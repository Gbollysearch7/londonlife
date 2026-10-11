"use client";
import { useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hours = (m: number) => (m >= 90 ? `${Math.round(m / 60)} h` : `${Math.round(m)} min`);
const pct = (x: number) => `${Math.round(x * 100)}%`;

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

/** Invest app: buy and sell investment homes, buy land and build on it in stages. */
export function InvestApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [tab, setTab] = useState<"homes" | "land">("homes");
  const v = s.invest;
  const homesFull = v.homes.length + v.fitouts >= v.maxHomes;
  const plotsFull = v.plots.length >= v.maxPlots;
  const fee = pct(v.saleFee);
  return (
    <>
      <p className="tiny">
        Investment homes are let to NPC tenants through a letting agent. Rent, less weekly upkeep, is paid into your wallet every Saturday at 09:00; some weeks a home sits empty and only upkeep is due. Valuations move a little each week and count towards your net worth, but aren't cash until you sell ({fee} fees). This is a separate catalogue from the home you live in. All prices are fictional.
      </p>
      <div className={styles.workRow}>
        <span className="tiny">Property value</span>
        <strong>{money(v.worthPence)}</strong>
      </div>
      <div className={styles.quotes} role="tablist">
        <button className={`btn small ${tab === "homes" ? "" : "secondary"}`} aria-selected={tab === "homes"} role="tab" onClick={() => setTab("homes")}>
          Homes · {v.homes.length}/{v.maxHomes}
        </button>
        <button className={`btn small ${tab === "land" ? "" : "secondary"}`} aria-selected={tab === "land"} role="tab" onClick={() => setTab("land")}>
          Land · {v.plots.length}/{v.maxPlots}
        </button>
      </div>

      {tab === "homes" && (
        <>
          <h3 className={styles.subhead}>Your investment homes</h3>
          {v.homes.length === 0 && <p className="muted">You don't own an investment home yet.</p>}
          <ul className={styles.list}>
            {v.homes.map((h) => (
              <li key={h.id} className={styles.workCard} data-testid="investment-home">
                <div className={styles.workRow}>
                  <strong>{h.name}</strong>
                  <span className="chip">{h.district}</span>
                </div>
                <span className="tiny">
                  Valued {money(h.valuationPence)} (paid {money(h.pricePaidPence)}) · rent {money(h.rentPence)} / week · upkeep {money(h.maintenancePence)} / week · empty about {pct(h.vacancy)} of weeks
                </span>
                <span className="tiny">
                  {h.lastWeek ? `Last week (${h.lastWeek.period}): ${h.lastWeek.occupied ? "let" : "empty"}, ${h.lastWeek.netPence >= 0 ? "+" : "−"}${money(Math.abs(h.lastWeek.netPence))}` : "No rent week settled yet"} · earned {money(h.totalIncomePence)} so far · next {when(h.nextIncomeAt)}
                </span>
                {confirm === `sell:${h.id}` ? (
                  <Confirm
                    text={`Sell the ${h.name.toLowerCase()} for ${money(h.salePence)}? That's this week's valuation of ${money(h.valuationPence)} less ${fee} agent and legal fees. Rent for a part week isn't paid on sale.`}
                    yes={`Sell for ${money(h.salePence)}`}
                    disabled={!!pending}
                    onNo={() => setConfirm(null)}
                    onYes={async () => (await run("SellInvestment", { propertyId: h.id }, "sell")) && setConfirm(null)}
                  />
                ) : (
                  <button className="btn small secondary" disabled={!!pending} onClick={() => setConfirm(`sell:${h.id}`)}>
                    Sell · {money(h.salePence)}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {v.homes.length > 0 && <p className="tiny">Next rent day: {when(v.nextIncomeAt)}.</p>}

          {v.income.length > 0 && (
            <>
              <h3 className={styles.subhead}>Recent rent weeks</h3>
              <ul className={styles.list}>
                {v.income.map((r) => (
                  <li key={r.id} className={styles.workRow}>
                    <span className="tiny">
                      {r.period} · {r.name} · {r.occupied ? `rent ${money(r.rentPence)}` : "no tenant"} · upkeep {money(r.maintenancePence)}
                    </span>
                    <strong>{r.netPence >= 0 ? "+" : "−"}{money(Math.abs(r.netPence))}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className={styles.subhead}>For sale</h3>
          <ul className={styles.list}>
            {v.catalogue.map((d) => (
              <li key={d.id} className={styles.workCard}>
                <div className={styles.workRow}>
                  <strong>{d.name}</strong>
                  <span className="chip">{money(d.pricePence)}</span>
                </div>
                <p className={styles.actionDesc}>{d.blurb}</p>
                <span className="tiny">
                  {d.district} · rent {money(d.rentPence)} / week · upkeep {money(d.maintenancePence)} / week · empty about {pct(d.vacancy)} of weeks
                </span>
                {confirm === `buy:${d.id}` ? (
                  <Confirm
                    text={`Buy the ${d.name.toLowerCase()} for ${money(d.pricePence)}? Tenants move in straight away; the first rent day pays for the part week.`}
                    yes={`Buy for ${money(d.pricePence)}`}
                    disabled={!!pending}
                    onNo={() => setConfirm(null)}
                    onYes={async () => (await run("BuyInvestment", { defId: d.id }, "buy")) && setConfirm(null)}
                  />
                ) : (
                  <button
                    className="btn small"
                    disabled={!!pending || homesFull || d.pricePence > s.wallet.cashPence}
                    onClick={() => setConfirm(`buy:${d.id}`)}
                    title={homesFull ? `You can own at most ${v.maxHomes} investment homes` : d.pricePence > s.wallet.cashPence ? `You need ${money(d.pricePence - s.wallet.cashPence)} more` : undefined}
                  >
                    Buy · {money(d.pricePence)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "land" && (
        <>
          <p className="tiny">
            Build in four stages: {v.stageNames.join(" → ")}. Each stage is paid when it starts and takes real time; one finished stage unlocks the next. Stopping a stage refunds the unworked share and keeps every finished stage. A finished building becomes an investment home (it needs a free home slot before the fit-out).
          </p>
          <h3 className={styles.subhead}>Your land</h3>
          {v.plots.length === 0 && <p className="muted">You don't own any land yet.</p>}
          <ul className={styles.list}>
            {v.plots.map((p) => {
              const total = p.running ? new Date(p.running.endsAt).getTime() - new Date(p.running.startedAt).getTime() : 1;
              const done = p.running ? Math.min(100, Math.max(0, ((Date.parse(s.now) - Date.parse(p.running.startedAt)) / total) * 100)) : 0;
              return (
                <li key={p.id} className={styles.workCard} data-testid="plot">
                  <div className={styles.workRow}>
                    <strong>{p.name}</strong>
                    <span className="chip">
                      {p.title} · {p.district}
                    </span>
                  </div>
                  <span className="tiny">
                    Land valued {money(p.valuationPence)} · building work paid {money(p.spentPence)} · becomes a {p.builds.name.toLowerCase()} (rent {money(p.builds.rentPence)} / week)
                  </span>
                  <div className={styles.workRow}>
                    {v.stageNames.map((n, i) => (
                      <span key={n} className={`chip ${i < p.stagesDone ? "good" : ""}`}>
                        {i < p.stagesDone ? "✓ " : p.running?.stage === i ? "… " : ""}
                        {n}
                      </span>
                    ))}
                  </div>
                  {p.running ? (
                    <>
                      <div className={styles.bar}>
                        <span style={{ width: `${done}%` }} />
                      </div>
                      <span className="tiny">
                        {p.running.name} under way · finishes {when(p.running.endsAt)}
                      </span>
                      {confirm === `stop:${p.id}` ? (
                        <Confirm
                          text={`Stop the ${p.running.name.toLowerCase()}? You'll get back the unworked share of its ${money(p.running.costPence)} cost; finished stages are kept.`}
                          yes="Stop work"
                          disabled={!!pending}
                          onNo={() => setConfirm(null)}
                          onYes={async () => (await run("CancelConstruction", { plotId: p.id }, "stop")) && setConfirm(null)}
                        />
                      ) : (
                        <button className="btn small secondary" disabled={!!pending} onClick={() => setConfirm(`stop:${p.id}`)}>
                          Stop work
                        </button>
                      )}
                    </>
                  ) : p.next ? (
                    <div className={styles.quotes}>
                      <button
                        className="btn small"
                        disabled={!!pending || p.next.costPence > s.wallet.cashPence || (p.next.stage === 3 && homesFull)}
                        onClick={() => run("StartConstruction", { plotId: p.id }, "build")}
                        title={p.next.stage === 3 && homesFull ? "Sell an investment home first: a finished building needs a free slot" : undefined}
                      >
                        Start {p.next.name.toLowerCase()} · {money(p.next.costPence)} · {hours(p.next.minutes)}
                      </button>
                      {p.stagesDone === 0 &&
                        (confirm === `sellplot:${p.id}` ? (
                          <Confirm
                            text={`Sell this bare land for ${money(p.salePence)} (valuation less ${fee} fees)?`}
                            yes="Sell"
                            disabled={!!pending}
                            onNo={() => setConfirm(null)}
                            onYes={async () => (await run("SellPlot", { plotId: p.id }, "sell")) && setConfirm(null)}
                          />
                        ) : (
                          <button className="btn small secondary" disabled={!!pending} onClick={() => setConfirm(`sellplot:${p.id}`)}>
                            Sell land · {money(p.salePence)}
                          </button>
                        ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <h3 className={styles.subhead}>Plots for sale</h3>
          <ul className={styles.list}>
            {v.plotCatalogue.map((d) => (
              <li key={d.id} className={styles.workCard}>
                <div className={styles.workRow}>
                  <strong>{d.name}</strong>
                  <span className="chip">{money(d.pricePence)}</span>
                </div>
                <p className={styles.actionDesc}>{d.blurb}</p>
                <span className="tiny">
                  {d.title} (game label) · {d.district} · building costs {money(d.buildCostPence)} over about {hours(d.buildMinutes)} of work · becomes a {d.builds.name.toLowerCase()}
                </span>
                {confirm === `buyplot:${d.id}` ? (
                  <Confirm
                    text={`Buy the ${d.name.toLowerCase()} for ${money(d.pricePence)}? Bare land earns nothing until you build on it.`}
                    yes={`Buy for ${money(d.pricePence)}`}
                    disabled={!!pending}
                    onNo={() => setConfirm(null)}
                    onYes={async () => (await run("BuyPlot", { defId: d.id }, "buy")) && setConfirm(null)}
                  />
                ) : (
                  <button
                    className="btn small"
                    disabled={!!pending || plotsFull || d.pricePence > s.wallet.cashPence}
                    onClick={() => setConfirm(`buyplot:${d.id}`)}
                    title={plotsFull ? `You can hold at most ${v.maxPlots} plots` : d.pricePence > s.wallet.cashPence ? `You need ${money(d.pricePence - s.wallet.cashPence)} more` : undefined}
                  >
                    Buy land · {money(d.pricePence)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
