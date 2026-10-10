import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { setDb, withTx } from "@/demo/db";

/** The test build runs the real game rules against PGlite; prove the adapter and SQL behave the same. */
describe("PGlite adapter used by the test build", () => {
  let game: typeof import("@/server/game");
  beforeAll(async () => {
    const db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    game = await import("@/server/game");
  });

  it("creates a character, cooks, travels and keeps the ledger balanced", async () => {
    const at = new Date("2026-10-10T09:00:00Z");
    const acc = await withTx(async (tx) => (await tx.query("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('a@b.c','x',now()) RETURNING id")).rows[0].id as string);
    const appearance = { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 };
    await withTx((tx) => game.createCharacter(tx, acc, { name: "Ada", appearance, traits: ["tidy", "foodie"], ambition: "founder" }, at, () => 0.3));
    expect((await withTx((tx) => game.createCharacter(tx, acc, { name: "B", appearance, traits: ["tidy", "foodie"], ambition: "founder" }, at))).created).toBe(false);
    await withTx((tx) => game.startActivity(tx, acc, { activityId: "cook_beans_on_toast" }, at));
    await withTx((tx) => game.startJourney(tx, acc, { destination: "food_hall", mode: "bus" }, new Date(at.getTime() + 4 * 60_000)).catch(() => null));
    const s = (await withTx((tx) => game.loadState(tx, acc, new Date(at.getTime() + 10 * 60_000)))) as any;
    expect(s.inventory.find((i: any) => i.id === "beans_on_toast").qty).toBe(1);
    expect(s.character.location).toBe("food_hall");
    const sum = await withTx((tx) => tx.query("SELECT sum(amount_pence) AS t FROM ledger_entries"));
    expect(Number(sum.rows[0].t)).toBe(s.wallet.cashPence);
  });
});
