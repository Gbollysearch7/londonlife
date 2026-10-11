import crypto from "node:crypto";
import { QUIZ, QUIZ_SECONDS_PER_QUESTION, RHYTHM, RHYTHM_LEAD_MS, beatMap, performanceScore, pickQuestions, quizPrize, quizScore, rhythmAccuracy, rhythmReward, songLengthMs } from "@/content/minigames";
import type { ActivityDef } from "@/content/types";
import { activityDef } from "@/content/world";
import { levelForXp } from "@/sim/progression";
import { GameError, type Tx } from "./db";
import { completeActivity, requireCharacter, settle, type CharRow, type MinigameBonus } from "./game";

/** Real time allowed to play a minigame, independent of any development time scale. */
export const MINIGAME_WINDOW_MS = 3 * 60_000;

export async function createRun(tx: Tx, c: CharRow, activityId: string, def: ActivityDef, now: Date, expiresAt: Date) {
  await tx.query(
    `INSERT INTO minigame_runs (id, character_id, activity_id, kind, def_id, seed, status, started_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8)`,
    [crypto.randomUUID(), c.id, activityId, def.minigame, def.id, crypto.randomUUID(), now, expiresAt],
  );
}

async function skillLevel(tx: Tx, charId: string, skill: string) {
  const r = await tx.query("SELECT xp FROM skills WHERE character_id = $1 AND skill_id = $2", [charId, skill]);
  return levelForXp(Number(r.rows[0]?.xp ?? 0));
}

export async function submitMinigame(tx: Tx, accountId: string, p: { runId: string; answers?: unknown[]; taps?: unknown[] }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const run = (await tx.query("SELECT * FROM minigame_runs WHERE id = $1 AND character_id = $2 FOR UPDATE", [p.runId, c.id])).rows[0];
  if (!run) throw new GameError("no_run", "That game isn't yours or doesn't exist.");
  if (run.status === "submitted") throw new GameError("already_submitted", "You've already finished that one.");
  if (run.status !== "open" || new Date(run.expires_at) <= now) throw new GameError("expired", "Too late — that round has ended.");
  const act = (await tx.query("SELECT * FROM activities WHERE id = $1 AND status = 'running'", [run.activity_id])).rows[0];
  if (!act) throw new GameError("expired", "That round has already ended.");
  const def = activityDef(run.def_id)!;

  let bonus: MinigameBonus;
  let result: Record<string, unknown>;
  if (run.kind === "quiz") {
    const qs = pickQuestions(run.seed);
    const answers = Array.isArray(p.answers) ? p.answers.slice(0, qs.length) : [];
    const correct = quizScore(qs, answers);
    const prize = quizPrize(correct);
    bonus = { xpMult: 0.5 + correct / qs.length, pence: prize.pence, rep: prize.rep, stars: prize.stars, label: `${correct}/${qs.length} correct`, incomeLabel: `Quiz prize at ${def.label.replace("Take on the ", "")}`, moodlet: correct >= 4 ? "buzzing" : correct === 0 ? "embarrassed" : undefined };
    result = { kind: "quiz", correct, total: qs.length, answers, solutions: qs.map((q) => q.answer), pence: prize.pence, rep: prize.rep, stars: prize.stars, label: prize.label };
  } else {
    const spec = RHYTHM[run.def_id];
    const notes = beatMap(run.seed, spec);
    // A song can't be finished faster than it plays.
    if (now.getTime() - new Date(run.started_at).getTime() < songLengthMs(notes) * 0.8) throw new GameError("too_soon", "The song isn't over yet.");
    const { hits, accuracy } = rhythmAccuracy(notes, p.taps);
    const level = await skillLevel(tx, c.id, spec.skill);
    const score = performanceScore(accuracy, level);
    const reward = rhythmReward(spec, score);
    bonus = { xpMult: reward.xpMult, pence: reward.pence, rep: Math.round(score * 12), stars: 0, label: `${Math.round(score * 100)}% performance`, incomeLabel: `${spec.title} tips`, moodlet: score >= 0.6 ? "buzzing" : score < 0.25 ? "embarrassed" : undefined };
    result = { kind: "rhythm", hits, total: notes.length, accuracy, score, pence: reward.pence, label: reward.label };
  }
  const notices = await completeActivity(tx, c, act, now, bonus);
  await tx.query("UPDATE minigame_runs SET status = 'submitted', submitted_at = $2, score = $3, result = $4 WHERE id = $1", [run.id, now, Number(result.score ?? result.correct), result]);
  return { message: notices[0] ?? "Finished.", result };
}

/** The open minigame for the running activity, without answers. */
export async function minigameView(tx: Tx, c: CharRow, now: Date) {
  const run = (await tx.query("SELECT * FROM minigame_runs WHERE character_id = $1 AND status = 'open' AND expires_at > $2 ORDER BY started_at DESC LIMIT 1", [c.id, now])).rows[0];
  if (!run) return null;
  const def = activityDef(run.def_id)!;
  const base = { id: String(run.id), kind: run.kind as "quiz" | "rhythm", defId: def.id, title: def.label, startedAt: new Date(run.started_at).toISOString(), expiresAt: new Date(run.expires_at).toISOString() };
  if (run.kind === "quiz") {
    return { ...base, secondsPerQuestion: QUIZ_SECONDS_PER_QUESTION, questions: pickQuestions(run.seed).map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })), notes: null, lead: 0, bpm: 0 };
  }
  const spec = RHYTHM[run.def_id];
  return { ...base, secondsPerQuestion: 0, questions: null, notes: beatMap(run.seed, spec), lead: RHYTHM_LEAD_MS, bpm: spec.bpm };
}

export const QUIZ_SIZE = QUIZ.length;
