import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Exactly what the test build bundles: the PGlite database and the browser crypto shim (no scrypt).
vi.mock("@/server/db", () => import("@/demo/db"));
vi.mock("node:crypto", () => import("@/demo/cryptoShim"));

/** The test build's on-screen recovery demo runs the real reset rules on PGlite with PBKDF2 hashing. */
describe("account recovery on PGlite (test build)", () => {
  let recovery: typeof import("@/server/recovery");
  let passwords: typeof import("@/server/passwords");
  let db: PGlite;
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    await db.query("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('local-test-player', 'none', now())");
    recovery = await import("@/server/recovery");
    passwords = await import("@/server/passwords");
  });

  it("issues and uses a single-use link, storing a PBKDF2 hash", async () => {
    const now = new Date("2026-10-10T09:00:00Z");
    const { token } = await recovery.requestPasswordReset("local-test-player", "local", now);
    expect(token).toBeTruthy();
    await recovery.completePasswordReset(token!, "browser password", "local", new Date(now.getTime() + 60_000));
    const hash = (await db.query<{ password_hash: string }>("SELECT password_hash FROM accounts")).rows[0].password_hash;
    expect(hash.startsWith("pbkdf2:")).toBe(true);
    expect(await passwords.verifyPassword("browser password", hash)).toBe(true);
    expect(await passwords.verifyPassword("wrong", hash)).toBe(false);
    await expect(recovery.completePasswordReset(token!, "again please", "local", new Date(now.getTime() + 120_000))).rejects.toMatchObject({ code: "reset_used" });
  }, 20000);
});
