"use client";
import { useState } from "react";
import { postJson } from "@/client/api";
import { useGraphics, type Quality } from "@/client/graphics";
import p from "./platform.module.css";

/** Settings → Graphics: quality preset (saved in this browser) and an optional performance readout. */
export function GraphicsSettings() {
  const quality = useGraphics((g) => g.quality);
  const chosen = useGraphics((g) => g.chosen);
  const reduced = useGraphics((g) => g.reducedMotion);
  const showStats = useGraphics((g) => g.showStats);
  const setQuality = useGraphics((g) => g.setQuality);
  const setShowStats = useGraphics((g) => g.setShowStats);
  const opts: { id: Quality; label: string }[] = [
    { id: "high", label: "High" },
    { id: "low", label: "Low" },
  ];
  return (
    <section className={p.section} aria-labelledby="gfx-title">
      <h3 id="gfx-title">Graphics</h3>
      <fieldset className={p.seg}>
        <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Graphics quality
        </legend>
        {opts.map((o) => (
          <label key={o.id}>
            <input type="radio" name="gfx-quality" value={o.id} checked={quality === o.id} onChange={() => setQuality(o.id)} />
            {o.label}
          </label>
        ))}
      </fieldset>
      <p className={p.hint}>
        {quality === "high" ? "Soft shadows, sharper rendering and full effects." : "No shadows, lower render scale and fewer particles. Smoother on phones and older laptops."}
        {chosen ? "" : " Picked automatically for this device."} Everything you can do in the game is the same on both.
      </p>
      <p className={p.hint}>
        {reduced
          ? "Your device asks for reduced motion, so markers, particles and flashing lights stay still."
          : "Turn on your device's reduce-motion setting to keep markers, particles and flashing lights still."}
      </p>
      <label className={p.check}>
        <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} />
        <span>Show performance stats (frames per second, draw calls) over the 3D view</span>
      </label>
    </section>
  );
}

/** Settings → Account (real game): change password and sign out on every device. */
export function AccountSecurity() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [askAll, setAskAll] = useState(false);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (next !== confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    try {
      const r = await postJson("/api/auth/password", { current, next });
      setDone(r.message ?? "Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={p.section} aria-labelledby="acct-title">
      <h3 id="acct-title">Account</h3>
      <form onSubmit={change} noValidate>
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw-next">New password</label>
          <input id="pw-next" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <span className={p.hint}>At least 8 characters. Other devices are signed out when you change it.</span>
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">New password again</label>
          <input id="pw-confirm" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className={p.ok} role="status">
            {done}
          </p>
        )}
        <button className="btn secondary" disabled={busy || !current || !next || !confirm}>
          {busy ? "One moment…" : "Change password"}
        </button>
      </form>
      {askAll ? (
        <div className="field">
          <p className={p.hint}>This signs you out here and on every other phone or computer. Your progress is safe on the server.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await postJson("/api/auth/signout-all", {});
                  window.location.href = "/";
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Something went wrong.");
                  setBusy(false);
                }
              }}
            >
              Sign out everywhere
            </button>
            <button className="btn secondary" onClick={() => setAskAll(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn secondary" onClick={() => setAskAll(true)}>
          Sign out of all devices
        </button>
      )}
    </section>
  );
}

/**
 * Test build only: walks through account recovery against the in-browser database. There is no email in the
 * test build, so the reset link is shown on screen under a clear development-only label.
 */
export function DevRecoveryDemo() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await postJson("/api/auth/reset/request", {});
      setToken(r.token ?? null);
      if (!r.token) setError("No local player to reset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function use(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await postJson("/api/auth/reset/complete", { token, password });
      setDone(r.message ?? "Password set.");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={p.section} aria-labelledby="recovery-title">
      <h3 id="recovery-title">Account recovery</h3>
      <p className={p.hint}>The real game lets you reset a forgotten password with a link that works once, for 30 minutes. Try the same flow here.</p>
      <button className="btn secondary" disabled={busy} onClick={request}>
        {token ? "Request another reset link" : "Request a reset link"}
      </button>
      {token && (
        <div className={p.devBox} role="region" aria-label="Development only: reset link">
          <span className={p.devLabel}>Development only</span>
          <p style={{ margin: 0, fontSize: 14 }}>The real game emails this link and never shows it on screen. It works once and expires in 30 minutes.</p>
          <code className={p.devLink}>/reset?token={token}</code>
          {done ? (
            <p className={p.ok} role="status">
              {done}
            </p>
          ) : (
            <form onSubmit={use} noValidate>
              <div className="field" style={{ marginBottom: 8 }}>
                <label htmlFor="dev-new-password">New password</label>
                <input id="dev-new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn small" disabled={busy || !password}>
                Use the link
              </button>
            </form>
          )}
        </div>
      )}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
