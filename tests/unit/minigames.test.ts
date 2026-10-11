import { describe, expect, it } from "vitest";
import { HIT_WINDOW_MS, QUIZ, RHYTHM, beatMap, performanceScore, pickQuestions, quizPrize, quizScore, rhythmAccuracy, rhythmReward } from "@/content/minigames";

describe("quiz", () => {
  it("has unique ids and valid answers", () => {
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
    for (const q of QUIZ) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(new Set(q.options).size).toBe(4);
    }
  });
  it("picks five distinct questions deterministically per seed", () => {
    const a = pickQuestions("seed-1");
    expect(a).toHaveLength(5);
    expect(new Set(a.map((q) => q.id)).size).toBe(5);
    expect(pickQuestions("seed-1").map((q) => q.id)).toEqual(a.map((q) => q.id));
  });
  it("scores answers and pays by result", () => {
    const qs = pickQuestions("x");
    expect(quizScore(qs, qs.map((q) => q.answer))).toBe(5);
    expect(quizScore(qs, qs.map((q) => (q.answer + 1) % 4))).toBe(0);
    expect(quizScore(qs, ["junk", null])).toBe(0);
    expect(quizPrize(5).pence).toBeGreaterThan(quizPrize(4).pence);
    expect(quizPrize(2).pence).toBe(0);
  });
});

describe("rhythm", () => {
  const spec = RHYTHM.open_mic;
  const notes = beatMap("song", spec);
  it("builds an increasing beat map of the right length", () => {
    expect(notes).toHaveLength(spec.notes);
    for (let i = 1; i < notes.length; i++) expect(notes[i].t).toBeGreaterThan(notes[i - 1].t);
  });
  it("perfect taps score 1; nothing scores 0; off-lane or late taps miss", () => {
    expect(rhythmAccuracy(notes, notes).accuracy).toBe(1);
    expect(rhythmAccuracy(notes, []).accuracy).toBe(0);
    expect(rhythmAccuracy(notes, notes.map((n) => ({ t: n.t, lane: (n.lane + 1) % 3 }))).hits).toBeLessThan(notes.length / 2);
    expect(rhythmAccuracy(notes, notes.map((n) => ({ t: n.t + HIT_WINDOW_MS + 60, lane: n.lane }))).hits).toBeLessThan(notes.length);
  });
  it("spamming every lane constantly doesn't give a good score", () => {
    const spam = [];
    for (let t = 0; t < notes[notes.length - 1].t; t += 50) for (const lane of [0, 1, 2]) spam.push({ t, lane });
    expect(rhythmAccuracy(notes, spam).accuracy).toBeLessThan(0.5);
  });
  it("ignores malformed input", () => {
    expect(rhythmAccuracy(notes, "nope").accuracy).toBe(0);
    expect(rhythmAccuracy(notes, [{ t: "x", lane: 9 }]).accuracy).toBe(0);
  });
  it("skill adds a bounded share and rewards are capped", () => {
    expect(performanceScore(1, 10)).toBe(1);
    expect(performanceScore(0, 10)).toBe(0.25);
    expect(rhythmReward(spec, 1).pence).toBe(spec.maxPayPence);
    expect(rhythmReward(spec, 0.1).pence).toBe(0);
    expect(rhythmReward(RHYTHM.dance_battle, 0.6).pence).toBe(0);
    expect(rhythmReward(RHYTHM.dance_battle, 0.9).pence).toBe(RHYTHM.dance_battle.maxPayPence);
  });
});
