"use client";
import { useEffect, useState } from "react";
import { SHIFT } from "@/content/careers";
import { serverNow, useGame } from "@/client/store";
import type { State } from "@/client/api";
import { countdown, money } from "./format";
import styles from "./ui.module.css";

type Shift = NonNullable<State["shift"]>;

/** The live work session: time, earnings, style, job tasks and a costed early exit. */
export function ShiftPanel({ s, shift }: { s: State; shift: Shift }) {
  const run = useGame((x) => x.run);
  const refresh = useGame((x) => x.refresh);
  const pending = useGame((x) => x.pending);
  const [now, setNow] = useState(serverNow());
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(true);
  const start = new Date(shift.startedAt).getTime();
  const end = new Date(shift.endsAt).getTime();
  const minPaid = new Date(shift.minPaidAt).getTime();

  useEffect(() => {
    let lastTaskCount = shift.tasks.length;
    const t = setInterval(() => {
      const n = serverNow();
      setNow(n);
      // Refresh when the shift ends or a new task is due, so the server shows it.
      const due = shift.taskCount > lastTaskCount && n >= start + ((end - start) / SHIFT.minutes) * SHIFT.taskMinutes[lastTaskCount];
      if (n >= end || due) {
        lastTaskCount++;
        refresh();
      }
    }, 500);
    return () => clearInterval(t);
  }, [shift.id, shift.tasks.length, shift.taskCount, start, end, refresh]);

  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const task = shift.tasks.find((t) => t.answer === null && new Date(t.expiresAt).getTime() > now);
  const handled = shift.tasks.filter((t) => t.answer !== null).length;
  const elapsedFraction = Math.min(1, (now - start) / (end - start));
  const earnedEstimate = now < minPaid ? 0 : Math.round(shift.salaryPence * elapsedFraction);

  return (
    <div className={styles.shift} role="region" aria-label="Work shift">
      <button className={styles.shiftHead} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="tiny">{shift.careerName} shift</span>
          <strong>{shift.title}</strong>
        </span>
        <span className={styles.shiftClock} data-testid="countdown">
          {now >= end ? "Finishing…" : countdown(end - now)}
        </span>
      </button>
      <div className={styles.bar}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {open && (
        <>
          <div className={styles.shiftStats}>
            <span>
              <span className="tiny">Earned so far</span>
              <strong>{money(earnedEstimate)}</strong>
            </span>
            <span>
              <span className="tiny">Full shift</span>
              <strong>{money(shift.salaryPence)}</strong>
            </span>
            <span>
              <span className="tiny">Performance</span>
              <strong>{shift.performanceNow}</strong>
            </span>
            <span>
              <span className="tiny">Tasks</span>
              <strong>
                {handled}/{shift.taskCount}
              </strong>
            </span>
          </div>

          {task ? (
            <div className={styles.task} role="group" aria-label="Work task">
              <div className={styles.taskHead}>
                <strong>{task.prompt}</strong>
                <span className="tiny">{countdown(new Date(task.expiresAt).getTime() - now)} left</span>
              </div>
              <div className={styles.taskOpts}>
                {task.options.map((o, i) => (
                  <button key={i} className="btn small secondary" disabled={!!pending} onClick={() => run("SubmitWorkTask", { index: task.index, choice: i }, "task")}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="tiny">{handled < shift.taskCount ? "Your next task will pop up here. Good answers add pay and performance." : "All tasks done for this shift."}</p>
          )}

          <div className={styles.styles} role="radiogroup" aria-label="Work style">
            {Object.entries(s.career.styles).map(([id, st]) => (
              <button
                key={id}
                role="radio"
                aria-checked={shift.style === id}
                className={`${styles.styleBtn} ${shift.style === id ? styles.styleOn : ""}`}
                disabled={!!pending}
                onClick={() => run("SetWorkStyle", { style: id }, "style")}
                title={`${st.blurb} Per hour: performance +${st.perf}, energy ${st.energy}, fun ${st.fun}${st.social ? `, social +${st.social}` : ""}.`}
              >
                <strong>{st.name}</strong>
                <span className="tiny">
                  Perf +{st.perf}/h · Energy {st.energy}
                  {st.social ? ` · Social +${st.social}` : ""}
                </span>
              </button>
            ))}
          </div>

          {leaving ? (
            <div className={styles.confirm}>
              <span>
                {now < minPaid
                  ? "Leaving now pays nothing: shifts pay after 6 minutes."
                  : `You'll be paid about ${money(earnedEstimate)} before tax for the time worked.`}{" "}
                An early exit doesn't count towards promotion{shift.promotionAtStake ? ", and this shift could earn your promotion" : ""}.
              </span>
              <div>
                <button className="btn small secondary" onClick={() => setLeaving(false)}>
                  Keep working
                </button>
                <button className="btn small danger" disabled={!!pending} onClick={() => run("LeaveShift", {}, "leave")}>
                  Leave now
                </button>
              </div>
            </div>
          ) : (
            <button className={styles.linkBtn} onClick={() => setLeaving(true)}>
              Leave early
            </button>
          )}
        </>
      )}
      {s.timeScale > 1 && <span className="tiny">Test speed ×{s.timeScale}</span>}
    </div>
  );
}
