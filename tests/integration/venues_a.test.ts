import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { firstFreeSpot } from "@/sim/placement";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// 10:00 London time (BST), Saturday.
const T0 = new Date("2026-10-10T09:00:00Z");
/** London hour h on the same Saturday (BST = UTC+1). */
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 10, h - 1, m));

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function taxi(acc: string, destination: string, when: Date) {
  await cmd(acc, "StartJourney", { destination, mode: "taxi" }, when);
  const s = await state(acc, when);
  return new Date(new Date(s.journey.arrivesAt).getTime() + 1000);
}

async function setCash(acc: string, pence: number) {
  // Tests top up through the ledger so ledger == cash still holds.
  const c = (await pool().query("SELECT id, cash_pence FROM characters WHERE account_id = $1", [acc])).rows[0];
  const delta = pence - Number(c.cash_pence);
  await pool().query("UPDATE characters SET cash_pence = $2 WHERE id = $1", [c.id, pence]);
  await pool().query(
    "INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after) VALUES ($1, 'test', 'test top-up', $2, $3)",
    [c.id, delta, pence],
  );
}

const action = (s: any, id: string) => s.actions.find((a: any) => a.id === id);

describe("V · venues part A", () => {
  it("lists all ten new venues in the directory with opening hours", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const s = await state(acc, T0);
    const ids = ["chalk_cushion", "riverside_arts", "hidden_chapter", "crossway_arcade", "skyline_kitchen", "community_chapel", "neighbourhood_mosque", "still_room", "city_fm", "kings_cross_gateway"];
    for (const id of ids) {
      const v = s.directory.find((d: any) => d.id === id);
      expect(v, id).toBeDefined();
      expect(v.hours, id).not.toBeNull();
      expect(v.npcs.every((n: any) => /NPC/.test(n.role)), id).toBe(true);
    }
    // The Hidden Chapter is a night venue: closed at 10:00.
    expect(s.directory.find((d: any) => d.id === "hidden_chapter").open).toBe(false);
  });

  it("The Hidden Chapter opens only at night, and its dance trains Dance", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = await taxi(acc, "hidden_chapter", T0);
    let s = await state(acc, t);
    expect(action(s, "chapter_dance").available).toBe(false);
    expect(action(s, "chapter_dance").reason).toMatch(/closed/i);
    await expect(cmd(acc, "StartActivity", { activityId: "chapter_dance" }, t)).rejects.toThrow(/closed/i);
    const night = at(22);
    s = await state(acc, night);
    expect(action(s, "chapter_dance").available).toBe(true);
    await cmd(acc, "StartActivity", { activityId: "chapter_dance" }, night);
    s = await state(acc, minutes(night, 9));
    expect(s.skills.find((k: any) => k.id === "dance").xp).toBeGreaterThan(0);
    // Still open after midnight (closes 02:00).
    s = await state(acc, new Date("2026-10-10T23:30:00Z"));
    expect(action(s, "chapter_read").available).toBe(true);
  });

  it("cinema screenings run only in their session window and once a day each", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await setCash(acc, 10000);
    const t = await taxi(acc, "crossway_arcade", T0);
    let s = await state(acc, t);
    expect(action(s, "arcade_matinee").available).toBe(false);
    expect(action(s, "arcade_matinee").reason).toMatch(/Only between 13:00 and 16:00/);
    await expect(cmd(acc, "StartActivity", { activityId: "arcade_matinee" }, t)).rejects.toThrow(/Only between/);
    const matinee = at(14);
    const before = (await state(acc, matinee)).wallet.cashPence;
    await cmd(acc, "StartActivity", { activityId: "arcade_matinee" }, matinee);
    s = await state(acc, minutes(matinee, 21));
    expect(before - s.wallet.cashPence).toBe(700);
    expect(action(s, "arcade_matinee").available).toBe(false);
    expect(action(s, "arcade_matinee").reason).toMatch(/Limit of 1/);
    await expect(cmd(acc, "StartActivity", { activityId: "arcade_matinee" }, minutes(matinee, 22))).rejects.toThrow(/Limit/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("Crossway Arcade's grocery counter sells its own stock only", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = await taxi(acc, "crossway_arcade", T0);
    const s = await state(acc, t);
    const stock = s.groceries.map((g: any) => g.id);
    expect(stock).toContain("peppers");
    expect(stock).not.toContain("plantain");
    await cmd(acc, "BuyGroceries", { itemId: "peppers", qty: 2 }, t);
    await expect(cmd(acc, "BuyGroceries", { itemId: "plantain", qty: 1 }, t)).rejects.toThrow(/isn't sold here/);
    const after = await state(acc, t);
    expect(after.inventory.find((i: any) => i.id === "peppers").qty).toBeGreaterThanOrEqual(2);
    expect(await ledgerMatches(acc)).toBe(true);
    // Closed after 22:00.
    await expect(cmd(acc, "BuyGroceries", { itemId: "bread", qty: 1 }, at(23))).rejects.toThrow(/closed/);
  });

  it("the retail side job pays and stops at its daily limit", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    let t = await taxi(acc, "crossway_arcade", T0);
    const before = (await state(acc, t)).wallet.cashPence;
    for (let i = 0; i < 3; i++) {
      await cmd(acc, "StartActivity", { activityId: "arcade_retail" }, t);
      t = minutes(t, 6);
      await state(acc, t);
    }
    const s = await state(acc, t);
    expect(s.wallet.cashPence - before).toBe(4500);
    await expect(cmd(acc, "StartActivity", { activityId: "arcade_retail" }, t)).rejects.toThrow(/Limit of 3/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("dinner for two and intercity trains are shown as coming later and can't be started", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await setCash(acc, 50000);
    let t = await taxi(acc, "skyline_kitchen", at(18));
    let s = await state(acc, t);
    expect(action(s, "skyline_dinner_for_two").available).toBe(false);
    expect(action(s, "skyline_dinner_for_two").reason).toMatch(/shared play/);
    const cash = s.wallet.cashPence;
    await expect(cmd(acc, "StartActivity", { activityId: "skyline_dinner_for_two" }, t)).rejects.toThrow(/shared play/);
    // The real tasting menu works, once a day.
    await cmd(acc, "StartActivity", { activityId: "skyline_tasting" }, t);
    s = await state(acc, minutes(t, 26));
    expect(cash - s.wallet.cashPence).toBe(4500);
    expect(s.moodlets.some((m: any) => /meal/i.test(m.label))).toBe(true);
    await expect(cmd(acc, "StartActivity", { activityId: "skyline_tasting" }, minutes(t, 27))).rejects.toThrow(/Limit/);
    t = await taxi(acc, "kings_cross_gateway", minutes(t, 27));
    await expect(cmd(acc, "StartActivity", { activityId: "kx_intercity" }, t)).rejects.toThrow(/other cities/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("donations take game money once a day, are voluntary and give no XP", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = await taxi(acc, "community_chapel", T0);
    const before = await state(acc, t);
    await cmd(acc, "StartActivity", { activityId: "chapel_donate" }, t);
    const s = await state(acc, minutes(t, 2));
    expect(before.wallet.cashPence - s.wallet.cashPence).toBe(500);
    expect(s.skills.reduce((n: number, k: any) => n + k.xp, 0)).toBe(before.skills.reduce((n: number, k: any) => n + k.xp, 0));
    await expect(cmd(acc, "StartActivity", { activityId: "chapel_donate" }, minutes(t, 3))).rejects.toThrow(/Limit of 1/);
    // The choir is an evening session.
    const s2 = await state(acc, minutes(t, 4));
    expect(action(s2, "chapel_choir").reason).toMatch(/Only between 16:00 and 20:00/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("a donation is refused when you can't afford it", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = await taxi(acc, "neighbourhood_mosque", T0);
    await setCash(acc, 300);
    const s = await state(acc, t);
    expect(action(s, "mosque_donate").available).toBe(false);
    await expect(cmd(acc, "StartActivity", { activityId: "mosque_donate" }, t)).rejects.toThrow(/Costs £5.00/);
    expect((await state(acc, t)).wallet.cashPence).toBe(300);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("activities at a venue can only be done there", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await expect(cmd(acc, "StartActivity", { activityId: "still_tea" }, T0)).rejects.toThrow(/Only at Still Room Wellness/);
  });
});

describe("W · gallery art becomes furniture", () => {
  it("buys an original piece once, delivers it to storage and lets you hang it at home", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = await taxi(acc, "riverside_arts", T0);
    await setCash(acc, 20000);
    let s = await state(acc, t);
    expect(s.gallery.here).toBe(true);
    const piece = s.gallery.pieces.find((p: any) => p.id === "art_estate_bloom");
    expect(piece.reason).toBeNull();
    const k = key();
    await cmd(acc, "BuyArtwork", { artId: "art_estate_bloom" }, t, k);
    // Replaying the same request key doesn't charge twice.
    const replay = await cmd(acc, "BuyArtwork", { artId: "art_estate_bloom" }, t, k);
    expect(replay.replayed).toBe(true);
    s = await state(acc, t);
    expect(s.wallet.cashPence).toBe(20000 - 3500);
    const owned = s.furniture.filter((f: any) => f.defId === "art_estate_bloom");
    expect(owned).toHaveLength(1);
    expect(owned[0].placed).toBe(false);
    expect(s.gallery.pieces.find((p: any) => p.id === "art_estate_bloom").bought).toBe(true);
    // Originals are one of a kind.
    await expect(cmd(acc, "BuyArtwork", { artId: "art_estate_bloom" }, t)).rejects.toThrow(/one-off original/);
    // Hang it at home.
    const home = await taxi(acc, "home", t);
    const hs = await state(acc, home);
    const placed = hs.furniture.filter((f: any) => f.placed).map((f: any) => ({ id: f.id, defId: f.defId, x: f.x, y: f.y, rot: f.rot }));
    const spot = firstFreeSpot("art_estate_bloom", placed, hs.home.tier.gridW, hs.home.tier.gridD)!;
    expect(spot).toBeTruthy();
    await cmd(acc, "PlaceFurniture", { instanceId: owned[0].id, ...spot }, home);
    s = await state(acc, home);
    expect(s.furniture.find((f: any) => f.id === owned[0].id).placed).toBe(true);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("refuses art away from the gallery, when closed, when unaffordable, and via the home catalogue", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await expect(cmd(acc, "BuyArtwork", { artId: "art_river_dusk" }, T0)).rejects.toThrow(/gallery desk/);
    await expect(cmd(acc, "BuyFurniture", { defId: "art_river_dusk" }, T0)).rejects.toThrow(/sold only at Riverside Arts House/);
    const home = await state(acc, T0);
    expect(home.catalogue.some((f: any) => f.id.startsWith("art_"))).toBe(false);
    const t = await taxi(acc, "riverside_arts", T0);
    await setCash(acc, 1000);
    await expect(cmd(acc, "BuyArtwork", { artId: "art_river_dusk" }, t)).rejects.toThrow(/You need £60.00/);
    await expect(cmd(acc, "BuyArtwork", { artId: "single_bed" }, t)).rejects.toThrow(/isn't for sale here/);
    // A failed purchase leaves no "owned" mark behind.
    await setCash(acc, 20000);
    const late = at(23, 30);
    await expect(cmd(acc, "BuyArtwork", { artId: "art_river_dusk" }, late)).rejects.toThrow(/closed/);
    const s = await state(acc, at(11));
    expect(s.gallery.pieces.find((p: any) => p.id === "art_river_dusk").bought).toBe(false);
    await cmd(acc, "BuyArtwork", { artId: "art_river_dusk" }, at(11));
    expect((await state(acc, at(11))).wallet.cashPence).toBe(20000 - 6000);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("two racing purchases of the same piece charge once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const t = await taxi(acc, "riverside_arts", T0);
    await setCash(acc, 20000);
    const results = await Promise.allSettled([
      cmd(acc, "BuyArtwork", { artId: "art_clay_heron" }, t),
      cmd(acc, "BuyArtwork", { artId: "art_clay_heron" }, t),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const s = await state(acc, t);
    expect(s.wallet.cashPence).toBe(20000 - 8500);
    expect(s.furniture.filter((f: any) => f.defId === "art_clay_heron")).toHaveLength(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
