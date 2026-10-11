"use client";
import { useState } from "react";
import { useGame } from "@/client/store";
import type { State } from "@/client/api";
import { money } from "./format";
import styles from "./ui.module.css";

/** Riverside Arts House gallery desk: original art that is delivered to storage as placeable furniture. */
export function GalleryCounter({ s }: { s: State }) {
  const run = useGame((x) => x.run);
  const pending = useGame((x) => x.pending);
  const [colours, setColours] = useState<Record<string, string>>({});
  if (!s.gallery.here || s.journey) return null;
  return (
    <section className={styles.group}>
      <h3>Gallery desk</h3>
      <p className="tiny">Original pieces by fictional local artists. Each one is one of a kind: buy it once and it's delivered to your storage to hang or stand at home.</p>
      <ul className={styles.list}>
        {s.gallery.pieces.map((p) => {
          const colour = colours[p.id] ?? p.colours[0];
          return (
            <li key={p.id} className={`${styles.action} ${p.reason ? styles.actionOff : ""}`}>
              <div className={styles.actionMain}>
                <div className={styles.actionTitle}>
                  <strong>{p.name}</strong>
                  <span className="chip">{p.artist}</span>
                </div>
                <p className={styles.actionDesc}>{p.blurb}</p>
                <div className={styles.chips}>
                  <span className="chip bad">Costs {money(p.pricePence)}</span>
                  <span className="chip good">Décor +{p.decor}</span>
                  <span className="chip">{p.surface === "wall" ? "Wall" : "Floor"}</span>
                  {!p.bought &&
                    p.colours.map((c) => (
                      <button
                        key={c}
                        aria-label={`${p.surface === "wall" ? "Frame" : "Glaze"} colour ${c}`}
                        aria-pressed={c === colour}
                        onClick={() => setColours({ ...colours, [p.id]: c })}
                        style={{ width: 22, height: 22, borderRadius: 11, background: c, border: c === colour ? "2px solid #17232b" : "1px solid #aaa" }}
                      />
                    ))}
                </div>
                {p.reason && <p className={styles.reason}>{p.reason}</p>}
              </div>
              <button className="btn small" disabled={!!p.reason || !!pending} onClick={() => run("BuyArtwork", { artId: p.id, colour }, p.name)} aria-label={`Buy ${p.name}`}>
                Buy
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
