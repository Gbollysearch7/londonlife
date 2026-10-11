"use client";
import { useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Staff phone app: household staff, weekly household bills, outage notices and house parties. */
export function StaffApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const h = s.household;
  const chef = h.staff.find((x) => x.id === "chef");
  return (
    <>
      <section className={styles.workCard}>
        <div className={styles.workRow}>
          <strong>Household bills</strong>
          <span className="chip">{money(h.utilitiesPence + h.wagesPence)} / week</span>
        </div>
        <p className={styles.actionDesc}>
          Energy and water {money(h.utilitiesPence)}
          {h.wagesPence ? ` + staff wages ${money(h.wagesPence)}` : ""}, paid every Saturday at 09:00 with rent (wallet first, then savings). Owned homes still pay energy and water. Next: {when(h.nextBillAt)}.
        </p>
      </section>

      {h.outage && h.outage.state !== "over" && (
        <div className={styles.warning} style={{ marginBottom: 10 }} data-testid="outage-notice">
          <strong>
            {h.outage.state === "active" ? `${h.outage.name} now` : `Planned ${h.outage.name.toLowerCase()}`}: {h.outage.when}.
          </strong>{" "}
          {h.outage.blurb} {h.outage.recovery} <span className="tiny">(A fictional game event.)</span>
        </div>
      )}

      <h3 className={styles.subhead}>Household staff</h3>
      <p className="tiny">
        First wages cover the days until Saturday 09:00; after that, wages join your weekly bills. Wages already paid aren&apos;t refunded if you let staff go. If wages can&apos;t be paid, staff leave (you owe nothing more). Staff are fictional NPCs, not players.
      </p>
      <ul className={styles.list}>
        {h.staff.map((st) => (
          <li key={st.id} className={styles.workCard} data-testid={`staff-${st.id}`}>
            <div className={styles.workRow}>
              <strong>{st.name}</strong>
              <span className={`chip ${st.hired ? "good" : ""}`}>{st.hired ? "Working for you" : `${money(st.wagePence)} / week`}</span>
            </div>
            <p className={styles.actionDesc}>
              {st.services} {st.blurb}
            </p>
            {st.hired ? (
              confirm === `fire:${st.id}` ? (
                <div className={styles.confirm}>
                  <span>Let your {st.name.toLowerCase()} go? Wages already paid aren&apos;t refunded.</span>
                  <div>
                    <button className="btn small secondary" onClick={() => setConfirm(null)}>
                      Keep
                    </button>
                    <button className="btn small" disabled={!!pending} onClick={async () => (await run("FireStaff", { role: st.id }, "staff")) && setConfirm(null)}>
                      Let go
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn small secondary" disabled={!!pending} onClick={() => setConfirm(`fire:${st.id}`)}>
                  Let go
                </button>
              )
            ) : !st.eligible ? (
              <span className="tiny">Not enough room in your current home.</span>
            ) : confirm === `hire:${st.id}` ? (
              <div className={styles.confirm}>
                <span>
                  Hire for {money(st.firstWagesPence)} now (to Saturday), then {money(st.wagePence)} every week?
                </span>
                <div>
                  <button className="btn small secondary" onClick={() => setConfirm(null)}>
                    Not now
                  </button>
                  <button className="btn small" disabled={!!pending} onClick={async () => (await run("HireStaff", { role: st.id }, "staff")) && setConfirm(null)}>
                    Hire · {money(st.firstWagesPence)}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn small" disabled={!!pending || s.wallet.cashPence < st.firstWagesPence || s.bank.unpaidCount > 0} onClick={() => setConfirm(`hire:${st.id}`)}>
                Hire · {money(st.firstWagesPence)} first wages
              </button>
            )}
            {st.id === "chef" && st.hired && (
              <div className={styles.quotes} style={{ marginTop: 8 }}>
                <span className="tiny">
                  Meals today: {h.chef.mealsToday}/{h.chef.max}
                </span>
                <button
                  className="btn small"
                  disabled={!!pending || h.chef.mealsToday >= h.chef.max || s.character.location !== "home" || !!s.journey}
                  onClick={() => run("CollectChefMeal", {}, "chef")}
                >
                  {s.character.location !== "home" ? "Collect at home" : h.chef.mealsToday >= h.chef.max ? "Back tomorrow" : "Collect a meal"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {chef && !chef.eligible && <p className="tiny">A chef needs a one-bedroom flat or bigger (Homes app).</p>}

      <h3 className={styles.subhead}>House party</h3>
      <section className={styles.workCard} data-testid="party-card">
        {h.party.hasSpeakers ? (
          <p className={styles.actionDesc}>
            Throw a party from your speakers at home between 17:00 and 02:00, once a night. Pay £20 for snacks, or use 3 snack bars, 2 bread and 3 tea bags from your cupboard.
          </p>
        ) : (
          <p className={styles.actionDesc}>Buy Party Speakers (Fun, in the Buy menu) and place them at home to throw house parties.</p>
        )}
        <span className="tiny">
          {h.party.guests.length
            ? `Would come (NPC locals, not players): ${h.party.guests.map((g) => g.name).join(", ")}.`
            : "No NPC friends yet: spend time with locals until you're Friends and they'll come."}
        </span>
        {h.party.thrownTonight && <span className="chip good">Party thrown tonight</span>}
        {h.party.last && (
          <span className="tiny">
            Last party {when(h.party.last.at)}
            {h.party.last.guests.length ? ` with ${h.party.last.guests.join(", ")} (NPCs)` : " (a quiet one)"}.
          </span>
        )}
      </section>
    </>
  );
}
