"use client";
import { useState, type ReactNode } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className={styles.tabs} role="tablist" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? styles.tabOn : ""} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Pounds entry that submits whole pence. */
function PriceForm({ label, min, max, disabled, onSubmit }: { label: string; min: number; max: number; disabled: boolean; onSubmit: (pence: number) => void }) {
  const [v, setV] = useState("");
  const pence = Math.round(Number(v) * 100);
  const ok = Number.isFinite(pence) && pence >= min && pence <= max;
  return (
    <form
      className={styles.quotes}
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) {
          onSubmit(pence);
          setV("");
        }
      }}
    >
      <input className="input" style={{ width: 110 }} inputMode="decimal" placeholder="£0.00" value={v} onChange={(e) => setV(e.target.value)} aria-label={`${label}: amount in pounds`} />
      <button className="btn small" disabled={!ok || disabled}>
        {label}
      </button>
    </form>
  );
}

// ───────────────────────────── Market ─────────────────────────────

export function MarketApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [confirm, setConfirm] = useState<string | null>(null);
  const m = s.market;
  const listed = new Set(m.listedIds);
  const stored = s.furniture.filter((f) => !f.placed && !listed.has(f.id));
  const fee = `${Math.round(m.feeRate * 100)}%`;
  return (
    <>
      <p className="tiny">Buy and sell furniture with other players. Sold items move straight into the buyer's storage. A {fee} market fee comes off the seller's price. Fictional money only.</p>
      <Tabs value={tab} options={[["buy", "Buy"], ["sell", `Sell${m.mine.length ? ` (${m.mine.length})` : ""}`]]} onChange={setTab} />
      {tab === "buy" ? (
        m.forSale.length === 0 ? (
          <p className="muted">Nothing for sale right now. When other players list furniture, it appears here.</p>
        ) : (
          <ul className={styles.list}>
            {m.forSale.map((l) => (
              <li key={l.id} className={styles.workCard}>
                <div className={styles.workRow}>
                  <strong>{l.name}</strong>
                  <span className="chip good">{money(l.pricePence)}</span>
                </div>
                <span className="tiny">
                  {l.category} · colour {l.colour} · sold by player {l.seller} · listed {when(l.listedAt)}
                </span>
                {confirm === l.id ? (
                  <div className={styles.confirm}>
                    <span>
                      Pay {money(l.pricePence)} to {l.seller}? You have {money(s.wallet.cashPence)}.
                    </span>
                    <div>
                      <button className="btn small secondary" onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                      <button className="btn small" disabled={!!pending || s.wallet.cashPence < l.pricePence} onClick={async () => (await run("BuyListing", { listingId: l.id }, "buy"), setConfirm(null))}>
                        Buy
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn small" disabled={s.wallet.cashPence < l.pricePence} onClick={() => setConfirm(l.id)}>
                    {s.wallet.cashPence < l.pricePence ? "Not enough money" : "Buy"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {m.mine.length > 0 && (
            <>
              <h3 className={styles.subhead}>Your listings</h3>
              <ul className={styles.list}>
                {m.mine.map((l) => (
                  <li key={l.id} className={styles.workCard}>
                    <div className={styles.workRow}>
                      <strong>{l.name}</strong>
                      <span className="chip">{money(l.pricePence)}</span>
                    </div>
                    <span className="tiny">
                      You'd receive {money(l.pricePence - l.feePence)} after the {money(l.feePence)} fee. Locked in storage while listed.
                    </span>
                    <button className="btn small secondary" disabled={!!pending} onClick={() => run("CancelListing", { listingId: l.id }, "unlist")}>
                      Cancel listing
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className={styles.subhead}>List something from storage</h3>
          {stored.length === 0 ? (
            <p className="muted">Nothing in storage. Move a piece of furniture to storage at home to sell it here.</p>
          ) : m.mine.length >= m.maxListings ? (
            <p className={styles.reason}>You can have up to {m.maxListings} items listed at once.</p>
          ) : (
            <ul className={styles.list}>
              {stored.map((f) => (
                <li key={f.id} className={styles.workCard}>
                  <div className={styles.workRow}>
                    <strong>{f.name}</strong>
                    <span className="tiny">Sells to the shop for {money(f.resalePence)}</span>
                  </div>
                  <PriceForm label="List" min={m.minPricePence} max={m.maxPricePence} disabled={!!pending} onSubmit={(p) => run("ListItem", { instanceId: f.id, pricePence: p }, "list")} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {m.history.length > 0 && (
        <>
          <h3 className={styles.subhead}>Recent trades</h3>
          <ul className={styles.ledger}>
            {m.history.map((h) => (
              <li key={h.id}>
                <div>
                  <strong>
                    {h.side === "sold" ? "Sold" : "Bought"} {h.name}
                  </strong>
                  <span className="tiny">
                    {h.side === "sold" ? "to" : "from"} {h.other} · {when(h.at)}
                  </span>
                </div>
                <div className={styles.ledgerAmt}>
                  <span className={h.netPence < 0 ? styles.neg : styles.pos}>
                    {h.netPence > 0 ? "+" : ""}
                    {money(h.netPence)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ───────────────────────────── Company ─────────────────────────────

export function CompanyApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setSheet = useGame((x) => x.setSheet);
  const k = s.company;
  const [name, setName] = useState("");
  const [sector, setSector] = useState<string>(k.sectors[0].id);
  const co = k.mine;
  if (!co) {
    const blocked = k.enterprise < k.minEnterprise ? `Needs Enterprise level ${k.minEnterprise} (you're level ${k.enterprise}). Study small business at the library or practise your pitch at East Yard.` : s.wallet.cashPence < k.foundingPence ? `Founding costs ${money(k.foundingPence)}; you have ${money(s.wallet.cashPence)}.` : null;
    return (
      <>
        <p className="muted">
          Found your own company: work on it at East Yard Workspace or your home desk, and every day at 18:00 it settles its takings. One company per person; founding costs {money(k.foundingPence)}.
        </p>
        <h3 className={styles.subhead}>Choose a sector</h3>
        <ul className={styles.list} role="radiogroup" aria-label="Sector">
          {k.sectors.map((x) => (
            <li key={x.id}>
              <button className={styles.workCard} style={{ width: "100%", textAlign: "left", outline: sector === x.id ? "2px solid var(--green)" : undefined }} role="radio" aria-checked={sector === x.id} onClick={() => setSector(x.id)}>
                <div className={styles.workRow}>
                  <strong>{x.name}</strong>
                  <span className="chip">
                    {money(x.forecast.lowPence)} to {money(x.forecast.highPence)} a day
                  </span>
                </div>
                <span className={styles.actionDesc}>{x.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="tiny">The figures are a forecast for a full day's work at level 1 with your current Enterprise. Before tax; not a promise.</p>
        <label className="tiny" htmlFor="company-name">
          Company name
        </label>
        <input id="company-name" className="input" maxLength={28} placeholder="e.g. Nightjar Coffee" value={name} onChange={(e) => setName(e.target.value)} />
        {blocked ? (
          <p className={styles.reason}>{blocked}</p>
        ) : (
          <button className="btn" style={{ marginTop: 10 }} disabled={!!pending || name.trim().length < 3} onClick={() => run("FoundCompany", { name, sector }, "found")}>
            Found company for {money(k.foundingPence)}
          </button>
        )}
      </>
    );
  }
  const span = co.levelTo ? co.levelTo - co.levelFrom : 1;
  const pct = co.levelTo ? Math.min(100, Math.round(((co.progress - co.levelFrom) / span) * 100)) : 100;
  return (
    <>
      <section className={styles.workCard}>
        <div className={styles.workRow}>
          <div>
            <span className="tiny">{co.sector.name}</span>
            <h3 style={{ fontSize: 22 }}>{co.name}</h3>
          </div>
          <span className="chip good">
            Level {co.level} of {co.maxLevel}
          </span>
        </div>
        <div>
          <div className={styles.workRow}>
            <span className="tiny">Progress</span>
            <span className="tiny">{co.levelTo ? `${co.progress} / ${co.levelTo}` : "Top level"}</span>
          </div>
          <div className={styles.bar}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="tiny">
          Today: {co.sessionsToday} of {co.sessionsCounted} work sessions counted. Next settlement {when(co.nextSettleAt)}. Forecast for a full day: {money(co.forecast.lowPence)} to {money(co.forecast.highPence)} profit before tax.
        </p>
        {co.lossCarriedPence > 0 && <p className={styles.reason}>Losses carried forward: {money(co.lossCarriedPence)}. Future profit pays this off before anything reaches your wallet.</p>}
        <p className="tiny">Work on your company from the Here menu at East Yard Workspace, or at your desk at home.</p>
        {s.character.location !== "east_yard" && s.character.location !== "home" && !s.journey && (
          <button className="btn small secondary" onClick={() => setSheet("map")}>
            Travel to East Yard Workspace
          </button>
        )}
      </section>
      <h3 className={styles.subhead}>This week</h3>
      <p className="tiny">
        Paid to you: {money(co.week.paidPence)} · business tax {money(co.week.taxPence)}. Business profit has its own weekly tax band (first £250 free, then 20%, 30% above £1,000), separate from wages. Fictional rates.
      </p>
      <h3 className={styles.subhead}>Daily reports</h3>
      {co.reports.length === 0 ? (
        <p className="muted">No days settled yet. The first report arrives at 18:00.</p>
      ) : (
        <ul className={styles.ledger}>
          {co.reports.map((r) => (
            <li key={r.period}>
              <div>
                <strong>{new Date(`${r.period}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</strong>
                <span className="tiny">
                  Takings {money(r.takingsPence)} · costs {money(r.costsPence)} · {r.sessions} session{r.sessions === 1 ? "" : "s"} · {r.roll >= 1.1 ? "busy day" : r.roll <= 0.85 ? "slow day" : "ordinary day"}
                  {r.offsetPence ? ` · ${money(r.offsetPence)} to past losses` : ""}
                  {r.taxPence ? ` · tax ${money(r.taxPence)}` : ""}
                </span>
              </div>
              <div className={styles.ledgerAmt}>
                <span className={r.profitPence < 0 ? styles.neg : styles.pos}>
                  {r.profitPence > 0 ? "+" : ""}
                  {money(r.profitPence)}
                </span>
                <span className="tiny">paid {money(r.paidPence)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ───────────────────────────── Player jobs board ─────────────────────────────

const STATUS: Record<string, string> = {
  posted: "Open",
  applied: "Offer waiting",
  hired: "In progress",
  submitted: "Handed in",
  completed: "Paid",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function BoardApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const j = s.playerJobs;
  const [tab, setTab] = useState<"board" | "posted" | "working">("board");
  const [template, setTemplate] = useState<string>(j.templates[0].id);
  const [hours, setHours] = useState<number>(j.deadlineHours[1]);
  const go = (type: string, jobId: string) => run(type, { jobId }, type);
  return (
    <>
      <p className="tiny">
        Pay another player for a favour. Your offer is held in escrow when you post: it's released only when you approve the work, comes back if you cancel before accepting anyone, and returns at the deadline if
        nobody finishes. Everyone here is a real player.
      </p>
      <Tabs
        value={tab}
        options={[
          ["board", "Board"],
          ["posted", `My posts${j.posted.filter((p) => p.status === "applied" || p.status === "submitted").length ? " •" : ""}`],
          ["working", "Working"],
        ]}
        onChange={setTab}
      />
      {tab === "board" &&
        (j.board.length === 0 ? (
          <p className="muted">No open jobs from other players right now.</p>
        ) : (
          <ul className={styles.list}>
            {j.board.map((x) => (
              <li key={x.id} className={styles.workCard}>
                <div className={styles.workRow}>
                  <strong>{x.title}</strong>
                  <span className="chip good">{money(x.payPence)}</span>
                </div>
                <span className={styles.actionDesc}>{x.blurb}</span>
                <span className="tiny">
                  Posted by player {x.poster} · open until {when(x.deadlineAt)}
                </span>
                <button className="btn small" disabled={!!pending} onClick={() => go("ApplyJob", x.id)}>
                  Offer to do it
                </button>
              </li>
            ))}
          </ul>
        ))}
      {tab === "posted" && (
        <>
          <section className={styles.workCard}>
            <strong>Post a job</strong>
            <select className="input" value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="What do you need?">
              {j.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Open for">
              {j.deadlineHours.map((h) => (
                <option key={h} value={h}>
                  Open for {h} hours
                </option>
              ))}
            </select>
            <PriceForm label="Post and hold pay" min={j.minPayPence} max={Math.min(j.maxPayPence, s.wallet.cashPence)} disabled={!!pending} onSubmit={(p) => run("PostJob", { templateId: template, payPence: p, hours }, "post")} />
            <span className="tiny">
              {money(j.minPayPence)} to {money(j.maxPayPence)}. Currently held in escrow: {money(j.escrowHeldPence)}.
            </span>
          </section>
          <JobList
            items={j.posted}
            empty="You haven't posted any jobs."
            actions={(x) => (
              <>
                {x.status === "applied" && (
                  <>
                    <span className="tiny">Player {x.worker} offered to do this.</span>
                    <div className={styles.quotes}>
                      <button className="btn small" disabled={!!pending} onClick={() => go("HireApplicant", x.id)}>
                        Accept {x.worker}
                      </button>
                      <button className="btn small secondary" disabled={!!pending} onClick={() => go("DeclineApplicant", x.id)}>
                        Decline
                      </button>
                    </div>
                  </>
                )}
                {x.status === "submitted" && (
                  <>
                    <span className="tiny">
                      {x.worker} says it's done. Approve to release {money(x.payPence)}; it's approved automatically {x.autoApproveAt ? when(x.autoApproveAt) : "soon"}.
                    </span>
                    <button className="btn small" disabled={!!pending} onClick={() => go("CompleteJob", x.id)}>
                      Approve and pay
                    </button>
                  </>
                )}
                {(x.status === "posted" || x.status === "applied") && (
                  <button className="btn small secondary" disabled={!!pending} onClick={() => go("CancelJob", x.id)}>
                    Cancel and refund
                  </button>
                )}
                {x.status === "hired" && <span className="tiny">{x.worker} is working on it.</span>}
              </>
            )}
          />
        </>
      )}
      {tab === "working" && (
        <JobList
          items={j.working}
          empty="You're not doing any jobs. Offer to help from the Board."
          actions={(x) => (
            <>
              {x.status === "applied" && <span className="tiny">Waiting for {x.poster} to accept you.</span>}
              {x.status === "hired" && (
                <button className="btn small" disabled={!!pending} onClick={() => go("SubmitJob", x.id)}>
                  Mark as done
                </button>
              )}
              {x.status === "submitted" && <span className="tiny">Waiting for {x.poster} to approve. Paid automatically {x.autoApproveAt ? when(x.autoApproveAt) : "soon"} if they don't respond.</span>}
              {(x.status === "applied" || x.status === "hired") && (
                <button className="btn small secondary" disabled={!!pending} onClick={() => go("WithdrawJob", x.id)}>
                  Step away
                </button>
              )}
            </>
          )}
        />
      )}
    </>
  );
}

type Job = State["playerJobs"]["posted"][number];

function JobList({ items, empty, actions }: { items: Job[]; empty: string; actions: (j: Job) => ReactNode }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className={styles.list} style={{ marginTop: 10 }}>
      {items.map((x) => (
        <li key={x.id} className={styles.workCard}>
          <div className={styles.workRow}>
            <strong>{x.title}</strong>
            <span className={`chip ${x.status === "completed" ? "good" : x.status === "cancelled" || x.status === "expired" ? "" : "gold"}`}>
              {STATUS[x.status]} · {money(x.payPence)}
            </span>
          </div>
          {["posted", "applied", "hired"].includes(x.status) && <span className="tiny">Deadline {when(x.deadlineAt)}</span>}
          {actions(x)}
        </li>
      ))}
    </ul>
  );
}
