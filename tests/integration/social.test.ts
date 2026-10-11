import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { socialQueryFor } from "@/server/commands";
import { BEST_FRIEND_POINTS, DAILY_TRANSFER_CAP_PENCE, FRIEND_POINTS, GIFT_MAX_PENCE, MESSAGE_MAX_CHARS, MESSAGES_PER_MINUTE, VISIT_CAPACITY } from "@/content/social";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

const T0 = new Date("2026-10-10T09:00:00Z");
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

interface Player {
  acc: string;
  id: string;
  name: string;
}

/** A real account with its own character and a distinct public name. */
async function player(name: string, at = T0): Promise<Player> {
  const acc = await makeAccount();
  await makeCharacter(acc, at);
  const r = await pool().query("UPDATE characters SET name = $2 WHERE account_id = $1 RETURNING id", [acc, name]);
  return { acc, id: r.rows[0].id, name };
}

const q = (p: Player, op: string, params: Record<string, unknown> = {}, at = T0) => socialQueryFor(p.acc, op, params, at) as Promise<any>;
const cid = () => `c-${key()}`;
const cash = async (p: Player) => Number((await pool().query("SELECT cash_pence FROM characters WHERE id = $1", [p.id])).rows[0].cash_pence);
const setCash = (p: Player, pence: number) =>
  pool().query(
    `WITH d AS (SELECT $2::bigint - cash_pence AS delta FROM characters WHERE id = $1)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after) SELECT $1, 'test', 'test top-up', delta, $2 FROM d`,
    [p.id, pence],
  ).then(() => pool().query("UPDATE characters SET cash_pence = $2 WHERE id = $1", [p.id, pence]));

async function befriend(a: Player, b: Player, at = T0) {
  await cmd(a.acc, "SendFriendRequest", { characterId: b.id }, at);
  const s = await state(b.acc, at);
  const req = s.social.incoming.find((r: any) => r.characterId === a.id);
  await cmd(b.acc, "RespondFriendRequest", { requestId: req.id, accept: true }, at);
}

describe("I · players: presence, directory and profiles", () => {
  it("loading state marks a player online for two minutes; profiles never include account details", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await state(ben.acc, T0);
    let online = await q(ada, "online", {}, minutes(T0, 1));
    expect(online.players.map((p: any) => p.name)).toEqual(["Ben"]);
    expect(online.players[0].online).toBe(true);
    online = await q(ada, "online", {}, minutes(T0, 3));
    expect(online.players).toEqual([]);

    const found = await q(ada, "search", { q: "be" });
    expect(found.players.map((p: any) => p.name)).toEqual(["Ben"]);
    const prof = (await q(ada, "profile", { id: ben.id })).profile;
    expect(prof.name).toBe("Ben");
    expect(prof.relation).toBe("none");
    expect(prof.home.district).toBeTruthy();
    expect(typeof prof.netWorthPence).toBe("number");
    const json = JSON.stringify(prof);
    expect(json).not.toMatch(/@example\.test/);
    expect(json).not.toContain(ben.acc);
    // Wildcards in a search are literal text.
    expect((await q(ada, "search", { q: "%" })).players).toEqual([]);
  });
});

describe("I · friend requests need the recipient's consent", () => {
  it("a sender can never accept their own request; only the recipient can", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0);
    const out = (await state(ada.acc, T0)).social.outgoing;
    expect(out).toHaveLength(1);
    await expect(cmd(ada.acc, "RespondFriendRequest", { requestId: out[0].id, accept: true }, T0)).rejects.toThrow(/Only the person you asked/);
    // A third player can't answer it either.
    const cat = await player("Cat");
    await expect(cmd(cat.acc, "RespondFriendRequest", { requestId: out[0].id, accept: true }, T0)).rejects.toThrow(/couldn't be found/);
    expect((await state(ada.acc, T0)).social.friends).toEqual([]);
    await expect(cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0)).rejects.toThrow(/already asked/);
    await cmd(ben.acc, "RespondFriendRequest", { requestId: out[0].id, accept: true }, T0);
    const sa = await state(ada.acc, T0);
    expect(sa.social.friends.map((f: any) => [f.name, f.title])).toEqual([["Ben", "Acquaintance"]]);
    await expect(cmd(ben.acc, "RespondFriendRequest", { requestId: out[0].id, accept: true }, T0)).rejects.toThrow(/already accepted/);
    await expect(cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0)).rejects.toThrow(/already friends/);
  });

  it("decline, withdraw, expiry, re-ask cooldown and asking back", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0);
    let req = (await state(ben.acc, T0)).social.incoming[0];
    await cmd(ben.acc, "RespondFriendRequest", { requestId: req.id, accept: false }, T0);
    expect((await state(ada.acc, T0)).social.outgoing).toEqual([]);
    await expect(cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, minutes(T0, 60))).rejects.toThrow(/declined recently/);

    // Withdraw: only the sender can, and then it's gone for both.
    await cmd(ben.acc, "SendFriendRequest", { characterId: ada.id }, T0);
    req = (await state(ben.acc, T0)).social.outgoing[0];
    await expect(cmd(ada.acc, "WithdrawFriendRequest", { requestId: req.id }, T0)).rejects.toThrow(/Only the sender/);
    await cmd(ben.acc, "WithdrawFriendRequest", { requestId: req.id }, T0);
    expect((await state(ada.acc, T0)).social.incoming).toEqual([]);

    // Expiry after seven days; answering late doesn't make friends.
    await cmd(ben.acc, "SendFriendRequest", { characterId: ada.id }, T0);
    req = (await state(ada.acc, T0)).social.incoming[0];
    const late = day(8);
    const r = await cmd(ada.acc, "RespondFriendRequest", { requestId: req.id, accept: true }, late);
    expect((r.receipt as any).message).toMatch(/expired/);
    expect((await state(ada.acc, late)).social.friends).toEqual([]);

    // Asking back while their request waits accepts it (the recipient's own choice).
    await cmd(ben.acc, "SendFriendRequest", { characterId: ada.id }, late);
    const back = await cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, late);
    expect((back.receipt as any).message).toMatch(/already asked you/);
    expect((await state(ben.acc, late)).social.friends.map((f: any) => f.name)).toEqual(["Ada"]);
  });

  it("strangers can't message, gift or visit", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await expect(cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "hi", clientId: cid() }, T0)).rejects.toThrow(/need to be friends/);
    await expect(cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 100, clientId: cid() }, T0)).rejects.toThrow(/need to be friends/);
    await expect(cmd(ada.acc, "VisitHome", { characterId: ben.id }, T0)).rejects.toThrow(/need to be friends/);
    await expect(cmd(ada.acc, "SendFriendRequest", { characterId: ada.id }, T0)).rejects.toThrow(/That's you/);
    await expect(cmd(ada.acc, "SendFriendRequest", { characterId: "not-a-uuid" }, T0)).rejects.toThrow(/couldn't be found/);
  });
});

describe("I · messages", () => {
  it("ordered threads, unread counts, read receipts and no duplicates on retry", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    const first = cid();
    await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "  Fancy the quiz tonight?  ", clientId: first }, minutes(T0, 1));
    // The same message retried with a new request key (lost response) lands once.
    await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "  Fancy the quiz tonight?  ", clientId: first }, minutes(T0, 1));
    // And a replay of the same request key returns the stored receipt.
    const k = key();
    await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "Eight o'clock", clientId: cid() }, minutes(T0, 2), k);
    const replay = await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "Eight o'clock", clientId: cid() }, minutes(T0, 2), k);
    expect(replay.replayed).toBe(true);

    let sb = await state(ben.acc, minutes(T0, 3));
    expect(sb.social.unreadTotal).toBe(2);
    expect(sb.social.conversations[0]).toMatchObject({ name: "Ada", unread: 2 });
    let ta = (await q(ada, "thread", { id: ben.id }, minutes(T0, 3))).thread;
    expect(ta.messages.map((m: any) => m.body)).toEqual(["Fancy the quiz tonight?", "Eight o'clock"]);
    expect(ta.readUpTo).toBe(0);

    const tb = (await q(ben, "thread", { id: ada.id }, minutes(T0, 4))).thread;
    expect(tb.messages.every((m: any) => !m.mine)).toBe(true);
    sb = await state(ben.acc, minutes(T0, 4));
    expect(sb.social.unreadTotal).toBe(0);
    ta = (await q(ada, "thread", { id: ben.id }, minutes(T0, 5))).thread;
    expect(ta.readUpTo).toBe(ta.messages[1].id);

    await cmd(ben.acc, "SendMessage", { characterId: ada.id, body: "Go on then", clientId: cid() }, minutes(T0, 6));
    ta = (await q(ada, "thread", { id: ben.id }, minutes(T0, 7))).thread;
    expect(ta.messages.map((m: any) => [m.mine, m.body])).toEqual([
      [true, "Fancy the quiz tonight?"],
      [true, "Eight o'clock"],
      [false, "Go on then"],
    ]);
    expect(ta.messages[0].id).toBeLessThan(ta.messages[2].id);

    // Read receipts obey settings: if either person turns them off, neither sees them.
    await cmd(ben.acc, "UpdateSocialSettings", { readReceipts: false }, minutes(T0, 8));
    expect((await q(ada, "thread", { id: ben.id }, minutes(T0, 9))).thread.readUpTo).toBeNull();
  });

  it("length limits, empty messages and the per-minute rate limit", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await expect(cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "x".repeat(MESSAGE_MAX_CHARS + 1), clientId: cid() }, T0)).rejects.toThrow(/up to 500/);
    await expect(cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "   ", clientId: cid() }, T0)).rejects.toThrow(/Write something/);
    await expect(cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "hi" }, T0)).rejects.toThrow(/Missing message id/);
    await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "x".repeat(MESSAGE_MAX_CHARS), clientId: cid() }, T0);
    for (let i = 1; i < MESSAGES_PER_MINUTE; i++) await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: `m${i}`, clientId: cid() }, T0);
    await expect(cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "one more", clientId: cid() }, T0)).rejects.toThrow(/very fast/);
    await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "later", clientId: cid() }, minutes(T0, 2));
  });
});

describe("I · block and report", () => {
  it("blocking during a pending request cancels it and stops all contact", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0);
    const req = (await state(ben.acc, T0)).social.incoming[0];
    await cmd(ben.acc, "BlockPlayer", { characterId: ada.id }, T0);
    await expect(cmd(ben.acc, "RespondFriendRequest", { requestId: req.id, accept: true }, T0)).rejects.toThrow(/already blocked/);
    expect((await state(ada.acc, T0)).social.outgoing).toEqual([]);
    await expect(cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0)).rejects.toThrow(/isn't accepting contact/);
    // The blocked player can't find or view the blocker.
    expect((await q(ada, "search", { q: "Ben" })).players).toEqual([]);
    await expect(q(ada, "profile", { id: ben.id })).rejects.toThrow(/couldn't be found/);
    expect((await state(ben.acc, T0)).social.blocked.map((b: any) => b.name)).toEqual(["Ada"]);
    await cmd(ben.acc, "UnblockPlayer", { characterId: ada.id }, T0);
    await cmd(ada.acc, "SendFriendRequest", { characterId: ben.id }, T0);
  });

  it("blocking a friend ends the friendship, open money requests and visits", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await cmd(ada.acc, "RequestMoney", { characterId: ben.id, amountPence: 500, clientId: cid() }, T0);
    await cmd(ada.acc, "VisitHome", { characterId: ben.id }, T0);
    expect((await state(ada.acc, T0)).social.visit?.hostName).toBe("Ben");
    await cmd(ben.acc, "BlockPlayer", { characterId: ada.id }, minutes(T0, 1));
    const sa = await state(ada.acc, minutes(T0, 1));
    expect(sa.social.friends).toEqual([]);
    expect(sa.social.visit).toBeNull();
    expect(sa.social.moneyRequests.outgoing).toEqual([]);
    await expect(cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "hello?", clientId: cid() }, minutes(T0, 2))).rejects.toThrow(/isn't accepting contact/);
    // The block hides the conversation from the blocked side's list.
    expect(sa.social.conversations).toEqual([]);
  });

  it("a report records the conversation context once a day, and can block at the same time", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await cmd(ben.acc, "SendMessage", { characterId: ada.id, body: "something unpleasant", clientId: cid() }, T0);
    await expect(cmd(ada.acc, "ReportPlayer", { characterId: ben.id, reason: "nonsense" }, T0)).rejects.toThrow(/Choose a reason/);
    await cmd(ada.acc, "ReportPlayer", { characterId: ben.id, reason: "harassment", note: "See the last message", block: true }, T0);
    const r = (await pool().query("SELECT * FROM reports WHERE reporter_id = $1", [ada.id])).rows;
    expect(r).toHaveLength(1);
    expect(r[0].target_id).toBe(ben.id);
    expect(r[0].context.messages.map((m: any) => [m.from, m.body])).toEqual([["reported", "something unpleasant"]]);
    expect(r[0].context.friends).toBe(true);
    await expect(cmd(ada.acc, "ReportPlayer", { characterId: ben.id, reason: "spam" }, minutes(T0, 5))).rejects.toThrow(/already reported/);
    expect((await state(ada.acc, T0)).social.blocked.map((b: any) => b.name)).toEqual(["Ben"]);
  });
});

describe("I · friendship value", () => {
  it("grows only on days both friends take part, capped per day, with gift and visit bonuses", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    const points = async () => (await state(ada.acc, T0)).social.friends[0].points;
    for (let i = 0; i < 5; i++) await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: `hello ${i}`, clientId: cid() }, minutes(T0, i));
    expect(await points()).toBe(0);
    await cmd(ben.acc, "SendMessage", { characterId: ada.id, body: "hi!", clientId: cid() }, minutes(T0, 10));
    expect(await points()).toBe(FRIEND_POINTS.mutualDay);
    await cmd(ben.acc, "SendMessage", { characterId: ada.id, body: "again", clientId: cid() }, minutes(T0, 11));
    expect(await points()).toBe(FRIEND_POINTS.mutualDay);
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 100, clientId: cid() }, minutes(T0, 12));
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 100, clientId: cid() }, minutes(T0, 13));
    expect(await points()).toBe(FRIEND_POINTS.mutualDay + FRIEND_POINTS.gift);
    await cmd(ben.acc, "VisitHome", { characterId: ada.id }, minutes(T0, 14));
    expect(await points()).toBe(FRIEND_POINTS.mutualDay + FRIEND_POINTS.gift + FRIEND_POINTS.visit);
    // A new London day can pay again.
    await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "morning", clientId: cid() }, day(1));
    await cmd(ben.acc, "SendMessage", { characterId: ada.id, body: "morning!", clientId: cid() }, day(1));
    expect((await state(ada.acc, day(1))).social.friends[0].points).toBe(2 * FRIEND_POINTS.mutualDay + FRIEND_POINTS.gift + FRIEND_POINTS.visit);
  });

  it("player best friends count towards the Four Best Friends ambition", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await pool().query("UPDATE characters SET ambition = 'four_friends' WHERE id = $1", [ada.id]);
    const before = (await state(ada.acc, T0)).goals.ambition.progress;
    await befriend(ada, ben);
    await pool().query("UPDATE friendships SET points = $1", [BEST_FRIEND_POINTS]);
    const s = await state(ada.acc, T0);
    expect(s.social.friends[0].title).toBe("Best friend");
    expect(s.goals.ambition.progress).toBeCloseTo(before + 0.25, 5);
    expect(s.goals.ambition.note).toMatch(/^1 of 4 best friends/);
  });
});

describe("I · gifts and money requests", () => {
  it("a gift moves money on both ledgers in one transaction and credits the recipient exactly once", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await setCash(ada, 10_000);
    const benBefore = await cash(ben);
    const clientId = cid();
    const k = key();
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 2_500, note: "for the bus", clientId }, T0, k);
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 2_500, note: "for the bus", clientId }, T0, k);
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 2_500, note: "for the bus", clientId }, T0);
    expect(await cash(ada)).toBe(7_500);
    expect(await cash(ben)).toBe(benBefore + 2_500);
    expect(await ledgerMatches(ada.acc)).toBe(true);
    expect(await ledgerMatches(ben.acc)).toBe(true);
    const sb = await state(ben.acc, T0);
    expect(sb.ledger[0]).toMatchObject({ category: "gift", amountPence: 2_500, description: "Gift from Ada" });
    expect((await q(ben, "thread", { id: ada.id })).thread.messages.map((m: any) => m.kind)).toEqual(["gift"]);
  });

  it("gift limits: funds, per-gift maximum and the daily cap", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await setCash(ada, 100);
    await expect(cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 101, clientId: cid() }, T0)).rejects.toThrow(/You need £1.01/);
    await expect(cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 0, clientId: cid() }, T0)).rejects.toThrow(/at least 1p/);
    await expect(cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 1.5, clientId: cid() }, T0)).rejects.toThrow(/at least 1p/);
    await setCash(ada, 1_000_000);
    await expect(cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: GIFT_MAX_PENCE + 1, clientId: cid() }, T0)).rejects.toThrow(/most you can send/);
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: GIFT_MAX_PENCE, clientId: cid() }, T0);
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: DAILY_TRANSFER_CAP_PENCE - GIFT_MAX_PENCE, clientId: cid() }, T0);
    await expect(cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 1, clientId: cid() }, T0)).rejects.toThrow(/a day to other players/);
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 1, clientId: cid() }, day(1));
    expect(await ledgerMatches(ada.acc)).toBe(true);
  });

  it("a money request moves money only when the payer accepts, once", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await setCash(ben, 5_000);
    const adaBefore = await cash(ada);
    await cmd(ada.acc, "RequestMoney", { characterId: ben.id, amountPence: 1_200, note: "pizza", clientId: cid() }, T0);
    expect(await cash(ben)).toBe(5_000);
    const req = (await state(ben.acc, T0)).social.moneyRequests.incoming[0];
    expect(req).toMatchObject({ name: "Ada", amountPence: 1_200, note: "pizza" });
    // The requester can't approve their own request.
    await expect(cmd(ada.acc, "RespondMoneyRequest", { transferId: req.id, accept: true }, T0)).rejects.toThrow(/Only the person you asked/);
    expect(await cash(ben)).toBe(5_000);
    await cmd(ben.acc, "RespondMoneyRequest", { transferId: req.id, accept: true }, T0);
    await expect(cmd(ben.acc, "RespondMoneyRequest", { transferId: req.id, accept: true }, T0)).rejects.toThrow(/already completed/);
    expect(await cash(ben)).toBe(3_800);
    expect(await cash(ada)).toBe(adaBefore + 1_200);
    expect(await ledgerMatches(ada.acc)).toBe(true);
    expect(await ledgerMatches(ben.acc)).toBe(true);

    // Decline, cancel, expiry and insufficient funds at the moment of paying.
    await cmd(ada.acc, "RequestMoney", { characterId: ben.id, amountPence: 100, clientId: cid() }, T0);
    let r2 = (await state(ben.acc, T0)).social.moneyRequests.incoming[0];
    await cmd(ben.acc, "RespondMoneyRequest", { transferId: r2.id, accept: false }, T0);
    await cmd(ada.acc, "RequestMoney", { characterId: ben.id, amountPence: 100, clientId: cid() }, T0);
    r2 = (await state(ada.acc, T0)).social.moneyRequests.outgoing[0];
    await expect(cmd(ben.acc, "CancelMoneyRequest", { transferId: r2.id }, T0)).rejects.toThrow(/Only the person who asked/);
    await cmd(ada.acc, "CancelMoneyRequest", { transferId: r2.id }, T0);
    await cmd(ada.acc, "RequestMoney", { characterId: ben.id, amountPence: 100, clientId: cid() }, T0);
    r2 = (await state(ben.acc, T0)).social.moneyRequests.incoming[0];
    const res = await cmd(ben.acc, "RespondMoneyRequest", { transferId: r2.id, accept: true }, day(4));
    expect((res.receipt as any).message).toMatch(/expired/);
    await cmd(ada.acc, "RequestMoney", { characterId: ben.id, amountPence: 9_999, clientId: cid() }, day(4));
    r2 = (await state(ben.acc, day(4))).social.moneyRequests.incoming[0];
    await expect(cmd(ben.acc, "RespondMoneyRequest", { transferId: r2.id, accept: true }, day(4))).rejects.toThrow(/You need £99.99/);
    expect(await cash(ben)).toBe(3_800);
  });

  it("simultaneous gifts: a retried gift lands once, and two friends gifting each other don't deadlock", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await setCash(ada, 10_000);
    await setCash(ben, 10_000);
    const same = cid();
    const results = await Promise.allSettled([
      cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 1_000, clientId: same }, T0),
      cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 1_000, clientId: same }, T0),
      cmd(ben.acc, "SendGift", { characterId: ada.id, amountPence: 300, clientId: cid() }, T0),
      cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 200, clientId: cid() }, T0),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await cash(ada)).toBe(10_000 - 1_000 - 200 + 300);
    expect(await cash(ben)).toBe(10_000 + 1_000 + 200 - 300);
    expect(await ledgerMatches(ada.acc)).toBe(true);
    expect(await ledgerMatches(ben.acc)).toBe(true);
  });

  it("transfers move wealth between players but never create it", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await setCash(ada, 20_000);
    const total = async () => {
      const r = (await q(ada, "rankings")).rankings.netWorth.top;
      return r.reduce((s: number, x: any) => s + x.value, 0);
    };
    const before = await total();
    await cmd(ada.acc, "SendGift", { characterId: ben.id, amountPence: 7_000, clientId: cid() }, T0);
    expect(await total()).toBe(before);
  });
});

describe("I · visiting a friend's home", () => {
  it("shows the friend's real furniture read-only; the host sees the guest; leaving ends it", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await cmd(ada.acc, "VisitHome", { characterId: ben.id }, T0);
    const sa = await state(ada.acc, T0);
    const sb = await state(ben.acc, T0);
    const placed = sb.furniture.filter((f: any) => f.placed).map((f: any) => ({ id: f.id, defId: f.defId, x: f.x, y: f.y, rot: f.rot, colour: f.colour }));
    expect(sa.social.visit.furniture).toEqual(placed);
    expect(sa.social.visit.home.gridW).toBe(sb.home.tier.gridW);
    expect(sa.character.location).toBe("home");
    expect(sb.social.visitors.map((v: any) => v.name)).toEqual(["Ada"]);
    // The guest still can't touch the host's things: furniture commands only accept your own items.
    await expect(cmd(ada.acc, "SellFurniture", { instanceId: placed[0].id }, T0)).rejects.toThrow(/don't own/);
    await cmd(ada.acc, "LeaveVisit", {}, minutes(T0, 5));
    expect((await state(ada.acc, minutes(T0, 5))).social.visit).toBeNull();
    expect((await state(ben.acc, minutes(T0, 5))).social.visitors).toEqual([]);
    await expect(cmd(ada.acc, "LeaveVisit", {}, minutes(T0, 6))).rejects.toThrow(/not visiting/);
  });

  it("visits end on their own, and unfriending ends one at once", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await cmd(ada.acc, "VisitHome", { characterId: ben.id }, T0);
    expect((await state(ada.acc, minutes(T0, 120))).social.visit).toBeNull();
    await cmd(ada.acc, "VisitHome", { characterId: ben.id }, minutes(T0, 121));
    await cmd(ben.acc, "Unfriend", { characterId: ada.id }, minutes(T0, 122));
    expect((await state(ada.acc, minutes(T0, 122))).social.visit).toBeNull();
  });

  it(`a home holds ${VISIT_CAPACITY} guests; the next one sees a full house`, async () => {
    const host = await player("Hana");
    const guests: Player[] = [];
    for (let i = 0; i <= VISIT_CAPACITY; i++) {
      const g = await player(`Guest${String.fromCharCode(65 + i)}`);
      await befriend(g, host);
      guests.push(g);
    }
    for (const g of guests.slice(0, VISIT_CAPACITY)) await cmd(g.acc, "VisitHome", { characterId: host.id }, minutes(T0, 1));
    await expect(cmd(guests[VISIT_CAPACITY].acc, "VisitHome", { characterId: host.id }, minutes(T0, 1))).rejects.toThrow(/already has 8 guests/);
    await cmd(guests[0].acc, "LeaveVisit", {}, minutes(T0, 2));
    await cmd(guests[VISIT_CAPACITY].acc, "VisitHome", { characterId: host.id }, minutes(T0, 2));
    expect((await state(host.acc, minutes(T0, 2))).social.visitors).toHaveLength(VISIT_CAPACITY);
  });
});

describe("I · rankings and the city feed", () => {
  it("net worth and reputation rankings match each player's own figures", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    const cat = await player("Cat");
    await setCash(ben, 1_234_567);
    await pool().query("UPDATE characters SET reputation_xp = 900 WHERE id = $1", [cat.id]);
    // An owned home counts at its price; unpaid bills count against you.
    await pool().query("UPDATE homes SET tier_id = 'shared_room', owned = true WHERE character_id = $1", [cat.id]);
    await pool().query("INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at) VALUES ($1, 'rent', 'w1', 'Rent', 4321, 'unpaid', $2)", [ada.id, T0]);
    const r = (await q(ada, "rankings")).rankings;
    expect(r.netWorth.top[0].name).toBe("Ben");
    expect(r.reputation.top[0].name).toBe("Cat");
    for (const p of [ada, ben, cat]) {
      const s = await state(p.acc, T0);
      const row = r.netWorth.top.find((x: any) => x.id === p.id);
      expect(row.value).toBe(s.bank.netWorthPence);
      const prof = (await q(ada, "profile", { id: p.id })).profile;
      expect(prof.netWorthPence).toBe(s.bank.netWorthPence);
      expect(r.reputation.top.find((x: any) => x.id === p.id).value).toBe(s.character.reputation.xp);
    }
    expect(r.netWorth.you.id).toBe(ada.id);
  });

  it("public events from players who share them, newest first, paginated without duplicates", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    const ev = (p: Player, type: string, data: Record<string, string>, at: Date) =>
      pool().query("INSERT INTO game_events (character_id, type, data, period_key, created_at) VALUES ($1,$2,$3,$4,$5)", [p.id, type, data, "2026-10-10", at]);
    await ev(ben, "promoted", { career: "tech", role: "Junior Developer I" }, T0);
    await ev(ben, "treasure_found", { venue: "camden_market" }, minutes(T0, 1));
    await ev(ben, "npc_time", { npc: "nia" }, minutes(T0, 2));
    await ev(ada, "home_bought", { tier: "shared_room" }, minutes(T0, 3));
    let f = (await q(ada, "feed")).feed;
    expect(f.items.map((i: any) => `${i.name} ${i.text}`)).toEqual([
      "Ada bought their room in a shared flat.",
      "Ben found today's hidden city treasure.",
      "Ben was promoted to Junior Developer I.",
    ]);
    expect(JSON.stringify(f)).not.toContain("camden_market");
    await cmd(ben.acc, "UpdateSocialSettings", { shareFeed: false }, T0);
    f = (await q(ada, "feed")).feed;
    expect(f.items.map((i: any) => i.name)).toEqual(["Ada"]);
    await cmd(ben.acc, "UpdateSocialSettings", { shareFeed: true }, T0);

    for (let i = 0; i < 35; i++) await ev(ben, "certified", { course: "x" }, minutes(T0, 10 + i));
    const p1 = (await q(ada, "feed")).feed;
    const p2 = (await q(ada, "feed", { before: p1.nextBefore })).feed;
    const ids = [...p1.items, ...p2.items].map((i: any) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(38);
    expect(p2.nextBefore).toBeNull();
  });
});
