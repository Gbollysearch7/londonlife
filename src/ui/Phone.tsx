"use client";
import { useState } from "react";
import { postJson } from "@/client/api";
import { useGame, type PhoneApp } from "@/client/store";
import type { State } from "@/client/api";
import Sheet from "./Sheet";
import { money } from "./format";
import { StoriesApp, TreasureApp } from "./Stories";
import { GoalsApp, PeopleApp, PerksApp } from "./Goals";
import { BankApp, CoursesApp, FoodApp, HomesApp, WardrobeApp } from "./Economy";
import { GamesApp, GovernmentApp } from "./Games";
import styles from "./ui.module.css";

const LIVE: { id: PhoneApp | "travel" | "help" | "settings"; name: string; icon: string }[] = [
  { id: "goals", name: "Goals", icon: "★" },
  { id: "stories", name: "Stories", icon: "✎" },
  { id: "treasure", name: "Treasure", icon: "◈" },
  { id: "jobs", name: "Jobs", icon: "◆" },
  { id: "perks", name: "Perks", icon: "✦" },
  { id: "people", name: "People", icon: "☺" },
  { id: "missions", name: "Missions", icon: "✓" },
  { id: "bank", name: "Bank", icon: "£" },
  { id: "homes", name: "Homes", icon: "⌂" },
  { id: "courses", name: "Courses", icon: "✎" },
  { id: "wardrobe", name: "Wardrobe", icon: "♦" },
  { id: "food", name: "Food", icon: "◐" },
  { id: "games", name: "Games", icon: "◉" },
  { id: "government", name: "Government", icon: "⚑" },
  { id: "skills", name: "Skills", icon: "↑" },
  { id: "profile", name: "Profile", icon: "☺" },
  { id: "inventory", name: "Kitchen", icon: "◫" },
  { id: "tour", name: "First steps", icon: "➜" },
  { id: "travel", name: "Travel", icon: "⌖" },
  { id: "help", name: "Help", icon: "?" },
  { id: "settings", name: "Settings", icon: "⚙" },
];

const LATER: { name: string; when: string }[] = [
  { name: "Vehicles", when: "Milestone 5" },
  { name: "Staff", when: "Milestone 2 (next)" },
  { name: "Messages", when: "Milestone 3" },
  { name: "Contacts", when: "Milestone 3" },
  { name: "Invitations", when: "Milestone 3" },
  { name: "Family", when: "Milestone 3" },
  { name: "Rankings", when: "Milestone 3" },
  { name: "Player work", when: "Milestone 3" },
  { name: "Company", when: "Milestone 3" },
  { name: "Shops", when: "Milestone 3" },
  { name: "Investments", when: "Milestone 3" },
  { name: "City feed", when: "Milestone 3" },
  { name: "Police", when: "Milestone 4" },
  { name: "Court", when: "Milestone 4" },
  { name: "Insurance", when: "Milestone 5" },
  { name: "Transport Co", when: "Milestone 5" },
  { name: "Advertising", when: "Milestone 5" },
];

const TITLES: Record<string, string> = {
  home: "Phone",
  jobs: "Jobs",
  missions: "Daily missions",
  bank: "Bank",
  skills: "Skills",
  profile: "Profile",
  inventory: "Kitchen cupboard",
  tour: "Your first twenty minutes",
  stories: "Stories",
  homes: "Homes",
  courses: "Courses",
  wardrobe: "Wardrobe",
  food: "Food delivery",
  games: "Games",
  government: "City government",
  goals: "Goals",
  perks: "Perks",
  people: "People",
  treasure: "Daily treasure",
  help: "Help",
  settings: "Settings",
};

export function PhoneSheet({ s }: { s: State }) {
  const app = useGame((x) => x.phoneApp);
  const setApp = useGame((x) => x.setPhoneApp);
  const setSheet = useGame((x) => x.setSheet);
  const [local, setLocal] = useState<string | null>(null);
  const current = local ?? app;
  const open = (id: string) => {
    if (id === "travel") return setSheet("map");
    if (id === "help" || id === "settings") return setLocal(id);
    setLocal(null);
    setApp(id as PhoneApp);
  };
  const back = current === "home" ? undefined : () => (setLocal(null), setApp("home"));
  return (
    <Sheet title={TITLES[current] ?? "Phone"} onClose={() => setSheet(null)} onBack={back}>
      {current === "home" && (
        <>
          <ul className={styles.apps}>
            {LIVE.map((a) => {
              const badge =
                a.id === "missions"
                  ? s.missions.items.filter((m) => m.claimable).length + (s.missions.bonus.claimable ? 1 : 0)
                  : a.id === "courses"
                    ? s.courses.list.filter((c) => c.quiz).length
                    : a.id === "bank"
                      ? s.bank.unpaidCount
                      : a.id === "goals"
                    ? s.goals.wishes.filter((w) => w.claimable).length + s.goals.ambition.milestones.filter((m) => m.claimable).length
                    : a.id === "stories"
                    ? Number(!!s.stories.active?.here)
                    : a.id === "treasure"
                      ? Number(!s.treasure.found)
                      : 0;
              return (
                <li key={a.id}>
                  <button className={styles.app} onClick={() => open(a.id)}>
                    <span className={styles.appIcon} aria-hidden>
                      {a.icon}
                    </span>
                    {a.name}
                    {badge ? <span className={styles.badge}>{badge}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <h3 className={styles.subhead}>Coming later</h3>
          <ul className={styles.apps}>
            {LATER.map((a) => (
              <li key={a.name}>
                <div className={`${styles.app} ${styles.appLocked}`} aria-label={`${a.name}: arrives in ${a.when}`}>
                  <span className={styles.appIcon} aria-hidden>
                    ·
                  </span>
                  {a.name}
                  <span className="tiny">{a.when}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {current === "goals" && <GoalsApp s={s} />}
      {current === "perks" && <PerksApp s={s} />}
      {current === "people" && <PeopleApp s={s} />}
      {current === "stories" && <StoriesApp s={s} />}
      {current === "treasure" && <TreasureApp s={s} />}
      {current === "jobs" && <Jobs s={s} />}
      {current === "missions" && <Missions s={s} />}
      {current === "bank" && <BankApp s={s} />}
      {current === "homes" && <HomesApp s={s} />}
      {current === "courses" && <CoursesApp s={s} />}
      {current === "wardrobe" && <WardrobeApp s={s} />}
      {current === "food" && <FoodApp s={s} />}
      {current === "games" && <GamesApp s={s} />}
      {current === "government" && <GovernmentApp s={s} />}
      {current === "skills" && <Skills s={s} />}
      {current === "profile" && <Profile s={s} />}
      {current === "inventory" && <Inventory s={s} />}
      {current === "tour" && <Tour s={s} />}
      {current === "help" && <Help />}
      {current === "settings" && <Settings />}
    </Sheet>
  );
}

function Jobs({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setSheet = useGame((x) => x.setSheet);
  const [confirm, setConfirm] = useState<string | null>(null);
  const cur = s.career.current;
  return (
    <>
      {cur ? (
        <section className={styles.workCard} data-testid="current-job">
          <div className={styles.workRow}>
            <div>
              <span className="tiny">{cur.name}</span>
              <h3 style={{ fontSize: 22 }}>{cur.title}</h3>
            </div>
            <span className="chip good">{money(cur.salaryPence)} / shift</span>
          </div>
          <div>
            <div className={styles.workRow}>
              <span className="tiny">Performance</span>
              <span className="tiny">{cur.performance}/100</span>
            </div>
            <div className={styles.bar}>
              <span style={{ width: `${cur.performance}%` }} />
            </div>
          </div>
          {cur.next ? (
            <p className="tiny">
              Next: <strong>{cur.next.title}</strong> at {money(cur.next.salaryPence)} a shift. Needs 100 performance at the end of a full shift and {cur.shiftsNeeded} full shifts at
              this grade ({cur.shiftsAtGrade}/{cur.shiftsNeeded} done)
              {cur.next.gate ? `, plus ${cur.next.gate.label}${cur.next.gate.met ? " ✓" : ""}` : ""}.
            </p>
          ) : (
            <p className="tiny">You're at the top of this career.</p>
          )}
          <p className="tiny">
            {cur.workplaceName} · {cur.schedule} London time · trains {cur.skill}
          </p>
          {cur.canStart ? (
            <p className="tiny" style={{ color: "#1d5a45", fontWeight: 600 }}>You can start a shift now from the Here menu.</p>
          ) : (
            <p className={styles.reason}>{cur.reason}</p>
          )}
          {!s.shift && s.character.location !== cur.workplace && (
            <button className="btn small secondary" onClick={() => setSheet("map")}>
              Travel to {cur.workplaceName}
            </button>
          )}
        </section>
      ) : (
        <p className="muted">Pick a career to start earning a wage. One shift a day, an hour long; do well and you'll be promoted.</p>
      )}

      <h3 className={styles.subhead}>Careers</h3>
      <ul className={styles.list}>
        {s.career.catalogue.map((k) => (
          <li key={k.id} className={styles.workCard}>
            <div className={styles.workRow}>
              <strong>{k.name}</strong>
              {k.current ? <span className="chip good">Your job</span> : <span className="chip">{money(k.payPence)} / shift to start</span>}
            </div>
            <p className={styles.actionDesc}>{k.blurb}</p>
            <div className={styles.ladder}>
              {k.ladder.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
            <span className="tiny">
              {k.workplace} · {k.schedule} · trains {k.skill} · up to {money(k.topPayPence)} a shift
            </span>
            {!k.current &&
              (k.reason ? (
                <p className={styles.reason}>{k.reason}</p>
              ) : confirm === k.id ? (
                <div className={styles.confirm}>
                  <span>
                    {cur ? `You'll leave your job as ${cur.title} and start as ${k.entryRole}. Your progress there won't carry over.` : `You'll start as ${k.entryRole}.`}
                  </span>
                  <div>
                    <button className="btn small secondary" onClick={() => setConfirm(null)}>
                      Cancel
                    </button>
                    <button className="btn small" disabled={!!pending || !!s.shift} onClick={async () => (await run("JoinCareer", { careerId: k.id }, "join"), setConfirm(null))}>
                      Join {k.name}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn small" disabled={!!s.shift} onClick={() => setConfirm(k.id)}>
                  {cur ? "Switch to this career" : `Start as ${k.entryRole}`}
                </button>
              ))}
          </li>
        ))}
      </ul>

      {s.career.history.length > 0 && (
        <>
          <h3 className={styles.subhead}>Recent shifts</h3>
          <ul className={styles.ledger}>
            {s.career.history.map((h) => (
              <li key={h.id}>
                <div>
                  <strong>{h.title}</strong>
                  <span className="tiny">
                    {h.day} · {h.status === "left" ? "left early" : "full shift"} · performance {h.perfDelta >= 0 ? "+" : ""}
                    {h.perfDelta}
                    {h.promoted ? " · promoted" : ""}
                  </span>
                </div>
                <div className={styles.ledgerAmt}>
                  <span className={styles.pos}>{money(h.net)}</span>
                  <span className="tiny">tax {money(h.tax)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="tiny">Pay, tax and careers are fictional game values.</p>
    </>
  );
}

function Missions({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const m = s.missions;
  return (
    <>
      <p className="tiny">Resets at midnight, London time. One free swap a day.</p>
      <ul className={styles.list}>
        {m.items.map((it) => (
          <li key={it.id} className={styles.action} data-testid={`mission-${it.id}`}>
            <div className={styles.actionMain}>
              <span className="tiny">{it.pool}</span>
              <strong>{it.title}</strong>
              <div className={styles.bar}>
                <span style={{ width: `${(it.progress / it.target) * 100}%` }} />
              </div>
              <span className="tiny">
                {it.progress}/{it.target} · {money(it.reward.pence)} · +{it.reward.rep} reputation
              </span>
            </div>
            <div className={styles.quotes}>
              {it.claimed ? (
                <span className="chip good">Claimed</span>
              ) : (
                <>
                  <button className="btn small" disabled={!it.claimable || !!pending} onClick={() => run("ClaimMission", { missionId: it.id }, "claim")}>
                    Claim
                  </button>
                  {m.swapsLeft > 0 && (
                    <button className="btn small secondary" disabled={!!pending} onClick={() => run("SwapMission", { missionId: it.id }, "swap")}>
                      Swap
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.bonus}>
        <div>
          <strong>All three bonus</strong>
          <span className="tiny">
            {money(m.bonus.reward.pence)} · +{m.bonus.reward.stars} stars · +{m.bonus.reward.rep} reputation
          </span>
        </div>
        {m.bonus.claimed ? (
          <span className="chip good">Claimed</span>
        ) : (
          <button className="btn small" disabled={!m.bonus.claimable || !!pending} onClick={() => run("ClaimMission", { missionId: "all_three" }, "claim")}>
            Claim
          </button>
        )}
      </div>
    </>
  );
}

function Skills({ s }: { s: State }) {
  return (
    <ul className={styles.list}>
      {s.skills.map((k) => (
        <li key={k.id} className={styles.skill}>
          <div className={styles.actionTitle}>
            <strong>{k.name}</strong>
            <span className="chip gold">Level {k.level}</span>
          </div>
          <div className={styles.bar}>
            <span style={{ width: `${k.progress * 100}%` }} />
          </div>
          <span className="tiny">{k.nextXp ? `${k.xp} / ${k.nextXp} XP to level ${k.level + 1}` : "Maxed"}</span>
        </li>
      ))}
    </ul>
  );
}

function Profile({ s }: { s: State }) {
  const c = s.character;
  return (
    <>
      <h3 style={{ fontSize: 24 }}>{c.name}</h3>
      <p className="muted">{c.origin.name}</p>
      <div className={styles.chips} style={{ margin: "10px 0" }}>
        {c.traits.map((t) => (
          <span key={t.id} className="chip">
            {t.name}
          </span>
        ))}
        <span className="chip gold">
          ✦ {c.stars} stars
        </span>
      </div>
      <section className={styles.group}>
        <h3>Reputation</h3>
        <p>
          <strong>{c.reputation.title}</strong> · {c.reputation.xp} XP
          {c.reputation.nextTitle && (
            <span className="tiny">
              {" "}
              · {c.reputation.nextXp! - c.reputation.xp} to {c.reputation.nextTitle}
            </span>
          )}
        </p>
      </section>
      <section className={styles.group}>
        <h3>Ambition: {c.ambition.name}</h3>
        <p className="muted">{c.ambition.blurb}</p>
        {c.ambition.progress !== null && (
          <div className={styles.bar}>
            <span style={{ width: `${c.ambition.progress * 100}%` }} />
          </div>
        )}
        <p className="tiny">{c.ambition.note}</p>
      </section>
      <section className={styles.group}>
        <h3>Home</h3>
        <p>
          {s.home.tier.name}, {s.home.district} · {s.home.tier.gridW}×{s.home.tier.gridD}
        </p>
      </section>
    </>
  );
}

function Inventory({ s }: { s: State }) {
  const meals = s.inventory.filter((i) => i.kind === "meal");
  const groceries = s.inventory.filter((i) => i.kind === "grocery");
  return (
    <>
      <section className={styles.group}>
        <h3>Meals ready to eat</h3>
        {meals.length ? (
          <ul className={styles.factors}>
            {meals.map((i) => (
              <li key={i.id}>
                <span>{i.name}</span>
                <strong>× {i.qty}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiny">None yet. Cook at home to make a meal, then eat it.</p>
        )}
      </section>
      <section className={styles.group}>
        <h3>Groceries</h3>
        {groceries.length ? (
          <ul className={styles.factors}>
            {groceries.map((i) => (
              <li key={i.id}>
                <span>{i.name}</span>
                <strong>× {i.qty}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiny">Empty. Buy groceries at the Common Table Food Hall counter.</p>
        )}
      </section>
    </>
  );
}

export function Tour({ s }: { s: State }) {
  const done = s.tutorial.filter((t) => t.done).length;
  return (
    <>
      <p className="muted">
        {done} of {s.tutorial.length} done. Optional — go at your own pace.
      </p>
      <ol className={styles.tour}>
        {s.tutorial.map((t) => (
          <li key={t.id} className={t.done ? styles.tourDone : ""}>
            <span aria-hidden>{t.done ? "✓" : "○"}</span>
            <div>
              {t.label}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function Help() {
  return (
    <div className={styles.help}>
      <p>
        <strong>Six needs</strong> drop over real time. Keep them up with the right actions: food for Hunger, sleep for Energy, hobbies for Fun,
        conversation for Social, showers for Hygiene and toilets for Bladder.
      </p>
      <p>
        <strong>Actions</strong> take real minutes. You can open the phone or map while they run. Each action shows its cost, duration and effects before you start.
      </p>
      <p>
        <strong>Travel</strong> by walking (free) or bus (fare). You only arrive when the journey finishes.
      </p>
      <p>
        <strong>Furniture</strong> unlocks actions at home. Buy, then place it: R rotates, arrows move, Enter places.
      </p>
      <p>
        <strong>NPCs</strong> are named locals written for the game. Real players arrive in a later update and will always be clearly marked.
      </p>
    </div>
  );
}

function Settings() {
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  if (process.env.LL_TEST_BUILD_TIME_SCALE)
    return (
      <div className={styles.help}>
        <p className="tiny">This is the test build. Progress is saved in this browser only and timers run ×{process.env.LL_TEST_BUILD_TIME_SCALE}.</p>
        {ask ? (
          <div className={styles.quotes}>
            <button className="btn danger" disabled={busy} onClick={async () => (setBusy(true), await postJson("/api/auth/signout", {}))}>
              Delete my save and start over
            </button>
            <button className="btn secondary" onClick={() => setAsk(false)}>
              Keep playing
            </button>
          </div>
        ) : (
          <button className="btn secondary" onClick={() => setAsk(true)}>
            Start over
          </button>
        )}
      </div>
    );
  return (
    <div className={styles.help}>
      <p className="tiny">Sound, notifications and privacy settings arrive with those features. Your progress saves automatically after every action.</p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await postJson("/api/auth/signout", {});
          window.location.href = "/";
        }}
      >
        Sign out
      </button>
    </div>
  );
}
