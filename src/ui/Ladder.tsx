"use client";
import type { State } from "@/client/api";
import styles from "./ui.module.css";
import d from "./draughts.module.css";

const londonTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** This week's ladder per venue, your games and whether they counted, and the Hall of Fame. */
export function LadderSection({ s }: { s: State }) {
  const l = s.ladder;
  return (
    <>
      <h3 className={styles.subhead}>Weekly ladder · {l.weekLabel}</h3>
      <p className="tiny">Friendly only: points and a champion badge, never money. Closes {londonTime(l.endsAt)} London time.</p>
      {l.boards.map((b) => (
        <section key={b.venueId} className={styles.workCard} style={{ marginBottom: 8 }}>
          <div className={styles.workRow}>
            <strong>{b.venue}</strong>
            {b.you ? <span className="chip">You: #{b.you.rank} · {b.you.points} pts</span> : b.here ? <span className="chip">You're here</span> : null}
          </div>
          {b.top.length ? (
            <table className={d.drTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>W–D</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {b.top.map((r) => (
                  <tr key={r.rank} className={r.you ? d.drYou : ""}>
                    <td>{r.rank}</td>
                    <td>
                      {r.name}
                      {r.you ? " (you)" : ""}
                    </td>
                    <td>
                      {r.wins}–{r.draws}
                    </td>
                    <td>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No ladder games here yet this week. Win a friendly game at a table to get on the board.
            </p>
          )}
        </section>
      ))}

      {l.recent.length > 0 && (
        <>
          <h3 className={styles.subhead}>Your ladder games this week</h3>
          <ul className={styles.ledger}>
            {l.recent.map((r) => (
              <li key={r.tableId}>
                <div>
                  <strong>
                    {r.game} v {r.opponent}
                  </strong>
                  <span className="tiny">{r.note ?? r.venue}</span>
                </div>
                <span className={r.points > 0 ? styles.pos : ""}>{r.counted ? `+${r.points} pts` : "Didn't count"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={styles.subhead}>Hall of Fame</h3>
      {l.hallOfFame.some((w) => w.champions.length) ? (
        <ul className={styles.ledger}>
          {l.hallOfFame
            .filter((w) => w.champions.length)
            .map((w) =>
              w.champions.map((c) => (
                <li key={`${w.weekKey}-${c.venue}`}>
                  <div>
                    <strong>
                      {c.name}
                      {c.you ? " (you)" : ""}
                    </strong>
                    <span className="tiny">
                      {c.venue} · {w.label}
                    </span>
                  </div>
                  <span className="chip gold">
                    {c.points} pts · {c.wins}W
                  </span>
                </li>
              )),
            )}
        </ul>
      ) : (
        <p className="muted">No champions yet. Each week's top player at a venue appears here.</p>
      )}
      <details>
        <summary className="tiny">How the ladder works</summary>
        <ul className="tiny">
          {l.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

/** Cosmetic champion badges for the profile. */
export function LadderBadges({ s }: { s: State }) {
  const badges = s.ladder?.badges ?? [];
  if (!badges.length) return null;
  return (
    <section className={styles.group}>
      <h3>Table titles</h3>
      <div className={d.drBadges}>
        {badges.slice(0, 6).map((b) => (
          <span key={`${b.weekKey}-${b.venue}`} className={d.drBadge} title={`Top of the ${b.venue} ladder, ${b.label}`}>
            ♛ {b.title} · {b.label}
          </span>
        ))}
      </div>
    </section>
  );
}
