import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { DELIVERY, DELIVERY_MENU } from "@/content/health";
import { cmd, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// 10:00 London, Saturday; the newcomer grace day is over by day 2.
const T0 = new Date("2026-10-10T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

const starve = (acc: string, at: Date) =>
  pool().query("UPDATE characters SET hunger = 0, needs_settled_at = $2 WHERE account_id = $1", [acc, at]);

describe("Q · fictional health", () => {
  it("neglect brings on a cold that blocks strenuous activity; the nurse clears it for free", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = days(2);
    await state(acc, t);
    await starve(acc, t);
    let s = await state(acc, minutes(t, 1));
    expect(s.health?.id).toBe("run_down");
    expect(s.mood.factors.some((f: any) => f.label === "Feeling run down")).toBe(true);
    await cmd(acc, "StartJourney", { destination: "borough_health", mode: "taxi" }, minutes(t, 2));
    let at = minutes(t, 20);
    s = await state(acc, at);
    expect(s.character.location).toBe("borough_health");
    await cmd(acc, "StartActivity", { activityId: "see_nurse" }, at);
    at = minutes(at, 11);
    s = await state(acc, at);
    expect(s.health).toBeNull();
    // Treatments aren't offered when you're well.
    expect(s.actions.find((a: any) => a.id === "see_nurse").reason).toMatch(/feeling fine/);
  });

  it("a cold passes on its own after a day", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await state(acc, days(2));
    await starve(acc, days(2));
    await state(acc, minutes(days(2), 1));
    await pool().query("UPDATE characters SET hunger = 60 WHERE account_id = $1", [acc]);
    const s = await state(acc, days(3.1));
    expect(s.health).toBeNull();
  });
});

describe("R · food delivery", () => {
  it("charges once, arrives home after the delivery time and fills the cupboard", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "OrderDelivery", { menuId: "pizza" }, T0);
    let s = await state(acc, minutes(T0, 5));
    expect(s.delivery.orders[0].status).toBe("pending");
    expect(s.inventory.find((i: any) => i.id === "takeaway_pizza")).toBeUndefined();
    s = await state(acc, minutes(T0, DELIVERY.minutes + 1));
    expect(s.inventory.find((i: any) => i.id === "takeaway_pizza").qty).toBe(1);
    expect(before - s.wallet.cashPence).toBe(DELIVERY_MENU.find((m) => m.id === "pizza")!.pricePence + DELIVERY.feePence);
    // Delivered once, even after reloads.
    s = await state(acc, minutes(T0, DELIVERY.minutes + 30));
    expect(s.inventory.find((i: any) => i.id === "takeaway_pizza").qty).toBe(1);
    await cmd(acc, "StartActivity", { activityId: "eat_takeaway_pizza" }, minutes(T0, 60));
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
