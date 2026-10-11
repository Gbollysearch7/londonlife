import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

vi.mock("@/server/db", () => import("@/demo/db"));

/** The test build runs games tables and the election on PGlite too (advisory locks, jsonb, uuid arrays). */
describe("games and civic commands on PGlite", () => {
  let commands: typeof import("@/server/commands");
  let acc: string;
  let pg: PGlite;
  const T0 = new Date("2026-10-10T13:00:00Z");
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    const db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    pg = db;
    acc = (await db.query<{ id: string }>("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('g','x',now()) RETURNING id")).rows[0].id;
    commands = await import("@/server/commands");
    const payload = { name: "Tess", appearance: { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 }, traits: ["creative", "sociable"], ambition: "four_friends" };
    await commands.runCommand(acc, "key-create-1", "CreateCharacter", payload, new Date(T0.getTime() - 2 * 86_400_000));
  }, 20000);

  it("plays a practice move against the NPC and stands and votes in the race", async () => {
    const r = await commands.runCommand(acc, "key-practice-1", "CreateGameTable", { mode: "practice" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    let t = await commands.loadTableFor(acc, id, T0);
    await commands.runCommand(acc, "key-move-0001", "GameMove", { tableId: id, column: 3, version: t.version }, T0);
    t = await commands.loadTableFor(acc, id, T0);
    expect(t.moveCount).toBe(2);
    expect(t.players[1].npc).toBe(true);
    // Ballots are cast in person at City Hall.
    await pg.query("UPDATE characters SET location = 'city_hall'");
    await commands.runCommand(acc, "key-stand-001", "StandForElection", { policyId: "half_price_buses" }, T0);
    const s = (await commands.loadStateFor(acc, T0)) as any;
    await commands.runCommand(acc, "key-vote-0001", "CastVote", { candidateId: s.civic.candidates[0].id }, T0);
    const after = (await commands.loadStateFor(acc, new Date("2026-10-11T19:01:00Z"))) as any;
    expect(after.civic.current.policy.id).toBe("half_price_buses");
  }, 20000);
});
