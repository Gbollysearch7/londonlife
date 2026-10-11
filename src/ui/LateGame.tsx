"use client";
import { useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

function Confirm({ text, yes, onYes, onNo, disabled }: { text: string; yes: string; onYes: () => void; onNo: () => void; disabled: boolean }) {
  return (
    <div className={styles.confirm}>
      <span>{text}</span>
      <div>
        <button className="btn small secondary" onClick={onNo}>
          Cancel
        </button>
        <button className="btn small" disabled={disabled} onClick={onYes}>
          {yes}
        </button>
      </div>
    </div>
  );
}

/** Phone badges: claims waiting, pets needing care, vehicles off the road. */
export function lateBadge(app: string, s: State): number {
  if (app === "insurance") return s.insurance.incidents.filter((e) => e.claimable).length;
  if (app === "pets") return s.pets.list.filter((p) => p.needsCare).length;
  if (app === "vehicles") return s.garage.vehicles.filter((v) => v.owedPence > 0).length;
  return 0;
}

// ───────────────────────────── Vehicles ─────────────────────────────

export function VehiclesApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [colours, setColours] = useState<Record<string, string>>({});
  const g = s.garage;
  const full = g.vehicles.length >= g.maxOwned;
  return (
    <>
      <p className="tiny">
        A bicycle or scooter adds a free <strong>Cycle</strong> option to the travel menu; a car adds <strong>Drive</strong>, faster than the bus for a small fuel or charge cost. Vehicles travel with you and stay where you leave them. Upkeep (insurance, parking and charging folded in) is charged every Saturday at 09:00 with rent. Prices are fictional.
      </p>
      <h3 className={styles.subhead}>
        Your vehicles · {g.vehicles.length}/{g.maxOwned}
      </h3>
      {g.vehicles.length === 0 && <p className="muted">You don't own a vehicle yet.</p>}
      <ul className={styles.list}>
        {g.vehicles.map((v) => (
          <li key={v.id} className={styles.workCard} data-testid="vehicle">
            <div className={styles.workRow}>
              <strong>
                <span className={styles.sw} style={{ background: v.colour, display: "inline-block", width: 14, height: 14, verticalAlign: "middle", marginRight: 6 }} aria-hidden />
                {v.name}
              </strong>
              {v.usableHere ? <span className="chip good">Ready here</span> : <span className="chip">{v.delivered ? v.locationName : "On its way"}</span>}
            </div>
            <div>
              <div className={styles.workRow}>
                <span className="tiny">Condition</span>
                <span className="tiny">{v.condition}%</span>
              </div>
              <div className={styles.bar}>
                <span style={{ width: `${v.condition}%`, background: v.condition < g.minCondition ? "#bc3d3b" : undefined }} />
              </div>
            </div>
            <span className="tiny">
              {v.trips} trip{v.trips === 1 ? "" : "s"} · upkeep {money(v.upkeepPence)} / week{v.tripPence ? ` · ${money(v.tripPence)} a trip` : " · free to ride"} · resale {money(v.resalePence)}
            </span>
            {v.reason && <p className={styles.reason}>{v.reason}</p>}
            {v.owedPence > 0 && (
              <button className="btn small" disabled={!!pending || v.owedPence > s.wallet.cashPence} onClick={() => run("PayVehicleUpkeep", { vehicleId: v.id }, "upkeep")}>
                Pay overdue upkeep · {money(v.owedPence)}
              </button>
            )}
            {confirm === `sell:${v.id}` ? (
              <Confirm
                text={`Sell your ${v.name.toLowerCase()} for ${money(Math.max(0, v.resalePence - v.owedPence))}? Resale is 60% of the price paid when in perfect condition, less for wear.`}
                yes="Sell"
                disabled={!!pending}
                onNo={() => setConfirm(null)}
                onYes={async () => (await run("SellVehicle", { vehicleId: v.id }, "sell")) && setConfirm(null)}
              />
            ) : (
              <div className={styles.quotes}>
                <button
                  className="btn small secondary"
                  disabled={!!pending || v.inUse || v.servicePence === 0 || v.servicePence > s.wallet.cashPence}
                  onClick={() => run("ServiceVehicle", { vehicleId: v.id }, "service")}
                  title="A mobile mechanic restores it to 100%"
                >
                  {v.servicePence ? `Service · ${money(v.servicePence)}` : "Serviced"}
                </button>
                <button className="btn small secondary" disabled={!!pending || v.inUse} onClick={() => setConfirm(`sell:${v.id}`)}>
                  Sell
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {g.vehicles.length > 0 && <p className="tiny">Below {g.minCondition}% a vehicle is unsafe and can't be used until it's serviced. Next upkeep: {when(g.nextChargeAt)}.</p>}

      <h3 className={styles.subhead}>Buy · delivered to your home</h3>
      <ul className={styles.list}>
        {g.catalogue.map((d) => {
          const colour = colours[d.id] ?? d.colours[0];
          return (
            <li key={d.id} className={styles.workCard}>
              <div className={styles.workRow}>
                <strong>{d.name}</strong>
                <span className="chip">{money(d.pricePence)}</span>
              </div>
              <p className={styles.actionDesc}>{d.blurb}</p>
              <span className="tiny">
                {d.mode === "cycle" ? "Cycle" : "Drive"} · {Math.round((1 / d.speed) * 10) / 10}× walking speed · {d.tripPence ? `${money(d.tripPence)} a trip` : "free trips"} · upkeep {money(d.upkeepPence)} / week · resale from {money(d.resalePence)}
              </span>
              <div className={styles.swatches}>
                {d.colours.map((c) => (
                  <button key={c} aria-label={`Colour ${c}`} aria-pressed={colour === c} className={`${styles.sw} ${colour === c ? styles.swOn : ""}`} style={{ background: c }} onClick={() => setColours({ ...colours, [d.id]: c })} />
                ))}
              </div>
              {confirm === `buy:${d.id}` ? (
                <Confirm
                  text={`Buy a ${d.name.toLowerCase()} for ${money(d.pricePence)}? It's delivered to your home in about ${g.deliveryMinutes} minutes, and upkeep of ${money(d.upkeepPence)} is charged every Saturday.`}
                  yes={`Buy for ${money(d.pricePence)}`}
                  disabled={!!pending}
                  onNo={() => setConfirm(null)}
                  onYes={async () => (await run("BuyVehicle", { defId: d.id, colour }, "buy")) && setConfirm(null)}
                />
              ) : (
                <button className="btn small" disabled={!!pending || full || d.pricePence > s.wallet.cashPence} onClick={() => setConfirm(`buy:${d.id}`)} title={full ? "Your garage is full" : d.pricePence > s.wallet.cashPence ? `You need ${money(d.pricePence - s.wallet.cashPence)} more` : undefined}>
                  Buy · {money(d.pricePence)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ───────────────────────────── Insurance ─────────────────────────────

export function InsuranceApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const ins = s.insurance;
  return (
    <>
      <section className={styles.workCard}>
        <div className={styles.workRow}>
          <strong>This week: {ins.week.forecast.name}</strong>
          <span className="chip">{Math.round(ins.week.forecast.risk * 100)}% risk</span>
        </div>
        <span className="tiny">{ins.week.forecast.blurb} Next week's forecast: {ins.next.forecast.name.toLowerCase()} ({Math.round(ins.next.forecast.risk * 100)}%). The week runs to {when(ins.week.endsAt)}.</span>
        <span className="tiny">
          Risk is the chance of one incident in the week, decided once per week. Incidents only happen once you own something worth protecting: a vehicle or a prestige item. Fictional forecast.
        </span>
      </section>
      <h3 className={styles.subhead}>Policies</h3>
      <ul className={styles.list}>
        {ins.policies.map((p) => (
          <li key={p.kind} className={styles.workCard}>
            <div className={styles.workRow}>
              <strong>{p.name}</strong>
              {p.active ? <span className="chip good">{p.renews ? "Active" : "Ending"}</span> : <span className="chip">{money(p.premiumPence)} this week</span>}
            </div>
            <p className={styles.actionDesc}>{p.blurb}</p>
            <span className="tiny">
              Covers: {p.covers.join(", ")} · excess {money(p.excessPence)} · next week {money(p.nextPremiumPence)}
            </span>
            <span className="tiny">{p.exclusions}</span>
            {p.coveredUntil && <span className="tiny">Cancelled: covered until {when(p.coveredUntil)}, then it stops.</span>}
            {confirm === p.kind ? (
              p.renews ? (
                <Confirm text={`Cancel ${p.name.toLowerCase()}? You stay covered until the end of this paid week; premiums aren't refunded.`} yes="Stop renewing" disabled={!!pending} onNo={() => setConfirm(null)} onYes={async () => (await run("CancelInsurance", { kind: p.kind }, "cancel")) && setConfirm(null)} />
              ) : (
                <Confirm
                  text={`Start ${p.name.toLowerCase()} now for ${money(p.premiumPence)} this week? It renews every Saturday at 09:00 with rent, priced from the coming week's forecast. If a premium can't be paid the policy lapses. It never covers anything that has already happened.`}
                  yes="Start cover"
                  disabled={!!pending}
                  onNo={() => setConfirm(null)}
                  onYes={async () => (await run("BuyInsurance", { kind: p.kind }, "insure")) && setConfirm(null)}
                />
              )
            ) : p.renews ? (
              <button className="btn small secondary" disabled={!!pending} onClick={() => setConfirm(p.kind)}>
                Cancel cover
              </button>
            ) : (
              <button className="btn small" disabled={!!pending || p.premiumPence > s.wallet.cashPence} onClick={() => setConfirm(p.kind)}>
                Get cover · {money(p.premiumPence)}
              </button>
            )}
          </li>
        ))}
      </ul>
      <h3 className={styles.subhead}>Incidents</h3>
      {ins.incidents.length === 0 ? (
        <p className="muted">Nothing has happened. Long may it last.</p>
      ) : (
        <ul className={styles.list}>
          {ins.incidents.map((e) => (
            <li key={e.id} className={styles.workCard}>
              <div className={styles.workRow}>
                <strong>{e.name}</strong>
                {e.insured ? <span className={`chip ${e.claimed ? "good" : "gold"}`}>{e.claimed ? "Claim paid" : "Covered"}</span> : <span className="chip">Not covered</span>}
              </div>
              <p className={styles.actionDesc}>{e.blurb}</p>
              <span className="tiny">
                {when(e.at)} · assessed loss {money(e.assessedPence)}
                {e.chargedPence ? ` · you paid ${money(e.chargedPence)}` : ""}
                {e.reliefPence ? ` · ${money(e.reliefPence)} waived (capped loss and hardship relief)` : ""}
                {e.insured ? ` · excess ${money(e.excessPence)}` : ""}
              </span>
              {e.claimable && (
                <button className="btn small" disabled={!!pending} onClick={() => run("ClaimInsurance", { eventId: e.id }, "claim")}>
                  Claim {money(e.payoutPence)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="tiny">
        Without cover, one incident never costs more than {money(ins.hardship.uninsuredCapPence)}. If your shift wages over the past week were under {money(ins.hardship.lowIncomePence)}, you pay only {Math.round(ins.hardship.lowIncomeShare * 100)}% of that, and nobody is ever pushed below £0. New arrivals have a quiet first {ins.hardship.newcomerDays} days.
      </p>
    </>
  );
}

// ───────────────────────────── Pets ─────────────────────────────

export function PetsApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const p = s.pets;
  const atHome = s.character.location === "home" && !s.journey;
  const busy = !!s.activity || !!s.shift;
  return (
    <>
      {p.list.length === 0 && <p className="muted">No pets yet. Adopt a cat or a dog from the Borough Animal Rescue (a fictional charity).</p>}
      <ul className={styles.list}>
        {p.list.map((pet) => (
          <li key={pet.id} className={styles.workCard} data-testid="pet">
            <div className={styles.workRow}>
              <strong>
                {pet.name} <span className="tiny">the {pet.kind}</span>
              </strong>
              {pet.needsCare ? <span className="chip bad">Needs care</span> : <span className="chip good">Content</span>}
            </div>
            <div>
              <div className={styles.workRow}>
                <span className="tiny">Wellbeing</span>
                <span className="tiny">{pet.wellbeing}/100</span>
              </div>
              <div className={styles.bar}>
                <span style={{ width: `${pet.wellbeing}%` }} />
              </div>
            </div>
            {pet.needsCare && <p className={styles.reason}>{pet.name} would love some attention. Wellbeing never drops below {p.floor}, and a little care soon brings it back.</p>}
            <div className={styles.quotes}>
              {pet.care.map((c) => (
                <button
                  key={c.id}
                  className="btn small secondary"
                  disabled={!!pending || !atHome || busy || !!c.readyAt || (c.id === "feed" && p.petFood < 1)}
                  onClick={() => run("CarePet", { petId: pet.id, action: c.id }, c.id)}
                  title={c.readyAt ? `Again at ${clock(c.readyAt)}` : c.blurb}
                >
                  {c.label} +{c.gain}
                  {c.readyAt ? ` · ${clock(c.readyAt)}` : ""}
                </button>
              ))}
            </div>
            {!atHome && <span className="tiny">Go home to look after {pet.name}.</span>}
            <span className="tiny">Pet food in the cupboard: {p.petFood} tin{p.petFood === 1 ? "" : "s"}. Buy more at the Common Table Food Hall or Borough Market.</span>
            {confirm === `rehome:${pet.id}` ? (
              <Confirm
                text={`Rehome ${pet.name}? The Borough Animal Rescue will find them a caring new home. This can't be undone, and the adoption fee isn't refunded.`}
                yes={`Rehome ${pet.name}`}
                disabled={!!pending}
                onNo={() => setConfirm(null)}
                onYes={async () => (await run("RehomePet", { petId: pet.id }, "rehome")) && setConfirm(null)}
              />
            ) : (
              <button className="btn small secondary" style={{ justifySelf: "start" }} onClick={() => setConfirm(`rehome:${pet.id}`)}>
                Rehome…
              </button>
            )}
          </li>
        ))}
      </ul>
      <h3 className={styles.subhead}>Adopt</h3>
      {p.list.length >= p.maxPets ? (
        <p className="tiny">You can look after up to {p.maxPets} pets at once.</p>
      ) : (
        <ul className={styles.list}>
          {p.kinds.map((k) => {
            const name = names[k.id] ?? "";
            const ok = /^[\p{L}][\p{L} '\-]{0,15}$/u.test(name.trim());
            return (
              <li key={k.id} className={styles.workCard}>
                <div className={styles.workRow}>
                  <strong>{k.name}</strong>
                  <span className="chip">Adoption {money(k.adoptionPence)}</span>
                </div>
                <p className={styles.actionDesc}>{k.blurb}</p>
                <span className="tiny">
                  Daily upkeep: about {k.foodPerDay} tin{k.foodPerDay > 1 ? "s" : ""} of pet food ({money(120 * k.foodPerDay)}). Care actions at home: feed, play, groom and settle down.
                </span>
                {confirm === `adopt:${k.id}` ? (
                  <Confirm
                    text={`Adopt ${name.trim()} the ${k.name.toLowerCase()} for ${money(k.adoptionPence)}? They'll be waiting at home.`}
                    yes="Adopt"
                    disabled={!!pending}
                    onNo={() => setConfirm(null)}
                    onYes={async () => {
                      if (await run("AdoptPet", { kind: k.id, name: name.trim() }, "adopt")) {
                        setConfirm(null);
                        setNames({ ...names, [k.id]: "" });
                      }
                    }}
                  />
                ) : (
                  <form
                    className={styles.quotes}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (ok) setConfirm(`adopt:${k.id}`);
                    }}
                  >
                    <input className="input" style={{ width: 140 }} placeholder="Name" maxLength={16} value={name} onChange={(e) => setNames({ ...names, [k.id]: e.target.value })} aria-label={`Name your ${k.name.toLowerCase()}`} />
                    <button className="btn small" disabled={!ok || !!pending || k.adoptionPence > s.wallet.cashPence}>
                      Adopt · {money(k.adoptionPence)}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
