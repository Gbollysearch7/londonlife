"use client";
import { useState } from "react";
import { postJson } from "@/client/api";
import { useGame, type PhoneApp } from "@/client/store";
import type { State } from "@/client/api";
import Sheet from "./Sheet";
import { money } from "./format";
import styles from "./ui.module.css";

const LIVE: { id: PhoneApp | "travel" | "help" | "settings"; name: string; icon: string }[] = [
  { id: "missions", name: "Missions", icon: "✓" },
  { id: "bank", name: "Bank", icon: "£" },
  { id: "skills", name: "Skills", icon: "↑" },
  { id: "profile", name: "Profile", icon: "☺" },
  { id: "inventory", name: "Kitchen", icon: "◫" },
  { id: "tour", name: "First steps", icon: "➜" },
  { id: "travel", name: "Travel", icon: "⌖" },
  { id: "help", name: "Help", icon: "?" },
  { id: "settings", name: "Settings", icon: "⚙" },
];

const LATER: { name: string; when: string }[] = [
  { name: "Jobs", when: "Milestone 2" },
  { name: "Courses", when: "Milestone 2" },
  { name: "Food delivery", when: "Milestone 2" },
  { name: "Wardrobe", when: "Milestone 2" },
  { name: "Homes", when: "Milestone 2" },
  { name: "Vehicles", when: "Milestone 2" },
  { name: "Health", when: "Milestone 2" },
  { name: "Staff", when: "Milestone 2" },
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
  { name: "Games", when: "Milestone 4" },
  { name: "Government", when: "Milestone 4" },
  { name: "Police", when: "Milestone 4" },
  { name: "Court", when: "Milestone 4" },
  { name: "Insurance", when: "Milestone 5" },
  { name: "Transport Co", when: "Milestone 5" },
  { name: "Advertising", when: "Milestone 5" },
];

const TITLES: Record<string, string> = {
  home: "Phone",
  missions: "Daily missions",
  bank: "Bank",
  skills: "Skills",
  profile: "Profile",
  inventory: "Kitchen cupboard",
  tour: "Your first twenty minutes",
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
              const badge = a.id === "missions" ? s.missions.items.filter((m) => m.claimable).length + (s.missions.bonus.claimable ? 1 : 0) : 0;
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
      {current === "missions" && <Missions s={s} />}
      {current === "bank" && <Bank s={s} />}
      {current === "skills" && <Skills s={s} />}
      {current === "profile" && <Profile s={s} />}
      {current === "inventory" && <Inventory s={s} />}
      {current === "tour" && <Tour s={s} />}
      {current === "help" && <Help />}
      {current === "settings" && <Settings />}
    </Sheet>
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

function Bank({ s }: { s: State }) {
  return (
    <>
      <div className={styles.balance}>
        <span className="tiny">Cash</span>
        <strong>{money(s.wallet.cashPence)}</strong>
      </div>
      <p className="tiny">Savings, bonds, bills and tax arrive in Milestone 2. Every change to your money is recorded below.</p>
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
        {done} of {s.tutorial.filter((t) => !("locked" in t && t.locked)).length} done. Optional — go at your own pace.
      </p>
      <ol className={styles.tour}>
        {s.tutorial.map((t) => (
          <li key={t.id} className={t.done ? styles.tourDone : ""}>
            <span aria-hidden>{t.done ? "✓" : "○"}</span>
            <div>
              {t.label}
              {"locked" in t && t.locked && <span className="tiny"> — {t.locked}</span>}
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
