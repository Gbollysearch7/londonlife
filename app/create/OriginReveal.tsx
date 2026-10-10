"use client";
import { useEffect, useState } from "react";
import { fetchState, type State } from "@/client/api";
import { furnitureDef } from "@/content/catalogue";
import styles from "./create.module.css";

export default function OriginReveal({ onEnter }: { onEnter?: () => void } = {}) {
  const [s, setS] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchState()
      .then((st) => setS(st as State))
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <main className={styles.reveal}>
        <p className="err">{error}</p>
        <button className="btn" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!s) return <main className={styles.reveal} aria-busy="true" />;
  const o = s.character.origin;
  return (
    <main className={styles.reveal}>
      <div className={styles.revealCard}>
        <p className="tiny">YOUR STARTING CIRCUMSTANCES</p>
        <h1>{o.name}</h1>
        <p className={styles.story}>{o.story}</p>
        <div className={styles.package}>
          <div>
            <span className="tiny">Money</span>
            <strong>£{(o.cashPence / 100).toFixed(2)}</strong>
          </div>
          <div>
            <span className="tiny">Home</span>
            <strong>
              {s.home.tier.name}, {s.home.district}
            </strong>
          </div>
          <div>
            <span className="tiny">Grid</span>
            <strong>
              {s.home.tier.gridW}×{s.home.tier.gridD}
            </strong>
          </div>
        </div>
        <h3>You own</h3>
        <p className="muted">{s.furniture.map((f) => furnitureDef(f.defId)?.name).join(", ")}</p>
        <p className="muted">
          Groceries: {s.inventory.map((i) => `${i.qty} × ${i.name}`).join(", ")}
        </p>
        {o.perks.length > 0 && (
          <p>
            {o.perks.map((p) => (
              <span key={p} className="chip gold" style={{ marginRight: 6 }}>
                {p}
              </span>
            ))}
          </p>
        )}
        <p className="tiny">Rent and bills start in a later update. For now, your first weeks are covered.</p>
        {onEnter ? (
          <button className="btn block" onClick={onEnter}>
            Enter London
          </button>
        ) : (
          <a className="btn block" href="/play">
            Enter London
          </a>
        )}
      </div>
    </main>
  );
}
