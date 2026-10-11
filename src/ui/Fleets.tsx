"use client";
import { useState } from "react";
import { serverNow, useGame } from "@/client/store";
import type { State } from "@/client/api";
import { contractFuel, contractWear, type ContractTier } from "@/content/fleets";
import { countdown, money } from "./format";
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

// ───────────────────────────── Transport Co ─────────────────────────────

export function TransportApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setApp = useGame((x) => x.setPhoneApp);
  const co = s.courier;
  const [first, setFirst] = useState<string>(co.nameFirst[0]);
  const [second, setSecond] = useState<string>(co.nameSecond[0]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const firstFree = co.cars.find((c) => c.available)?.id ?? "";
  const [chosen, setChosen] = useState<Record<number, string>>({});

  if (!co.firm) {
    return (
      <>
        <p className="tiny">
          Run a small courier firm with your own cars. Take delivery and haulage contracts from the city's daily board; a driver takes your car on the run while you get on with your day. You pay fuel up front and the fee (less the driver's wage) is paid when the goods arrive. Fictional prices and places.
        </p>
        {!co.hasCar ? (
          <section className={styles.workCard}>
            <strong>You need a car first</strong>
            <span className="tiny">Any car will do to start. Family cars and electric saloons can also take heavy haulage later.</span>
            <button className="btn small" onClick={() => setApp("vehicles")}>
              Open Vehicles
            </button>
          </section>
        ) : (
          <section className={styles.workCard}>
            <strong>Register your firm · {money(co.registrationPence)}</strong>
            <span className="tiny">Pick a name from the lists (no typing, so nothing needs checking).</span>
            <div className={styles.quotes}>
              <select className="input" value={first} onChange={(e) => setFirst(e.target.value)} aria-label="First part of the firm's name">
                {co.nameFirst.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <select className="input" value={second} onChange={(e) => setSecond(e.target.value)} aria-label="Second part of the firm's name">
                {co.nameSecond.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            {confirm === "register" ? (
              <Confirm
                text={`Register ${first} ${second} for ${money(co.registrationPence)}? One firm per person; the fee isn't refundable.`}
                yes="Register"
                disabled={!!pending}
                onNo={() => setConfirm(null)}
                onYes={async () => (await run("RegisterFirm", { first, second }, "register")) && setConfirm(null)}
              />
            ) : (
              <button className="btn small" disabled={!!pending || co.registrationPence > s.wallet.cashPence} onClick={() => setConfirm("register")}>
                Register · {money(co.registrationPence)}
              </button>
            )}
          </section>
        )}
      </>
    );
  }

  const f = co.firm;
  const pct = f.levelTo === null ? 100 : Math.round(((f.xp - f.levelFrom) / (f.levelTo - f.levelFrom)) * 100);
  const left = Math.max(0, f.limit - f.usedToday);
  return (
    <>
      <section className={styles.workCard} data-testid="courier-firm">
        <div className={styles.workRow}>
          <div>
            <span className="tiny">Courier firm</span>
            <h3 style={{ fontSize: 22 }}>{f.name}</h3>
          </div>
          <span className="chip good">Level {f.level}</span>
        </div>
        <div>
          <div className={styles.workRow}>
            <span className="tiny">{f.levelTo === null ? "Top level" : `Next level at ${f.levelTo} XP`}</span>
            <span className="tiny">{f.xp} XP</span>
          </div>
          <div className={styles.bar}>
            <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
        </div>
        <span className="tiny">
          Today: {f.usedToday}/{f.limit} contracts ({co.contractsPerCar} per car, up to {co.maxCarsCounted} cars, plus one per level above 1). {f.contractsDone} delivered so far.
        </span>
        <span className="tiny">
          This week: {f.week.runs} run{f.week.runs === 1 ? "" : "s"} · paid to you {money(f.week.paidPence)} · driver wages {money(f.week.driverPence)} · fuel {money(f.week.fuelPence)} · business tax {money(f.week.taxPence)}
        </span>
      </section>

      {co.running.length > 0 && (
        <>
          <h3 className={styles.subhead}>On the road</h3>
          <ul className={styles.list}>
            {co.running.map((k) => {
              const total = new Date(k.endsAt).getTime() - new Date(k.startedAt).getTime();
              const done = Math.min(100, Math.max(0, ((serverNow() - new Date(k.startedAt).getTime()) / Math.max(1, total)) * 100));
              return (
                <li key={k.id} className={styles.workCard} data-testid="courier-running">
                  <div className={styles.workRow}>
                    <strong>{k.title}</strong>
                    <span className="chip">{countdown(new Date(k.endsAt).getTime() - serverNow())}</span>
                  </div>
                  <span className="tiny">
                    {k.tierName} · {k.goods} · {k.vehicleName} · back at {clock(k.endsAt)} · fee {money(k.payPence)}
                  </span>
                  <div className={styles.bar}>
                    <span style={{ width: `${done}%` }} />
                  </div>
                  {confirm === `back:${k.id}` ? (
                    <Confirm
                      text="Call the car back? The fee won't be paid, fuel isn't refunded and the run still counts towards today's limit."
                      yes="Call back"
                      disabled={!!pending}
                      onNo={() => setConfirm(null)}
                      onYes={async () => (await run("AbandonContract", { contractId: k.id }, "abandon")) && setConfirm(null)}
                    />
                  ) : (
                    <button className={styles.linkBtn} onClick={() => setConfirm(`back:${k.id}`)}>
                      Call the car back
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h3 className={styles.subhead}>Your cars</h3>
      <ul className={styles.list}>
        {co.cars.map((c) => (
          <li key={c.id} className={styles.action}>
            <div className={styles.actionMain}>
              <strong>
                <span className={styles.sw} style={{ background: c.colour, display: "inline-block", width: 14, height: 14, verticalAlign: "middle", marginRight: 6 }} aria-hidden />
                {c.name}
              </strong>
              <span className="tiny">
                Condition {c.condition}% · carries {c.cargo === 2 ? "heavy loads" : "parcels"}
              </span>
              {c.reason && <span className={styles.reason}>{c.reason}</span>}
            </div>
            {c.available ? <span className="chip good">Free</span> : <span className="chip">Busy</span>}
          </li>
        ))}
      </ul>

      <h3 className={styles.subhead}>Today's board · {left} left today</h3>
      <p className="tiny">Everyone sees the same board each day; your firm can run each listing once. Deliveries must arrive by the deadline.</p>
      <ul className={styles.list}>
        {co.board.listings.map((l) => {
          const carId = chosen[l.slot] ?? firstFree;
          const car = co.cars.find((c) => c.id === carId);
          const fuel = car ? contractFuel(car.tripPence, l.minutes) : 0;
          const wear = car ? contractWear(car.wearPerTrip, l.minutes, l.tier as ContractTier) : 0;
          const tooSmall = !!car && car.cargo < l.cargo;
          const blocked = !l.open || !car || !car.available || tooSmall || left <= 0 || fuel > s.wallet.cashPence;
          return (
            <li key={l.slot} className={`${styles.workCard} ${l.open ? "" : styles.actionOff}`} data-testid="courier-listing">
              <div className={styles.workRow}>
                <strong>{l.title}</strong>
                <span className={`chip ${l.open ? "good" : ""}`}>{money(l.payPence)}</span>
              </div>
              <span className="tiny">
                {l.tierName} · {l.goods} · {l.minutes} min · deliver by {clock(l.deadlineAt)} · driver {money(l.driverPence)}
                {l.cargo === 2 ? " · heavy load" : ""}
              </span>
              {l.reason ? (
                <p className={styles.reason}>{l.reason}</p>
              ) : (
                <>
                  {co.cars.length > 1 && (
                    <select className="input" value={carId} onChange={(e) => setChosen({ ...chosen, [l.slot]: e.target.value })} aria-label="Which car">
                      {co.cars.map((c) => (
                        <option key={c.id} value={c.id} disabled={!c.available}>
                          {c.name} ({c.condition}%){c.available ? "" : " · busy"}
                        </option>
                      ))}
                    </select>
                  )}
                  {car && (
                    <span className="tiny">
                      Fuel {money(fuel)} now · wear −{wear}% · you receive {money(l.payPence - l.driverPence)} before any business tax
                    </span>
                  )}
                  {tooSmall && <p className={styles.reason}>Needs a family car or an electric saloon.</p>}
                  {!car && <p className={styles.reason}>No car is free right now.</p>}
                  {left <= 0 && <p className={styles.reason}>Today's limit is reached. More cars or a higher level raise it.</p>}
                  <button className="btn small" disabled={!!pending || blocked} onClick={() => run("StartContract", { slot: l.slot, vehicleId: carId }, "dispatch")}>
                    Send {car ? car.name.toLowerCase() : "a car"}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {co.recent.length > 0 && (
        <>
          <h3 className={styles.subhead}>Recent runs</h3>
          <ul className={styles.ledger}>
            {co.recent.map((k) => (
              <li key={k.id}>
                <div>
                  <span>{k.title}</span>
                  <span className="tiny">
                    {k.tierName} · {when(k.startedAt)} · {k.status === "completed" ? `fee ${money(k.payPence)}, driver ${money(k.driverPence)}, fuel ${money(k.fuelPence)}, tax ${money(k.taxPence)}` : "called back"}
                  </span>
                </div>
                <span className={`${styles.ledgerAmt} ${k.status === "completed" ? styles.pos : styles.neg}`}>{k.status === "completed" ? money(k.paidPence) : "—"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="tiny">Contract tiers: {co.tiers.map((t) => `${t.name} (level ${t.minLevel}${t.cargo === 2 ? ", heavy" : ""})`).join(" · ")}. Business tax is weekly and only applies above an allowance.</p>
    </>
  );
}

// ───────────────────────────── Advertising ─────────────────────────────

/** A flat preview of a billboard design, matching the 3D panels. */
export function AdPreview({ template, colour, slogan, brand }: { template: string; colour: string; slogan: string; brand: string }) {
  const dark = template === "neon" || template === "chalk";
  const bg = template === "neon" ? "#17232b" : template === "chalk" ? "#2b3330" : template === "classic" ? "#f4eee4" : colour;
  const fg = template === "neon" ? colour : template === "chalk" ? "#f4eee4" : template === "classic" ? colour : "#fbf8f2";
  return (
    <div
      aria-label={`Ad preview: ${slogan} — ${brand}`}
      style={{
        position: "relative",
        background: bg,
        color: fg,
        borderRadius: 10,
        padding: "16px 14px 12px",
        minHeight: 96,
        display: "grid",
        alignContent: "center",
        gap: 6,
        textAlign: "center",
        border: template === "classic" ? `4px double ${colour}` : template === "chalk" ? "6px solid #8a6a4a" : "none",
        textShadow: template === "neon" ? `0 0 8px ${colour}` : undefined,
        fontFamily: template === "classic" ? "Georgia, serif" : template === "chalk" ? "'Comic Sans MS', 'Chalkboard SE', cursive" : "system-ui, sans-serif",
      }}
    >
      <span style={{ position: "absolute", top: 4, right: 8, fontSize: 10, opacity: 0.7, letterSpacing: ".08em", color: dark ? "#cfd6d2" : undefined }}>AD</span>
      <strong style={{ fontSize: template === "bold" ? 20 : 18, lineHeight: 1.2 }}>{slogan}</strong>
      <span style={{ fontSize: 13, opacity: 0.85 }}>— {brand}</span>
    </div>
  );
}

export function AdvertisingApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const ads = s.ads;
  const [siteId, setSiteId] = useState(ads.sites[0].id);
  const [week, setWeek] = useState<"this" | "next">("next");
  const [template, setTemplate] = useState<string>(ads.templates[0].id);
  const [colour, setColour] = useState<string>(ads.colours[0].id);
  const [slogan, setSlogan] = useState<string>(ads.slogans[0].id);
  const [brand, setBrand] = useState<"name" | "firm">("name");
  const [confirm, setConfirm] = useState<string | null>(null);
  const site = ads.sites.find((x) => x.id === siteId)!;
  const slot = week === "this" ? site.thisWeek : site.nextWeek;
  const price = slot.pricePence;
  const down = week === "this" ? site.thisWeek.down : null;
  const brandText = brand === "firm" ? ads.brands.firm ?? "" : ads.brands.name;
  const hex = ads.colours.find((c) => c.id === colour)?.hex ?? "#234C42";
  const sloganText = ads.slogans.find((x) => x.id === slogan)?.text ?? "";
  const blocked = !!down || slot.left <= 0 || price > s.wallet.cashPence || (brand === "firm" && !ads.brands.firm);

  return (
    <>
      <p className="tiny">
        Rent a billboard for a week (Monday 00:00 to Monday 00:00). Ads are built only from preset templates, colours and slogans, so they go up straight away with nothing to check. Every player sees them in the world. You're refunded only if your ad couldn't be shown: cancelled before its week starts, or the site was out of use that week. Advertisers never see who looked.
      </p>

      {ads.mine.length > 0 && (
        <>
          <h3 className={styles.subhead}>Your ads</h3>
          <ul className={styles.list}>
            {ads.mine.map((b) => (
              <li key={b.id} className={styles.workCard} data-testid="my-ad">
                <div className={styles.workRow}>
                  <strong>{b.siteName}</strong>
                  <span className={`chip ${b.status === "live" ? "good" : ""}`}>{{ scheduled: "Scheduled", live: "Live", expired: "Expired", cancelled: "Cancelled", refunded: "Refunded" }[b.status] ?? b.status}</span>
                </div>
                <AdPreview template={b.template} colour={b.colour} slogan={b.slogan} brand={b.brand} />
                <span className="tiny">
                  {when(b.start)} – {when(b.end)} · {money(b.pricePence)}
                  {b.refundReason ? ` · ${b.refundReason}` : ""}
                </span>
                {b.cancellable &&
                  (confirm === `cancel:${b.id}` ? (
                    <Confirm text={`Cancel before it goes up and get ${money(b.pricePence)} back?`} yes="Cancel ad" disabled={!!pending} onNo={() => setConfirm(null)} onYes={async () => (await run("CancelAd", { bookingId: b.id }, "cancel ad")) && setConfirm(null)} />
                  ) : (
                    <button className={styles.linkBtn} onClick={() => setConfirm(`cancel:${b.id}`)}>
                      Cancel for a full refund
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={styles.subhead}>1 · Choose a site</h3>
      <ul className={styles.list}>
        {ads.sites.map((x) => (
          <li key={x.id}>
            <button className={`${styles.styleBtn} ${siteId === x.id ? styles.styleOn : ""}`} style={{ width: "100%" }} aria-pressed={siteId === x.id} onClick={() => setSiteId(x.id)}>
              <strong>
                {x.name} · {money(x.pricePence)} / week
              </strong>
              <span className="tiny">
                {x.whereName}. {x.blurb}
              </span>
              <span className="tiny">
                This week: {x.thisWeek.down ? "out of use" : `${x.thisWeek.left}/${x.slots} free`} · next week: {x.nextWeek.left}/{x.slots} free
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className={styles.subhead}>2 · Choose the week</h3>
      <div className={styles.tabs} role="tablist">
        <button role="tab" aria-selected={week === "this"} className={week === "this" ? styles.tabOn : ""} onClick={() => setWeek("this")}>
          Rest of this week · {money(site.thisWeek.pricePence)}
        </button>
        <button role="tab" aria-selected={week === "next"} className={week === "next" ? styles.tabOn : ""} onClick={() => setWeek("next")}>
          Next week · {money(site.nextWeek.pricePence)}
        </button>
      </div>
      <span className="tiny">{week === "this" ? `Goes up now, until ${when(ads.week.end)}. Priced by whole days left.` : `From ${when(ads.next.start)} to ${when(ads.next.end)}.`}</span>

      <h3 className={styles.subhead}>3 · Design it</h3>
      <div className={styles.styles}>
        {ads.templates.map((t) => (
          <button key={t.id} className={`${styles.styleBtn} ${template === t.id ? styles.styleOn : ""}`} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
            <strong>{t.name}</strong>
            <span className="tiny">{t.blurb}</span>
          </button>
        ))}
      </div>
      <div className={styles.swatches} style={{ margin: "10px 0" }}>
        {ads.colours.map((c) => (
          <button key={c.id} aria-label={c.name} title={c.name} aria-pressed={colour === c.id} className={`${styles.sw} ${colour === c.id ? styles.swOn : ""}`} style={{ background: c.hex }} onClick={() => setColour(c.id)} />
        ))}
      </div>
      <select className="input" style={{ width: "100%" }} value={slogan} onChange={(e) => setSlogan(e.target.value)} aria-label="Slogan">
        {ads.slogans.map((x) => (
          <option key={x.id} value={x.id}>
            {x.text}
          </option>
        ))}
      </select>
      <div className={styles.tabs} role="tablist" style={{ marginTop: 10 }}>
        <button role="tab" aria-selected={brand === "name"} className={brand === "name" ? styles.tabOn : ""} onClick={() => setBrand("name")}>
          Signed: {ads.brands.name}
        </button>
        <button role="tab" aria-selected={brand === "firm"} className={brand === "firm" ? styles.tabOn : ""} onClick={() => setBrand("firm")} disabled={!ads.brands.firm} title={ads.brands.firm ? undefined : "Register a courier firm in Transport Co to advertise it"}>
          {ads.brands.firm ? `Signed: ${ads.brands.firm}` : "Your firm (none yet)"}
        </button>
      </div>

      <h3 className={styles.subhead}>Preview</h3>
      <AdPreview template={template} colour={hex} slogan={sloganText} brand={brandText} />
      {down && <p className={styles.reason}>{site.name} can't show ads this week: {down}</p>}
      {!down && slot.left <= 0 && <p className={styles.reason}>All slots on {site.name} are sold for that week.</p>}
      <div style={{ marginTop: 10 }}>
        {confirm === "book" ? (
          <Confirm
            text={`Book ${site.name} ${week === "this" ? "for the rest of this week" : "for next week"} at ${money(price)}? ${week === "this" ? "It goes up now and can't be refunded once it's showing." : "You can cancel for a full refund until it goes up. If the site can't show it, you're refunded automatically."}`}
            yes={`Book for ${money(price)}`}
            disabled={!!pending}
            onNo={() => setConfirm(null)}
            onYes={async () => (await run("BookAd", { siteId, week, template, colour, slogan, brand }, "book ad")) && setConfirm(null)}
          />
        ) : (
          <button className="btn" disabled={!!pending || blocked} onClick={() => setConfirm("book")}>
            Book · {money(price)}
          </button>
        )}
      </div>
      <p className="tiny">Up to {ads.maxPerWeek} ads a week per person, one per site. Prices are fictional game money.</p>
    </>
  );
}
