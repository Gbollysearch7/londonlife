import crypto from "node:crypto";

/**
 * Password and token hashing shared by the server and the test build.
 * On the server passwords use scrypt (the format sign-up has always written). The test build runs in a
 * browser without scrypt, so there it falls back to PBKDF2 through Web Crypto. Both formats verify everywhere
 * a format's primitive exists, and a stored hash always names its own format.
 */

const enc = new TextEncoder();

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** URL-safe random token (256 bits by default). */
export function randomToken(bytes = 32): string {
  const b = randomBytes(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 hex digest, used to store tokens and throttle keys without keeping the raw value. */
export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", enc.encode(text))));
}

const PBKDF2_ITERATIONS = 210_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

type ScryptFn = (pw: string, salt: Uint8Array, len: number, cb: (err: Error | null, key: Uint8Array) => void) => void;
const scryptFn = (crypto as unknown as { scrypt?: ScryptFn }).scrypt;

function scrypt(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => scryptFn!(password, salt, 64, (err, key) => (err ? reject(err) : resolve(new Uint8Array(key)))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  if (scryptFn) return `scrypt:${toHex(salt)}:${toHex(await scrypt(password, salt))}`;
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts[0] === "scrypt" && parts.length === 3 && scryptFn) return sameBytes(await scrypt(password, fromHex(parts[1])), fromHex(parts[2]));
  if (parts[0] === "pbkdf2" && parts.length === 4) {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    return sameBytes(await pbkdf2(password, fromHex(parts[2]), iterations), fromHex(parts[3]));
  }
  return false;
}
