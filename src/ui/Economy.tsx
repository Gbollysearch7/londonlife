"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { APPEARANCE_OPTIONS, type Appearance } from "@/content/character";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

const AvatarPreview = dynamic(() => import("@/world/AvatarPreview"), { ssr: false, loading: () => <div className={styles.previewBox} /> });

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function PoundsInput({ label, onSubmit, max, disabled }: { label: string; onSubmit: (pence: number) => void; max: number; disabled: boolean }) {
  const [v, setV] = useState("");
  const pence = Math.round(Number(v) * 100);
  const ok = Number.isFinite(pence) && pence > 0 && pence <= max;
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
      <input className="input" style={{ width: 110 }} inputMode="decimal" placeholder="£0.00" value={v} onChange={(e) => setV(e.target.value)} aria-label={`${label} amount in pounds`} />
      <button className="btn small" disabled={!ok || disabled}>
        {label}
      </button>
      <button type="button" className="btn small secondary" disabled={max <= 0 || disabled} onClick={() => setV((max / 100).toFixed(2))}>
        All
      </button>
    </form>
  );
}

export function BankApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const b = s.bank;
  return (
    <>
      <div className={styles.balance}>
        <span className="tiny">Wallet</span>
        <strong>{money(s.wallet.cashPence)}</strong>
        <span className="tiny">Savings {money(b.savingsPence)} · Net worth {money(b.netWorthPence)}</span>
      </div>
      {b.unpaidCount > 0 && (
        <div className={styles.warning} style={{ marginBottom: 10 }}>
          <strong>
            {b.unpaidCount} unpaid bill{b.unpaidCount > 1 ? "s" : ""}: {money(b.unpaidPence)}.
          </strong>{" "}
          You won't lose your home, but unpaid rent lowers your mood and stops you moving.
          <div style={{ marginTop: 8 }}>
            <button className="btn small" disabled={!!pending} onClick={() => run("PayBills", {}, "bills")}>
              Pay what I can
            </button>
          </div>
        </div>
      )}
      <section className={styles.workCard}>
        <div className={styles.workRow}>
          <strong>Savings account</strong>
          <span className="chip good">{(b.weeklyRate * 100).toFixed(1)}% a week</span>
        </div>
        <span className="tiny">Interest is added once a day on balances of {money(b.minPence)} or more. Fictional rate; not real banking.</span>
        <PoundsInput label="Save" max={s.wallet.cashPence} disabled={!!pending} onSubmit={(p) => run("DepositSavings", { amountPence: p }, "save")} />
        <PoundsInput label="Withdraw" max={b.savingsPence} disabled={!!pending} onSubmit={(p) => run("WithdrawSavings", { amountPence: p }, "withdraw")} />
      </section>
      <h3 className={styles.subhead}>Bills</h3>
      {s.housing.owned ? (
        <p className="tiny">You own your home, so there's no rent to pay.</p>
      ) : (
        <p className="tiny">
          Rent: {money(s.housing.rentPence)} every Saturday at 09:00.
          {s.housing.nextRentAt && ` Next: ${when(s.housing.nextRentAt)}.`}
          {s.housing.rentFreeUntil && ` Covered by your starting support until ${when(s.housing.rentFreeUntil)}.`} Paid from your wallet first, then savings.
        </p>
      )}
      {b.bills.length > 0 && (
        <ul className={styles.ledger}>
          {b.bills.map((x) => (
            <li key={x.id}>
              <div>
                <strong>{x.description}</strong>
                <span className="tiny">Week {x.period}</span>
              </div>
              <div className={styles.ledgerAmt}>
                <span className={x.status === "unpaid" ? styles.neg : undefined}>{money(x.amountPence)}</span>
                <span className={`chip ${x.status === "unpaid" ? "bad" : x.status === "covered" ? "gold" : "good"}`}>{x.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <h3 className={styles.subhead}>Money history</h3>
      <ul className={styles.ledger}>
        {s.ledger.map((l) => (
          <li key={l.id}>
            <div>
              <strong>{l.description}</strong>
              <span className="tiny">
                {new Date(l.at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {l.category}
              </span>
            </div>
            <div className={styles.ledgerAmt}>
              <span className={l.amountPence < 0 ? styles.neg : styles.pos}>
                {l.amountPence > 0 ? "+" : ""}
                {money(l.amountPence)}
              </span>
              <span className="tiny">{money(l.balanceAfter)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function HomesApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [confirm, setConfirm] = useState<string | null>(null);
  const h = s.housing;
  const cur = h.tiers.find((t) => t.current)!;
  const busy = !!s.activity || !!s.journey || !!s.shift;
  return (
    <>
      <section className={styles.workCard}>
        <span className="tiny">Your home</span>
        <h3 style={{ fontSize: 22 }}>{cur.name}</h3>
        <p className={styles.actionDesc}>
          {cur.blurb} {cur.gridW}×{cur.gridD} in {cur.district}.
        </p>
        <div className={styles.chips}>
          {h.owned ? <span className="chip good">You own it</span> : <span className="chip">Rent {money(h.rentPence)} / week</span>}
          {!h.owned && h.depositPence > 0 && <span className="chip">Deposit held {money(h.depositPence)}</span>}
          {cur.mood > 0 && <span className="chip good">Mood +{cur.mood}</span>}
        </div>
        {!h.owned &&
          (cur.pricePence ? (
            confirm === "buy" ? (
              <div className={styles.confirm}>
                <span>
                  Buy it for {money(cur.pricePence)}? Your deposit comes back and rent stops for good.
                </span>
                <div>
                  <button className="btn small secondary" onClick={() => setConfirm(null)}>
                    Not yet
                  </button>
                  <button className="btn small" disabled={!!pending} onClick={async () => (await run("BuyHome", {}, "buy")) && setConfirm(null)}>
                    Buy for {money(cur.pricePence)}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn small" disabled={s.wallet.cashPence + h.depositPence < cur.pricePence} onClick={() => setConfirm("buy")}>
                Buy this home · {money(cur.pricePence)}
              </button>
            )
          ) : (
            <span className="tiny">This home can't be bought. Move somewhere you can buy.</span>
          ))}
      </section>
      <h3 className={styles.subhead}>Move house</h3>
      <p className="tiny">Moving in costs one week's rent as a refundable deposit plus two weeks' rent as a fee. Furniture that doesn't fit goes to storage — nothing is lost. Prices are fictional.</p>
      <ul className={styles.list}>
        {h.tiers
          .filter((t) => !t.current)
          .map((t) => {
            const total = t.deposit + t.fee;
            const afford = s.wallet.cashPence + h.depositPence + h.salePence >= total;
            return (
              <li key={t.id} className={styles.workCard}>
                <div className={styles.workRow}>
                  <strong>{t.name}</strong>
                  <span className="chip">{money(t.rentPence)} / week</span>
                </div>
                <p className={styles.actionDesc}>
                  {t.blurb} {t.gridW}×{t.gridD} · {t.district}
                  {t.mood ? ` · mood +${t.mood}` : ""}
                  {t.pricePence ? ` · buy for ${money(t.pricePence)}` : ""}
                </p>
                {confirm === t.id ? (
                  <div className={styles.confirm}>
                    <span>
                      Pay {money(t.deposit)} deposit + {money(t.fee)} fee{h.depositPence ? `; ${money(h.depositPence)} deposit returned` : ""}.
                      {h.owned ? ` Moving sells the home you own for ${money(h.salePence)} (90% of its price).` : ""}
                    </span>
                    <div>
                      <button className="btn small secondary" onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                      <button className="btn small" disabled={!!pending} onClick={async () => (await run("MoveHome", { tierId: t.id }, "move")) && setConfirm(null)}>
                        Move in
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn small secondary" disabled={!afford || busy || s.bank.unpaidCount > 0} onClick={() => setConfirm(t.id)} title={!afford ? `Needs ${money(total)}` : undefined}>
                    Move here · {money(total)}
                  </button>
                )}
              </li>
            );
          })}
      </ul>
    </>
  );
}

function LessonQuiz({ courseId, quiz }: { courseId: string; quiz: NonNullable<State["courses"]["list"][number]["quiz"]> }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [result, setResult] = useState<{ correct: number; passed: boolean; solutions: number[] } | null>(null);
  if (result)
    return (
      <div className={styles.workCard}>
        <strong>{result.passed ? `Passed: ${result.correct}/3` : `${result.correct}/3 — attend the class again to retry`}</strong>
        <ol className={styles.tour}>
          {quiz.questions.map((q, i) => (
            <li key={i}>
              <span>{answers[i] === result.solutions[i] ? "✓" : "✗"}</span>
              <div>
                {q.prompt}
                <div className="tiny">Answer: {q.options[result.solutions[i]]}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  return (
    <div className={styles.workCard}>
      <strong>
        Lesson {quiz.lesson} quiz · {quiz.title}
      </strong>
      {quiz.questions.map((q, i) => (
        <fieldset key={i} className={styles.quizField}>
          <legend>{q.prompt}</legend>
          {q.options.map((o, k) => (
            <label key={k} className={styles.quizOpt}>
              <input type="radio" name={`q${i}`} checked={answers[i] === k} onChange={() => setAnswers(answers.map((a, j) => (j === i ? k : a)))} />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      <button
        className="btn small"
        disabled={answers.some((a) => a === null) || !!pending}
        onClick={async () => {
          const r = await run("SubmitLessonQuiz", { courseId, answers }, "quiz");
          if (r && r.result) setResult(r.result as { correct: number; passed: boolean; solutions: number[] });
        }}
      >
        Submit answers
      </button>
      <span className="tiny">Pass with 2 of 3. Your notes above have every answer.</span>
    </div>
  );
}

export function CoursesApp({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const setMapFocus = useGame((x) => x.setMapFocus);
  const [open, setOpen] = useState<string | null>(s.courses.list.find((c) => c.quiz)?.id ?? null);
  const atCampus = s.character.location === "learning_campus";
  return (
    <>
      <p className="tiny">
        Classes are held at the London Learning Campus: 45 minutes, £30 each, up to {s.courses.classesPerDay} a day ({s.courses.classesToday} today). Each class ends with a three-question quiz. Five passed lessons earn a certificate (+3 stars) and faster performance in the matching career.
      </p>
      {!atCampus && (
        <button
          className="btn small secondary"
          style={{ marginBottom: 10 }}
          onClick={() => {
            setMapFocus("learning_campus");
            setSheet("map");
          }}
        >
          Travel to the campus
        </button>
      )}
      <ul className={styles.list}>
        {s.courses.list.map((c) => (
          <li key={c.id} className={styles.workCard}>
            <button className={styles.courseHead} onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
              <div>
                <strong>{c.name}</strong>
                <span className="tiny">
                  {c.blurb} · trains {c.skill} · boosts {c.career} careers
                </span>
              </div>
              {c.certified ? <span className="chip gold">Certified ✦</span> : c.quiz ? <span className="chip bad">Quiz ready</span> : <span className="chip">{c.passed}/5</span>}
            </button>
            <div className={styles.bar}>
              <span style={{ width: `${(c.passed / c.total) * 100}%` }} />
            </div>
            {open === c.id && (
              <>
                {c.quiz && <LessonQuiz key={`${c.id}${c.quiz.lesson}`} courseId={c.id} quiz={c.quiz} />}
                <ol className={styles.lessons}>
                  {c.lessons.map((l) => (
                    <li key={l.n} className={l.n <= c.passed ? styles.lessonDone : ""}>
                      <strong>
                        {l.n}. {l.title}
                      </strong>
                      {l.notes ? <p className={styles.actionDesc}>{l.notes}</p> : <span className="tiny">Notes unlock when you attend this class.</span>}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const SLOT_LABEL: Record<string, string> = { top: "Tops", bottom: "Bottoms", hat: "Hats", glasses: "Glasses", scarf: "Scarves" };

export function WardrobeApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setSheet = useGame((x) => x.setSheet);
  const setMapFocus = useGame((x) => x.setMapFocus);
  const a = s.character.appearance;
  const atShop = s.character.location === s.wardrobe.shop;
  const atSalon = s.character.location === s.wardrobe.salon.venue;
  const [hair, setHair] = useState({ hairStyle: a.hairStyle, hairColour: a.hairColour });
  const preview: Appearance = useMemo(() => (atSalon ? { ...a, ...hair } : a), [a, hair, atSalon]);
  const items = s.wardrobe.items;
  const worn = (slot: string, style: number) => {
    const o = a.outfit ?? {};
    if (slot === "top") return (o.top ?? 0) === style;
    if (slot === "bottom") return (o.bottom ?? 0) === style;
    if (slot === "hat") return (o.hat ?? 0) === style;
    if (slot === "glasses") return !!o.glasses;
    return !!o.scarf;
  };
  const hairCost = (hair.hairStyle !== a.hairStyle ? s.wardrobe.salon.stylePence : 0) + (hair.hairColour !== a.hairColour ? s.wardrobe.salon.colourPence : 0);
  return (
    <>
      <div className={styles.previewBox}>
        <AvatarPreview appearance={preview} />
      </div>
      <h3 className={styles.subhead}>Colours</h3>
      {(["top", "bottom", "shoes"] as const).map((k) => (
        <div key={k} className={styles.swatchRow}>
          <span className="tiny">{k === "top" ? "Top" : k === "bottom" ? "Bottoms" : "Shoes"}</span>
          <div className={styles.swatches}>
            {APPEARANCE_OPTIONS[k].map((c, i) => (
              <button
                key={c}
                className={`${styles.sw} ${a[k] === i ? styles.swOn : ""}`}
                style={{ background: c }}
                aria-label={`${k} colour ${i + 1}`}
                aria-pressed={a[k] === i}
                disabled={!!pending}
                onClick={() => run("EquipOutfit", { [`${k}Colour`]: i }, "outfit")}
              />
            ))}
          </div>
        </div>
      ))}
      {(["top", "bottom", "hat", "glasses", "scarf"] as const).map((slot) => (
        <section key={slot}>
          <h3 className={styles.subhead}>{SLOT_LABEL[slot]}</h3>
          <ul className={styles.cards}>
            {items
              .filter((g) => g.slot === slot)
              .map((g) => {
                const on = worn(slot, g.style);
                return (
                  <li key={g.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <strong>{g.name}</strong>
                      {on && <span className="chip good">Wearing</span>}
                    </div>
                    {g.owned ? (
                      <button
                        className="btn small secondary"
                        disabled={!!pending}
                        onClick={() =>
                          run(
                            "EquipOutfit",
                            slot === "glasses" ? { glasses: !on } : slot === "scarf" ? { scarf: !on } : slot === "hat" ? { hat: on ? null : g.id } : { [slot]: g.id },
                            "outfit",
                          )
                        }
                      >
                        {on ? (slot === "top" || slot === "bottom" ? "Wearing" : "Take off") : "Wear"}
                      </button>
                    ) : (
                      <button className="btn small" disabled={!atShop || !!pending || g.pricePence > s.wallet.cashPence} onClick={() => run("BuyGarment", { itemId: g.id }, "buy")}>
                        Buy {money(g.pricePence)}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {!atShop && (
        <p className="tiny">
          New clothes are sold at the vintage stalls in Borough Street Market.{" "}
          <button
            className={styles.linkBtn}
            style={{ color: "var(--green)" }}
            onClick={() => {
              setMapFocus(s.wardrobe.shop);
              setSheet("map");
            }}
          >
            Go there
          </button>
        </p>
      )}
      <h3 className={styles.subhead}>Hair at Crown & Curl</h3>
      {atSalon ? (
        <>
          <div className={styles.filters}>
            {APPEARANCE_OPTIONS.hairStyle.map((h, i) => (
              <button key={h} className={`${styles.filter} ${hair.hairStyle === i ? styles.filterOn : ""}`} onClick={() => setHair({ ...hair, hairStyle: i })}>
                {h}
              </button>
            ))}
          </div>
          <div className={styles.swatches}>
            {APPEARANCE_OPTIONS.hairColour.map((c, i) => (
              <button key={c} className={`${styles.sw} ${hair.hairColour === i ? styles.swOn : ""}`} style={{ background: c }} aria-label={`Hair colour ${i + 1}`} onClick={() => setHair({ ...hair, hairColour: i })} />
            ))}
          </div>
          <button className="btn small" style={{ marginTop: 8 }} disabled={!hairCost || !!pending || hairCost > s.wallet.cashPence} onClick={() => run("ChangeHair", hair, "hair")}>
            {hairCost ? `Book it · ${money(hairCost)}` : "Pick a new look"}
          </button>
          <p className="tiny">
            New style {money(s.wardrobe.salon.stylePence)} · new colour {money(s.wardrobe.salon.colourPence)}. Preview is free.
          </p>
        </>
      ) : (
        <p className="tiny">Visit Crown & Curl in Brixton to change your hairstyle or colour.</p>
      )}
    </>
  );
}

export function FoodApp({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const d = s.delivery;
  return (
    <>
      <p className="tiny">
        Delivered to your home in about {d.minutes} minutes for a {money(d.feePence)} fee. Takeaways are eaten at home; ingredients go in your cupboard. Orders can't be cancelled once placed.
      </p>
      <ul className={styles.cards}>
        {d.menu.map((m) => (
          <li key={m.id} className={styles.card}>
            <div className={styles.cardTop}>
              <strong>{m.name}</strong>
              <span className="chip">{money(m.pricePence)}</span>
            </div>
            <p className={styles.actionDesc}>{m.blurb}</p>
            <span className="tiny">{m.contents.join(" · ")}</span>
            <button className="btn small" disabled={!!pending || m.pricePence + d.feePence > s.wallet.cashPence} onClick={() => run("OrderDelivery", { menuId: m.id }, "order")}>
              Order · {money(m.pricePence + d.feePence)}
            </button>
          </li>
        ))}
      </ul>
      {d.orders.length > 0 && (
        <>
          <h3 className={styles.subhead}>Your orders</h3>
          <ul className={styles.ledger}>
            {d.orders.map((o) => (
              <li key={o.id}>
                <div>
                  <strong>{o.name}</strong>
                  <span className="tiny">{o.status === "pending" ? `Arriving ${when(o.deliverAt)}` : "Delivered home"}</span>
                </div>
                <span className={`chip ${o.status === "pending" ? "gold" : "good"}`}>{o.status === "pending" ? "On its way" : "Delivered"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
