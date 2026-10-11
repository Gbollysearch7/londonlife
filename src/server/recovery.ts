import { GameError, withTx, type Tx } from "./db";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "./passwords";

/**
 * Account recovery and session safety (spec ch. 35.4, 36): password reset links, password changes,
 * signing out everywhere and attempt throttling.
 *
 * Security windows are real wall-clock time. They deliberately do not use the game's time scale,
 * so a sped-up test build never shortens how long a reset link lives or how long a lockout lasts.
 */

export const RESET_TTL_MS = 30 * 60_000;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;

export interface Rule {
  limit: number;
  windowMs: number;
}

export const LIMITS = {
  /** Reset emails asked for one address. */
  resetRequestPerEmail: { limit: 3, windowMs: 60 * 60_000 },
  /** Reset emails asked for from one network address. */
  resetRequestPerAddress: { limit: 10, windowMs: 60 * 60_000 },
  /** Attempts to use a reset link from one network address. */
  resetUsePerAddress: { limit: 10, windowMs: 15 * 60_000 },
  /** Failed sign-ins for one email. */
  signInFailures: { limit: 8, windowMs: 15 * 60_000 },
  /** Wrong current password when changing it. */
  passwordChangeFailures: { limit: 5, windowMs: 15 * 60_000 },
} satisfies Record<string, Rule>;

export const normaliseEmail = (raw: string) => raw.trim().toLowerCase();

/** Throttle keys are hashed so the attempts table never holds emails or addresses. */
export async function bucketFor(kind: string, value: string) {
  return `${kind}:${await sha256Hex(value)}`;
}

export function checkNewPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new GameError("weak_password", `Use a password of at least ${MIN_PASSWORD} characters.`);
  if (password.length > MAX_PASSWORD) throw new GameError("long_password", `Use a password of at most ${MAX_PASSWORD} characters.`);
}

function waitText(ms: number) {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  return mins === 1 ? "a minute" : `${mins} minutes`;
}

async function recent(tx: Tx, bucket: string, rule: Rule, now: Date) {
  const r = await tx.query(
    "SELECT count(*)::int AS n, min(created_at) AS oldest FROM auth_attempts WHERE bucket = $1 AND created_at > $2",
    [bucket, new Date(now.getTime() - rule.windowMs)],
  );
  return { n: Number(r.rows[0].n), oldest: r.rows[0].oldest ? new Date(r.rows[0].oldest) : null };
}

function limited(oldest: Date | null, rule: Rule, now: Date) {
  const wait = oldest ? oldest.getTime() + rule.windowMs - now.getTime() : rule.windowMs;
  return new GameError("rate_limited", `Too many attempts. Please wait ${waitText(wait)} and try again.`, 429);
}

/** True when the bucket is already at its limit (used where only failures count). */
export async function isThrottled(tx: Tx, bucket: string, rule: Rule, now: Date) {
  const { n } = await recent(tx, bucket, rule, now);
  return n >= rule.limit;
}

export async function throwIfThrottled(tx: Tx, bucket: string, rule: Rule, now: Date) {
  const { n, oldest } = await recent(tx, bucket, rule, now);
  if (n >= rule.limit) throw limited(oldest, rule, now);
}

export async function recordAttempt(tx: Tx, bucket: string, now: Date) {
  await tx.query("INSERT INTO auth_attempts (bucket, created_at) VALUES ($1, $2)", [bucket, now]);
}

/** Counts one attempt, or rejects it when the bucket is full. Locked per bucket so parallel requests can't slip past. */
export async function throttle(tx: Tx, bucket: string, rule: Rule, now: Date) {
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [bucket]);
  await throwIfThrottled(tx, bucket, rule, now);
  await recordAttempt(tx, bucket, now);
}

/**
 * Issues a single-use reset link for the account with this email, if there is one.
 * The caller always shows the same reply, so the response never reveals whether an email is registered.
 * Returns the raw token only so the caller can deliver it; it is stored as a hash.
 */
export async function requestPasswordReset(emailRaw: string, address: string, now: Date): Promise<{ token: string | null }> {
  const email = normaliseEmail(emailRaw);
  if (!email || email.length > 320) throw new GameError("bad_email", "Enter the email you signed up with.");
  const byEmail = await bucketFor("reset-email", email);
  const byAddress = await bucketFor("reset-address", address);
  await withTx(async (tx) => {
    await throttle(tx, byEmail, LIMITS.resetRequestPerEmail, now);
    await throttle(tx, byAddress, LIMITS.resetRequestPerAddress, now);
  });
  return withTx(async (tx) => {
    // Housekeeping: old throttle rows and long-dead links.
    const dayAgo = new Date(now.getTime() - 86_400_000);
    await tx.query("DELETE FROM auth_attempts WHERE created_at < $1", [dayAgo]);
    await tx.query("DELETE FROM password_reset_tokens WHERE expires_at < $1", [dayAgo]);
    const acc = await tx.query("SELECT id FROM accounts WHERE email = $1 FOR UPDATE", [email]);
    if (!acc.rowCount) return { token: null };
    const accountId = acc.rows[0].id as string;
    // A new link replaces any earlier unused one.
    await tx.query("DELETE FROM password_reset_tokens WHERE account_id = $1 AND used_at IS NULL", [accountId]);
    const token = randomToken();
    await tx.query("INSERT INTO password_reset_tokens (token_hash, account_id, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
      await sha256Hex(token),
      accountId,
      now,
      new Date(now.getTime() + RESET_TTL_MS),
    ]);
    return { token };
  });
}

const INVALID = () => new GameError("reset_invalid", "This reset link isn't valid. Request a new one from the sign-in screen.");

/** Whether a reset link can still be used (for the reset page; does not consume it). */
export async function resetLinkStatus(token: string, now: Date): Promise<"valid" | "used" | "expired" | "invalid"> {
  if (!token || token.length > 200) return "invalid";
  return withTx(async (tx) => {
    const r = await tx.query("SELECT expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1", [await sha256Hex(token)]);
    if (!r.rowCount) return "invalid";
    if (r.rows[0].used_at) return "used";
    return new Date(r.rows[0].expires_at) <= now ? "expired" : "valid";
  });
}

/**
 * Sets a new password from a reset link. The link works once, within 30 minutes; using it signs the
 * account out on every device and clears its sign-in lockout.
 */
export async function completePasswordReset(token: string, newPassword: string, address: string, now: Date): Promise<{ accountId: string }> {
  checkNewPassword(newPassword);
  if (!token || token.length > 200) throw INVALID();
  const byAddress = await bucketFor("reset-use", address);
  await withTx((tx) => throttle(tx, byAddress, LIMITS.resetUsePerAddress, now));
  const tokenHash = await sha256Hex(token);
  const passwordHash = await hashPassword(newPassword);
  return withTx(async (tx) => {
    const r = await tx.query(
      `SELECT t.account_id, t.expires_at, t.used_at, a.email FROM password_reset_tokens t JOIN accounts a ON a.id = t.account_id
       WHERE t.token_hash = $1 FOR UPDATE OF t`,
      [tokenHash],
    );
    if (!r.rowCount) throw INVALID();
    const row = r.rows[0];
    if (row.used_at) throw new GameError("reset_used", "This reset link has already been used. Request a new one if you still need it.");
    if (new Date(row.expires_at) <= now) throw new GameError("reset_expired", "This reset link has expired. Links last 30 minutes, so request a new one.");
    const accountId = row.account_id as string;
    await tx.query("UPDATE password_reset_tokens SET used_at = $2 WHERE token_hash = $1", [tokenHash, now]);
    await tx.query("DELETE FROM password_reset_tokens WHERE account_id = $1 AND used_at IS NULL", [accountId]);
    await tx.query("UPDATE accounts SET password_hash = $2, password_changed_at = $3 WHERE id = $1", [accountId, passwordHash, now]);
    await tx.query("DELETE FROM sessions WHERE account_id = $1", [accountId]);
    await tx.query("DELETE FROM auth_attempts WHERE bucket = $1", [await bucketFor("signin", row.email)]);
    return { accountId };
  });
}

/**
 * Changes the password of a signed-in account after checking the current one. Every other session is
 * signed out; the session making the change (if given) stays signed in.
 */
export async function changePassword(
  accountId: string,
  current: string,
  next: string,
  keepSessionHash: string | null,
  now: Date,
): Promise<{ signedOutOthers: number }> {
  checkNewPassword(next);
  if (current === next) throw new GameError("same_password", "Choose a new password that's different from your current one.");
  const bucket = `pw-change:${accountId}`;
  const nextHash = await hashPassword(next);
  try {
    return await withTx(async (tx) => {
      const { n, oldest } = await recent(tx, bucket, LIMITS.passwordChangeFailures, now);
      if (n >= LIMITS.passwordChangeFailures.limit) throw limited(oldest, LIMITS.passwordChangeFailures, now);
      const r = await tx.query("SELECT password_hash FROM accounts WHERE id = $1 FOR UPDATE", [accountId]);
      if (!r.rowCount) throw new GameError("signed_out", "Your session has ended. Please sign in again.", 401);
      if (!(await verifyPassword(current, r.rows[0].password_hash))) throw new GameError("bad_password", "Your current password is incorrect.");
      await tx.query("UPDATE accounts SET password_hash = $2, password_changed_at = $3 WHERE id = $1", [accountId, nextHash, now]);
      await tx.query("DELETE FROM password_reset_tokens WHERE account_id = $1 AND used_at IS NULL", [accountId]);
      const s = await tx.query("DELETE FROM sessions WHERE account_id = $1 AND token_hash IS DISTINCT FROM $2", [accountId, keepSessionHash]);
      return { signedOutOthers: s.rowCount ?? 0 };
    });
  } catch (err) {
    // Wrong guesses count towards the lockout even though the change itself rolled back.
    if (err instanceof GameError && err.code === "bad_password") await withTx((tx) => recordAttempt(tx, bucket, now));
    throw err;
  }
}

/** Ends every session of this account, on every device (including this one). */
export async function signOutEverywhere(accountId: string): Promise<{ ended: number }> {
  return withTx(async (tx) => {
    const r = await tx.query("DELETE FROM sessions WHERE account_id = $1", [accountId]);
    return { ended: r.rowCount ?? 0 };
  });
}

/**
 * No email service is approved yet. In development the link goes to the server log so the flow can be
 * tested; in production nothing secret is logged and the request is recorded as undeliverable.
 */
export function deliverResetLink(email: string, link: string) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[London Life · development only] Password reset link for ${email} (works once, for 30 minutes): ${link}`);
  } else {
    console.warn("[London Life] A password reset was requested, but no email service is configured, so no link was sent.");
  }
}
