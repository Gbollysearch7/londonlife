"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

/** Daily check-in prompt, shown once per London day until claimed or dismissed. */
export function CheckInModal({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const c = s.goals.checkin;
  const key = `ll-checkin-dismissed-${s.day}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(key) === "1";
    } catch {
      /* storage unavailable */
    }
    setHidden(dismissed);
  }, [key]);
  // New arrivals get the tour first; the check-in prompt starts from their second day (it's always in Goals).
  const firstDay = new Date(s.character.createdAt).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) === s.day;
  if (c.claimedToday || hidden || s.minigame || firstDay) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable */
    }
    setHidden(true);
  };
  return (
    <div className={styles.modalScrim} role="dialog" aria-label="Daily check-in">
      <div className={styles.modal}>
        <span className={styles.kickerGold}>Daily check-in</span>
        <h2>Welcome back to London</h2>
        <p className="muted">
          {c.streak > 0 ? `You're on a ${c.streak}-day streak. Keep it going!` : "Check in every day for bigger rewards. Missing a day resets the streak."}
        </p>
        <ol className={styles.streak}>
          {c.cycle.map((r, i) => {
            const dayNo = i + 1;
            const cur = ((c.day - 1) % 7) + 1;
            return (
              <li key={i} className={dayNo < cur ? styles.streakDone : dayNo === cur ? styles.streakNow : ""}>
                <span className="tiny">Day {dayNo}</span>
                <strong>{money(r.pence)}</strong>
                {r.stars > 0 && <span className={styles.starTiny}>+{r.stars} ✦</span>}
              </li>
            );
          })}
        </ol>
        <div className={styles.quotes} style={{ justifyContent: "center" }}>
          <button className="btn secondary" onClick={dismiss}>
            Later
          </button>
          <button className="btn" autoFocus disabled={!!pending} onClick={() => run("DailyCheckIn", {}, "checkin")}>
            Claim day {c.day}: {money(c.todayReward.pence)}
            {c.todayReward.stars ? ` + ${c.todayReward.stars} ✦` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GoalsApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [changing, setChanging] = useState(false);
  const g = s.goals;
  const a = g.ambition;
  return (
    <>
      <section className={styles.workCard}>
        <div className={styles.workRow}>
          <div>
            <span className="tiny">Ambition</span>
            <h3 style={{ fontSize: 22 }}>{a.name}</h3>
          </div>
          <span className="chip gold">{Math.round(a.progress * 100)}%</span>
        </div>
        <p className={styles.actionDesc}>{a.blurb}</p>
        <div className={styles.bar}>
          <span style={{ width: `${Math.min(100, a.progress * 100)}%` }} />
        </div>
        <p className="tiny">{a.note}</p>
        <div className={styles.milestones}>
          {a.milestones.map((m) => (
            <button
              key={m.at}
              className={`${styles.milestone} ${m.claimed ? styles.milestoneDone : m.claimable ? styles.milestoneReady : ""}`}
              disabled={!m.claimable || !!pending}
              onClick={() => run("ClaimAmbition", { milestone: m.at }, "ambition")}
              aria-label={`${Math.round(m.at * 100)}% milestone: ${m.stars} stars${m.claimed ? ", claimed" : m.claimable ? ", ready to claim" : ""}`}
            >
              <strong>{Math.round(m.at * 100)}%</strong>
              <span>{m.claimed ? "✓" : `+${m.stars} ✦`}</span>
            </button>
          ))}
        </div>
        {changing ? (
          <div className={styles.quotes}>
            {a.options
              .filter((o) => o.id !== a.id)
              .map((o) => (
                <button key={o.id} className="btn small secondary" disabled={!!pending} onClick={async () => (await run("ChangeAmbition", { ambitionId: o.id }, "ambition")) && setChanging(false)}>
                  {o.name}
                </button>
              ))}
            <button className={styles.linkBtn} onClick={() => setChanging(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className={styles.linkBtn} style={{ color: "var(--ink-2)" }} disabled={!a.canChange} onClick={() => setChanging(true)}>
            {a.canChange ? "Change ambition (once a week)" : `Can change again ${new Date(a.changeReadyAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
          </button>
        )}
      </section>

      <h3 className={styles.subhead}>Today's wishes</h3>
      <ul className={styles.list}>
        {g.wishes.map((w) => (
          <li key={w.id} className={styles.action}>
            <div className={styles.actionMain}>
              <strong>{w.title}</strong>
              <div className={styles.bar}>
                <span style={{ width: `${(w.progress / w.target) * 100}%` }} />
              </div>
              <span className="tiny">
                {w.progress}/{w.target} · +{w.stars} ✦
              </span>
            </div>
            {w.claimed ? (
              <span className="chip good">Granted</span>
            ) : (
              <button className="btn small" disabled={!w.claimable || !!pending} onClick={() => run("ClaimWish", { wishId: w.id }, "wish")}>
                Claim
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="tiny">Wishes refresh at midnight. Spend stars in the Perks app.</p>

      <h3 className={styles.subhead}>Check-in streak</h3>
      <div className={styles.action}>
        <div className={styles.actionMain}>
          <strong>{g.checkin.streak}-day streak</strong>
          <span className="tiny">{g.checkin.claimedToday ? "Checked in today — see you tomorrow." : `Today: ${money(g.checkin.todayReward.pence)}${g.checkin.todayReward.stars ? ` + ${g.checkin.todayReward.stars} ✦` : ""}`}</span>
        </div>
        {!g.checkin.claimedToday && (
          <button className="btn small" disabled={!!pending} onClick={() => run("DailyCheckIn", {}, "checkin")}>
            Check in
          </button>
        )}
      </div>
    </>
  );
}

export function PerksApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  return (
    <>
      <div className={styles.balance} style={{ background: "#7b5a1d" }}>
        <span className="tiny">Stars to spend</span>
        <strong>✦ {s.character.stars}</strong>
      </div>
      <p className="tiny">Earn stars from wishes, missions, stories, ambitions, check-ins and perfect quizzes. Perks are permanent and never refunded.</p>
      <ul className={styles.list}>
        {s.goals.perks.map((p) => (
          <li key={p.id} className={`${styles.action} ${p.owned ? "" : !p.affordable ? styles.actionOff : ""}`}>
            <div className={styles.actionMain}>
              <strong>{p.name}</strong>
              <p className={styles.actionDesc}>{p.blurb}</p>
            </div>
            {p.owned ? (
              <span className="chip good">Owned</span>
            ) : (
              <button className="btn small" disabled={!p.affordable || !!pending} onClick={() => run("BuyPerk", { perkId: p.id }, "perk")} title={p.affordable ? undefined : `Needs ${p.stars - s.character.stars} more stars`}>
                ✦ {p.stars}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function PeopleApp({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const setMapFocus = useGame((x) => x.setMapFocus);
  return (
    <>
      <p className="tiny">These are named local characters (NPCs), not other players. Chat and spend time together to grow closer. Real players arrive with shared play.</p>
      <ul className={styles.list}>
        {s.goals.friends.map((f) => (
          <li key={f.id} className={styles.action}>
            <div className={styles.actionMain}>
              <div className={styles.actionTitle}>
                <strong>{f.name}</strong>
                <span className="chip">NPC</span>
                <span className={`chip ${f.level >= 4 ? "gold" : f.level >= 2 ? "good" : ""}`}>{f.title}</span>
              </div>
              <span className="tiny">
                {f.role.replace(" (NPC)", "")} · {f.venue}
              </span>
              <div className={styles.bar}>
                <span style={{ width: `${f.next ? Math.min(100, (f.points / f.next) * 100) : 100}%` }} />
              </div>
            </div>
            <button
              className="btn small secondary"
              onClick={() => {
                setMapFocus(f.venueId);
                setSheet("map");
              }}
            >
              Visit
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
