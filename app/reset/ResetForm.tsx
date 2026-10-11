"use client";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/client/api";
import Skyline from "../Skyline";
import styles from "../welcome.module.css";

type Status = "checking" | "valid" | "used" | "expired" | "invalid" | "done";

const PROBLEM: Record<string, string> = {
  used: "This reset link has already been used.",
  expired: "This reset link has expired. Links last 30 minutes.",
  invalid: "This reset link isn't valid. It may have been replaced by a newer one.",
};

/** Choose a new password from a reset link. */
export default function ResetForm({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!token) return;
    postJson("/api/auth/reset/status", { token })
      .then((r) => setStatus(r.status))
      .catch(() => setStatus("valid")); // let the submit report the real problem
  }, [token]);
  useEffect(() => heading.current?.focus(), [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/reset/complete", { token, password });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
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
        <h2 ref={heading} tabIndex={-1} style={{ fontSize: 24, marginBottom: 12 }}>
          {status === "done" ? "Password changed" : "Choose a new password"}
        </h2>
        {status === "checking" && <p className="muted" role="status">Checking your link…</p>}
        {(status === "used" || status === "expired" || status === "invalid") && (
          <>
            <p className="err" role="alert">
              {PROBLEM[status]}
            </p>
            <a className="btn block" href="/">
              Request a new link
            </a>
          </>
        )}
        {status === "done" && (
          <>
            <p className="muted" role="status">
              Your password has been changed and every device was signed out. Sign in with your new password.
            </p>
            <a className="btn block" href="/">
              Go to sign in
            </a>
          </>
        )}
        {status === "valid" && (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input id="new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <span className="muted" style={{ fontSize: 13 }}>At least 8 characters.</span>
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Type it again</label>
              <input id="confirm-password" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            <button className="btn block" disabled={busy || !password || !confirm}>
              {busy ? "One moment…" : "Set new password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
