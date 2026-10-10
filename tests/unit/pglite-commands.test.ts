import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

vi.mock("@/server/db", () => import("@/demo/db"));

/** The test build routes every command through the real command runner on PGlite. */
describe("command runner on PGlite", () => {
  let commands: typeof import("@/server/commands");
  let acc: string;
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    const db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    acc = (await db.query<{ id: string }>("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('x','x',now()) RETURNING id")).rows[0].id;
    commands = await import("@/server/commands");
  });

  it("creates a character and replays a repeated key", async () => {
    const payload = { name: "Tess", appearance: { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 }, traits: ["creative", "sociable"], ambition: "four_friends" };
    const first = await commands.runCommand(acc, "key-123456789", "CreateCharacter", payload);
    const again = await commands.runCommand(acc, "key-123456789", "CreateCharacter", payload);
    expect(first.replayed).toBe(false);
    expect(again.replayed).toBe(true);
    const s = (await commands.loadStateFor(acc)) as any;
    expect(s.character.name).toBe("Tess");
  }, 20000);
});
