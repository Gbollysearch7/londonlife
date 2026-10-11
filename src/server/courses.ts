import { COURSES, courseDef } from "@/content/courses";
import { CLASSES_PER_DAY } from "@/content/world";
import type { ActivityDef } from "@/content/types";
import { londonDayKey } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { addXp, emit, requireCharacter, settle, type CharRow } from "./game";

/** Passing a lesson quiz needs at least two of the three answers right. */
export const PASS_MARK = 2;
export const LESSON_STARS = 1;
export const CERTIFICATE_STARS = 3;
/** Certified careers gain this much more performance per shift (the source advertised 15%). */
export const CERT_PERF_BONUS = 1.15;

export interface CourseRow {
  passed: number;
  pending: number | null;
  certified: boolean;
}

export async function courseRows(tx: Tx, charId: string): Promise<Record<string, CourseRow>> {
  const rows = (await tx.query("SELECT * FROM course_progress WHERE character_id = $1", [charId])).rows;
  return Object.fromEntries(rows.map((r) => [r.course_id, { passed: Number(r.lessons_passed), pending: r.pending_lesson === null ? null : Number(r.pending_lesson), certified: !!r.certified_at }]));
}

export async function classesToday(tx: Tx, charId: string, now: Date) {
  const r = await tx.query("SELECT count(*) AS n FROM activities WHERE character_id = $1 AND period_key = $2 AND def_id LIKE 'class\\_%' AND status IN ('running','completed')", [charId, londonDayKey(now)]);
  return Number(r.rows[0].n);
}

/** Course-specific reasons a class can't start (sequence, pending quiz, certificate, daily cap). */
export function classBlocker(def: ActivityDef, courses: Record<string, CourseRow>, today: number): string | null {
  if (!def.id.startsWith("class_")) return null;
  const id = def.id.slice(6);
  const row = courses[id];
  if (row?.certified) return "Certificate earned — course complete.";
  if (row?.pending) return `Take the lesson ${row.pending} quiz in the Courses app first.`;
  if (today >= CLASSES_PER_DAY) return `You've attended ${CLASSES_PER_DAY} classes today. Come back tomorrow.`;
  return null;
}

/** Called when a class activity completes: that lesson's quiz becomes available. */
export async function classAttended(tx: Tx, c: CharRow, courseId: string) {
  await tx.query(
    `INSERT INTO course_progress (character_id, course_id, lessons_passed, pending_lesson) VALUES ($1, $2, 0, 1)
     ON CONFLICT (character_id, course_id) DO UPDATE SET pending_lesson = course_progress.lessons_passed + 1
     WHERE course_progress.certified_at IS NULL`,
    [c.id, courseId],
  );
}

export async function submitLessonQuiz(tx: Tx, accountId: string, p: { courseId: string; answers: unknown[] }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const course = courseDef(p.courseId);
  if (!course) throw new GameError("bad_course", "Unknown course.");
  const row = (await tx.query("SELECT * FROM course_progress WHERE character_id = $1 AND course_id = $2 FOR UPDATE", [c.id, course.id])).rows[0];
  if (!row?.pending_lesson) throw new GameError("no_quiz", "Attend the next class first — the quiz follows the lesson.");
  const n = Number(row.pending_lesson);
  const lesson = course.lessons[n - 1];
  const answers = Array.isArray(p.answers) ? p.answers.slice(0, 3) : [];
  const correct = lesson.questions.reduce((k, q, i) => k + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const passed = correct >= PASS_MARK;
  const attempts = [...(row.attempts as unknown[]), { lesson: n, correct, at: now.toISOString() }];
  const result = { lesson: n, correct, total: 3, passed, solutions: lesson.questions.map((q) => q.answer), certified: false };
  if (!passed) {
    // A failed quiz means sitting the class again (it counts towards the daily class limit).
    await tx.query("UPDATE course_progress SET pending_lesson = NULL, attempts = $3 WHERE character_id = $1 AND course_id = $2", [c.id, course.id, JSON.stringify(attempts)]);
    return { message: `${correct}/3 — not quite. Attend lesson ${n} again to retake the quiz.`, result };
  }
  const certified = n === course.lessons.length;
  await tx.query("UPDATE course_progress SET lessons_passed = $3, pending_lesson = NULL, attempts = $4, certified_at = $5 WHERE character_id = $1 AND course_id = $2", [
    c.id,
    course.id,
    n,
    JSON.stringify(attempts),
    certified ? now : null,
  ]);
  const stars = LESSON_STARS + (certified ? CERTIFICATE_STARS : 0);
  await tx.query("UPDATE characters SET stars = stars + $2 WHERE id = $1", [c.id, stars]);
  c.stars += stars;
  const xp = await addXp(tx, c, course.skill, 25, now);
  await emit(tx, c.id, "lesson_passed", { course: course.id }, now);
  if (certified) await emit(tx, c.id, "certified", { course: course.id }, now);
  result.certified = certified;
  return {
    message: certified
      ? `Certificate earned: ${course.name}! +${stars} stars, and ${course.career} shifts now build performance faster.`
      : `Lesson ${n} passed (${correct}/3). +${LESSON_STARS} star, ${xp.skill} +${xp.gained} XP.`,
    result,
  };
}

export async function coursesView(tx: Tx, c: CharRow, now: Date) {
  const rows = await courseRows(tx, c.id);
  const today = await classesToday(tx, c.id, now);
  return {
    classesToday: today,
    classesPerDay: CLASSES_PER_DAY,
    list: COURSES.map((course) => {
      const r = rows[course.id] ?? { passed: 0, pending: null, certified: false };
      const readable = Math.min(course.lessons.length, r.passed + (r.pending ? 1 : 0));
      return {
        id: course.id,
        name: course.name,
        blurb: course.blurb,
        skill: course.skill,
        career: course.career,
        feePence: course.feePence,
        passed: r.passed,
        total: course.lessons.length,
        certified: r.certified,
        lessons: course.lessons.map((l, i) => ({ n: i + 1, title: l.title, notes: i < readable ? l.notes : null })),
        quiz: r.pending
          ? { lesson: r.pending, title: course.lessons[r.pending - 1].title, questions: course.lessons[r.pending - 1].questions.map((q) => ({ prompt: q.prompt, options: q.options })) }
          : null,
      };
    }),
  };
}

/** Career ids with a matching certificate. */
export async function certifiedCareers(tx: Tx, charId: string) {
  const rows = await courseRows(tx, charId);
  return COURSES.filter((k) => rows[k.id]?.certified).map((k) => k.career);
}
