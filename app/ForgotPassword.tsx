"use client";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/client/api";

/** Asks for a password reset link. The reply is the same whether or not the email has an account. */
export default function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [sent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await postJson("/api/auth/reset/request", { email });
      setSent(r.message ?? "If an account uses that email, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="forgot-title">
      <h2 id="forgot-title" ref={heading} tabIndex={-1} style={{ fontSize: 24, marginBottom: 8 }}>
        Reset your password
      </h2>
      {sent ? (
        <>
          <p className="muted" role="status">
            {sent}
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            Email delivery isn't set up yet, so the link isn't emailed. On a development server it's written to the server log for whoever runs the game.
          </p>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="muted">Enter the email you signed up with and we'll send a link to choose a new password. The link works once, for 30 minutes.</p>
          <div className="field">
            <label htmlFor="forgot-email">Email</label>
            <input id="forgot-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button className="btn block" disabled={busy || !email}>
            {busy ? "One moment…" : "Send reset link"}
          </button>
        </form>
      )}
      <button className="btn secondary block" style={{ marginTop: 10 }} onClick={onBack}>
        Back to sign in
      </button>
    </section>
  );
}
