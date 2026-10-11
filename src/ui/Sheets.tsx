"use client";
import { useEffect, useMemo, useState } from "react";
import { furnitureDef } from "@/content/catalogue";
import { NEED_IDS } from "@/content/types";
import { venue } from "@/content/world";
import { NEED_CONSEQUENCES, NEED_RECOVERY } from "@/sim/needs";
import { footprint, placementError, firstFreeSpot } from "@/sim/placement";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import Sheet from "./Sheet";
import { GalleryCounter } from "./Gallery";
import { NEED_META, duration, effectChips, money } from "./format";
import styles from "./ui.module.css";

type Action = State["actions"][number];

export function ActionRow({ a, onStart, disabled }: { a: Action; onStart: () => void; disabled: boolean }) {
  const chips = effectChips(a.needs);
  return (
    <li className={`${styles.action} ${!a.available ? styles.actionOff : ""}`}>
      <div className={styles.actionMain}>
        <div className={styles.actionTitle}>
          <strong>{a.label}</strong>
          {a.npc && <span className="chip">NPC</span>}
        </div>
        {a.description && <p className={styles.actionDesc}>{a.description}</p>}
        <div className={styles.chips}>
          <span className="chip">⏱ {duration(a.minutes)}</span>
          {a.costPence > 0 && <span className="chip bad">Costs {money(a.costPence)}</span>}
          {a.payPence > 0 && <span className="chip good">Pays {money(a.payPence)}</span>}
          {a.xp && (
            <span className="chip gold">
              {a.xp.skill === "enterprise" ? "Enterprise" : a.xp.skill[0].toUpperCase() + a.xp.skill.slice(1)} +{a.xp.amount} XP
            </span>
          )}
          {chips.map((c) => (
            <span key={c.key} className={`chip ${c.good ? "good" : "bad"}`}>
              {c.text}
            </span>
          ))}
          {a.consumes.map((c) => (
            <span key={c.id} className="chip">
              Uses {c.qty} × {c.name}
            </span>
          ))}
          {a.produces.map((c) => (
            <span key={c.id} className="chip good">
              Makes {c.name}
            </span>
          ))}
        </div>
        {!a.available && a.reason && <p className={styles.reason}>{a.reason}</p>}
      </div>
      <button className="btn small" disabled={!a.available || disabled} onClick={onStart} aria-label={`Start: ${a.label}`}>
        Start
      </button>
    </li>
  );
}

function WorkSection({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const setSheet = useGame((x) => x.setSheet);
  const pending = useGame((x) => x.pending);
  const cur = s.career.current;
  if (!cur || cur.workplace !== s.character.location || s.shift) return null;
  return (
    <section className={styles.group}>
      <h3>Work</h3>
      <div className={styles.action}>
        <div className={styles.actionMain}>
          <strong>Start your shift</strong>
          <span className="tiny">
            {cur.title} · 60 min · pays {money(cur.salaryPence)} before tax · trains {cur.skill}
          </span>
          {cur.reason && <p className={styles.reason}>{cur.reason}</p>}
        </div>
        <button
          className="btn small"
          disabled={!cur.canStart || !!pending}
          onClick={async () => {
            if (await run("StartShift", {}, "shift")) setSheet(null);
          }}
        >
          Start shift
        </button>
      </div>
    </section>
  );
}

export function ActionsSheet({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const place = venue(s.character.location)!;
  const groups = ["Care", "Eat", "Cook", "Earn", "Learn"];
  const visible = s.actions.filter((a) => !a.hidden);
  return (
    <Sheet title={s.journey ? "Travelling" : place.name} onClose={() => setSheet(null)}>
      {s.journey ? (
        <p className="muted">You're on the move. Actions are available when you arrive.</p>
      ) : (
        <>
          {place.kind === "venue" && <p className="muted">{place.blurb}</p>}
          {s.treasure.anchor && (
            <div className={styles.bonus}>
              <div>
                <strong>Something sparkles here…</strong>
                <span className="tiny">Today's treasure is hidden at this place.</span>
              </div>
              <button className="btn small" disabled={!!pending} onClick={async () => (await run("ClaimTreasure", {}, "treasure")) && setSheet(null)}>
                Search for it
              </button>
            </div>
          )}
          <WorkSection s={s} />
          {groups.map((g) => {
            const list = visible.filter((a) => a.group === g).sort((a, b) => Number(b.available) - Number(a.available));
            if (!list.length) return null;
            return (
              <section key={g} className={styles.group}>
                <h3>{g}</h3>
                <ul className={styles.list}>
                  {list.map((a) => (
                    <ActionRow
                      key={a.id}
                      a={a}
                      disabled={!!pending}
                      onStart={async () => {
                        if (await run("StartActivity", { activityId: a.id }, a.label)) setSheet(null);
                      }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          <GroceryCounter s={s} />
          <GalleryCounter s={s} />
          {place.kind === "venue" && (
            <p className="tiny">Characters marked NPC are authored locals, not other players. Other players arrive in a later update.</p>
          )}
        </>
      )}
    </Sheet>
  );
}

export function GroceryCounter({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [qty, setQty] = useState<Record<string, number>>({});
  if (!s.groceries.length) return null;
  return (
    <section className={styles.group}>
      <h3>Grocery counter</h3>
      <ul className={styles.list}>
        {s.groceries.map((g) => {
          const q = qty[g.id] ?? 1;
          const owned = s.inventory.find((i) => i.id === g.id)?.qty ?? 0;
          return (
            <li key={g.id} className={styles.action}>
              <div className={styles.actionMain}>
                <strong>{g.name}</strong>
                <span className="tiny">
                  {money(g.pricePence)} per {g.unit} · you have {owned}
                </span>
              </div>
              <div className={styles.qty}>
                <button aria-label={`Fewer ${g.name}`} onClick={() => setQty({ ...qty, [g.id]: Math.max(1, q - 1) })}>
                  −
                </button>
                <span>{q}</span>
                <button aria-label={`More ${g.name}`} onClick={() => setQty({ ...qty, [g.id]: Math.min(10, q + 1) })}>
                  +
                </button>
              </div>
              <button className="btn small" disabled={!!pending || g.pricePence * q > s.wallet.cashPence} onClick={() => run("BuyGroceries", { itemId: g.id, qty: q }, "groceries")}>
                Buy {money(g.pricePence * q)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TAG_FILTERS = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "earn", label: "Earn" },
  { id: "learn", label: "Learn" },
  { id: "fitness", label: "Fitness" },
  { id: "music", label: "Music" },
  { id: "night", label: "Night out" },
  { id: "free", label: "Free" },
  { id: "outdoors", label: "Outdoors" },
];

export function MapSheet({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const focus = useGame((x) => x.mapFocus);
  const setFocus = useGame((x) => x.setMapFocus);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const busy = !!s.activity || !!s.journey || !!s.shift;
  const list = s.directory
    .filter((d) => `${d.name} ${d.district} ${d.blurb}`.toLowerCase().includes(query.toLowerCase()))
    .filter((d) => tag === "all" || d.tags.includes(tag))
    .sort((a, b) => Number(b.id === focus) - Number(a.id === focus) || Number(b.here) - Number(a.here));
  useEffect(() => {
    if (focus) document.getElementById(`place-${focus}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);
  return (
    <Sheet title="London" onClose={() => setSheet(null)} half>
      <p className="tiny" style={{ marginTop: 0 }}>
        Tap a pin on the map or pick a place below. Fares and times are fictional game values.
      </p>
      <label className="field">
        <span className="tiny">Search places</span>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Music, gym, market, Brixton…" />
      </label>
      <div className={styles.filters}>
        {TAG_FILTERS.map((t) => (
          <button key={t.id} className={`${styles.filter} ${tag === t.id ? styles.filterOn : ""}`} aria-pressed={tag === t.id} onClick={() => setTag(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <ul className={styles.list}>
        {list.map((d) => (
          <li key={d.id} id={`place-${d.id}`} className={styles.place} style={d.id === focus ? { borderColor: "var(--gold)", boxShadow: "0 0 0 2px rgba(198,156,88,.35)" } : undefined} onClick={() => setFocus(d.id)}>
            <div>
              <div className={styles.actionTitle}>
                <strong>{d.name}</strong>
                {d.here && <span className="chip good">You're here</span>}
                {!d.open && <span className="chip bad">Closed now</span>}
              </div>
              <p className={styles.actionDesc}>{d.blurb}</p>
              <span className="tiny">
                {d.district} · {d.opening} · {d.access}
                {d.npcs.length ? ` · ${d.npcs.map((n) => n.name).join(", ")} (NPC)` : ""}
              </span>
            </div>
            {!d.here && (
              <div className={styles.quotes}>
                {d.quotes.map((q) => (
                  <button
                    key={q.mode}
                    className="btn small secondary"
                    disabled={busy || !!pending || q.farePence > s.wallet.cashPence}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await run("StartJourney", { destination: d.id, mode: q.mode }, "travel")) setSheet(null);
                    }}
                    aria-label={`${q.name} to ${d.name}: ${q.minutes} minutes, ${q.farePence ? money(q.farePence) : "free"}`}
                  >
                    {q.name} · {q.minutes} min · {q.farePence ? money(q.farePence) : "free"}
                  </button>
                ))}
              </div>
            )}
            {!d.here && !d.open && <span className="tiny">You can travel now, but activities there wait until it opens.</span>}
          </li>
        ))}
      </ul>
      {busy && (
        <p className={styles.reason}>{s.journey ? "You're already travelling." : s.shift ? "You're on shift. Leave your shift before travelling." : "Finish or stop your current activity before travelling."}</p>
      )}
      <p className="tiny">The Tube runs between districts. Taxis go anywhere for a fare.</p>
    </Sheet>
  );
}

export function NeedsSheet({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  return (
    <Sheet title="How you're doing" onClose={() => setSheet(null)}>
      <section className={styles.group}>
        <h3>
          Mood: {s.mood.label} ({s.mood.score})
        </h3>
        {s.health && (
          <p className={styles.reason}>
            {s.health.label}: {s.health.blurb}
          </p>
        )}
        {s.moodlets.length > 0 && (
          <div className={styles.moodlets}>
            {s.moodlets.map((m) => (
              <span key={m.id} className={`chip ${m.strength > 0 ? "good" : "bad"}`} title={`Until ${new Date(m.expiresAt).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}`}>
                {m.icon} {m.label} {m.strength > 0 ? "+" : ""}
                {m.strength}
              </span>
            ))}
          </div>
        )}
        <ul className={styles.factors}>
          {s.mood.factors.map((f) => (
            <li key={f.label}>
              <span>{f.label}</span>
              <strong>{f.value > 0 && f.label !== "Needs" ? "+" : ""}{f.value}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.group}>
        <h3>Needs</h3>
        <ul className={styles.list}>
          {NEED_IDS.map((id) => (
            <li key={id} className={styles.needDetail}>
              <div className={styles.actionTitle}>
                <strong>{NEED_META[id].label}</strong>
                <span className={`chip ${s.needs[id] <= 20 ? "bad" : ""}`}>{Math.round(s.needs[id])} / 100</span>
              </div>
              <p className={styles.actionDesc}>{NEED_CONSEQUENCES[id]}</p>
              <p className="tiny">How to recover: {NEED_RECOVERY[id]}</p>
            </li>
          ))}
        </ul>
        <p className="tiny">Needs drop in real time, even while you're away (up to 8 hours per absence). New arrivals get a protected first day.</p>
      </section>
    </Sheet>
  );
}

export function BuySheet({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const setPlacement = useGame((x) => x.setPlacement);
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [tab, setTab] = useState<"shop" | "owned">("shop");
  const [cat, setCat] = useState("All");
  const [colours, setColours] = useState<Record<string, string>>({});
  const cats = ["All", ...Array.from(new Set(s.catalogue.map((c) => c.category)))];
  const atHome = s.character.location === "home" && !s.journey;
  const placedList = s.furniture.filter((f) => f.placed).map((f) => ({ id: f.id, defId: f.defId, x: f.x!, y: f.y!, rot: f.rot }));

  function startPlacing(instanceId: string, defId: string) {
    const f = s.furniture.find((x) => x.id === instanceId)!;
    const spot =
      f.placed && f.x !== null
        ? { x: f.x, y: f.y!, rot: f.rot }
        : firstFreeSpot(defId, placedList, s.home.tier.gridW, s.home.tier.gridD) ?? { x: 0, y: 0, rot: 0 };
    setPlacement({ instanceId, defId, x: spot.x, y: spot.y, rot: spot.rot });
    setSheet(null);
  }

  return (
    <Sheet title="Furnish your home" onClose={() => setSheet(null)} wide>
      <div className={styles.tabs} role="tablist">
        <button role="tab" aria-selected={tab === "shop"} className={tab === "shop" ? styles.tabOn : ""} onClick={() => setTab("shop")}>
          Shop
        </button>
        <button role="tab" aria-selected={tab === "owned"} className={tab === "owned" ? styles.tabOn : ""} onClick={() => setTab("owned")}>
          Your items ({s.furniture.length})
        </button>
      </div>
      {tab === "shop" ? (
        <>
          <div className={styles.filters}>
            {cats.map((c) => (
              <button key={c} className={`${styles.filter} ${cat === c ? styles.filterOn : ""}`} onClick={() => setCat(c)} aria-pressed={cat === c}>
                {c}
              </button>
            ))}
          </div>
          <p className="tiny">Bought items are delivered to storage straight away. Placing them is free; selling returns half the price.</p>
          <ul className={styles.cards}>
            {s.catalogue
              .filter((d) => cat === "All" || d.category === cat)
              .map((d) => {
                const colour = colours[d.id] ?? d.colours[0];
                return (
                  <li key={d.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <strong>{d.name}</strong>
                      <span className="chip">{d.surface === "wall" ? "Wall" : `${d.w}×${d.d}`}</span>
                    </div>
                    <p className={styles.actionDesc}>{d.blurb}</p>
                    <div className={styles.swatches}>
                      {d.colours.map((c) => (
                        <button key={c} aria-label={`Colour ${c}`} aria-pressed={colour === c} className={`${styles.sw} ${colour === c ? styles.swOn : ""}`} style={{ background: c }} onClick={() => setColours({ ...colours, [d.id]: c })} />
                      ))}
                    </div>
                    <div className={styles.cardFoot}>
                      <span className="tiny">{"★".repeat(d.quality)} quality</span>
                      <button
                        className="btn small"
                        disabled={!!pending || d.pricePence > s.wallet.cashPence}
                        title={d.pricePence > s.wallet.cashPence ? `You need ${money(d.pricePence - s.wallet.cashPence)} more` : undefined}
                        onClick={async () => {
                          if (await run("BuyFurniture", { defId: d.id, colour }, "buy")) setTab("owned");
                        }}
                      >
                        Buy {money(d.pricePence)}
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </>
      ) : (
        <>
          {!atHome && <p className={styles.reason}>Go home to place, move or sell furniture.</p>}
          {s.activity && atHome && <p className={styles.reason}>Finish or stop your current activity to rearrange.</p>}
          <ul className={styles.list}>
            {s.furniture.map((f) => (
              <li key={f.id} className={styles.action}>
                <div className={styles.actionMain}>
                  <strong>{f.name}</strong>
                  <span className="tiny">{f.placed ? "In your home" : "In storage"}</span>
                </div>
                <div className={styles.quotes}>
                  <button className="btn small secondary" disabled={!atHome || !!s.activity} onClick={() => startPlacing(f.id, f.defId)}>
                    {f.placed ? "Move" : "Place"}
                  </button>
                  {f.placed && (
                    <button className="btn small secondary" disabled={!atHome || !!s.activity || !!pending} onClick={() => run("StoreFurniture", { instanceId: f.id }, "store")}>
                      Store
                    </button>
                  )}
                  <SellButton disabled={!atHome || !!s.activity || !!pending} value={f.resalePence} onSell={() => run("SellFurniture", { instanceId: f.id }, "sell")} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}

function SellButton({ disabled, value, onSell }: { disabled: boolean; value: number; onSell: () => void }) {
  const [ask, setAsk] = useState(false);
  if (ask)
    return (
      <span className={styles.quotes}>
        <button className="btn small danger" onClick={onSell}>
          Sell for {money(value)}
        </button>
        <button className="btn small secondary" onClick={() => setAsk(false)}>
          Keep
        </button>
      </span>
    );
  return (
    <button className="btn small secondary" disabled={disabled} onClick={() => setAsk(true)}>
      Sell
    </button>
  );
}

/** On-screen and keyboard controls for placing a ghost. R rotates, arrows move, Enter places, Escape cancels. */
export function PlacementBar({ s }: { s: State }) {
  const placement = useGame((x) => x.placement)!;
  const setPlacement = useGame((x) => x.setPlacement);
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const { gridW, gridD } = s.home.tier;
  const others = useMemo(
    () => s.furniture.filter((f) => f.placed && f.id !== placement.instanceId).map((f) => ({ id: f.id, defId: f.defId, x: f.x!, y: f.y!, rot: f.rot })),
    [s.furniture, placement.instanceId],
  );
  const err = placementError({ id: placement.instanceId, defId: placement.defId, x: placement.x, y: placement.y, rot: placement.rot }, others, gridW, gridD);
  const def = furnitureDef(placement.defId)!;

  const move = (dx: number, dy: number) => {
    const fp = footprint(placement.defId, placement.rot);
    setPlacement({ ...placement, x: Math.max(0, Math.min(gridW - fp.w, placement.x + dx)), y: Math.max(0, Math.min(gridD - fp.d, placement.y + dy)) });
  };
  const rotate = () => {
    const order = def.surface === "wall" ? [0, 90] : [0, 90, 180, 270];
    const rot = order[(order.indexOf(placement.rot) + 1) % order.length];
    let { x, y } = placement;
    if (def.surface === "wall") {
      if (rot === 90) x = 0;
      else y = 0;
    }
    const fp = footprint(placement.defId, rot);
    setPlacement({ ...placement, rot, x: Math.min(x, gridW - fp.w), y: Math.min(y, gridD - fp.d) });
  };
  const commit = async () => {
    if (err) return;
    if (await run("PlaceFurniture", { instanceId: placement.instanceId, x: placement.x, y: placement.y, rot: placement.rot }, "place")) setPlacement(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") rotate();
      else if (e.key === "ArrowLeft") move(-1, 0);
      else if (e.key === "ArrowRight") move(1, 0);
      else if (e.key === "ArrowUp") move(0, -1);
      else if (e.key === "ArrowDown") move(0, 1);
      else if (e.key === "Enter") commit();
      else if (e.key === "Escape") setPlacement(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={styles.placement} role="region" aria-label={`Placing ${def.name}`}>
      <div>
        <strong>Placing {def.name}</strong>
        <p className={err ? styles.reason : "tiny"} role="status">
          {err ?? "Looks good. Tap the floor or use the arrows to move it."}
        </p>
        <p className="tiny">Keys: arrows move · R rotate · Enter place · Esc cancel</p>
      </div>
      <div className={styles.placeBtns}>
        <div className={styles.pad}>
          <button onClick={() => move(0, -1)} aria-label="Move back">
            ↑
          </button>
          <button onClick={() => move(-1, 0)} aria-label="Move left">
            ←
          </button>
          <button onClick={() => move(1, 0)} aria-label="Move right">
            →
          </button>
          <button onClick={() => move(0, 1)} aria-label="Move forward">
            ↓
          </button>
        </div>
        <button className="btn small secondary" onClick={rotate}>
          Rotate
        </button>
        <button className="btn small secondary" onClick={() => setPlacement(null)}>
          Cancel
        </button>
        <button className="btn small" disabled={!!err || !!pending} onClick={commit}>
          Place here
        </button>
      </div>
    </div>
  );
}
