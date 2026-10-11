import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { databaseDigest, exportDatabase, importDatabase, ledgerImbalances, parseBackup, type Backup } from "@/server/backup";
import { requestPasswordReset } from "@/server/recovery";
import { cmd, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

const T0 = new Date("2026-10-10T09:00:00Z");
const SOURCE = process.env.DATABASE_URL!;
const RESTORE = SOURCE.replace(/\/([^/?]+)(\?.*)?$/, (_m, db, qs = "") => `/${db}_restore${qs}`);
const restoreDbName = new URL(RESTORE).pathname.slice(1);

async function admin<T>(fn: (c: Client) => Promise<T>) {
  const u = new URL(SOURCE);
  u.pathname = "/postgres";
  const c = new Client({ connectionString: u.toString() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function freshRestoreDb() {
  await admin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${restoreDbName}" WITH (FORCE)`);
    await c.query(`CREATE DATABASE "${restoreDbName}"`);
  });
  await migrate(RESTORE);
}

async function withClient<T>(url: string, fn: (c: Client) => Promise<T>) {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** A realistic little world: two players with homes, furniture, cooking, travel, a friendship and a rematched game. */
async function seedWorld() {
  await resetDb();
  const a = await makeAccount();
  const b = await makeAccount();
  await makeCharacter(a, T0, 0.3);
  await makeCharacter(b, T0, 0.8);
  await cmd(a, "BuyFurniture", { defId: "plant" }, T0);
  await cmd(a, "StartActivity", { activityId: "cook_beans_on_toast" }, T0);
  await state(a, minutes(T0, 10));
  await cmd(b, "StartJourney", { destination: "food_hall", mode: "bus" }, T0);
  await state(b, minutes(T0, 20));
  const ids = await pool().query("SELECT id, account_id FROM characters");
  const charOf = (acc: string) => ids.rows.find((r) => r.account_id === acc).id as string;
  await cmd(a, "SendFriendRequest", { characterId: charOf(b) }, minutes(T0, 21));
  const s = await state(b, minutes(T0, 22));
  await cmd(b, "RespondFriendRequest", { requestId: s.social.incoming[0].id, accept: true }, minutes(T0, 22));
  // A finished game and its rematch; the rematch's id sorts first, so restore must order rows by the self-reference.
  const board = ".".repeat(42);
  await pool().query(
    `INSERT INTO game_tables (id, game, mode, venue, status, seat_a, seat_b, board, turn, created_at, winner, moves)
     VALUES ('ffffffff-0000-4000-8000-000000000001', 'four_in_row', 'friendly', 'food_hall', 'finished', $1, $2, $3, 'a', $4, 'draw', '[{"col":3,"n":1.25}]')`,
    [charOf(a), charOf(b), board, T0],
  );
  await pool().query(
    `INSERT INTO game_tables (id, game, mode, venue, status, seat_a, seat_b, board, turn, created_at, rematch_of)
     VALUES ('00000000-0000-4000-8000-000000000002', 'four_in_row', 'friendly', 'food_hall', 'active', $2, $1, $3, 'b', $4, 'ffffffff-0000-4000-8000-000000000001')`,
    [charOf(a), charOf(b), board, minutes(T0, 30)],
  );
  // Live credentials that must not end up in a backup.
  await pool().query("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ('secret-session-hash', $1, now() + interval '1 day')", [a]);
  const email = (await pool().query("SELECT email FROM accounts WHERE id = $1", [a])).rows[0].email;
  await requestPasswordReset(email, "10.9.9.9", T0);
}

beforeAll(async () => {
  await migrate(SOURCE);
  await seedWorld();
}, 60_000);
afterAll(async () => {
  await pool().end();
  await admin((c) => c.query(`DROP DATABASE IF EXISTS "${restoreDbName}" WITH (FORCE)`));
}, 60_000);

describe("M · backup and restore", { timeout: 60_000 }, () => {
  let backup: Backup;
  let original: Awaited<ReturnType<typeof databaseDigest>>;

  it("exports every game table in dependency order, without credentials", async () => {
    backup = await withClient(SOURCE, (c) => exportDatabase(c, T0));
    original = await withClient(SOURCE, databaseDigest);
    const names = backup.tables.map((t) => t.name);
    expect(names.indexOf("accounts")).toBeLessThan(names.indexOf("characters"));
    expect(names.indexOf("characters")).toBeLessThan(names.indexOf("ledger_entries"));
    expect(names.indexOf("characters")).toBeLessThan(names.indexOf("game_tables"));
    expect(names.indexOf("game_tables")).toBeLessThan(names.indexOf("game_results"));
    for (const secret of ["sessions", "password_reset_tokens", "auth_attempts", "schema_migrations"]) expect(names).not.toContain(secret);
    expect(JSON.stringify(backup)).not.toContain("secret-session-hash");
    expect(backup.migrations).toContain("018_platform.sql");
    const ledger = backup.tables.find((t) => t.name === "ledger_entries")!;
    expect(ledger.rows.length).toBeGreaterThan(2);
    expect(Object.keys(original)).toEqual(names);
  });

  it("restores into a fresh database with identical rows, balances, ledger and sequences", async () => {
    await freshRestoreDb();
    const file = parseBackup(JSON.stringify(backup)); // through text, exactly as the scripts do
    const r = await withClient(RESTORE, (c) => importDatabase(c, file));
    expect(r.rows).toBe(backup.tables.reduce((n, t) => n + t.rows.length, 0));
    const restored = await withClient(RESTORE, databaseDigest);
    expect(restored).toEqual(original);
    expect(await withClient(RESTORE, ledgerImbalances)).toEqual([]);
    const cash = (url: string) =>
      withClient(url, async (c) => (await c.query("SELECT id, cash_pence::text AS cash FROM characters ORDER BY id")).rows);
    expect(await cash(RESTORE)).toEqual(await cash(SOURCE));
    const seq = (url: string) => withClient(url, async (c) => (await c.query("SELECT last_value::text AS v FROM ledger_entries_id_seq")).rows[0].v);
    expect(await seq(RESTORE)).toBe(await seq(SOURCE));
    // Nobody is signed in after a restore; reset links don't carry over.
    expect(await withClient(RESTORE, async (c) => (await c.query("SELECT count(*)::int AS n FROM sessions")).rows[0].n)).toBe(0);
  });

  it("refuses a non-empty target unless replacing, and replacing is repeatable", async () => {
    await expect(withClient(RESTORE, (c) => importDatabase(c, backup))).rejects.toThrow(/already has rows/);
    await withClient(RESTORE, (c) => c.query("INSERT INTO sessions (token_hash, account_id, expires_at) SELECT 'x', id, now() FROM accounts LIMIT 1"));
    await withClient(RESTORE, (c) => importDatabase(c, backup, { replace: true }));
    expect(await withClient(RESTORE, databaseDigest)).toEqual(original);
    expect(await withClient(RESTORE, async (c) => (await c.query("SELECT count(*)::int AS n FROM sessions")).rows[0].n)).toBe(0);
  });

  it("refuses a target on different migrations and leaves it untouched", async () => {
    const future = { ...backup, migrations: [...backup.migrations, "999_future.sql"] };
    await expect(withClient(RESTORE, (c) => importDatabase(c, future, { replace: true }))).rejects.toThrow(/migrations don't match.*999_future/);
    expect(await withClient(RESTORE, databaseDigest)).toEqual(original);
  });

  it("rolls back completely when a row can't be restored", async () => {
    const broken: Backup = JSON.parse(JSON.stringify(backup));
    const chars = broken.tables.find((t) => t.name === "characters")!;
    chars.rows[0][chars.columns.indexOf("cash_pence")] = "-5"; // violates cash_pence >= 0
    await expect(withClient(RESTORE, (c) => importDatabase(c, broken, { replace: true }))).rejects.toThrow();
    expect(await withClient(RESTORE, databaseDigest)).toEqual(original);
  });

  it("rejects files that aren't London Life backups", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/isn't a London Life backup/);
    expect(() => parseBackup(JSON.stringify({ ...backup, version: 99 }))).toThrow(/version 99/);
  });
});
