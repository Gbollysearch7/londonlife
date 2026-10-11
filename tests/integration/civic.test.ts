import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { venue } from "@/content/world";
import { cmd, ledgerMatches, makeAccount, makeCharacter, resetDb, state } from "./helpers";

// Characters arrive on Thursday; the race below closes Sunday 11 October 2026 at 20:00 London (19:00 UTC, summer time).
const BORN = new Date("2026-10-08T12:00:00Z");
const T0 = new Date("2026-10-10T13:00:00Z");
const CLOSE = new Date("2026-10-11T19:00:00Z");
const NEXT_CLOSE = new Date("2026-10-18T19:00:00Z");
const mins = (base: Date, m: number) => new Date(base.getTime() + m * 60_000);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function people(n: number, born = BORN) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = await makeAccount();
    await makeCharacter(a, born);
    out.push(a);
  }
  return out;
}

/** Puts a character somewhere, rested and fed, at a moment in time (keeps long time jumps from tiring them out). */
const ready = (acc: string, place: string, at: Date) =>
  pool().query(
    "UPDATE characters SET location = $2, hunger = 90, energy = 90, fun = 90, social = 90, hygiene = 90, bladder = 90, needs_settled_at = $3, condition = NULL WHERE account_id = $1",
    [acc, place, at],
  );

const candidateId = async (acc: string) => (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id as string;

async function elect(policyId: string) {
  const [mayor, voter] = await people(2);
  await cmd(mayor, "StandForElection", { policyId }, T0);
  await cmd(voter, "CastVote", { candidateId: await candidateId(mayor) }, T0);
  return { mayor, voter };
}

const busFare = (s: any, dest = "food_hall") => s.directory.find((d: any) => d.id === dest).quotes.find((q: any) => q.mode === "bus").farePence;

describe("City Mayor race · eligibility and ballots", () => {
  it("characters under a day old can't stand or vote", async () => {
    const [fresh] = await people(1, mins(T0, -60));
    const [old] = await people(1);
    await expect(cmd(fresh, "StandForElection", { policyId: "half_price_buses" }, T0)).rejects.toThrow(/24 hours/);
    await cmd(old, "StandForElection", { policyId: "half_price_buses" }, T0);
    await expect(cmd(fresh, "CastVote", { candidateId: await candidateId(old) }, T0)).rejects.toThrow(/24 hours/);
    const s = await state(fresh, T0);
    expect(s.civic.voteBlocker).toMatch(/24 hours/);
  });

  it("one candidacy and one final ballot per character per week; only real candidates and listed policies", async () => {
    const [a, b, c] = await people(3);
    await expect(cmd(a, "StandForElection", { policyId: "free_money" }, T0)).rejects.toThrow(/listed policies/);
    await expect(cmd(a, "StandForElection", { policyId: "status_quo" }, T0)).rejects.toThrow(/listed policies/);
    await cmd(a, "StandForElection", { policyId: "half_price_buses" }, T0);
    await expect(cmd(a, "StandForElection", { policyId: "free_gym_fridays" }, T0)).rejects.toThrow(/already standing/);
    await expect(cmd(b, "CastVote", { candidateId: await candidateId(c) }, T0)).rejects.toThrow(/isn't standing/);
    await expect(cmd(b, "CastVote", { candidateId: "nonsense" }, T0)).rejects.toThrow(/isn't standing/);
    await cmd(b, "CastVote", { candidateId: await candidateId(a) }, T0);
    await expect(cmd(b, "CastVote", { candidateId: await candidateId(a) }, mins(T0, 1))).rejects.toThrow(/already voted/);
    // Candidates may vote for themselves, once.
    await cmd(a, "CastVote", { candidateId: await candidateId(a) }, T0);
    const s = await state(c, mins(T0, 2));
    expect(s.civic.candidates).toHaveLength(1);
    expect(s.civic.candidates[0]).toMatchObject({ votes: 2, policy: { id: "half_price_buses" } });
    // Your own ballot is shown to you; nobody else's is in the state.
    expect(s.civic.myBallot).toBeNull();
    expect((await state(b, mins(T0, 2))).civic.myBallot).toBe(await candidateId(a));
    expect(JSON.stringify(s.civic)).not.toContain(await candidateId(b));
    expect(await ledgerMatches(a)).toBe(true);
  });

  it("voting happens through the Government app when this build has no City Hall", async () => {
    if (venue("city_hall")) return; // A build with City Hall requires voting there instead.
    const [a, b] = await people(2);
    await cmd(a, "StandForElection", { policyId: "library_late_nights" }, T0);
    await ready(b, "south_bank", T0);
    await cmd(b, "CastVote", { candidateId: await candidateId(a) }, T0);
    expect((await state(b, T0)).civic.pollingPlace).toBeNull();
  });

  it("a ballot arriving at the close counts in next week's race, never the closed one", async () => {
    const [a, b] = await people(2);
    await cmd(a, "StandForElection", { policyId: "half_price_buses" }, T0);
    await expect(cmd(b, "CastVote", { candidateId: await candidateId(a) }, CLOSE)).rejects.toThrow(/isn't standing/);
    const s = await state(b, mins(CLOSE, 1));
    // Nobody voted before the close, so the caretaker carries on.
    expect(s.civic.current).toMatchObject({ caretaker: true, policy: { id: "status_quo" }, candidates: 1, totalVotes: 0 });
    expect(s.civic.raceKey).toBe("2026-10-18");
  });

  it("nobody stands: a clearly labelled caretaker keeps the status quo", async () => {
    const [a] = await people(1);
    const s = await state(a, mins(CLOSE, 5));
    expect(s.civic.current).toMatchObject({ caretaker: true, mayor: expect.stringMatching(/NPC/), policy: { id: "status_quo" } });
  });

  it("a tie goes to whoever stood first", async () => {
    const [a, b, c, d] = await people(4);
    await cmd(b, "StandForElection", { policyId: "free_gym_fridays" }, T0);
    await cmd(a, "StandForElection", { policyId: "half_price_buses" }, mins(T0, 1));
    await cmd(c, "CastVote", { candidateId: await candidateId(a) }, mins(T0, 2));
    await cmd(d, "CastVote", { candidateId: await candidateId(b) }, mins(T0, 2));
    const s = await state(a, mins(CLOSE, 1));
    expect(s.civic.current).toMatchObject({ caretaker: false, policy: { id: "free_gym_fridays" }, votes: 1, totalVotes: 2 });
    expect((await state(b, mins(CLOSE, 1))).civic.current.you).toBe(true);
  });
});

describe("City Mayor race · the winning policy applies for exactly the next week", () => {
  it("half-price buses: from the Sunday close until the next one, in quotes and in the fare charged", async () => {
    const { voter } = await elect("half_price_buses");
    await ready(voter, "home", mins(CLOSE, -1));
    expect(busFare(await state(voter, mins(CLOSE, -1)))).toBe(200);
    const s = await state(voter, CLOSE);
    expect(s.civic.current.policy.id).toBe("half_price_buses");
    expect(busFare(s)).toBe(100);
    // Taxis aren't affected.
    expect(s.directory.find((d: any) => d.id === "food_hall").quotes.find((q: any) => q.mode === "taxi").farePence).toBeGreaterThan(400);
    await cmd(voter, "StartJourney", { destination: "food_hall", mode: "bus" }, mins(CLOSE, 1));
    const after = await state(voter, mins(CLOSE, 2));
    expect(after.ledger.find((l: any) => l.category === "travel").amountPence).toBe(-100);
    expect(await ledgerMatches(voter)).toBe(true);
    expect((await state(voter, mins(CLOSE, 60))).character.location).toBe("food_hall");
    // The next race had no candidates: back to the status quo exactly at the next close.
    await ready(voter, "home", mins(NEXT_CLOSE, -1));
    expect(busFare(await state(voter, mins(NEXT_CLOSE, -1)))).toBe(100);
    const later = await state(voter, NEXT_CLOSE);
    expect(later.civic.current.policy.id).toBe("status_quo");
    expect(busFare(later)).toBe(200);
    expect(later.civic.past.slice(0, 2).map((p: any) => [p.raceKey, p.policy.id])).toEqual([["2026-10-18", "status_quo"], ["2026-10-11", "half_price_buses"]]);
  });

  it("free gym Fridays: gym sessions cost nothing on Friday, the usual price on Thursday", async () => {
    const { voter } = await elect("free_gym_fridays");
    const thursday = new Date("2026-10-15T10:00:00Z");
    const friday = new Date("2026-10-16T10:00:00Z");
    await ready(voter, "borough_athletics", thursday);
    expect((await state(voter, thursday)).actions.find((a: any) => a.id === "gym_yoga").costPence).toBe(600);
    await ready(voter, "borough_athletics", friday);
    const s = await state(voter, friday);
    expect(s.actions.find((a: any) => a.id === "gym_yoga").costPence).toBe(0);
    // The protein shake is food, not a gym session.
    expect(s.actions.find((a: any) => a.id === "gym_shake").costPence).toBe(400);
    const cash = s.wallet.cashPence;
    await cmd(voter, "StartActivity", { activityId: "gym_yoga" }, friday);
    const after = await state(voter, mins(friday, 1));
    expect(after.wallet.cashPence).toBe(cash);
    expect(await ledgerMatches(voter)).toBe(true);
  });

  it("library late nights: open until 23:00 during the term only", async () => {
    const { voter } = await elect("library_late_nights");
    // Saturday 21:00 London, before the term starts: closed.
    const before = new Date("2026-10-10T20:00:00Z");
    await ready(voter, "reading_library", before);
    let s = await state(voter, before);
    expect(s.actions.find((a: any) => a.id === "library_coding").reason).toMatch(/closed/);
    // Tuesday 21:00 London, during the term: open.
    const tuesday = new Date("2026-10-13T20:00:00Z");
    await ready(voter, "reading_library", tuesday);
    s = await state(voter, tuesday);
    expect(s.directory.find((d: any) => d.id === "reading_library").open).toBe(true);
    expect(s.actions.find((a: any) => a.id === "library_coding").available).toBe(true);
    await cmd(voter, "StartActivity", { activityId: "library_coding" }, tuesday);
  });

  it("market rates freeze: groceries at Borough Street Market cost 20% less, charged at that price", async () => {
    const { voter } = await elect("market_rates_freeze");
    const tuesday = new Date("2026-10-13T10:00:00Z");
    await ready(voter, "borough_market", tuesday);
    const s = await state(voter, tuesday);
    const cheese = s.groceries.find((g: any) => g.id === "cheese");
    const list = s.groceryItems.find((g: any) => g.id === "cheese").pricePence;
    expect(cheese.pricePence).toBe(Math.round(list * 0.8));
    await cmd(voter, "BuyGroceries", { itemId: "cheese", qty: 2 }, tuesday);
    const after = await state(voter, mins(tuesday, 1));
    expect(after.ledger.find((l: any) => l.category === "groceries").amountPence).toBe(-2 * Math.round(list * 0.8));
    expect(await ledgerMatches(voter)).toBe(true);
  });
});
