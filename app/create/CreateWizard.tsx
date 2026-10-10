"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { AMBITIONS, APPEARANCE_OPTIONS, TRAITS, type Appearance } from "@/content/character";
import { sendCommand } from "@/client/api";
import styles from "./create.module.css";

const AvatarPreview = dynamic(() => import("@/world/AvatarPreview"), { ssr: false, loading: () => <div className={styles.previewLoading} /> });

const STEPS = ["Appearance", "Traits", "Ambition", "Confirm"] as const;

const NEED_NAMES: Record<string, string> = { hunger: "Hunger", energy: "Energy", fun: "Fun", social: "Social", hygiene: "Hygiene", bladder: "Bladder" };

function traitEffects(id: string): string[] {
  const t = TRAITS.find((x) => x.id === id)!;
  const out: string[] = [];
  for (const [skill, m] of Object.entries(t.xp ?? {})) out.push(`${skill === "enterprise" ? "Enterprise" : skill[0].toUpperCase() + skill.slice(1)} XP ${m! > 1 ? "+" : "−"}${Math.round(Math.abs(m! - 1) * 100)}%`);
  for (const [need, m] of Object.entries(t.decay ?? {})) out.push(`${NEED_NAMES[need]} drops ${Math.round(Math.abs(m! - 1) * 100)}% ${m! > 1 ? "faster" : "slower"}`);
  return out;
}

const LABELS: Record<keyof typeof APPEARANCE_OPTIONS, string> = {
  body: "Body",
  skin: "Skin tone",
  hairStyle: "Hairstyle",
  hairColour: "Hair colour",
  top: "Top",
  bottom: "Bottoms",
  shoes: "Shoes",
};

export default function CreateWizard({ onCreated }: { onCreated?: () => void } = {}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState<Appearance>({ body: 0, skin: 2, hairStyle: 1, hairColour: 0, top: 0, bottom: 0, shoes: 0 });
  const [traits, setTraits] = useState<string[]>([]);
  const [ambition, setAmbition] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOk = /^[\p{L}][\p{L} '\-]{0,23}$/u.test(name.trim());
  const canNext = step === 0 ? nameOk : step === 1 ? traits.length === 2 : step === 2 ? !!ambition : true;

  function toggleTrait(id: string) {
    setTraits((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < 2 ? [...t, id] : t));
  }
  const conflicted = (id: string) => traits.some((t) => TRAITS.find((x) => x.id === t)?.conflicts?.includes(id));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await sendCommand("CreateCharacter", { name: name.trim(), appearance, traits, ambition });
      if (onCreated) onCreated();
      else window.location.href = "/create";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your character.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Make your Londoner</h1>
        <ol className={styles.steps} aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={i === step ? styles.cur : i < step ? styles.done : ""}>
              <span>{i + 1}</span> {s}
            </li>
          ))}
        </ol>
      </header>

      <div className={styles.body}>
        <div className={styles.preview}>
          <AvatarPreview appearance={appearance} />
          <p className={styles.previewName}>{name.trim() || "Your name"}</p>
        </div>

        <section className={styles.card}>
          {step === 0 && (
            <>
              <h2>Appearance</h2>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" className="input" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada" />
                <span className="tiny">This is your public in-game name. Your email is never shown.</span>
              </div>
              {(Object.keys(APPEARANCE_OPTIONS) as (keyof typeof APPEARANCE_OPTIONS)[]).map((k) => (
                <fieldset key={k} className={styles.optRow}>
                  <legend>{LABELS[k]}</legend>
                  <div className={styles.opts}>
                    {APPEARANCE_OPTIONS[k].map((v, i) => {
                      const isColour = v.startsWith("#");
                      return (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={appearance[k] === i}
                          aria-label={isColour ? `${LABELS[k]} option ${i + 1}` : v}
                          className={`${isColour ? styles.swatch : styles.pill} ${appearance[k] === i ? styles.on : ""}`}
                          style={isColour ? { background: v } : undefined}
                          onClick={() => setAppearance({ ...appearance, [k]: i })}
                        >
                          {isColour ? "" : v}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <h2>Choose exactly two traits</h2>
              <p className="muted">Traits change how fast needs drop and how quickly skills grow.</p>
              <div className={styles.grid}>
                {TRAITS.map((t) => {
                  const on = traits.includes(t.id);
                  const blocked = !on && (traits.length >= 2 || conflicted(t.id));
                  return (
                    <button key={t.id} type="button" aria-pressed={on} disabled={blocked} className={`${styles.choice} ${on ? styles.on : ""}`} onClick={() => toggleTrait(t.id)}>
                      <strong>{t.name}</strong>
                      <span className="muted">{t.blurb}</span>
                      <span className={styles.effects}>
                        {traitEffects(t.id).map((e) => (
                          <span key={e} className="chip">
                            {e}
                          </span>
                        ))}
                      </span>
                      {conflicted(t.id) && !on && <span className="tiny">Can't combine with your other choice.</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Your ambition</h2>
              <p className="muted">A lifelong goal. You can change it once a week; rewards you've earned are kept.</p>
              <div className={styles.grid}>
                {AMBITIONS.map((a) => (
                  <button key={a.id} type="button" aria-pressed={ambition === a.id} className={`${styles.choice} ${ambition === a.id ? styles.on : ""}`} onClick={() => setAmbition(a.id)}>
                    <strong>{a.name}</strong>
                    <span className="muted">{a.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Ready?</h2>
              <dl className={styles.summary}>
                <dt>Name</dt>
                <dd>{name.trim()}</dd>
                <dt>Traits</dt>
                <dd>{traits.map((t) => TRAITS.find((x) => x.id === t)!.name).join(" and ")}</dd>
                <dt>Ambition</dt>
                <dd>{AMBITIONS.find((a) => a.id === ambition)?.name}</dd>
              </dl>
              <p className="muted">
                Next, London decides where you start. Your origin — money, home and head starts — is assigned once and stays with this character. You can't
                re-roll it.
              </p>
            </>
          )}

          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}

          <div className={styles.nav}>
            <button className="btn secondary" type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>
              Back
            </button>
            {step < 3 ? (
              <button className="btn" type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Next
              </button>
            ) : (
              <button className="btn" type="button" onClick={submit} disabled={busy}>
                {busy ? "Finding your place…" : "Begin my London life"}
              </button>
            )}
          </div>
          {step === 0 && !nameOk && name.length > 0 && <p className="tiny">Use letters, spaces, apostrophes or hyphens (up to 24).</p>}
        </section>
      </div>
    </main>
  );
}
