import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { journeyQuote, taxiFare, walkMinutes } from "@/content/world";
import { cmd, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// 10:00 London time (BST) on a Saturday.
const T0 = new Date("2026-10-10T09:00:00Z");

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function travelTo(acc: string, destination: string, mode: string, at: Date) {
  await cmd(acc, "StartJourney", { destination, mode }, at);
  const s = await state(acc, at);
  return new Date(s.journey.arrivesAt);
}

describe("G · the wider city", () => {
  it("keeps the authored Camden times and uses map distance elsewhere", () => {
    expect(walkMinutes("home", "food_hall")).toBe(6);
    expect(walkMinutes("home", "borough_athletics")).toBeGreaterThan(60);
    const taxi = journeyQuote("home", "borough_athletics", "taxi");
    expect(taxi.farePence).toBe(taxiFare(walkMinutes("home", "borough_athletics")));
    expect(taxi.minutes).toBeLessThan(journeyQuote("home", "borough_athletics", "bus").minutes);
  });

  it("charges a taxi fare once and arrives across the city", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const before = (await state(acc, T0)).wallet.cashPence;
    const arrive = await travelTo(acc, "south_bank", "taxi", T0);
    const s = await state(acc, new Date(arrive.getTime() + 1000));
    expect(s.character.location).toBe("south_bank");
    expect(before - s.wallet.cashPence).toBe(journeyQuote("home", "south_bank", "taxi").farePence);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("blocks activities while a venue is closed and allows them once it opens", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const arrive = await travelTo(acc, "afterlight", "tube", T0);
    const at = new Date(arrive.getTime() + 1000);
    let s = await state(acc, at);
    const dance = () => s.actions.find((a: any) => a.id === "club_dance");
    expect(dance().available).toBe(false);
    expect(dance().reason).toMatch(/closed/i);
    await expect(cmd(acc, "StartActivity", { activityId: "club_dance" }, at)).rejects.toThrow(/closed/i);
    // 22:00 London time the same evening.
    const night = new Date("2026-10-10T21:00:00Z");
    s = await state(acc, night);
    expect(dance().available).toBe(true);
    await cmd(acc, "StartActivity", { activityId: "club_dance" }, night);
    s = await state(acc, minutes(night, 11));
    expect(s.skills.find((k: any) => k.id === "dance").xp).toBeGreaterThan(0);
  });

  it("an activity window is enforced (sunset only in the evening)", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const arrive = await travelTo(acc, "south_bank", "tube", T0);
    const s = await state(acc, new Date(arrive.getTime() + 1000));
    const sunset = s.actions.find((a: any) => a.id === "watch_sunset");
    expect(sunset.available).toBe(false);
    expect(sunset.reason).toMatch(/Only between 16:00 and 21:00/);
  });

  it("sells market-only ingredients at the market and not at the Food Hall", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    let arrive = await travelTo(acc, "food_hall", "walk", T0);
    await expect(cmd(acc, "BuyGroceries", { itemId: "potato", qty: 1 }, new Date(arrive.getTime() + 1000))).rejects.toThrow(/isn't sold here/);
    arrive = await travelTo(acc, "borough_market", "tube", new Date(arrive.getTime() + 2000));
    const at = new Date(arrive.getTime() + 1000);
    await cmd(acc, "BuyGroceries", { itemId: "potato", qty: 2 }, at);
    const s = await state(acc, at);
    expect(s.inventory.find((i: any) => i.id === "potato").qty).toBe(2);
    expect(s.groceries.map((g: any) => g.id)).toContain("cheese");
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
