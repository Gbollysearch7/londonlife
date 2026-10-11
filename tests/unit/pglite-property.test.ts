import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

vi.mock("@/server/db", () => import("@/demo/db"));

/** The browser test build runs on PGlite: the property SQL (partial unique indexes, net-worth subqueries) must work there too. */
describe("property commands on PGlite", () => {
  let commands: typeof import("@/server/commands");
  let db: PGlite;
  let acc: string;
  beforeAll(async () => {
    const { setDb } = await import("@/demo/db");
    db = new PGlite();
    for (const f of fs.readdirSync("db/migrations").sort()) await db.exec(fs.readFileSync(`db/migrations/${f}`, "utf8").replace(/CREATE EXTENSION[^;]*;/, ""));
    setDb(db);
    acc = (await db.query<{ id: string }>("INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ('p','x',now()) RETURNING id")).rows[0].id;
    commands = await import("@/server/commands");
  });

  it("buys a home and a plot, starts and cancels a stage, and ranks net worth consistently", async () => {
    const payload = { name: "Ola", appearance: { body: 0, skin: 1, hairStyle: 0, hairColour: 0, top: 0, bottom: 0, shoes: 0 }, traits: ["foodie", "tidy"], ambition: "home_owner" };
    await commands.runCommand(acc, "key-p-create-1", "CreateCharacter", payload);
    await db.query(
      `WITH c AS (UPDATE characters SET cash_pence = cash_pence + 50000000 WHERE account_id = $1 RETURNING id, cash_pence)
       INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after) SELECT id, 'test', 'test', 50000000, cash_pence FROM c`,
      [acc],
    );
    await commands.runCommand(acc, "key-p-buy-1", "BuyInvestment", { defId: "inv_camden_studio" });
    await commands.runCommand(acc, "key-p-plot-1", "BuyPlot", { defId: "plot_brixton_yard" });
    let s = (await commands.loadStateFor(acc)) as any;
    const plotId = s.invest.plots[0].id;
    await commands.runCommand(acc, "key-p-stage-1", "StartConstruction", { plotId });
    await expect(commands.runCommand(acc, "key-p-stage-2", "StartConstruction", { plotId })).rejects.toThrow(/still under way/);
    await commands.runCommand(acc, "key-p-cancel-1", "CancelConstruction", { plotId });
    s = (await commands.loadStateFor(acc)) as any;
    expect(s.invest.homes).toHaveLength(1);
    expect(s.invest.plots[0].running).toBeNull();
    const r = (await commands.socialQueryFor(acc, "rankings", {})) as any;
    expect(r.rankings.netWorth.you.value).toBe(s.bank.netWorthPence);
    expect(s.bank.propertyPence).toBeGreaterThan(0);
  }, 30000);
});
