import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { socialQueryFor } from "@/server/commands";
import { DATE_MIN_POINTS, PARTNER_MIN_VALUE, PARTY_GUEST_CAP, PARTY_GUEST_REWARD, ROMANCE_PARTY_BONUS } from "@/content/family";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London.
const T0 = new Date("2026-10-10T09:00:00Z");
const EVENING = new Date(T0.getTime() + 10 * 3_600_000); // 20:00 London
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);
const INHERITED = 0.999; // owned one-bed 8×8 with a cooker

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

async function player(name: string, origin = 0.3): Promise<Player> {
  const acc = await makeAccount();
  await makeCharacter(acc, T0, origin);
  const r = await pool().query("UPDATE characters SET name = $2 WHERE account_id = $1 RETURNING id", [acc, name]);
  return { acc, id: r.rows[0].id, name };
}

async function befriend(a: Player, b: Player, at = T0) {
  await cmd(a.acc, "SendFriendRequest", { characterId: b.id }, at);
  const s = await state(b.acc, at);
  const req = s.social.incoming.find((r: any) => r.characterId === a.id);
  await cmd(b.acc, "RespondFriendRequest", { requestId: req.id, accept: true }, at);
}

const setPoints = (a: Player, b: Player, points: number) => {
  const [x, y] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
  return pool().query("UPDATE friendships SET points = $3 WHERE a_id = $1 AND b_id = $2", [x, y, points]);
};
const fam = async (p: Player, at = T0) => (await state(p.acc, at)).family;
const q = (p: Player, op: string, params: Record<string, unknown> = {}, at = T0) => socialQueryFor(p.acc, op, params, at) as Promise<any>;
const cash = async (p: Player) => Number((await pool().query("SELECT cash_pence FROM characters WHERE id = $1", [p.id])).rows[0].cash_pence);
const inv = async (p: Player) =>
  Object.fromEntries((await pool().query("SELECT item_id, qty FROM inventory WHERE character_id = $1 AND qty > 0", [p.id])).rows.map((r) => [r.item_id, Number(r.qty)]));
const openVisit = async (guest: Player) => (await pool().query("SELECT host_id FROM home_visits WHERE guest_id = $1 AND ended_at IS NULL", [guest.id])).rows[0]?.host_id ?? null;

async function placeAnywhere(acc: string, instanceId: string, at: Date) {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      try {
        await cmd(acc, "PlaceFurniture", { instanceId, x, y, rot: 0 }, at);
        return;
      } catch {
        /* occupied: try the next cell */
      }
    }
  throw new Error("no free cell");
}

describe("V · romance needs both people's consent", { timeout: 30_000 }, () => {
  it("Good friends may ask to date; only the person asked can say yes; partners need a grown relationship", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await expect(cmd(ada.acc, "AskToDate", { characterId: ben.id }, T0)).rejects.toThrow(/need to be friends/);
    await befriend(ada, ben);
    await expect(cmd(ada.acc, "AskToDate", { characterId: ben.id }, T0)).rejects.toThrow(/Good friends first/);
    await setPoints(ada, ben, DATE_MIN_POINTS);

    await cmd(ada.acc, "AskToDate", { characterId: ben.id }, T0);
    await expect(cmd(ada.acc, "AskToDate", { characterId: ben.id }, T0)).rejects.toThrow(/already asked/);
    const mine = await fam(ada);
    expect(mine.romanceRequests.outgoing).toHaveLength(1);
    expect(mine.romance).toBeNull();
    // The sender can never accept their own request.
    await expect(cmd(ada.acc, "RespondRomance", { requestId: mine.romanceRequests.outgoing[0].id, accept: true }, T0)).rejects.toThrow(/Only the person you asked/);
    // A third player can't answer it either.
    const cy = await player("Cy");
    await expect(cmd(cy.acc, "RespondRomance", { requestId: mine.romanceRequests.outgoing[0].id, accept: true }, T0)).rejects.toThrow(/couldn't be found/);
    expect((await fam(ada)).romance).toBeNull();

    const theirs = await fam(ben);
    expect(theirs.romanceRequests.incoming[0]).toMatchObject({ kind: "date", name: "Ada" });
    await cmd(ben.acc, "RespondRomance", { requestId: theirs.romanceRequests.incoming[0].id, accept: true }, T0);
    let r = (await fam(ada)).romance;
    expect(r).toMatchObject({ name: "Ben", status: "dating", value: 0, canPropose: false });
    expect((await fam(ben)).romance).toMatchObject({ name: "Ada", status: "dating" });

    // Partners need the relationship to grow first.
    await expect(cmd(ada.acc, "ProposePartnership", { characterId: ben.id }, T0)).rejects.toThrow(/grow a little/);
    // Shared days grow it: here, two days of messaging each other.
    for (const d of [1, 2, 3, 4, 5]) {
      await cmd(ada.acc, "SendMessage", { characterId: ben.id, body: "Morning!", clientId: `m-${key()}` }, day(d));
      await cmd(ben.acc, "SendMessage", { characterId: ada.id, body: "Hiya", clientId: `m-${key()}` }, day(d));
    }
    r = (await fam(ada, day(5))).romance;
    expect(r.value).toBeGreaterThanOrEqual(PARTNER_MIN_VALUE);
    expect(r.canPropose).toBe(true);

    await cmd(ben.acc, "ProposePartnership", { characterId: ada.id }, day(5));
    const prop = (await fam(ada, day(5))).romanceRequests.incoming[0];
    expect(prop.kind).toBe("partner");
    await expect(cmd(ben.acc, "RespondRomance", { requestId: prop.id, accept: true }, day(5))).rejects.toThrow(/Only the person you asked/);
    await cmd(ada.acc, "RespondRomance", { requestId: prop.id, accept: true }, day(5));
    expect((await fam(ben, day(5))).romance.status).toBe("partnered");

    // Ending needs a clear confirmation, and the only effect is the status change.
    const cashBefore = await cash(ada);
    await expect(cmd(ben.acc, "EndRelationship", { characterId: ada.id }, day(5))).rejects.toThrow(/Please confirm/);
    expect((await fam(ben, day(5))).romance).not.toBeNull();
    await cmd(ben.acc, "EndRelationship", { characterId: ada.id, confirm: true }, day(5));
    expect((await fam(ada, day(5))).romance).toBeNull();
    expect((await state(ada.acc, day(5))).social.friends.map((f: any) => f.name)).toEqual(["Ben"]);
    expect(await cash(ada)).toBe(cashBefore);
    expect(await ledgerMatches(ada.acc)).toBe(true);
  });

  it("declines hold off re-asking; asking back accepts; one relationship at a time; withdraw is sender-only", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    const cy = await player("Cy");
    await befriend(ada, ben);
    await befriend(ada, cy);
    await befriend(ben, cy);
    await setPoints(ada, ben, 20);
    await setPoints(ada, cy, 20);
    await setPoints(ben, cy, 20);

    await cmd(ada.acc, "AskToDate", { characterId: ben.id }, T0);
    const req = (await fam(ben)).romanceRequests.incoming[0];
    await expect(cmd(ben.acc, "WithdrawRomance", { requestId: req.id }, T0)).rejects.toThrow(/Only the person who asked/);
    await cmd(ben.acc, "RespondRomance", { requestId: req.id, accept: false }, T0);
    await expect(cmd(ada.acc, "AskToDate", { characterId: ben.id }, minutes(T0, 5))).rejects.toThrow(/said no recently/);
    await expect(cmd(ben.acc, "RespondRomance", { requestId: req.id, accept: true }, T0)).rejects.toThrow(/already declined/);

    // Cy asks Ada; Ada asking Cy back is her own yes.
    await cmd(cy.acc, "AskToDate", { characterId: ada.id }, T0);
    const r = await cmd(ada.acc, "AskToDate", { characterId: cy.id }, T0);
    expect((r.receipt as any).message).toMatch(/already asked you/);
    expect((await fam(cy)).romance.name).toBe("Ada");

    // One relationship each at a time.
    await expect(cmd(ben.acc, "AskToDate", { characterId: cy.id }, T0)).rejects.toThrow(/isn't available/);
    await expect(cmd(ada.acc, "AskToDate", { characterId: ben.id }, day(4))).rejects.toThrow(/already dating Cy/);

    // Unfriending ends the romance at once.
    await cmd(cy.acc, "Unfriend", { characterId: ada.id }, T0);
    expect((await fam(ada)).romance).toBeNull();
    const n = await pool().query("SELECT count(*) AS n FROM romances");
    expect(Number(n.rows[0].n)).toBe(0);
  });

  it("a block cancels a pending romance request; requests expire", async () => {
    const ada = await player("Ada");
    const ben = await player("Ben");
    await befriend(ada, ben);
    await setPoints(ada, ben, 20);
    await cmd(ada.acc, "AskToDate", { characterId: ben.id }, T0);
    const req = (await fam(ben)).romanceRequests.incoming[0];
    await cmd(ben.acc, "BlockPlayer", { characterId: ada.id }, T0);
    expect((await fam(ada)).romanceRequests.outgoing).toEqual([]);
    await expect(cmd(ben.acc, "RespondRomance", { requestId: req.id, accept: true }, T0)).rejects.toThrow(/already cancelled/);

    const cy = await player("Cy");
    await befriend(ada, cy);
    await setPoints(ada, cy, 20);
    await cmd(ada.acc, "AskToDate", { characterId: cy.id }, T0);
    const req2 = (await fam(cy)).romanceRequests.incoming[0];
    const late = await cmd(cy.acc, "RespondRomance", { requestId: req2.id, accept: true }, day(4));
    expect((late.receipt as any).message).toMatch(/expired/);
    expect((await fam(cy, day(4))).romance).toBeNull();
  });
});

describe("W · households: shared appliances, never shared money, furniture or messages", { timeout: 30_000 }, () => {
  it("owner invites, only the invitee accepts; members cook with their own groceries, sleep and shower at the owner's", async () => {
    const host = await player("Hana", INHERITED);
    const mem = await player("Milo");
    const pal = await player("Pat");
    await befriend(host, mem);
    await befriend(host, pal);
    await expect(cmd(host.acc, "InviteToHousehold", { characterId: mem.id }, T0)).rejects.toThrow(/at least Friends/);
    await setPoints(host, mem, 6);
    await cmd(host.acc, "InviteToHousehold", { characterId: mem.id }, T0);
    const out = (await fam(host)).invitations.outgoing[0];
    expect(out).toMatchObject({ kind: "household", guestName: "Milo", status: "pending" });
    // The host can't accept on the invitee's behalf.
    await expect(cmd(host.acc, "RespondInvitation", { invitationId: out.id, accept: true }, T0)).rejects.toThrow(/Only the person you invited/);
    await expect(cmd(pal.acc, "RespondInvitation", { invitationId: out.id, accept: true }, T0)).rejects.toThrow(/couldn't be found/);
    expect((await fam(host)).household).toBeNull();
    await cmd(mem.acc, "RespondInvitation", { invitationId: out.id, accept: true }, T0);
    expect((await fam(host)).household).toMatchObject({ role: "owner", members: [{ name: "Milo" }] });
    expect((await fam(mem)).household).toMatchObject({ role: "member", owner: { name: "Hana" } });

    // Using the owner's home needs a visit there first.
    await expect(cmd(mem.acc, "UseHostHome", { activityId: "cook_tea_and_toast" }, T0)).rejects.toThrow(/Visit Hana's home first/);
    await cmd(mem.acc, "VisitHome", { characterId: host.id }, T0);
    const view = (await fam(mem)).hostHome;
    expect(view.hostName).toBe("Hana");
    expect(view.actions.map((a: any) => a.id)).toEqual(expect.arrayContaining(["sleep", "shower", "cook_tea_and_toast"]));
    // Only care and cooking: not the owner's TV, desk or anything else.
    await expect(cmd(mem.acc, "UseHostHome", { activityId: "watch_tv" }, T0)).rejects.toThrow(/cook, sleep, shower/);

    const hostItems = await inv(host);
    const memItems = await inv(mem);
    const hostCash = await cash(host);
    await cmd(mem.acc, "UseHostHome", { activityId: "cook_tea_and_toast" }, T0);
    expect(await inv(host)).toEqual(hostItems);
    const after = await inv(mem);
    expect(after.bread).toBe(memItems.bread - 1);
    expect(after.tea).toBe(memItems.tea - 1);
    // The cooked meal goes into the member's own cupboard when it's done.
    const done = await state(mem.acc, minutes(T0, 5));
    expect(done.inventory.find((i: any) => i.id === "tea_and_toast")?.qty).toBe(1);
    await cmd(mem.acc, "UseHostHome", { activityId: "shower" }, minutes(T0, 5));
    const showered = await state(mem.acc, minutes(T0, 9));
    expect(showered.notices.join(" ")).toMatch(/Shower done/);
    expect(await cash(host)).toBe(hostCash);
    const uses = await pool().query("SELECT count(*) AS n FROM host_home_uses WHERE member_id = $1 AND host_id = $2", [mem.id, host.id]);
    expect(Number(uses.rows[0].n)).toBe(2);

    // A friend visiting without membership can't use anything.
    await cmd(pal.acc, "VisitHome", { characterId: host.id }, T0);
    await expect(cmd(pal.acc, "UseHostHome", { activityId: "shower" }, T0)).rejects.toThrow(/Only household members/);
    expect(await ledgerMatches(mem.acc)).toBe(true);
    expect(await ledgerMatches(host.acc)).toBe(true);
  });

  it("members can never sell or move the owner's furniture, spend the owner's money or read the owner's messages", async () => {
    const host = await player("Hana", INHERITED);
    const mem = await player("Milo");
    const pal = await player("Pat");
    await befriend(host, mem);
    await befriend(host, pal);
    await setPoints(host, mem, 6);
    await cmd(host.acc, "InviteToHousehold", { characterId: mem.id }, T0);
    await cmd(mem.acc, "RespondInvitation", { invitationId: (await fam(mem)).invitations.incoming[0].id, accept: true }, T0);
    await cmd(mem.acc, "VisitHome", { characterId: host.id }, T0);
    await cmd(host.acc, "SendMessage", { characterId: pal.id, body: "Secret plans for Milo's birthday", clientId: `m-${key()}` }, T0);

    const hostFurniture = (await state(host.acc, T0)).furniture;
    const bed = hostFurniture.find((f: any) => f.placed);
    const hostCash = await cash(host);
    await expect(cmd(mem.acc, "SellFurniture", { instanceId: bed.id }, T0)).rejects.toThrow();
    await expect(cmd(mem.acc, "StoreFurniture", { instanceId: bed.id }, T0)).rejects.toThrow();
    await expect(cmd(mem.acc, "PlaceFurniture", { instanceId: bed.id, x: 0, y: 0, rot: 0 }, T0)).rejects.toThrow();
    expect((await state(host.acc, T0)).furniture).toEqual(hostFurniture);

    // Buying uses the buyer's own wallet only.
    const memCash = await cash(mem);
    await cmd(mem.acc, "BuyGroceries", { itemId: "bread", qty: 1 }, T0).catch(() => undefined);
    expect(await cash(host)).toBe(hostCash);
    expect(await cash(mem)).toBeLessThanOrEqual(memCash);

    // The owner's conversation with someone else is invisible to a member.
    const own = (await q(mem, "thread", { id: host.id })).thread;
    expect(own.messages.map((m: any) => m.body)).not.toContain("Secret plans for Milo's birthday");
    const other = (await q(mem, "thread", { id: pal.id })).thread;
    expect(other.messages).toEqual([]);
    const ms = await state(mem.acc, T0);
    expect(JSON.stringify(ms.social.conversations)).not.toContain("Secret plans");
    expect(JSON.stringify(ms.family)).not.toContain("Secret plans");
  });

  it("leaving, removal, caps and blocks", async () => {
    const host = await player("Hana", INHERITED);
    const mem = await player("Milo");
    const other = await player("Ola");
    await befriend(host, mem);
    await befriend(other, mem);
    await befriend(host, other);
    await setPoints(host, mem, 6);
    await setPoints(other, mem, 6);
    await setPoints(host, other, 6);

    await cmd(host.acc, "InviteToHousehold", { characterId: mem.id }, T0);
    await cmd(other.acc, "InviteToHousehold", { characterId: mem.id }, T0);
    const invites = (await fam(mem)).invitations.incoming;
    expect(invites).toHaveLength(2);
    await cmd(mem.acc, "RespondInvitation", { invitationId: invites.find((i: any) => i.hostName === "Hana").id, accept: true }, T0);
    // The other household invitation is withdrawn: one household per person.
    expect((await fam(mem)).invitations.incoming).toEqual([]);
    await expect(cmd(mem.acc, "RespondInvitation", { invitationId: invites.find((i: any) => i.hostName === "Ola").id, accept: true }, T0)).rejects.toThrow(/withdrew/);
    // A member can't start their own household, and a member can't be invited elsewhere.
    await expect(cmd(mem.acc, "InviteToHousehold", { characterId: other.id }, T0)).rejects.toThrow(/member of someone else's household/);
    await expect(cmd(other.acc, "InviteToHousehold", { characterId: mem.id }, T0)).rejects.toThrow(/already part of a household/);
    await expect(cmd(other.acc, "RemoveHouseholdMember", { characterId: mem.id }, T0)).rejects.toThrow(/isn't in your household/);

    await cmd(mem.acc, "LeaveHousehold", {}, T0);
    expect((await fam(host)).household).toBeNull();
    await expect(cmd(mem.acc, "LeaveHousehold", {}, T0)).rejects.toThrow(/not part of anyone's household/);

    await cmd(host.acc, "InviteToHousehold", { characterId: mem.id }, T0);
    await cmd(mem.acc, "RespondInvitation", { invitationId: (await fam(mem)).invitations.incoming[0].id, accept: true }, T0);
    await cmd(mem.acc, "VisitHome", { characterId: host.id }, T0);
    await cmd(host.acc, "RemoveHouseholdMember", { characterId: mem.id }, T0);
    expect((await fam(mem)).household).toBeNull();
    expect((await fam(mem)).hostHome).toBeNull();
    // Removed members lose access at once, even mid-visit.
    await expect(cmd(mem.acc, "UseHostHome", { activityId: "shower" }, T0)).rejects.toThrow(/Only household members/);

    // Block ends membership and any invitation between the two.
    await cmd(host.acc, "InviteToHousehold", { characterId: mem.id }, T0);
    await cmd(mem.acc, "RespondInvitation", { invitationId: (await fam(mem)).invitations.incoming[0].id, accept: true }, T0);
    await cmd(host.acc, "InviteToVisit", { characterId: mem.id }, T0);
    await cmd(mem.acc, "BlockPlayer", { characterId: host.id }, T0);
    const f = await fam(host);
    expect(f.household).toBeNull();
    expect(f.invitations.outgoing).toEqual([]);
  });
});

describe("X · visit invitations: time-limited and revocable", { timeout: 30_000 }, () => {
  it("host invites, guest accepts into a visit, host revokes and the visit ends; expired invites say so", async () => {
    const host = await player("Hana");
    const guest = await player("Gus");
    await befriend(host, guest);
    await cmd(host.acc, "InviteToVisit", { characterId: guest.id }, T0);
    await expect(cmd(host.acc, "InviteToVisit", { characterId: guest.id }, T0)).rejects.toThrow(/already has an invitation/);
    const i = (await fam(guest)).invitations.incoming[0];
    expect(i).toMatchObject({ kind: "visit", hostName: "Hana" });
    await expect(cmd(host.acc, "RespondInvitation", { invitationId: i.id, accept: true }, T0)).rejects.toThrow(/Only the person you invited/);
    await expect(cmd(guest.acc, "RevokeInvitation", { invitationId: i.id }, T0)).rejects.toThrow(/Only the person who sent/);
    await cmd(guest.acc, "RespondInvitation", { invitationId: i.id, accept: true }, T0);
    expect(await openVisit(guest)).toBe(host.id);
    expect((await state(guest.acc, T0)).social.visit.hostName).toBe("Hana");

    await cmd(host.acc, "RevokeInvitation", { invitationId: i.id }, minutes(T0, 2));
    expect(await openVisit(guest)).toBeNull();
    await expect(cmd(guest.acc, "RespondInvitation", { invitationId: i.id, accept: true }, minutes(T0, 3))).rejects.toThrow(/withdrew/);

    // A pending invitation can be revoked before it's answered, and an expired one says why.
    await cmd(host.acc, "InviteToVisit", { characterId: guest.id }, minutes(T0, 5));
    const j = (await fam(guest, minutes(T0, 5))).invitations.incoming[0];
    const late = await cmd(guest.acc, "RespondInvitation", { invitationId: j.id, accept: true }, day(2));
    expect((late.receipt as any).message).toMatch(/expired/);
    expect(await openVisit(guest)).toBeNull();

    // The host can end any visit to their home.
    await cmd(guest.acc, "VisitHome", { characterId: host.id }, day(2));
    await cmd(host.acc, "EndGuestVisit", { characterId: guest.id }, day(2));
    expect(await openVisit(guest)).toBeNull();
    await expect(cmd(host.acc, "EndGuestVisit", { characterId: guest.id }, day(2))).rejects.toThrow(/isn't visiting/);
  });

  it("blocking during a pending invitation removes it; only friends can be invited", async () => {
    const host = await player("Hana");
    const guest = await player("Gus");
    const stranger = await player("Sam");
    await expect(cmd(host.acc, "InviteToVisit", { characterId: stranger.id }, T0)).rejects.toThrow(/need to be friends/);
    await befriend(host, guest);
    await cmd(host.acc, "InviteToVisit", { characterId: guest.id }, T0);
    const i = (await fam(guest)).invitations.incoming[0];
    await cmd(host.acc, "BlockPlayer", { characterId: guest.id }, T0);
    expect((await fam(guest)).invitations.incoming).toEqual([]);
    await expect(cmd(guest.acc, "RespondInvitation", { invitationId: i.id, accept: true }, T0)).rejects.toThrow(/withdrew/);
    expect(await openVisit(guest)).toBeNull();
  });
});

describe("Y · house parties with real players", { timeout: 30_000 }, () => {
  async function partyHost() {
    const host = await player("Hana", INHERITED);
    const bought = await cmd(host.acc, "BuyFurniture", { defId: "party_speakers" }, T0);
    await placeAnywhere(host.acc, (bought.receipt as any).instanceId, T0);
    return host;
  }

  it("opens only after throwing a house party; the ninth guest finds a full house; the reward is paid once", async () => {
    const host = await partyHost();
    const guests: Player[] = [];
    for (let i = 0; i < 9; i++) {
      const g = await player(`Guest${String.fromCharCode(65 + i)}`);
      await befriend(host, g);
      guests.push(g);
    }
    await expect(cmd(host.acc, "InviteToParty", { characterId: guests[0].id }, EVENING)).rejects.toThrow(/Open your party/);
    await expect(cmd(host.acc, "OpenParty", {}, EVENING)).rejects.toThrow(/Throw a house party first/);
    expect((await fam(host, EVENING)).party.canOpen).toBe(false);
    await cmd(host.acc, "StartActivity", { activityId: "house_party" }, EVENING);
    expect((await fam(host, EVENING)).party.canOpen).toBe(true);
    await cmd(host.acc, "OpenParty", {}, EVENING);
    await expect(cmd(host.acc, "OpenParty", {}, EVENING)).rejects.toThrow(/already opened/);

    for (const g of guests) await cmd(host.acc, "InviteToParty", { characterId: g.id }, EVENING);
    await expect(cmd(host.acc, "InviteToParty", { characterId: guests[0].id }, EVENING)).rejects.toThrow(/already invited/);
    const inviteOf = async (g: Player) => (await fam(g, EVENING)).invitations.incoming.find((x: any) => x.kind === "party");

    // The host can't join on a guest's behalf.
    const first = await inviteOf(guests[0]);
    await expect(cmd(host.acc, "JoinParty", { invitationId: first.id }, EVENING)).rejects.toThrow(/Only the person you invited/);

    const social0 = (await state(guests[0].acc, EVENING)).needs.social;
    for (const g of guests.slice(0, 8)) await cmd(g.acc, "JoinParty", { invitationId: (await inviteOf(g)).id }, EVENING);
    const s0 = await state(guests[0].acc, EVENING);
    expect(s0.needs.social).toBeGreaterThanOrEqual(Math.min(100, social0 + PARTY_GUEST_REWARD.social - 1));
    expect(s0.moodlets.some((m: any) => m.id === "good_company")).toBe(true);
    expect(s0.social.visit.hostName).toBe("Hana");

    // Guest nine: the party is full and nothing about them changes.
    const ninth = guests[8];
    const before = await state(ninth.acc, EVENING);
    await expect(cmd(ninth.acc, "JoinParty", { invitationId: (await inviteOf(ninth)).id }, EVENING)).rejects.toThrow(/full: 8 guests/);
    expect(await openVisit(ninth)).toBeNull();
    expect((await state(ninth.acc, EVENING)).needs.social).toBeCloseTo(before.needs.social, 0);
    const p = (await fam(host, EVENING)).party.open;
    expect(p.guestCount).toBe(PARTY_GUEST_CAP);
    expect(p.guests).toHaveLength(8);

    // Reconnecting: a guest who leaves can rejoin, but the bonus isn't paid twice.
    await cmd(guests[0].acc, "LeaveVisit", {}, minutes(EVENING, 1));
    const again = await cmd(guests[0].acc, "JoinParty", { invitationId: first.id }, minutes(EVENING, 2));
    expect((again.receipt as any).message).toMatch(/once per party/);
    expect(await openVisit(guests[0])).toBe(host.id);
    expect((await pool().query("SELECT count(*) AS n FROM party_guests")).rows[0].n).toBe("8");
    const events = await pool().query("SELECT count(*) AS n FROM game_events WHERE character_id = $1 AND type = 'player_party_joined'", [guests[0].id]);
    expect(Number(events.rows[0].n)).toBe(1);

    // Ending the party sends guests home and closes the door.
    await cmd(host.acc, "EndParty", {}, minutes(EVENING, 3));
    expect(await openVisit(guests[1])).toBeNull();
    await expect(cmd(guests[1].acc, "JoinParty", { invitationId: (await pool().query("SELECT id FROM invitations WHERE guest_id = $1", [guests[1].id])).rows[0].id }, minutes(EVENING, 4))).rejects.toThrow(/party is over/);
  });

  it("nine guests joining at the same moment: exactly eight get in", async () => {
    const host = await partyHost();
    const guests: Player[] = [];
    for (let i = 0; i < 9; i++) {
      const g = await player(`Racer${String.fromCharCode(65 + i)}`);
      await befriend(host, g);
      guests.push(g);
    }
    await cmd(host.acc, "StartActivity", { activityId: "house_party" }, EVENING);
    await cmd(host.acc, "OpenParty", {}, EVENING);
    const ids: string[] = [];
    for (const g of guests) {
      await cmd(host.acc, "InviteToParty", { characterId: g.id }, EVENING);
      ids.push((await fam(g, EVENING)).invitations.incoming[0].id);
    }
    const results = await Promise.allSettled(guests.map((g, i) => cmd(g.acc, "JoinParty", { invitationId: ids[i] }, EVENING)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(8);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0].reason.message)).toMatch(/full/);
    const row = (await pool().query("SELECT guest_count FROM player_parties")).rows[0];
    expect(row.guest_count).toBe(8);
    expect(Number((await pool().query("SELECT count(*) AS n FROM party_guests")).rows[0].n)).toBe(8);
  });

  it("revoked or declined invitations can't join; a partner gets a relationship bonus once", async () => {
    const host = await partyHost();
    const love = await player("Lou");
    const pal = await player("Pat");
    await befriend(host, love);
    await befriend(host, pal);
    await setPoints(host, love, 20);
    await cmd(love.acc, "AskToDate", { characterId: host.id }, T0);
    await cmd(host.acc, "RespondRomance", { requestId: (await fam(host)).romanceRequests.incoming[0].id, accept: true }, T0);

    await cmd(host.acc, "StartActivity", { activityId: "house_party" }, EVENING);
    await cmd(host.acc, "OpenParty", {}, EVENING);
    await cmd(host.acc, "InviteToParty", { characterId: love.id }, EVENING);
    await cmd(host.acc, "InviteToParty", { characterId: pal.id }, EVENING);
    const palInv = (await fam(pal, EVENING)).invitations.incoming[0];
    await cmd(host.acc, "RevokeInvitation", { invitationId: palInv.id }, EVENING);
    await expect(cmd(pal.acc, "JoinParty", { invitationId: palInv.id }, EVENING)).rejects.toThrow(/withdrew/);

    const loveInv = (await fam(love, EVENING)).invitations.incoming[0];
    // RSVP first, then join from anywhere.
    await cmd(love.acc, "RespondInvitation", { invitationId: loveInv.id, accept: true }, EVENING);
    const v0 = (await fam(love, EVENING)).romance.value;
    await cmd(love.acc, "JoinParty", { invitationId: loveInv.id }, EVENING);
    expect((await fam(love, EVENING)).romance.value).toBe(v0 + ROMANCE_PARTY_BONUS);
    await cmd(love.acc, "LeaveVisit", {}, minutes(EVENING, 1));
    await cmd(love.acc, "JoinParty", { invitationId: loveInv.id }, minutes(EVENING, 2));
    expect((await fam(love, EVENING)).romance.value).toBe(v0 + ROMANCE_PARTY_BONUS);

    // After the party's scheduled finish, nobody can join.
    const late = await player("Late");
    await befriend(host, late);
    await cmd(host.acc, "InviteToParty", { characterId: late.id }, minutes(EVENING, 3));
    const lateInv = (await fam(late, minutes(EVENING, 3))).invitations.incoming[0];
    await expect(cmd(late.acc, "JoinParty", { invitationId: lateInv.id }, minutes(EVENING, 61))).rejects.toThrow(/party is over/);
  });
});
