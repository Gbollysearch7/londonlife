"use client";
import { useEffect, useState } from "react";
import { useFx } from "@/client/fx";
import { getSoundSettings, setSoundSettings, subscribeSound } from "@/client/sound";
import { NEED_IDS } from "@/content/types";
import { venue } from "@/content/world";
import { serverNow, useGame } from "@/client/store";
import type { State } from "@/client/api";
import { NEED_META, countdown, money } from "./format";
import styles from "./ui.module.css";

const WEATHER_ICON: Record<string, string> = { rain: "☂", drizzle: "☂", cloud: "☁", sun: "☀" };

export function TopBar({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const setPhoneApp = useGame((x) => x.setPhoneApp);
  const place = s.journey ? `On the way to ${venue(s.journey.destination)?.name}` : venue(s.character.location)?.name;
  return (
    <header className={styles.top}>
      <div className={styles.topGroup}>
        <span className={styles.clock} title="London time">
          {s.clock}
        </span>
        <span className={styles.topItem} title={`${s.weather.label}, ${s.weather.tempC}°C`}>
          <span aria-hidden>{WEATHER_ICON[s.weather.id]}</span> {s.weather.tempC}°
          <span className={styles.hideSm}>&nbsp;{s.weather.label}</span>
        </span>
        <span className={styles.topItem}>
          <span aria-hidden>⌂</span> <span data-testid="location">{place}</span>
        </span>
      </div>
      <div className={styles.topGroup}>
        <SoundToggle />
        <button className={styles.topBtn} onClick={() => setSheet("needs")} title={`Mood ${s.mood.score}`}>
          Mood <strong>{s.mood.label}</strong>
        </button>
        <button
          className={styles.topBtn}
          onClick={() => {
            setPhoneApp("profile");
            setSheet("phone");
          }}
          title={`${s.character.reputation.title}, ${s.character.reputation.xp} reputation`}
          aria-label={`${s.character.stars} ${s.character.stars === 1 ? "star" : "stars"} — profile`}
        >
          <span aria-hidden className={styles.star}>
            ✦
          </span>{" "}
          {s.character.stars}
        </button>
        <button
          className={`${styles.topBtn} ${styles.wallet}`}
          onClick={() => {
            setPhoneApp("bank");
            setSheet("phone");
          }}
          data-testid="wallet"
        >
          {money(s.wallet.cashPence)}
        </button>
      </div>
    </header>
  );
}

export function NeedsBar({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  return (
    <button className={styles.needs} onClick={() => setSheet("needs")} aria-label="Needs — open details">
      <span className={styles.needsName}>{s.character.name}</span>
      {NEED_IDS.map((id) => {
        const v = Math.round(s.needs[id]);
        const low = v <= 20;
        return (
          <span key={id} className={styles.needRow} data-testid={`need-${id}`}>
            <span className={styles.needIcon} style={{ color: NEED_META[id].colour }} aria-hidden>
              {NEED_META[id].icon}
            </span>
            <span className={styles.needLabel}>{NEED_META[id].label}</span>
            <span className={styles.needTrack}>
              <span style={{ width: `${v}%`, background: low ? "#bc3d3b" : NEED_META[id].colour }} />
            </span>
            <span className={`${styles.needVal} ${low ? styles.lowVal : ""}`}>{v}</span>
          </span>
        );
      })}
    </button>
  );
}

export function ProgressStrip({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const refresh = useGame((x) => x.refresh);
  const [now, setNow] = useState(serverNow());
  const [confirm, setConfirm] = useState(false);
  const target = s.activity ?? s.journey;
  useEffect(() => {
    setConfirm(false);
  }, [target && "id" in target ? target.id : s.journey?.departedAt]);
  useEffect(() => {
    if (!target) return;
    const end = new Date(s.activity ? s.activity.endsAt : s.journey!.arrivesAt).getTime();
    let fired = false;
    const t = setInterval(() => {
      const n = serverNow();
      setNow(n);
      if (n >= end && !fired) {
        fired = true;
        setTimeout(() => refresh(), 250);
      }
    }, 250);
    return () => clearInterval(t);
  }, [target, s.activity, s.journey, refresh]);
  if (!target) return null;
  const startMs = new Date(s.activity ? s.activity.startedAt : s.journey!.departedAt).getTime();
  const endMs = new Date(s.activity ? s.activity.endsAt : s.journey!.arrivesAt).getTime();
  const pct = Math.min(100, Math.max(0, ((now - startMs) / Math.max(1, endMs - startMs)) * 100));
  const title = s.activity ? s.activity.label : `${({ walk: "Walking", bus: "Bus", tube: "Tube", taxi: "Taxi" } as Record<string, string>)[s.journey!.mode] ?? "Travelling"} to ${venue(s.journey!.destination)?.name}`;
  const rule = s.activity ? s.activity.cancelRule : s.journey!.farePence ? "You'll turn back to where you started. Fares aren't refunded." : "You'll turn back to where you started.";
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <div className={styles.progressHead}>
        <strong>{title}</strong>
        <span data-testid="countdown">{now >= endMs ? "Finishing…" : countdown(endMs - now)}</span>
      </div>
      <div className={styles.bar}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {confirm ? (
        <div className={styles.confirm}>
          <span>{rule}</span>
          <div>
            <button className="btn small secondary" onClick={() => setConfirm(false)}>
              Keep going
            </button>
            <button className="btn small danger" onClick={() => run(s.activity ? "CancelActivity" : "CancelJourney", {}, "cancel")}>
              {s.activity ? "Stop now" : "Turn back"}
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.linkBtn} onClick={() => setConfirm(true)}>
          {s.activity ? "Stop" : "Turn back"}
        </button>
      )}
      {s.timeScale > 1 && <span className="tiny">Development speed ×{s.timeScale}</span>}
    </div>
  );
}

export function Dock({ s }: { s: State }) {
  const sheet = useGame((x) => x.sheet);
  const setSheet = useGame((x) => x.setSheet);
  const setPhoneApp = useGame((x) => x.setPhoneApp);
  const claimable =
    s.missions.items.filter((m) => m.claimable).length +
    (s.missions.bonus.claimable ? 1 : 0) +
    s.goals.wishes.filter((w) => w.claimable).length +
    s.goals.ambition.milestones.filter((m) => m.claimable).length +
    Number(!!s.stories.active?.here);
  const items = [
    { id: "actions" as const, label: s.character.location === "home" ? "Home" : "Here", icon: "◉" },
    { id: "buy" as const, label: "Buy", icon: "▣" },
    { id: "map" as const, label: "Map", icon: "⌖" },
    { id: "phone" as const, label: "Phone", icon: "▯", badge: claimable },
  ];
  return (
    <nav className={styles.dock} aria-label="Main">
      {items.map((it) => (
        <button
          key={it.id}
          className={`${styles.dockBtn} ${sheet === it.id ? styles.dockOn : ""}`}
          aria-pressed={sheet === it.id}
          onClick={() => {
            if (it.id === "phone") setPhoneApp("home");
            setSheet(sheet === it.id ? null : it.id);
          }}
        >
          <span aria-hidden className={styles.dockIcon}>
            {it.icon}
          </span>
          {it.label}
          {it.badge ? <span className={styles.badge}>{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export function Toasts() {
  const toasts = useGame((x) => x.toasts);
  return (
    <div className={styles.toasts} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`} role={t.tone === "error" ? "alert" : undefined}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Warnings({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  if (!s.warnings.length) return null;
  const w = s.warnings[0];
  return (
    <button className={styles.warning} onClick={() => setSheet("needs")}>
      <strong>{w.label} is low.</strong> {w.recovery}
    </button>
  );
}

function SoundToggle() {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(getSoundSettings().muted);
    return subscribeSound((x) => setMuted(x.muted));
  }, []);
  return (
    <button className={`${styles.topBtn} ${styles.soundBtn}`} onClick={() => setSoundSettings({ muted: !muted })} aria-label={muted ? "Turn sound on" : "Mute sound"} aria-pressed={muted} title={muted ? "Sound off" : "Sound on"}>
      <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  dx: `${Math.round(Math.cos((i / 26) * Math.PI * 2) * (90 + (i % 5) * 30))}px`,
  dy: `${Math.round(Math.sin((i / 26) * Math.PI * 2) * (70 + (i % 4) * 30) - 40)}px`,
  rot: `${(i * 67) % 360}deg`,
  bg: ["#bc3d3b", "#c69c58", "#234c42", "#2f4a6b", "#e0697a"][i % 5],
  delay: `${(i % 6) * 0.03}s`,
}));

/** Level-ups, promotions and new titles: a banner with confetti that dismisses itself. */
export function Celebrations() {
  const list = useFx((x) => x.celebrations);
  const dismiss = useFx((x) => x.dismiss);
  const top = list[0];
  useEffect(() => {
    if (!top) return;
    const t = setTimeout(() => dismiss(top.id), 3400);
    return () => clearTimeout(t);
  }, [top, dismiss]);
  if (!top) return null;
  return (
    <div className={styles.celebrate} role="status" aria-live="assertive" onClick={() => dismiss(top.id)} key={top.id}>
      <div className={styles.confetti} aria-hidden>
        {CONFETTI.map((c, i) => (
          <i key={i} style={{ background: c.bg, animationDelay: c.delay, ["--dx" as string]: c.dx, ["--dy" as string]: c.dy, ["--rot" as string]: c.rot }} />
        ))}
      </div>
      <span className={styles.celebrateIcon} aria-hidden>
        {top.icon}
      </span>
      <strong>{top.title}</strong>
      <span>{top.sub}</span>
    </div>
  );
}
