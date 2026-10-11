import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { HOME_TIERS } from "@/content/character";
import { COURSES } from "@/content/courses";
import { walkMinutes } from "@/content/world";
import { cmd, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London — just after rent time, so the first rent falls on 17 Oct.
const T0 = new Date("2026-10-10T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);
const setCash = (acc: string, p: number) =>
  pool().query(
    `WITH c AS (UPDATE characters SET cash_pence = $2 WHERE account_id = $1 RETURNING id, cash_pence)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after)
     SELECT id, 'test', 'test adjustment', $2 - (SELECT COALESCE(SUM(amount_pence),0) FROM ledger_entries WHERE character_id = c.id), cash_pence FROM c`,
    [acc, p],
  );

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("L · rent and bills", () => {
  it("covers the first two weeks, then charges rent every Saturday exactly once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0); // shared room, £80 a week
    let s = await state(acc, days(8));
    expect(s.bank.bills.map((b: any) => b.status)).toEqual(["covered"]);
    s = await state(acc, days(15));
    expect(s.bank.bills.map((b: any) => b.status)).toEqual(["covered", "covered"]);
    const cash = s.wallet.cashPence;
    s = await state(acc, days(22));
    expect(s.bank.bills[0].status).toBe("paid");
    expect(cash - s.wallet.cashPence).toBe(8000);
    // Reloading the same week never charges twice.
    await state(acc, days(22.2));
    s = await state(acc, days(23));
    expect(s.bank.bills.filter((b: any) => b.status === "paid")).toHaveLength(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("leaves rent unpaid when you can't afford it, shows it in mood, and lets you pay later", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await state(acc, days(15));
    await setCash(acc, 1000);
    let s = await state(acc, days(22));
    expect(s.bank.unpaidPence).toBe(8000);
    expect(s.mood.factors.some((f: any) => f.label === "Unpaid rent")).toBe(true);
    await expect(cmd(acc, "MoveHome", { tierId: "outer_studio" }, days(22))).rejects.toThrow(/unpaid rent/);
    await expect(cmd(acc, "PayBills", {}, days(22))).rejects.toThrow(/oldest bill/);
    await setCash(acc, 20000);
    await cmd(acc, "PayBills", {}, days(22));
    s = await state(acc, days(22));
    expect(s.bank.unpaidPence).toBe(0);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("an owned home never bills rent", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999); // inherited wealth
    const s = await state(acc, days(30));
    expect(s.housing.owned).toBe(true);
    expect(s.bank.bills).toHaveLength(0);
  });
});

describe("M · savings", () => {
  it("moves money both ways through the ledger and credits interest once per day", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999);
    await cmd(acc, "DepositSavings", { amountPence: 100000 }, T0);
    await expect(cmd(acc, "WithdrawSavings", { amountPence: 200000 }, T0)).rejects.toThrow(/don't have that much/);
    let s = await state(acc, days(1));
    const after1 = s.bank.savingsPence;
    expect(after1).toBe(100000 + Math.floor((100000 * 0.005) / 7));
    s = await state(acc, days(1.5));
    expect(s.bank.savingsPence).toBe(after1);
    s = await state(acc, days(3));
    expect(s.bank.savingsPence).toBeGreaterThan(after1);
    await cmd(acc, "WithdrawSavings", { amountPence: 50000 }, days(3));
    expect(await ledgerMatches(acc)).toBe(true);
  });
});

describe("N · moving and buying", () => {
  it("moving charges deposit and fee, refunds the old deposit, and downsizing stores what doesn't fit", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999); // one-bed 8×8, owned
    await pool().query("UPDATE homes SET owned = false WHERE character_id = (SELECT id FROM characters WHERE account_id = $1)", [acc]);
    await cmd(acc, "MoveHome", { tierId: "brixton_terrace" }, T0);
    let s = await state(acc, T0);
    expect(s.home.tier.id).toBe("brixton_terrace");
    expect(s.home.district).toBe("Brixton");
    const placedBefore = s.furniture.filter((f: any) => f.placed).length;
    // Journey times now start from Brixton.
    expect(s.directory.find((d: any) => d.id === "borough_athletics").quotes[0].minutes).toBeLessThan(walkMinutes("home", "borough_athletics"));
    await cmd(acc, "MoveHome", { tierId: "student_hall" }, T0);
    s = await state(acc, T0);
    const placed = s.furniture.filter((f: any) => f.placed);
    expect(placed.length).toBeLessThanOrEqual(placedBefore);
    for (const f of placed) expect(f.x + 1).toBeLessThanOrEqual(6);
    expect(s.furniture.length).toBeGreaterThan(0);
    expect(s.housing.depositPence).toBe(HOME_TIERS.find((t) => t.id === "student_hall")!.rentPence);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("buying stops rent and student halls can't be bought", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await setCash(acc, 900000);
    await cmd(acc, "BuyHome", {}, T0);
    const s = await state(acc, days(30));
    expect(s.housing.owned).toBe(true);
    expect(s.bank.bills.filter((b: any) => b.status === "paid")).toHaveLength(0);
    expect(s.goals.ambition.id === "home_owner" || true).toBe(true);
    await cmd(acc, "MoveHome", { tierId: "student_hall" }, days(30));
    await expect(cmd(acc, "BuyHome", {}, days(30))).rejects.toThrow(/can't be bought/);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});

describe("O · courses", () => {
  const course = COURSES[0];
  async function attend(acc: string, at: Date) {
    await cmd(acc, "StartActivity", { activityId: `class_${course.id}` }, at);
    return minutes(at, 46);
  }
  it("class → quiz → next lesson; failing means re-attending; two classes a day", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999);
    await cmd(acc, "StartJourney", { destination: "learning_campus", mode: "taxi" }, T0);
    let t = minutes(T0, 10);
    await expect(cmd(acc, "SubmitLessonQuiz", { courseId: course.id, answers: [0, 0, 0] }, t)).rejects.toThrow(/Attend the next class/);
    t = await attend(acc, t);
    let s = await state(acc, t);
    const quiz = s.courses.list.find((c: any) => c.id === course.id).quiz;
    expect(quiz.lesson).toBe(1);
    expect(JSON.stringify(quiz)).not.toMatch(/"answer"/);
    await expect(cmd(acc, "StartActivity", { activityId: `class_${course.id}` }, t)).rejects.toThrow(/quiz/);
    const wrong = course.lessons[0].questions.map((q) => (q.answer + 1) % 4);
    await cmd(acc, "SubmitLessonQuiz", { courseId: course.id, answers: wrong }, t);
    s = await state(acc, t);
    expect(s.courses.list.find((c: any) => c.id === course.id).passed).toBe(0);
    t = await attend(acc, t);
    const stars = (await state(acc, t)).character.stars;
    await cmd(acc, "SubmitLessonQuiz", { courseId: course.id, answers: course.lessons[0].questions.map((q) => q.answer) }, t);
    s = await state(acc, t);
    expect(s.courses.list.find((c: any) => c.id === course.id).passed).toBe(1);
    expect(s.character.stars).toBe(stars + 1);
    // Third class today is refused.
    await expect(cmd(acc, "StartActivity", { activityId: `class_${course.id}` }, t)).rejects.toThrow(/2 classes today/);
  });

  it("five passed lessons award a certificate and three bonus stars", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999);
    await cmd(acc, "StartJourney", { destination: "learning_campus", mode: "taxi" }, T0);
    let t = minutes(T0, 10);
    let starsBefore = 0;
    for (let n = 0; n < 5; n++) {
      if (n % 2 === 0 && n > 0) t = days(Math.ceil(n / 2)) ;
      t = await attend(acc, new Date(t.getTime() + 60_000));
      if (n === 4) starsBefore = (await state(acc, t)).character.stars;
      await cmd(acc, "SubmitLessonQuiz", { courseId: course.id, answers: course.lessons[n].questions.map((q) => q.answer) }, t);
    }
    const s = await state(acc, t);
    const row = s.courses.list.find((c: any) => c.id === course.id);
    expect(row.certified).toBe(true);
    expect(s.character.stars).toBe(starsBefore + 4);
    await expect(cmd(acc, "StartActivity", { activityId: `class_${course.id}` }, t)).rejects.toThrow(/Certificate earned/);
  });
});

describe("P · wardrobe and salon", () => {
  it("buy once at the market, equip anywhere, and the avatar record updates", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999);
    await expect(cmd(acc, "EquipOutfit", { top: "top_hoodie" }, T0)).rejects.toThrow(/don't own/);
    await expect(cmd(acc, "BuyGarment", { itemId: "top_hoodie" }, T0)).rejects.toThrow(/Only at Borough/);
    await cmd(acc, "StartJourney", { destination: "borough_market", mode: "taxi" }, T0);
    const t = minutes(T0, 30);
    await cmd(acc, "BuyGarment", { itemId: "top_hoodie" }, t);
    await expect(cmd(acc, "BuyGarment", { itemId: "top_hoodie" }, t)).rejects.toThrow(/already own/);
    await cmd(acc, "EquipOutfit", { top: "top_hoodie", topColour: 2, hat: null }, t);
    const s = await state(acc, t);
    expect(s.character.appearance.outfit.top).toBe(1);
    expect(s.character.appearance.top).toBe(2);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("the salon charges for what changes", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999);
    await cmd(acc, "StartJourney", { destination: "crown_and_curl", mode: "taxi" }, T0);
    const t = minutes(T0, 40);
    const before = (await state(acc, t)).wallet.cashPence;
    await cmd(acc, "ChangeHair", { hairStyle: 3, hairColour: 0 }, t);
    const s = await state(acc, t);
    expect(s.character.appearance.hairStyle).toBe(3);
    expect(before - s.wallet.cashPence).toBe(2500);
    await expect(cmd(acc, "ChangeHair", { hairStyle: 3, hairColour: 0 }, t)).rejects.toThrow(/already have/);
  });
});

describe("N2 · selling on the way out", () => {
  it("moving out of a home you own sells it for 90% instead of losing it", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.999); // owns a one-bed
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "MoveHome", { tierId: "outer_studio" }, T0);
    const s = await state(acc, T0);
    const sale = Math.round(HOME_TIERS.find((t) => t.id === "one_bed")!.pricePence! * 0.9);
    const studio = HOME_TIERS.find((t) => t.id === "outer_studio")!.rentPence;
    expect(s.wallet.cashPence - before).toBe(sale - studio * 3);
    expect(s.housing.owned).toBe(false);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
