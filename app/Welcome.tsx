"use client";
import { useState } from "react";
import { postJson } from "@/client/api";
import ForgotPassword from "./ForgotPassword";
import Skyline from "./Skyline";
import styles from "./welcome.module.css";

export default function Welcome() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(mode === "signup" ? "/api/auth/signup" : "/api/auth/signin", { email, password, adult });
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.art} aria-hidden="true">
        <Skyline />
      </section>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.roundel} />
          <h1>London Life</h1>
        </div>
        <p className={styles.premise}>
          Start with a small room and six needs. Work, learn, cook, take the bus, furnish your place and make London yours.
        </p>
        {forgot ? (
          <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />
        ) : (
        <>
        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? styles.active : ""} onClick={() => setMode("signup")}>
            Create account
          </button>
          <button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? styles.active : ""} onClick={() => setMode("signin")}>
            Sign in
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === "signup" && <span className="tiny">At least 8 characters.</span>}
          </div>
          {mode === "signup" && (
            <label className={styles.check}>
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>I confirm I am 18 or over. London Life is an adults-only game.</span>
            </label>
          )}
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button className="btn block" disabled={busy || !email || !password || (mode === "signup" && !adult)}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        {mode === "signin" && (
          <button type="button" className="btn secondary block" style={{ marginTop: 10 }} onClick={() => setForgot(true)}>
            Forgotten your password?
          </button>
        )}
        </>
        )}
        <p className="tiny" style={{ marginTop: 18 }}>
          Your email is only used to sign in. It is never shown to other players. Everything in London Life — people, places, prices — is fictional.
        </p>
      </section>
    </main>
  );
}
