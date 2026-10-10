import crypto from "node:crypto";
import { cookies } from "next/headers";
import { GameError, pool } from "./db";

const COOKIE = "ll_session";
const SESSION_DAYS = 30;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [, saltHex, keyHex] = stored.split(":");
  const key = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}

const tokenHash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GameError("bad_email", "Enter a valid email address.");
}

export async function signUp(emailRaw: string, password: string, adultConfirmed: boolean) {
  const email = emailRaw.trim().toLowerCase();
  validateEmail(email);
  if (!adultConfirmed) throw new GameError("not_adult", "London Life is for adults. Please confirm you are 18 or over.");
  if (password.length < 8) throw new GameError("weak_password", "Use a password of at least 8 characters.");
  const res = await pool().query(
    `INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ($1, $2, now())
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [email, hashPassword(password)],
  );
  if (!res.rowCount) throw new GameError("email_taken", "An account with that email already exists. Sign in instead.");
  return startSession(res.rows[0].id);
}

export async function signIn(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const res = await pool().query("SELECT id, password_hash FROM accounts WHERE email = $1", [email]);
  if (!res.rowCount || !verifyPassword(password, res.rows[0].password_hash)) {
    throw new GameError("bad_credentials", "Email or password is incorrect.", 401);
  }
  return startSession(res.rows[0].id);
}

async function startSession(accountId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool().query(
    `INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [tokenHash(token), accountId],
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return accountId;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await pool().query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  jar.delete(COOKIE);
}

export async function currentAccountId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const res = await pool().query("SELECT account_id FROM sessions WHERE token_hash = $1 AND expires_at > now()", [
    tokenHash(token),
  ]);
  return res.rows[0]?.account_id ?? null;
}

export async function requireAccount(): Promise<string> {
  const id = await currentAccountId();
  if (!id) throw new GameError("signed_out", "Your session has ended. Please sign in again.", 401);
  return id;
}
