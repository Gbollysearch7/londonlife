"use client";
import { useEffect } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { firstFreeSpot } from "@/sim/placement";
import { useScene } from "@/world/sceneStore";
import { ActionRow, GroceryCounter } from "./Sheets";
import styles from "./ui.module.css";

/**
 * The card that rises when you tap something in the world: what it is, what you can do with it,
 * what each action costs and gives, and why anything is unavailable.
 */
export function HotspotCard({ s }: { s: State }) {
  const hotspot = useScene((x) => x.hotspot);
  const close = () => useScene.getState().openHotspot(null);
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const setSheet = useGame((x) => x.setSheet);
  const setPlacement = useGame((x) => x.setPlacement);

  useEffect(() => {
    if (!hotspot) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotspot]);

  // Leaving the place (or the item disappearing) closes the card.
  useEffect(() => {
    if (hotspot?.furnitureId && !s.furniture.some((f) => f.id === hotspot.furnitureId && f.placed)) close();
  }, [s.furniture, hotspot]);
  useEffect(() => close(), [s.character.location]);

  if (!hotspot) return null;
  const actions = s.actions.filter((a) => hotspot.actionIds.includes(a.id) && !a.hidden).sort((a, b) => Number(b.available) - Number(a.available));
  const isExit = hotspot.id === "anchor:exit";
  const isGroceries = hotspot.id === "anchor:groceries";
  const furniture = hotspot.furnitureId ? s.furniture.find((f) => f.id === hotspot.furnitureId) : null;
  const canArrange = !!furniture && s.character.location === "home" && !s.activity && !s.journey;

  return (
    <section className={styles.hotspot} role="dialog" aria-label={hotspot.title}>
      <header className={styles.hotspotHead}>
        <div>
          <strong>{hotspot.title}</strong>
          {hotspot.subtitle && <span className="tiny">{hotspot.subtitle}</span>}
        </div>
        <button className={styles.iconBtn} onClick={close} aria-label="Close">
          ×
        </button>
      </header>
      <div className={styles.hotspotBody}>
        {isExit && (
          <div className={styles.quotes}>
            <p className="muted" style={{ margin: 0 }}>
              Where to next?
            </p>
            <button
              className="btn small"
              onClick={() => {
                close();
                setSheet("map");
              }}
            >
              Open the map
            </button>
          </div>
        )}
        {isGroceries && <GroceryCounter s={s} />}
        {!isExit && !isGroceries && actions.length === 0 && !furniture && <p className="muted">Nothing to do here right now.</p>}
        {actions.length > 0 && (
          <ul className={styles.list}>
            {actions.map((a) => (
              <ActionRow
                key={a.id}
                a={a}
                disabled={!!pending}
                onStart={async () => {
                  if (await run("StartActivity", { activityId: a.id }, a.label)) close();
                }}
              />
            ))}
          </ul>
        )}
        {furniture && (
          <div className={styles.quotes} style={{ marginTop: 10 }}>
            <button
              className="btn small secondary"
              disabled={!canArrange}
              onClick={() => {
                const others = s.furniture.filter((f) => f.placed && f.id !== furniture.id).map((f) => ({ id: f.id, defId: f.defId, x: f.x!, y: f.y!, rot: f.rot }));
                const spot = furniture.placed && furniture.x !== null ? { x: furniture.x, y: furniture.y!, rot: furniture.rot } : firstFreeSpot(furniture.defId, others, s.home.tier.gridW, s.home.tier.gridD) ?? { x: 0, y: 0, rot: 0 };
                setPlacement({ instanceId: furniture.id, defId: furniture.defId, ...spot });
                close();
              }}
            >
              Move
            </button>
            <button
              className="btn small secondary"
              disabled={!canArrange || !!pending}
              onClick={async () => {
                if (await run("StoreFurniture", { instanceId: furniture.id }, "store")) close();
              }}
            >
              Put in storage
            </button>
            {!canArrange && s.activity && <span className="tiny">Finish what you're doing to rearrange.</span>}
          </div>
        )}
      </div>
    </section>
  );
}
