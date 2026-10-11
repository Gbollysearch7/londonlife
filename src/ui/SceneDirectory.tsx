"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { useFx } from "@/client/fx";
import { sceneHotspots } from "@/world/hotspots";
import { useScene } from "@/world/sceneStore";
import p from "./platform.module.css";

/**
 * "What's here": a keyboard and screen-reader friendly list of everything tappable in the current scene.
 * Choosing an item opens the same action card the 3D view opens, so no action needs the canvas.
 */
export function SceneDirectory({ s }: { s: State }) {
  const [open, setOpen] = useState(false);
  const placement = useGame((x) => x.placement);
  const sheet = useGame((x) => x.sheet);
  const setSheet = useGame((x) => x.setSheet);
  const run = useGame((x) => x.run);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const entries = sceneHotspots(s, { placingId: placement?.instanceId });

  useEffect(() => setOpen(false), [s.character.location, !!s.journey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!entries.length || placement || sheet) return null;
  const place = s.character.location === "home" ? "your home" : "this place";

  return (
    <div>
      <button ref={toggle} className={p.dirToggle} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        What's here
        <span>
          {entries.length} {entries.length === 1 ? "thing" : "things"} {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <nav id={panelId} className={p.dirPanel} aria-label={`Things you can use in ${place}`} style={{ marginTop: 6 }}>
          <h2>Everything you can use in {place}</h2>
          <ul className={p.dirList}>
            {entries.map((e) => (
              <li key={e.key}>
                <button
                  className={p.dirItem}
                  onClick={async () => {
                    toggle.current?.focus(); // the card hands focus back here when it closes
                    setOpen(false);
                    if (e.kind === "hotspot") useScene.getState().openHotspot(e.hotspot);
                    else if (e.kind === "map") setSheet("map");
                    else {
                      const r = await run("ClaimTreasure", {}, "treasure");
                      if (r) useFx.getState().push([], [{ title: "Treasure found!", sub: r.message ?? "", icon: "◆" }]);
                    }
                  }}
                >
                  <strong>{e.label}</strong>
                  <span>{e.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
