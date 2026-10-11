import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { COMPANY, companyDay, marketFee, marketRoll, sectorDef } from "@/content/market";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London (BST). Rent is covered for the first two weeks.
const T0 = new Date("2026-10-10T09:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);

const setCash = (acc: string, p: number) =>
  pool().query(
    `WITH c AS (UPDATE characters SET cash_pence = $2 WHERE account_id = $1 RETURNING id, cash_pence)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after)
     SELECT id, 'test', 'test adjustment', $2 - (SELECT COALESCE(SUM(amount_pence),0) FROM ledger_entries WHERE character_id = c.id), cash_pence FROM c`,
    [acc, p],
  );
const cash = async (acc: string) => Number((await pool().query("SELECT cash_pence FROM characters WHERE account_id = $1", [acc])).rows[0].cash_pence);
const setEnterprise = (acc: string, xp: number) =>
  pool().query("UPDATE skills SET xp = $2 WHERE skill_id = 'enterprise' AND character_id = (SELECT id FROM characters WHERE account_id = $1)", [acc, xp]);
const held = async () => Number((await pool().query("SELECT COALESCE(SUM(amount_pence),0) AS s FROM escrow_holds WHERE status = 'held'")).rows[0].s);

async function player(draw = 0.3, pence = 500_000) {
  const acc = await makeAccount();
  await makeCharacter(acc, T0, draw);
  await setCash(acc, pence);
  return acc;
}

/** A stored furniture instance owned by `acc` (bought fresh, so it starts in storage). */
async function storedItem(acc: string, defId = "lamp") {
  const r = await cmd(acc, "BuyFurniture", { defId }, T0);
  return (r.receipt as { instanceId: string }).instanceId;
}

async function listing(acc: string, instanceId: string, pricePence: number) {
  const r = await cmd(acc, "ListItem", { instanceId, pricePence }, T0);
  return (r.receipt as { listingId: string }).listingId;
}

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("S · player marketplace", () => {
  it("sells an item in one transaction: buyer pays, seller gets the price less 5%, the item moves to the buyer's storage", async () => {
    const seller = await player();
    const buyer = await player();
    const item = await storedItem(seller);
    const listingId = await listing(seller, item, 10_000);
    const s0 = await cash(seller);
    const b0 = await cash(buyer);
    const view = await state(buyer, T0);
    expect(view.market.forSale.map((l: any) => l.id)).toEqual([listingId]);
    expect(view.market.forSale[0].seller).toBe("Ada");
    expect((await state(seller, T0)).market.forSale).toHaveLength(0);

    await cmd(buyer, "BuyListing", { listingId }, T0);
    expect(await cash(buyer)).toBe(b0 - 10_000);
    expect(await cash(seller)).toBe(s0 - marketFee(10_000) + 10_000);
    expect(marketFee(10_000)).toBe(500);
    const row = (await pool().query("SELECT f.*, c.account_id FROM furniture f JOIN characters c ON c.id = f.character_id WHERE f.id = $1", [item])).rows[0];
    expect(row.account_id).toBe(buyer);
    expect(row.home_id).toBeNull();
    const bs = await state(buyer, T0);
    expect(bs.furniture.some((f: any) => f.id === item && !f.placed)).toBe(true);
    expect(bs.market.history[0]).toMatchObject({ side: "bought", netPence: -10_000 });
    expect((await state(seller, T0)).market.history[0]).toMatchObject({ side: "sold", netPence: 9_500 });
    expect(await ledgerMatches(seller)).toBe(true);
    expect(await ledgerMatches(buyer)).toBe(true);
    await expect(cmd(buyer, "BuyListing", { listingId }, T0)).rejects.toThrow(/own listing|already sold/);
  });

  it("locks a listed item: it can't be placed, sold to the game or listed twice; only stored items can be listed", async () => {
    const seller = await player();
    const item = await storedItem(seller);
    const listingId = await listing(seller, item, 5_000);
    await expect(cmd(seller, "PlaceFurniture", { instanceId: item, x: 0, y: 0, rot: 0 }, T0)).rejects.toThrow(/listed on the Market/);
    await expect(cmd(seller, "SellFurniture", { instanceId: item }, T0)).rejects.toThrow(/listed on the Market/);
    await expect(cmd(seller, "ListItem", { instanceId: item, pricePence: 6_000 }, T0)).rejects.toThrow(/already listed/);
    const placed = (await state(seller, T0)).furniture.find((f: any) => f.placed);
    await expect(cmd(seller, "ListItem", { instanceId: placed.id, pricePence: 1_000 }, T0)).rejects.toThrow(/storage/);
    await expect(cmd(seller, "ListItem", { instanceId: item, pricePence: 50 }, T0)).rejects.toThrow(/price between/);
    // Cancelling unlocks it.
    const other = await player();
    await expect(cmd(other, "CancelListing", { listingId }, T0)).rejects.toThrow(/isn't active/);
    await cmd(seller, "CancelListing", { listingId }, T0);
    await expect(cmd(other, "BuyListing", { listingId }, T0)).rejects.toThrow(/already sold or been withdrawn/);
    await cmd(seller, "SellFurniture", { instanceId: item }, T0);
  });

  it("rejects buying your own listing and a listing you can't afford, leaving everything unchanged", async () => {
    const seller = await player();
    const poor = await player(0.3, 1_000);
    const item = await storedItem(seller);
    const listingId = await listing(seller, item, 20_000);
    await expect(cmd(seller, "BuyListing", { listingId }, T0)).rejects.toThrow(/can't buy your own/);
    await expect(cmd(poor, "BuyListing", { listingId }, T0)).rejects.toThrow(/You need £200.00/);
    expect(await cash(poor)).toBe(1_000);
    expect((await pool().query("SELECT status FROM market_listings WHERE id = $1", [listingId])).rows[0].status).toBe("active");
    expect((await state(seller, T0)).furniture.some((f: any) => f.id === item)).toBe(true);
  });

  it("sells once when two players race to buy the same item", async () => {
    const seller = await player();
    const a = await player();
    const b = await player();
    const item = await storedItem(seller);
    const listingId = await listing(seller, item, 30_000);
    const before = (await cash(seller)) + (await cash(a)) + (await cash(b));
    const results = await Promise.allSettled([cmd(a, "BuyListing", { listingId }, T0), cmd(b, "BuyListing", { listingId }, T0)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = (await cash(seller)) + (await cash(a)) + (await cash(b));
    // Only the fee leaves the economy; the item has exactly one owner.
    expect(before - after).toBe(marketFee(30_000));
    expect((await pool().query("SELECT count(*) AS n FROM furniture WHERE id = $1", [item])).rows[0].n).toBe("1");
    for (const acc of [seller, a, b]) expect(await ledgerMatches(acc)).toBe(true);
  });

  it("replays a repeated buy request without charging twice", async () => {
    const seller = await player();
    const buyer = await player();
    const listingId = await listing(seller, await storedItem(seller), 4_000);
    const b0 = await cash(buyer);
    const k = key();
    await cmd(buyer, "BuyListing", { listingId }, T0, k);
    const again = await cmd(buyer, "BuyListing", { listingId }, T0, k);
    expect(again.replayed).toBe(true);
    expect(await cash(buyer)).toBe(b0 - 4_000);
  });

  it("keeps the original price for game resale, so a high player price can't mint money", async () => {
    const seller = await player();
    const buyer = await player();
    const item = await storedItem(seller, "lamp");
    const original = Number((await pool().query("SELECT price_pence FROM furniture WHERE id = $1", [item])).rows[0].price_pence);
    const listingId = await listing(seller, item, 900_000);
    await setCash(buyer, 1_000_000);
    await cmd(buyer, "BuyListing", { listingId }, T0);
    expect(Number((await pool().query("SELECT price_pence FROM furniture WHERE id = $1", [item])).rows[0].price_pence)).toBe(original);
  });
});

describe("T · player companies", () => {
  it("needs Enterprise 3 and £500, and allows one company per character", async () => {
    const acc = await player(0.1);
    await expect(cmd(acc, "FoundCompany", { name: "Nightjar Coffee", sector: "cafe" }, T0)).rejects.toThrow(/Enterprise level 3/);
    await setEnterprise(acc, 450);
    await setCash(acc, 40_000);
    await expect(cmd(acc, "FoundCompany", { name: "Nightjar Coffee", sector: "cafe" }, T0)).rejects.toThrow(/You need £500.00/);
    await setCash(acc, 60_000);
    await expect(cmd(acc, "FoundCompany", { name: "!!", sector: "cafe" }, T0)).rejects.toThrow(/company name/);
    await expect(cmd(acc, "FoundCompany", { name: "Nightjar", sector: "casino" }, T0)).rejects.toThrow(/sector/);
    await cmd(acc, "FoundCompany", { name: "Nightjar Coffee", sector: "cafe" }, T0);
    expect(await cash(acc)).toBe(10_000);
    await expect(cmd(acc, "FoundCompany", { name: "Second Go", sector: "app" }, T0)).rejects.toThrow(/One per person/);
    const s = await state(acc, T0);
    expect(s.company.mine).toMatchObject({ name: "Nightjar Coffee", level: 1, sessionsToday: 0 });
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("offers company work only to founders, then settles the day at 18:00 exactly once", async () => {
    const acc = await player(0.1); // student with a desk at home
    let s = await state(acc, T0);
    const blocked = s.actions.find((a: any) => a.id === "company_work_home");
    expect(blocked.reason).toMatch(/Found a company/);
    await expect(cmd(acc, "StartActivity", { activityId: "company_work_home" }, T0)).rejects.toThrow(/Found a company/);
    await setEnterprise(acc, 450);
    await cmd(acc, "FoundCompany", { name: "Pixel Yard", sector: "studio" }, T0);
    let t = T0;
    for (let i = 0; i < 3; i++) {
      await cmd(acc, "StartActivity", { activityId: "company_work_home" }, t);
      t = minutes(t, 11);
      await state(acc, t);
    }
    s = await state(acc, t);
    expect(s.company.mine.sessionsToday).toBe(3);
    await expect(cmd(acc, "StartActivity", { activityId: "company_work_home" }, t)).rejects.toThrow(/Limit of 3/);
    const enterprise = s.company.enterprise;
    const before = await cash(acc);
    // 19:00 London: two loads racing, then a reload. One settlement, one payout.
    await Promise.all([state(acc, hours(9)), state(acc, hours(9))]);
    s = await state(acc, hours(9.5));
    const rows = (await pool().query("SELECT * FROM company_settlements")).rows;
    expect(rows).toHaveLength(1);
    const co = (await pool().query("SELECT * FROM companies")).rows[0];
    const day = companyDay({ sector: sectorDef("studio")!, level: 1, enterprise, sessions: 3, roll: marketRoll(sectorDef("studio")!, `${co.id}:2026-10-10`) });
    expect(Number(rows[0].profit_pence)).toBe(day.profit);
    expect(Number(rows[0].sessions)).toBe(3);
    const paid = Number(rows[0].paid_pence);
    expect(paid).toBe(Math.max(0, day.profit));
    expect((await cash(acc)) - before).toBe(paid);
    expect(s.company.mine.reports).toHaveLength(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("carries losses forward instead of charging the founder, and taxes business profit in its own weekly band", async () => {
    const acc = await player(0.1);
    await setEnterprise(acc, 450);
    await cmd(acc, "FoundCompany", { name: "Big Night Events", sector: "events" }, T0);
    await pool().query("UPDATE companies SET loss_carried_pence = 1000000");
    const before = await cash(acc);
    await state(acc, hours(9));
    const r = (await pool().query("SELECT * FROM company_settlements")).rows[0];
    expect(Number(r.paid_pence)).toBe(0);
    const loss = Number((await pool().query("SELECT loss_carried_pence FROM companies")).rows[0].loss_carried_pence);
    expect(loss).toBe(1_000_000 - Number(r.profit_pence));
    expect(await cash(acc)).toBe(before);
    // Business tax is separate from wage tax: a large profit pays the marginal business band.
    await pool().query("UPDATE companies SET loss_carried_pence = 0, level = 5, progress = 800");
    await setEnterprise(acc, 4200);
    await state(acc, hours(33));
    const r2 = (await pool().query("SELECT * FROM company_settlements WHERE period_key = '2026-10-11'")).rows[0];
    if (Number(r2.profit_pence) > COMPANY.foundingPence) expect(Number(r2.tax_pence)).toBeGreaterThan(0);
    expect(Number(r2.paid_pence)).toBe(Number(r2.taxable_pence) - Number(r2.tax_pence));
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("catches up at most seven missed days and levels up from work, lifting the founder ambition", async () => {
    const acc = await player(0.1);
    await setEnterprise(acc, 450);
    const g0 = (await state(acc, T0)).goals.ambition.progress;
    await cmd(acc, "FoundCompany", { name: "Tiny Apps", sector: "app" }, T0);
    await pool().query("UPDATE companies SET progress = 75");
    await cmd(acc, "StartActivity", { activityId: "company_work_home" }, T0);
    const s = await state(acc, minutes(T0, 11));
    expect(s.company.mine.level).toBe(2);
    expect(s.goals.ambition.progress).toBeGreaterThan(g0 * 0.6);
    expect(s.goals.ambition.note).toMatch(/Tiny Apps at level 2/);
    await state(acc, hours(24 * 20));
    expect((await pool().query("SELECT count(*) AS n FROM company_settlements")).rows[0].n).toBe("7");
    expect(await ledgerMatches(acc)).toBe(true);
  });
});

describe("U · player jobs board and escrow", () => {
  const total = async (...accs: string[]) => (await Promise.all(accs.map(cash))).reduce((a, b) => a + b, 0) + (await held());

  it("runs post → apply → hire → submit → approve with consent at each step, and escrow never creates money", async () => {
    const poster = await player();
    const worker = await player();
    const sum = await total(poster, worker);
    const r = await cmd(poster, "PostJob", { templateId: "move_furniture", payPence: 2_500, hours: 24 }, T0);
    const jobId = (r.receipt as { jobId: string }).jobId;
    expect(await held()).toBe(2_500);
    expect(await total(poster, worker)).toBe(sum);
    expect((await state(worker, T0)).playerJobs.board.map((j: any) => j.id)).toEqual([jobId]);
    expect((await state(poster, T0)).playerJobs.board).toHaveLength(0);

    await expect(cmd(poster, "ApplyJob", { jobId }, T0)).rejects.toThrow(/own job/);
    await cmd(worker, "ApplyJob", { jobId }, T0);
    await expect(cmd(worker, "SubmitJob", { jobId }, T0)).rejects.toThrow(/accept you first/);
    await expect(cmd(worker, "HireApplicant", { jobId }, T0)).rejects.toThrow(/Only the person who posted/);
    await cmd(poster, "HireApplicant", { jobId }, T0);
    await expect(cmd(poster, "CancelJob", { jobId }, T0)).rejects.toThrow(/can't be cancelled now/);
    await expect(cmd(poster, "CompleteJob", { jobId }, T0)).rejects.toThrow(/hasn't marked/);
    await cmd(worker, "SubmitJob", { jobId }, minutes(T0, 30));
    await expect(cmd(worker, "CompleteJob", { jobId }, minutes(T0, 31))).rejects.toThrow(/Only the person who posted/);
    const w0 = await cash(worker);
    await cmd(poster, "CompleteJob", { jobId }, minutes(T0, 40));
    expect(await cash(worker)).toBe(w0 + 2_500);
    expect(await held()).toBe(0);
    await expect(cmd(poster, "CompleteJob", { jobId }, minutes(T0, 41))).rejects.toThrow(/hasn't marked|already/);
    expect(await total(poster, worker)).toBe(sum);
    expect(await ledgerMatches(poster)).toBe(true);
    expect(await ledgerMatches(worker)).toBe(true);
  });

  it("releases once when approval is sent twice at the same time", async () => {
    const poster = await player();
    const worker = await player();
    const sum = await total(poster, worker);
    const jobId = ((await cmd(poster, "PostJob", { templateId: "tutoring", payPence: 4_000, hours: 12 }, T0)).receipt as { jobId: string }).jobId;
    await cmd(worker, "ApplyJob", { jobId }, T0);
    await cmd(poster, "HireApplicant", { jobId }, T0);
    await cmd(worker, "SubmitJob", { jobId }, T0);
    const res = await Promise.allSettled([cmd(poster, "CompleteJob", { jobId }, T0), cmd(poster, "CompleteJob", { jobId }, T0)]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await total(poster, worker)).toBe(sum);
    expect((await pool().query("SELECT count(*) AS n FROM ledger_entries WHERE category = 'player_work'")).rows[0].n).toBe("1");
  });

  it("lets only one of two racing workers take a job; withdrawing reopens it", async () => {
    const poster = await player();
    const a = await player();
    const b = await player();
    const jobId = ((await cmd(poster, "PostJob", { templateId: "errand", payPence: 1_000, hours: 12 }, T0)).receipt as { jobId: string }).jobId;
    const res = await Promise.allSettled([cmd(a, "ApplyJob", { jobId }, T0), cmd(b, "ApplyJob", { jobId }, T0)]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const winner = res[0].status === "fulfilled" ? a : b;
    const loser = winner === a ? b : a;
    await cmd(winner, "WithdrawJob", { jobId }, T0);
    await cmd(loser, "ApplyJob", { jobId }, T0);
    await cmd(poster, "DeclineApplicant", { jobId }, T0);
    expect((await state(winner, T0)).playerJobs.board).toHaveLength(1);
  });

  it("refunds escrow on cancel and at the deadline, and rejects posts you can't afford", async () => {
    const poster = await player(0.3, 3_000);
    const worker = await player();
    await expect(cmd(poster, "PostJob", { templateId: "errand", payPence: 5_000, hours: 12 }, T0)).rejects.toThrow(/You need £50.00/);
    await expect(cmd(poster, "PostJob", { templateId: "something_else", payPence: 500, hours: 12 }, T0)).rejects.toThrow(/Choose what/);
    await expect(cmd(poster, "PostJob", { templateId: "errand", payPence: 500, hours: 5 }, T0)).rejects.toThrow(/how long/);
    const first = ((await cmd(poster, "PostJob", { templateId: "errand", payPence: 1_000, hours: 12 }, T0)).receipt as { jobId: string }).jobId;
    expect(await cash(poster)).toBe(2_000);
    await cmd(poster, "CancelJob", { jobId: first }, T0);
    expect(await cash(poster)).toBe(3_000);
    await expect(cmd(poster, "CancelJob", { jobId: first }, T0)).rejects.toThrow(/already closed/);

    const second = ((await cmd(poster, "PostJob", { templateId: "photo_shoot", payPence: 2_000, hours: 12 }, T0)).receipt as { jobId: string }).jobId;
    await cmd(worker, "ApplyJob", { jobId: second }, T0);
    await cmd(poster, "HireApplicant", { jobId: second }, T0);
    await expect(cmd(worker, "SubmitJob", { jobId: second }, hours(13))).rejects.toThrow(/deadline has passed/);
    const s = await state(poster, hours(13));
    expect(s.notices.some((n: string) => /came back from escrow/.test(n))).toBe(true);
    expect(await cash(poster)).toBe(3_000);
    await state(poster, hours(14));
    expect(await cash(poster)).toBe(3_000);
    expect(await held()).toBe(0);
    expect(await ledgerMatches(poster)).toBe(true);
  });

  it("approves a submitted job automatically after the response window, paying the worker once", async () => {
    const poster = await player();
    const worker = await player();
    const sum = await total(poster, worker);
    const jobId = ((await cmd(poster, "PostJob", { templateId: "pitch_practice", payPence: 1_500, hours: 12 }, T0)).receipt as { jobId: string }).jobId;
    await cmd(worker, "ApplyJob", { jobId }, T0);
    await cmd(poster, "HireApplicant", { jobId }, T0);
    await cmd(worker, "SubmitJob", { jobId }, hours(1));
    // The poster loading after the deadline must not refund a job that was handed in.
    await state(poster, hours(20));
    expect(await held()).toBe(1_500);
    const w0 = await cash(worker);
    await state(worker, hours(26));
    await state(worker, hours(27));
    expect(await cash(worker)).toBe(w0 + 1_500);
    await expect(cmd(poster, "CompleteJob", { jobId }, hours(28))).rejects.toThrow(/hasn't marked|already/);
    expect(await total(poster, worker)).toBe(sum);
    expect(await ledgerMatches(worker)).toBe(true);
  });
});
