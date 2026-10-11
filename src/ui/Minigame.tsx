"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { scheduleSong, sfx } from "@/client/sound";
import { money } from "./format";
import styles from "./minigame.module.css";
import { FocusScope } from "./a11y";

type Run = NonNullable<State["minigame"]>;

interface QuizResult {
  kind: "quiz";
  correct: number;
  total: number;
  answers: (number | null)[];
  solutions: number[];
  pence: number;
  rep: number;
  stars: number;
  label: string;
}
interface RhythmResult {
  kind: "rhythm";
  hits: number;
  total: number;
  accuracy: number;
  score: number;
  pence: number;
  label: string;
}
type Result = (QuizResult & { questions?: { prompt: string; options: string[] }[] }) | RhythmResult;

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className={styles.leaveAsk}>
      Leave now? You won't earn anything.
      <button className="btn small danger" onClick={onLeave}>
        Leave
      </button>
      <button className="btn small secondary" onClick={() => setAsk(false)}>
        Stay
      </button>
    </span>
  ) : (
    <button className={styles.leave} onClick={() => setAsk(true)}>
      Leave
    </button>
  );
}

function Quiz({ run, onDone }: { run: Run; onDone: (r: Result | null) => void }) {
  const runCmd = useGame((x) => x.run);
  const qs = run.questions ?? [];
  const [idx, setIdx] = useState(-1);
  const [failed, setFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Questions arrive from the server only once the round has begun.
  useEffect(() => {
    if (run.questions && idx < 0 && run.begunAt) setIdx(0);
  }, [run.questions, run.begunAt, idx]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(run.secondsPerQuestion);
  const submitting = useRef(false);

  const submit = async (all: (number | null)[]) => {
    if (submitting.current) return;
    submitting.current = true;
    setFailed(false);
    const r = await runCmd("SubmitMinigame", { runId: run.id, answers: all }, "quiz");
    if (r && r.result) onDone({ ...(r.result as QuizResult), questions: qs } as Result);
    else {
      submitting.current = false;
      setFailed(true);
    }
  };

  const choose = (choice: number | null) => {
    if (picked !== null && choice !== null) return;
    setPicked(choice ?? -1);
    sfx(choice === null ? "miss" : "click");
    const next = [...answers, choice];
    timers.current.push(setTimeout(() => {
      setAnswers(next);
      setPicked(null);
      setLeft(run.secondsPerQuestion);
      if (next.length >= qs.length) void submit(next);
      else setIdx(next.length);
    }, 450));
  };

  useEffect(() => {
    if (idx < 0 || picked !== null || answers.length >= qs.length) return;
    if (left <= 0) {
      choose(null);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (idx < 0) return;
      const n = ["1", "2", "3", "4"].indexOf(e.key);
      if (n >= 0) choose(n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (idx < 0)
    return (
      <div className={styles.intro}>
        <p className={styles.kicker}>Pub quiz</p>
        <h2>Five London questions</h2>
        <p className="muted">{run.secondsPerQuestion} seconds each. Get all five for the top prize and a star.</p>
        <button
          className="btn"
          autoFocus
          onClick={() => {
            sfx("start");
            void runCmd("BeginMinigame", { runId: run.id }, "begin");
          }}
        >
          Start the quiz
        </button>
      </div>
    );
  if (answers.length >= qs.length)
    return (
      <div className={styles.intro}>
        {failed ? (
          <>
            <p className="muted">Your answers didn't go through.</p>
            <button className="btn" onClick={() => void submit(answers)}>
              Try again
            </button>
          </>
        ) : (
          <p className="muted">Sam is marking your answers…</p>
        )}
      </div>
    );
  const q = qs[idx];
  return (
    <div className={styles.quiz}>
      <div className={styles.quizHead}>
        <span className={styles.kicker}>
          Question {idx + 1} of {qs.length}
        </span>
        <span className={`${styles.timer} ${left <= 5 ? styles.timerLow : ""}`} aria-live="polite">
          {left}s
        </span>
      </div>
      <div className={styles.timeBar}>
        <span style={{ width: `${(left / run.secondsPerQuestion) * 100}%` }} />
      </div>
      <h2 className={styles.prompt}>{q.prompt}</h2>
      <div className={styles.options}>
        {q.options.map((o, i) => (
          <button key={i} className={`${styles.option} ${picked === i ? styles.optionPicked : ""}`} disabled={picked !== null} onClick={() => choose(i)}>
            <span className={styles.optionKey}>{i + 1}</span>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const LANE_KEYS = [
  ["a", "j", "arrowleft"],
  ["s", "k", "arrowdown"],
  ["d", "l", "arrowright"],
];
const APPROACH = 1600;

function Rhythm({ run, onDone }: { run: Run; onDone: (r: Result | null) => void }) {
  const runCmd = useGame((x) => x.run);
  const notes = run.notes ?? [];
  const [phase, setPhase] = useState<"intro" | "count" | "play" | "submit" | "retry">("intro");
  const [count, setCount] = useState(3);
  const [combo, setCombo] = useState(0);
  const [judge, setJudge] = useState<{ text: string; n: number } | null>(null);
  const start = useRef(0);
  const taps = useRef<{ t: number; lane: number }[]>([]);
  const hit = useRef(new Uint8Array(notes.length));
  const noteEls = useRef<(HTMLDivElement | null)[]>([]);
  const laneEls = useRef<(HTMLButtonElement | null)[]>([]);
  const notesBox = useRef<HTMLDivElement>(null);
  const stopSong = useRef<() => void>(() => {});
  const end = notes.length ? notes[notes.length - 1].t + 1200 : 0;
  // The beat map arrives once the round has begun; then the countdown and guide melody start together.
  useEffect(() => {
    if (phase === "intro" && run.begunAt && notes.length) {
      stopSong.current = scheduleSong(notes, run.bpm, 2100);
      setPhase("count");
    }
  }, [run.begunAt, notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (lane: number) => {
    if (phase !== "play") return;
    const t = performance.now() - start.current;
    taps.current.push({ t: Math.round(t), lane });
    const el = laneEls.current[lane];
    if (el) {
      el.classList.remove(styles.flash);
      void el.offsetWidth;
      el.classList.add(styles.flash);
    }
    let best = -1;
    let bestD = 151;
    notes.forEach((n, i) => {
      if (hit.current[i] || n.lane !== lane) return;
      const d = Math.abs(n.t - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      hit.current[best] = 1;
      sfx("hit");
      setCombo((c) => c + 1);
      setJudge({ text: bestD < 60 ? "Perfect!" : "Good", n: Date.now() });
    } else {
      sfx("miss");
      setCombo(0);
      setJudge({ text: "Miss", n: Date.now() });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const lane = LANE_KEYS.findIndex((ks) => ks.includes(e.key.toLowerCase()));
      if (lane >= 0) {
        e.preventDefault();
        tap(lane);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (phase !== "count") return;
    if (count <= 0) {
      start.current = performance.now();
      setPhase("play");
      return;
    }
    sfx("click");
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const loop = () => {
      const t = performance.now() - start.current;
      const H = notesBox.current?.clientHeight ?? 300;
      notes.forEach((n, i) => {
        const el = noteEls.current[i];
        if (!el) return;
        const dt = n.t - t;
        if (dt > APPROACH || dt < -250 || hit.current[i]) {
          el.style.opacity = "0";
          return;
        }
        el.style.opacity = "1";
        el.style.transform = `translateY(${(1 - dt / APPROACH) * H}px)`;
      });
      if (t > end) {
        setPhase("submit");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "submit") return;
    stopSong.current();
    void (async () => {
      const r = await runCmd("SubmitMinigame", { runId: run.id, taps: taps.current }, "rhythm");
      if (r && r.result) onDone(r.result as Result);
      else setPhase("retry");
    })();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopSong.current(), []);

  if (phase === "intro")
    return (
      <div className={styles.intro}>
        <p className={styles.kicker}>{run.title}</p>
        <h2>Hit the notes on the line</h2>
        <p className="muted">
          Tap the lanes or press <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd>). Timing earns tips; your skill level helps too.
        </p>
        <button
          className="btn"
          autoFocus
          onClick={() => void runCmd("BeginMinigame", { runId: run.id }, "begin")}
        >
          I'm ready
        </button>
      </div>
    );
  return (
    <div className={styles.rhythm}>
      <div className={styles.rhythmHead}>
        <span className={styles.kicker}>{run.title}</span>
        <span>
          Combo <strong>{combo}</strong>
        </span>
      </div>
      <div className={styles.stage}>
        {[0, 1, 2].map((lane) => (
          <button
            key={lane}
            ref={(el) => void (laneEls.current[lane] = el)}
            className={styles.lane}
            onPointerDown={(e) => {
              e.preventDefault();
              tap(lane);
            }}
            aria-label={`Lane ${lane + 1}`}
          >
            <span className={styles.hitLine} />
            <span className={styles.laneKey}>{["A", "S", "D"][lane]}</span>
          </button>
        ))}
        <div className={styles.notes} ref={notesBox} aria-hidden>
          {notes.map((n, i) => (
            <div key={i} ref={(el) => void (noteEls.current[i] = el)} className={`${styles.note} ${styles[`lane${n.lane}`]}`} style={{ left: `${n.lane * 33.33}%`, opacity: 0 }} />
          ))}
        </div>
        {phase === "count" && <div className={styles.count}>{count || "Go!"}</div>}
        {judge && phase === "play" && (
          <div key={judge.n} className={`${styles.judge} ${judge.text === "Miss" ? styles.judgeMiss : ""}`}>
            {judge.text}
          </div>
        )}
        {phase === "submit" && <div className={styles.count}>…</div>}
        {phase === "retry" && (
          <div className={styles.count} style={{ pointerEvents: "auto" }}>
            <button className="btn" onClick={() => setPhase("submit")}>
              Send my performance again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Results({ r, onClose }: { r: Result; onClose: () => void }) {
  return (
    <div className={styles.intro}>
      <p className={styles.kicker}>{r.kind === "quiz" ? "Final score" : "Performance"}</p>
      <h2 className={styles.big}>{r.kind === "quiz" ? `${r.correct} / ${r.total}` : `${Math.round(r.score * 100)}%`}</h2>
      <p>{r.label}</p>
      {r.kind === "quiz" && r.questions && (
        <ol className={styles.review}>
          {r.questions.map((q, i) => {
            const ok = r.answers[i] === r.solutions[i];
            return (
              <li key={i} className={ok ? styles.right : styles.wrong}>
                <span aria-hidden>{ok ? "✓" : "✗"}</span>
                <div>
                  <strong>{q.prompt}</strong>
                  <span className="tiny">{ok ? q.options[r.solutions[i]] : `Answer: ${q.options[r.solutions[i]]}`}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {r.kind === "rhythm" && (
        <p className="tiny">
          {r.hits} of {r.total} notes hit
        </p>
      )}
      <div className={styles.prizes}>
        {r.pence > 0 && <span className="chip good">+{money(r.pence)}</span>}
        {r.kind === "quiz" && r.rep > 0 && <span className="chip">+{r.rep} reputation</span>}
        {r.kind === "quiz" && r.stars > 0 && <span className="chip gold">+{r.stars} ✦</span>}
        {r.pence === 0 && <span className="chip">No prize this time</span>}
      </div>
      <button className="btn" autoFocus onClick={onClose}>
        Back to London
      </button>
    </div>
  );
}

/** Full-screen minigame layer shown while a minigame activity is running. */
export function MinigameOverlay({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const [result, setResult] = useState<Result | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const active = s.minigame;
  useEffect(() => {
    if (active && active.id !== runId) {
      setRunId(active.id);
      setResult(null);
    }
  }, [active, runId]);
  if (result)
    return (
      <FocusScope trap>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Results">
        <div className={styles.panel}>
          <Results r={result} onClose={() => setResult(null)} />
        </div>
      </div>
      </FocusScope>
    );
  if (!active) return null;
  return (
    <FocusScope trap focusKey={active.id}>
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={active.title}>
      <div className={styles.panel}>
        <LeaveButton onLeave={() => run("CancelActivity", {}, "cancel")} />
        {active.kind === "quiz" ? (
          <Quiz key={active.id} run={active} onDone={(r) => r && setResult(r)} />
        ) : (
          <Rhythm key={active.id} run={active} onDone={(r) => r && setResult(r)} />
        )}
      </div>
    </div>
    </FocusScope>
  );
}
