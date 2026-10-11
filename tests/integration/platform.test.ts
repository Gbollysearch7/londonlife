import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool, type Tx } from "@/server/db";
import { verifyCredentials } from "@/server/auth";
import { hashPassword, sha256Hex, verifyPassword } from "@/server/passwords";
import {
  LIMITS,
  RESET_TTL_MS,
  changePassword,
  completePasswordReset,
  requestPasswordReset,
  resetLinkStatus,
  signOutEverywhere,
} from "@/server/recovery";
import { healthReport, migrationFiles } from "@/server/platformHealth";
import { resetDb } from "./helpers";

const T0 = new Date("2026-10-10T09:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;

let n = 0;
async function account(password = "correct horse", email = `reset${n++}@example.test`) {
  const r = await pool().query("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ($1, $2, now()) RETURNING id", [
    email,
    await hashPassword(password),
  ]);
  return { id: r.rows[0].id as string, email, password };
}

async function session(accountId: string, name: string) {
  const hash = await sha256Hex(`session-${name}-${Math.random()}`);
  await pool().query("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [hash, accountId]);
  return hash;
}

const sessionCount = async (accountId: string) =>
  Number((await pool().query("SELECT count(*) AS n FROM sessions WHERE account_id = $1", [accountId])).rows[0].n);

const expectCode = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toMatchObject({ code });
};

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(async () => {
  await resetDb();
  await pool().query("TRUNCATE auth_attempts");
});
afterAll(async () => {
  await pool().end();
});

describe("M · account recovery: password reset links", () => {
  it("issues a hashed, single-use link that sets a new password and signs out every device", async () => {
    const a = await account();
    await session(a.id, "phone");
    await session(a.id, "laptop");
    const { token } = await requestPasswordReset(a.email.toUpperCase() + "  ", "10.0.0.1", T0);
    expect(token).toBeTruthy();
    // Only the hash is stored.
    const stored = await pool().query("SELECT token_hash, expires_at FROM password_reset_tokens WHERE account_id = $1", [a.id]);
    expect(stored.rowCount).toBe(1);
    expect(stored.rows[0].token_hash).toBe(await sha256Hex(token!));
    expect(stored.rows[0].token_hash).not.toContain(token!);
    expect(new Date(stored.rows[0].expires_at).getTime()).toBe(T0.getTime() + RESET_TTL_MS);
    expect(await resetLinkStatus(token!, at(MIN))).toBe("valid");

    await completePasswordReset(token!, "a brand new secret", "10.0.0.1", at(5 * MIN));
    expect(await sessionCount(a.id)).toBe(0);
    expect(await verifyCredentials(a.email, "a brand new secret")).toBe(a.id);
    await expectCode(verifyCredentials(a.email, a.password), "bad_credentials");
    const acc = await pool().query("SELECT password_changed_at FROM accounts WHERE id = $1", [a.id]);
    expect(new Date(acc.rows[0].password_changed_at).getTime()).toBe(at(5 * MIN).getTime());

    // Single use.
    expect(await resetLinkStatus(token!, at(6 * MIN))).toBe("used");
    await expectCode(completePasswordReset(token!, "another new secret", "10.0.0.1", at(6 * MIN)), "reset_used");
    expect(await verifyCredentials(a.email, "a brand new secret")).toBe(a.id);
  });

  it("gives the same answer for unknown emails and creates nothing", async () => {
    const r = await requestPasswordReset("nobody@example.test", "10.0.0.2", T0);
    expect(r.token).toBeNull();
    expect((await pool().query("SELECT count(*) AS n FROM password_reset_tokens")).rows[0].n).toBe("0");
  });

  it("expires after 30 minutes", async () => {
    const a = await account();
    const { token } = await requestPasswordReset(a.email, "10.0.0.3", T0);
    expect(await resetLinkStatus(token!, at(RESET_TTL_MS - 1000))).toBe("valid");
    expect(await resetLinkStatus(token!, at(RESET_TTL_MS))).toBe("expired");
    await expectCode(completePasswordReset(token!, "too late now", "10.0.0.3", at(RESET_TTL_MS + 1)), "reset_expired");
    expect(await verifyCredentials(a.email, a.password)).toBe(a.id);
  });

  it("rejects made-up tokens and weak passwords without using the link up", async () => {
    const a = await account();
    const { token } = await requestPasswordReset(a.email, "10.0.0.4", T0);
    await expectCode(completePasswordReset("not-a-real-token", "long enough pass", "10.0.0.4", at(MIN)), "reset_invalid");
    await expectCode(completePasswordReset("", "long enough pass", "10.0.0.4", at(MIN)), "reset_invalid");
    await expectCode(completePasswordReset(token!, "short", "10.0.0.4", at(MIN)), "weak_password");
    await expectCode(completePasswordReset(token!, "x".repeat(201), "10.0.0.4", at(MIN)), "long_password");
    expect(await resetLinkStatus(token!, at(MIN))).toBe("valid");
    await completePasswordReset(token!, "long enough pass", "10.0.0.4", at(2 * MIN));
  });

  it("a newer link replaces an older unused one", async () => {
    const a = await account();
    const first = (await requestPasswordReset(a.email, "10.0.0.5", T0)).token!;
    const second = (await requestPasswordReset(a.email, "10.0.0.5", at(MIN))).token!;
    expect(await resetLinkStatus(first, at(2 * MIN))).toBe("invalid");
    await expectCode(completePasswordReset(first, "first link pass", "10.0.0.5", at(2 * MIN)), "reset_invalid");
    await completePasswordReset(second, "second link pass", "10.0.0.5", at(2 * MIN));
    expect(await verifyCredentials(a.email, "second link pass")).toBe(a.id);
  });

  it("two simultaneous uses of one link: exactly one wins", async () => {
    const a = await account();
    const { token } = await requestPasswordReset(a.email, "10.0.0.6", T0);
    const results = await Promise.allSettled([
      completePasswordReset(token!, "racer number one", "10.0.0.6", at(MIN)),
      completePasswordReset(token!, "racer number two", "10.0.0.7", at(MIN)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason.code).toBe("reset_used");
  });

  it("one account's link never touches another account (two accounts)", async () => {
    const a = await account("alpha password");
    const b = await account("bravo password");
    const bSession = await session(b.id, "b-phone");
    const { token } = await requestPasswordReset(a.email, "10.0.0.8", T0);
    await completePasswordReset(token!, "alpha replaced", "10.0.0.8", at(MIN));
    expect(await verifyCredentials(b.email, "bravo password")).toBe(b.id);
    expect(await sessionCount(b.id)).toBe(1);
    expect((await pool().query("SELECT 1 FROM sessions WHERE token_hash = $1", [bSession])).rowCount).toBe(1);
    // B's own link only resets B.
    const tb = (await requestPasswordReset(b.email, "10.0.0.9", at(2 * MIN))).token!;
    await completePasswordReset(tb, "bravo replaced", "10.0.0.9", at(3 * MIN));
    expect(await verifyCredentials(a.email, "alpha replaced")).toBe(a.id);
    expect(await verifyCredentials(b.email, "bravo replaced")).toBe(b.id);
  });

  it("rate-limits reset requests per email and per address, whether or not the email exists", async () => {
    const a = await account();
    for (let i = 0; i < LIMITS.resetRequestPerEmail.limit; i++) await requestPasswordReset(a.email, `10.1.0.${i}`, at(i * MIN));
    await expectCode(requestPasswordReset(a.email, "10.1.0.99", at(10 * MIN)), "rate_limited");
    // Same for an unregistered address, so the limit can't reveal who has an account.
    for (let i = 0; i < LIMITS.resetRequestPerEmail.limit; i++) await requestPasswordReset("ghost@example.test", `10.2.0.${i}`, at(i * MIN));
    await expectCode(requestPasswordReset("ghost@example.test", "10.2.0.99", at(10 * MIN)), "rate_limited");
    // The window passes.
    expect((await requestPasswordReset(a.email, "10.1.0.100", at(61 * MIN))).token).toBeTruthy();

    // One address spraying many emails.
    for (let i = 0; i < LIMITS.resetRequestPerAddress.limit; i++) await requestPasswordReset(`spray${i}@example.test`, "10.3.0.1", at(i * 1000));
    const err = await requestPasswordReset("spray-last@example.test", "10.3.0.1", at(20_000)).catch((e) => e);
    expect(err.code).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/wait .* and try again/);
  });

  it("rate-limits guessing at reset links from one address", async () => {
    const a = await account();
    const { token } = await requestPasswordReset(a.email, "10.4.0.1", T0);
    for (let i = 0; i < LIMITS.resetUsePerAddress.limit; i++) {
      await expectCode(completePasswordReset(`guess-${i}`, "guessing pass", "10.4.0.2", at(MIN)), "reset_invalid");
    }
    await expectCode(completePasswordReset(token!, "guessing pass", "10.4.0.2", at(MIN)), "rate_limited");
    // The real owner on another connection is unaffected.
    await completePasswordReset(token!, "owner pass ok", "10.4.0.3", at(MIN));
  });
});

describe("M · change password, sign out everywhere, sign-in lockout", () => {
  it("changes the password after checking the current one, keeping only this session", async () => {
    const a = await account("old password");
    const here = await session(a.id, "here");
    await session(a.id, "elsewhere-1");
    await session(a.id, "elsewhere-2");
    await expectCode(changePassword(a.id, "wrong password", "new password!", here, T0), "bad_password");
    await expectCode(changePassword(a.id, "old password", "old password", here, T0), "same_password");
    await expectCode(changePassword(a.id, "old password", "short", here, T0), "weak_password");
    expect(await sessionCount(a.id)).toBe(3);
    const r = await changePassword(a.id, "old password", "new password!", here, T0);
    expect(r.signedOutOthers).toBe(2);
    expect(await sessionCount(a.id)).toBe(1);
    expect((await pool().query("SELECT 1 FROM sessions WHERE token_hash = $1", [here])).rowCount).toBe(1);
    expect(await verifyCredentials(a.email, "new password!")).toBe(a.id);
    await expectCode(verifyCredentials(a.email, "old password"), "bad_credentials");
  });

  it("changing the password cancels any outstanding reset link", async () => {
    const a = await account("old password");
    const { token } = await requestPasswordReset(a.email, "10.5.0.1", T0);
    await changePassword(a.id, "old password", "newer password", null, at(MIN));
    await expectCode(completePasswordReset(token!, "hijack attempt", "10.5.0.2", at(2 * MIN)), "reset_invalid");
  });

  it("locks password changes after repeated wrong current passwords", async () => {
    const a = await account("old password");
    for (let i = 0; i < LIMITS.passwordChangeFailures.limit; i++) {
      await expectCode(changePassword(a.id, `wrong ${i}`, "new password!", null, at(i * 1000)), "bad_password");
    }
    await expectCode(changePassword(a.id, "old password", "new password!", null, at(10_000)), "rate_limited");
    expect(await verifyCredentials(a.email, "old password")).toBe(a.id);
    // Lockouts are per account.
    const b = await account("b password");
    await changePassword(b.id, "b password", "b password 2", null, at(10_000));
    // And they lift after the window.
    await changePassword(a.id, "old password", "new password!", null, at(LIMITS.passwordChangeFailures.windowMs + 1000));
  });

  it("signs out of every session on every device, and only for that account", async () => {
    const a = await account();
    const b = await account();
    await session(a.id, "1");
    await session(a.id, "2");
    await session(b.id, "1");
    expect((await signOutEverywhere(a.id)).ended).toBe(2);
    expect(await sessionCount(a.id)).toBe(0);
    expect(await sessionCount(b.id)).toBe(1);
    expect((await signOutEverywhere(a.id)).ended).toBe(0);
  });

  it("locks sign-in for an email after repeated failures; a reset lifts it", async () => {
    const a = await account("right password");
    for (let i = 0; i < LIMITS.signInFailures.limit; i++) await expectCode(verifyCredentials(a.email, `wrong ${i}`), "bad_credentials");
    await expectCode(verifyCredentials(a.email, "right password"), "rate_limited");
    // Other emails are unaffected.
    const b = await account("b password");
    expect(await verifyCredentials(b.email, "b password")).toBe(b.id);
    const { token } = await requestPasswordReset(a.email, "10.6.0.1", new Date());
    await completePasswordReset(token!, "fresh password", "10.6.0.1", new Date());
    expect(await verifyCredentials(a.email, "fresh password")).toBe(a.id);
  });

  it("verifies both stored password formats and rejects junk hashes", async () => {
    expect(await verifyPassword("anything", "x")).toBe(false);
    expect(await verifyPassword("anything", "pbkdf2:0:00:00")).toBe(false);
    const h = await hashPassword("pass phrase");
    expect(h.startsWith("scrypt:")).toBe(true);
    expect(await verifyPassword("pass phrase", h)).toBe(true);
    expect(await verifyPassword("pass phrasf", h)).toBe(false);
  });
});

describe("M · health report", () => {
  it("reports the database and migrations without secrets", async () => {
    const files = migrationFiles();
    expect(files).toContain("018_platform.sql");
    const r = await healthReport(pool(), files, { deep: true }, T0);
    expect(r.status).toBe("ok");
    expect(r.database.reachable).toBe(true);
    expect(r.migrations).toMatchObject({ expected: files.length, applied: files.length, pending: [], unknown: [], latest: files[files.length - 1] });
    expect(r.ledger).toEqual({ characters: 0, imbalanced: 0 });
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/postgres|password|london:london/i);
  });

  it("is degraded when migrations are pending or unknown, or the ledger drifts", async () => {
    const r = await healthReport(pool(), [...migrationFiles(), "999_future.sql"], {}, T0);
    expect(r.status).toBe("degraded");
    expect(r.migrations!.pending).toEqual(["999_future.sql"]);
    const r2 = await healthReport(pool(), migrationFiles().slice(0, -1), {}, T0);
    expect(r2.status).toBe("degraded");
    expect(r2.migrations!.unknown).toEqual([migrationFiles().slice(-1)[0]]);
  });

  it("is down (and says nothing more) when the database can't be reached", async () => {
    const broken: Tx = {
      query: async () => {
        throw new Error("connect ECONNREFUSED postgresql://london:secret@db:5432");
      },
    };
    const r = await healthReport(broken, migrationFiles(), {}, T0);
    expect(r).toEqual({ status: "down", checkedAt: T0.toISOString(), database: { reachable: false, latencyMs: null }, migrations: null });
  });
});
