import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

vi.mock("@/server/db", () => import("@/demo/db"));

/** The test build runs draughts and the weekly ladder on PGlite too (constraint swap, advisory locks, FILTER, text arrays). */
describe("draughts and the ladder on PGlite", () => {
  let commands: typeof import("@/server/commands");
  let pg: PGlite;
  const accs: string[] = [];
  const T0 = new Date("2026-10-10T13:00:00Z");
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    const forPglite = (sql: string) => sql.replace(/CREATE EXTENSION[^;]*;/, "");
    const db = new PGlite();
    // The demo's migration list must include every migration file, in order.
    expect([...fs.readFileSync("src/demo/migrations.ts", "utf8").matchAll(/\["(\d{3}_\w+\.sql)"/g)].map((m) => m[1])).toEqual(fs.readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort());
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(forPglite(fs.readFileSync(`db/migrations/${f}`, "utf8")));
    setDb(db);
    pg = db;
    commands = await import("@/server/commands");
    for (const [i, name] of ["Tess", "Uma"].entries()) {
      const acc = (await db.query<{ id: string }>(`INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('d${i}','x',now()) RETURNING id`)).rows[0].id;
      const payload = { name, appearance: { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 }, traits: ["creative", "sociable"], ambition: "four_friends" };
      await commands.runCommand(acc, `key-create-${i}`, "CreateCharacter", payload, new Date(T0.getTime() - 2 * 86_400_000));
      accs.push(acc);
    }
    await db.query("UPDATE characters SET location = 'last_stop_pub'");
  }, 30000);

  it("plays a practice draughts move against the NPC", async () => {
    const [a] = accs;
    const r = await commands.runCommand(a, "key-dpractice-1", "CreateGameTable", { mode: "practice", game: "draughts" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    let t = await commands.loadTableFor(a, id, T0);
    expect(t.board).toHaveLength(32);
    await commands.runCommand(a, "key-dmove-0001", "GameMove", { tableId: id, path: [10, 14], version: t.version }, T0);
    t = await commands.loadTableFor(a, id, T0);
    expect(t.moveCount).toBe(2);
    await commands.runCommand(a, "key-dleave-001", "LeaveGameTable", { tableId: id }, T0);
    // The board length constraint follows the game.
    await expect(pg.query("UPDATE game_tables SET board = $1 WHERE id = $2", [".".repeat(42), id])).rejects.toThrow();
  }, 20000);

  it("records a friendly win on the ladder", async () => {
    const [a, b] = accs;
    const r = await commands.runCommand(a, "key-open-0001", "CreateGameTable", { mode: "friendly", game: "four_in_row" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    await commands.runCommand(b, "key-join-0001", "JoinGameTable", { tableId: id }, T0);
    let n = 0;
    for (const [acc, col] of [[a, 0], [b, 1], [a, 0], [b, 1], [a, 0], [b, 1], [a, 0]] as const) {
      const t = await commands.loadTableFor(acc, id, T0);
      await commands.runCommand(acc, `key-fmove-${n++}`, "GameMove", { tableId: id, column: col, version: t.version }, T0);
    }
    const s = (await commands.loadStateFor(a, T0)) as any;
    expect(s.ladder.boards[0].top[0]).toMatchObject({ name: "Tess", points: 3 });
    expect(s.games.recent[0]).toMatchObject({ outcome: "win", gameName: "Four in a Row" });
  }, 20000);
});
