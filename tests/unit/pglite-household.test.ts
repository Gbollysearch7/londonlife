import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

vi.mock("@/server/db", () => import("@/demo/db"));

/** The browser test build runs on PGlite: the household SQL (partial unique index, conditional upsert) must work there too. */
describe("household commands on PGlite", () => {
  let commands: typeof import("@/server/commands");
  let db: PGlite;
  let acc: string;
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    acc = (await db.query<{ id: string }>("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('h','x',now()) RETURNING id")).rows[0].id;
    commands = await import("@/server/commands");
  });

  it("hires a chef, caps meals at three a day, and refuses a second chef", async () => {
    const payload = { name: "Ola", appearance: { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 }, traits: ["foodie", "tidy"], ambition: "home_owner" };
    await commands.runCommand(acc, "key-h-create-1", "CreateCharacter", payload);
    // Whatever origin was drawn, give the character a one-bed and money so the chef is allowed.
    await db.query("UPDATE homes SET tier_id = 'one_bed' WHERE character_id = (SELECT id FROM characters WHERE account_id = $1)", [acc]);
    await db.query(
      `WITH c AS (UPDATE characters SET cash_pence = cash_pence + 100000, location = 'home' WHERE account_id = $1 RETURNING id, cash_pence)
       INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after) SELECT id, 'test', 'test', 100000, cash_pence FROM c`,
      [acc],
    );
    await db.query("UPDATE journeys SET status = 'cancelled' WHERE character_id = (SELECT id FROM characters WHERE account_id = $1)", [acc]);
    await commands.runCommand(acc, "key-h-hire-1", "HireStaff", { role: "chef" });
    await expect(commands.runCommand(acc, "key-h-hire-2", "HireStaff", { role: "chef" })).rejects.toThrow(/already have a chef/);
    for (let i = 0; i < 3; i++) await commands.runCommand(acc, `key-h-meal-${i}`, "CollectChefMeal", {});
    await expect(commands.runCommand(acc, "key-h-meal-4", "CollectChefMeal", {})).rejects.toThrow(/3 meals today/);
    const s = (await commands.loadStateFor(acc)) as any;
    expect(s.household.chef.mealsToday).toBe(3);
    expect(s.household.staff.find((x: any) => x.id === "chef").hired).toBe(true);
    await commands.runCommand(acc, "key-h-fire-1", "FireStaff", { role: "chef" });
    await commands.runCommand(acc, "key-h-hire-3", "HireStaff", { role: "chef" });
  }, 30000);
});
