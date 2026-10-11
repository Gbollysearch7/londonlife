"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { Celebrations, Dock, NeedsBar, ProgressStrip, Toasts, TopBar, Warnings } from "./Hud";
import { HotspotCard } from "./HotspotCard";
import { MinigameOverlay } from "./Minigame";
import { initSound } from "@/client/sound";
import { useScene } from "@/world/sceneStore";
import { ActionsSheet, BuySheet, MapSheet, NeedsSheet, PlacementBar } from "./Sheets";
import { PhoneSheet } from "./Phone";
import { ShiftPanel } from "./ShiftPanel";
import styles from "./ui.module.css";

const World = dynamic(() => import("@/world/World"), { ssr: false });

class WorldBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className={styles.noGl}>
          <p>The 3D view couldn't start on this device. Everything still works through the menus below.</p>
        </div>
      );
    return this.props.children;
  }
}

function NextStep({ s }: { s: State }) {
  const setSheet = useGame((x) => x.setSheet);
  const setPhoneApp = useGame((x) => x.setPhoneApp);
  const [hidden, setHidden] = useState(false);
  const next = s.tutorial.find((t) => !t.done);
  if (!next || hidden) return null;
  return (
    <div className={styles.next}>
      <button
        className={styles.nextMain}
        onClick={() => {
          setPhoneApp("tour");
          setSheet("phone");
        }}
      >
        <span className="tiny">Next step</span>
        <strong>{next.label}</strong>
      </button>
      <button className={styles.iconBtn} onClick={() => setHidden(true)} aria-label="Hide next step">
        ×
      </button>
    </div>
  );
}

export default function Game() {
  const state = useGame((x) => x.state);
  const loading = useGame((x) => x.loading);
  const offline = useGame((x) => x.offline);
  const sheet = useGame((x) => x.sheet);
  const placement = useGame((x) => x.placement);
  const refresh = useGame((x) => x.refresh);

  useEffect(() => initSound(), []);
  // Opening a sheet replaces any open in-world action card.
  useEffect(() => {
    if (sheet) useScene.getState().openHotspot(null);
  }, [sheet]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 15000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  if (!state)
    return (
      <main className={styles.loading} aria-busy={loading}>
        {offline ? (
          <>
            <p>Couldn't reach London.</p>
            <button className="btn" onClick={() => refresh()}>
              Try again
            </button>
          </>
        ) : (
          <p>Loading your London…</p>
        )}
      </main>
    );

  return (
    <main className={`${styles.game} ${sheet === "buy" ? styles.withWide : sheet ? styles.withSheet : ""}`}>
      <div className={styles.world}>
        <WorldBoundary>
          <World state={state} />
        </WorldBoundary>
      </div>
      <TopBar s={state} />
      {offline && <div className={styles.offline}>Reconnecting… your progress is safe on the server.</div>}
      <div className={styles.leftCol}>
        <NextStep s={state} />
        <Warnings s={state} />
      </div>
      <NeedsBar s={state} />
      <div className={styles.bottomCentre}>
        {!placement && !sheet && <HotspotCard s={state} />}
        {placement ? <PlacementBar s={state} /> : state.shift ? <ShiftPanel s={state} shift={state.shift} /> : <ProgressStrip s={state} />}
        <Dock s={state} />
      </div>
      <MinigameOverlay s={state} />
      <Toasts />
      <Celebrations />
      {sheet === "actions" && <ActionsSheet s={state} />}
      {sheet === "map" && <MapSheet s={state} />}
      {sheet === "buy" && <BuySheet s={state} />}
      {sheet === "phone" && <PhoneSheet s={state} />}
      {sheet === "needs" && <NeedsSheet s={state} />}
    </main>
  );
}
