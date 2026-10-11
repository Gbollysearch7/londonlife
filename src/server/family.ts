import crypto from "node:crypto";
import {
  DATE_MIN_POINTS,
  DATE_MIN_TITLE,
  HOST_HOME_ACTIVITY,
  HOUSEHOLD_INVITE_DAYS,
  HOUSEHOLD_MAX_MEMBERS,
  HOUSEHOLD_MIN_POINTS,
  HOUSEHOLD_MIN_TITLE,
  MAX_ROMANCES,
  NOT_BUILT,
  PARTNER_MIN_VALUE,
  PARTY_GUEST_CAP,
  PARTY_GUEST_REWARD,
  PLAYER_PARTY_MINUTES,
  ROMANCE_MAX_VALUE,
  ROMANCE_PARTY_BONUS,
  ROMANCE_REASK_DAYS,
  ROMANCE_REQUEST_DAYS,
  VISIT_INVITE_MINUTES,
  romanceStage,
} from "@/content/family";
import { PARTY_IDS } from "@/content/household";
import { VISIT_CAPACITY, VISIT_MINUTES } from "@/content/social";
import { policyActivityCost } from "@/content/civic";
import type { ActivityDef } from "@/content/types";
import { ACTIVITIES, activityDef } from "@/content/world";
import { applyEffects } from "@/sim/needs";
import { durationMs, londonDayKey } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { activityBlocker, changeItems, emit, homeContext, loadCtx, moveMoney, requireCharacter, saveNeeds, settle, type CharRow, type Ctx } from "./game";
import { grantMoodlet } from "./goals";

/**
 * Relationships, households and invitations between real players (spec ch. 19).
 * Consent: every tie (dating, partners, household, visit, party) is created only by the invited
 * person's own command. A host's permissions never extend to a guest's account and vice versa:
 * household members use the owner's appliances with their own groceries and wallet, and every other
 * command (furniture, money, staff, messages) acts only on the caller's own character.
 */

const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
const clockOf = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

interface Other {
  id: string;
  account_id: string;
  name: string;
  created_at: Date;
}

async function otherPlayer(tx: Tx, me: CharRow, id: unknown): Promise<Other> {
  if (typeof id !== "string" || !UUID.test(id)) throw new GameError("no_player", "That player couldn't be found.");
  if (id === me.id) throw new GameError("self", "That's you!");
  const r = await tx.query("SELECT id, account_id, name, created_at FROM characters WHERE id = $1", [id]);
  if (!r.rowCount) throw new GameError("no_player", "That player couldn't be found.");
  return r.rows[0] as Other;
}

async function playerById(tx: Tx, id: string): Promise<Other> {
  return (await tx.query("SELECT id, account_id, name, created_at FROM characters WHERE id = $1", [id])).rows[0] as Other;
}

/** Locks the caller's and the other character's rows in id order, so two players acting on each other can't deadlock. */
async function lockPair(tx: Tx, accountId: string, otherId: unknown) {
  const mine = await tx.query("SELECT id FROM characters WHERE account_id = $1", [accountId]);
  if (!mine.rowCount) throw new GameError("no_character", "Create your character first.", 409);
  if (typeof otherId === "string" && UUID.test(otherId)) await tx.query("SELECT id FROM characters WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [[mine.rows[0].id, otherId]]);
}

async function requireNoBlock(tx: Tx, me: string, other: string) {
  const r = await tx.query("SELECT blocker_id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)", [me, other]);
  if (r.rows.some((b) => b.blocker_id === me)) throw new GameError("blocked", "You've blocked this player. Unblock them first.");
  if (r.rowCount) throw new GameError("unavailable", "This player isn't accepting contact.");
}

async function friendPoints(tx: Tx, x: string, y: string): Promise<number | null> {
  const [a, b] = pair(x, y);
  const r = (await tx.query("SELECT points FROM friendships WHERE a_id = $1 AND b_id = $2", [a, b])).rows[0];
  return r ? Number(r.points) : null;
}

async function requireFriends(tx: Tx, me: CharRow, other: Other) {
  await requireNoBlock(tx, me.id, other.id);
  const pts = await friendPoints(tx, me.id, other.id);
  if (pts === null) throw new GameError("not_friends", `You and ${other.name} need to be friends first.`);
  return pts;
}

// ───────────────────────────── romance ─────────────────────────────

interface RomanceRow {
  a_id: string;
  b_id: string;
  status: "dating" | "partnered";
  base_points: number;
  bonus: number;
  started_at: Date;
  partnered_at: Date | null;
}

async function romanceOf(tx: Tx, charId: string): Promise<RomanceRow | null> {
  return ((await tx.query("SELECT * FROM romances WHERE a_id = $1 OR b_id = $1", [charId])).rows[0] as RomanceRow) ?? null;
}

async function romanceBetween(tx: Tx, x: string, y: string): Promise<RomanceRow | null> {
  const [a, b] = pair(x, y);
  return ((await tx.query("SELECT * FROM romances WHERE a_id = $1 AND b_id = $2", [a, b])).rows[0] as RomanceRow) ?? null;
}

/** Relationship value: friendship points earned together since the romance began, plus shared-party bonuses. */
export function romanceValue(r: { base_points: number; bonus: number }, friendshipPoints: number) {
  return Math.max(0, Math.min(ROMANCE_MAX_VALUE, friendshipPoints - Number(r.base_points) + Number(r.bonus)));
}

async function countRomances(tx: Tx, charId: string) {
  return Number((await tx.query("SELECT count(*) AS n FROM romances WHERE a_id = $1 OR b_id = $1", [charId])).rows[0].n);
}

async function expireFamily(tx: Tx, charId: string, now: Date) {
  await tx.query("UPDATE romance_requests SET status = 'expired', resolved_at = expires_at WHERE status = 'pending' AND expires_at <= $2 AND (from_id = $1 OR to_id = $1)", [charId, now]);
  await tx.query("UPDATE invitations SET status = 'expired', resolved_at = expires_at WHERE status = 'pending' AND expires_at <= $2 AND (host_id = $1 OR guest_id = $1)", [charId, now]);
}

/**
 * Called when two people stop being friends (unfriend, block or report-and-block): any romance,
 * romance request, shared household and invitation between them ends at once.
 */
export async function endFamilyTies(tx: Tx, x: string, y: string, now: Date) {
  const [a, b] = pair(x, y);
  await tx.query("DELETE FROM romances WHERE a_id = $1 AND b_id = $2", [a, b]);
  await tx.query("UPDATE romance_requests SET status = 'cancelled', resolved_at = $3 WHERE status = 'pending' AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))", [x, y, now]);
  await tx.query("DELETE FROM household_members WHERE (member_id = $1 AND owner_id = $2) OR (member_id = $2 AND owner_id = $1)", [x, y]);
  await tx.query(
    "UPDATE invitations SET status = 'revoked', resolved_at = $3 WHERE status IN ('pending', 'accepted') AND ((host_id = $1 AND guest_id = $2) OR (host_id = $2 AND guest_id = $1))",
    [x, y, now],
  );
}

async function romanceGate(tx: Tx, c: CharRow, other: Other) {
  if ((await countRomances(tx, c.id)) >= MAX_ROMANCES) {
    const mine = (await romanceOf(tx, c.id))!;
    const partner = await playerById(tx, mine.a_id === c.id ? mine.b_id : mine.a_id);
    throw new GameError("taken", `You're already ${mine.status === "partnered" ? "partnered with" : "dating"} ${partner.name}. End that first if you'd like to move on.`);
  }
  if ((await countRomances(tx, other.id)) >= MAX_ROMANCES) throw new GameError("unavailable", `${other.name} isn't available for a relationship right now.`);
}

async function createRomanceRequest(tx: Tx, accountId: string, characterId: unknown, kind: "date" | "partner", now: Date) {
  await lockPair(tx, accountId, characterId);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, characterId);
  const pts = await requireFriends(tx, c, other);
  await expireFamily(tx, c.id, now);
  const together = await romanceBetween(tx, c.id, other.id);
  if (kind === "date") {
    if (together) throw new GameError("already_together", `You and ${other.name} are already ${together.status === "partnered" ? "partners" : "dating"}.`);
    if (pts < DATE_MIN_POINTS) throw new GameError("not_close", `You and ${other.name} need to be ${DATE_MIN_TITLE}s first (${pts}/${DATE_MIN_POINTS} friendship). Spend days together: messages, gifts and visits.`);
    await romanceGate(tx, c, other);
  } else {
    if (!together) throw new GameError("not_dating", `You and ${other.name} need to be dating before becoming partners.`);
    if (together.status === "partnered") throw new GameError("already_partners", `You and ${other.name} are already partners.`);
    const value = romanceValue(together, pts);
    if (value < PARTNER_MIN_VALUE) throw new GameError("not_close", `Your relationship needs to grow a little first (${value}/${PARTNER_MIN_VALUE}). Spend days together.`);
  }
  const label = kind === "date" ? "to date" : "to be partners";
  const pending = (
    await tx.query("SELECT * FROM romance_requests WHERE status = 'pending' AND kind = $3 AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)) FOR UPDATE", [c.id, other.id, kind])
  ).rows[0];
  if (pending?.from_id === c.id) throw new GameError("already_sent", `You've already asked ${other.name} ${label}. They can accept or decline.`);
  if (pending) {
    // They asked first: asking back is this person's own consent, so it accepts their request.
    await tx.query("UPDATE romance_requests SET status = 'accepted', resolved_at = $2 WHERE id = $1", [pending.id, now]);
    return { message: await applyRomance(tx, c, other, kind, pts, now, `${other.name} had already asked you. `) };
  }
  const declined = await tx.query("SELECT 1 FROM romance_requests WHERE from_id = $1 AND to_id = $2 AND kind = $3 AND status = 'declined' AND resolved_at > $4 LIMIT 1", [
    c.id,
    other.id,
    kind,
    new Date(now.getTime() - ROMANCE_REASK_DAYS * DAY_MS),
  ]);
  if (declined.rowCount) throw new GameError("cooldown", `${other.name} said no recently. Give it a few days.`);
  await tx.query("INSERT INTO romance_requests (from_id, to_id, kind, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)", [
    c.id,
    other.id,
    kind,
    now,
    new Date(now.getTime() + ROMANCE_REQUEST_DAYS * DAY_MS),
  ]);
  return { message: `You asked ${other.name} ${label}. Nothing changes unless they say yes; it lasts ${ROMANCE_REQUEST_DAYS} days.` };
}

async function applyRomance(tx: Tx, c: CharRow, other: Other, kind: "date" | "partner", pts: number, now: Date, prefix = "") {
  const [a, b] = pair(c.id, other.id);
  if (kind === "date") {
    await tx.query("INSERT INTO romances (a_id, b_id, status, base_points, started_at) VALUES ($1, $2, 'dating', $3, $4)", [a, b, pts, now]);
    // Any other date requests either of them had waiting no longer make sense.
    await tx.query(
      "UPDATE romance_requests SET status = 'cancelled', resolved_at = $2 WHERE status = 'pending' AND kind = 'date' AND (from_id = ANY($1::uuid[]) OR to_id = ANY($1::uuid[]))",
      [[c.id, other.id], now],
    );
    await emit(tx, c.id, "romance_started", {}, now);
    await emit(tx, other.id, "romance_started", {}, now);
    return `${prefix}You and ${other.name} are now dating.`;
  }
  await tx.query("UPDATE romances SET status = 'partnered', partnered_at = $3 WHERE a_id = $1 AND b_id = $2", [a, b, now]);
  await emit(tx, c.id, "partnered", {}, now);
  await emit(tx, other.id, "partnered", {}, now);
  return `${prefix}You and ${other.name} are now partners.`;
}

export async function askToDate(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  return createRomanceRequest(tx, accountId, p.characterId, "date", now);
}

export async function proposePartnership(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  return createRomanceRequest(tx, accountId, p.characterId, "partner", now);
}

async function peekRomanceRequest(tx: Tx, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new GameError("no_request", "That request couldn't be found.");
  const r = (await tx.query("SELECT from_id, to_id FROM romance_requests WHERE id = $1", [id])).rows[0];
  if (!r) throw new GameError("no_request", "That request couldn't be found.");
  return r as { from_id: string; to_id: string };
}

export async function respondRomance(tx: Tx, accountId: string, p: { requestId: string; accept: boolean }, now: Date) {
  const peek = await peekRomanceRequest(tx, p.requestId);
  const mine = (await tx.query("SELECT id FROM characters WHERE account_id = $1", [accountId])).rows[0];
  if (mine) await lockPair(tx, accountId, mine.id === peek.from_id ? peek.to_id : peek.from_id);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const req = (await tx.query("SELECT * FROM romance_requests WHERE id = $1 FOR UPDATE", [p.requestId])).rows[0];
  // Consent: only the person who was asked can answer. The asker can only withdraw.
  if (req.from_id === c.id) throw new GameError("not_recipient", "Only the person you asked can say yes or no. You can withdraw it instead.");
  if (req.to_id !== c.id) throw new GameError("no_request", "That request couldn't be found.");
  if (req.status === "pending" && new Date(req.expires_at) <= now) {
    await tx.query("UPDATE romance_requests SET status = 'expired', resolved_at = expires_at WHERE id = $1", [req.id]);
    return { message: "That request had expired. You can ask them yourself if you like." };
  }
  if (req.status !== "pending") throw new GameError("not_pending", `That request was already ${req.status}.`);
  const other = await playerById(tx, req.from_id);
  if (!p.accept) {
    await tx.query("UPDATE romance_requests SET status = 'declined', resolved_at = $2 WHERE id = $1", [req.id, now]);
    return { message: `You said no to ${other.name}. Nothing else changes between you.` };
  }
  const pts = await requireFriends(tx, c, other);
  const together = await romanceBetween(tx, c.id, other.id);
  if (req.kind === "date") {
    if (together) throw new GameError("already_together", `You and ${other.name} are already together.`);
    await romanceGate(tx, c, other);
  } else if (!together || together.status !== "dating") throw new GameError("not_dating", `You and ${other.name} aren't dating any more.`);
  await tx.query("UPDATE romance_requests SET status = 'accepted', resolved_at = $2 WHERE id = $1", [req.id, now]);
  return { message: await applyRomance(tx, c, other, req.kind, pts, now) };
}

export async function withdrawRomance(tx: Tx, accountId: string, p: { requestId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  await peekRomanceRequest(tx, p.requestId);
  const req = (await tx.query("SELECT * FROM romance_requests WHERE id = $1 FOR UPDATE", [p.requestId])).rows[0];
  if (req.from_id !== c.id) throw new GameError("not_sender", "Only the person who asked can withdraw it.");
  if (req.status !== "pending") throw new GameError("not_pending", `That request was already ${req.status}.`);
  await tx.query("UPDATE romance_requests SET status = 'withdrawn', resolved_at = $2 WHERE id = $1", [req.id, now]);
  return { message: "Request withdrawn." };
}

/** Either person can end it, after a clear confirmation. The only effect is the status change: you stay friends. */
export async function endRelationship(tx: Tx, accountId: string, p: { characterId: string; confirm?: boolean }, now: Date) {
  await lockPair(tx, accountId, p.characterId);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  const r = await romanceBetween(tx, c.id, other.id);
  if (!r) throw new GameError("not_together", `You and ${other.name} aren't in a relationship.`);
  const what = r.status === "partnered" ? "partners" : "dating";
  if (p.confirm !== true) throw new GameError("confirm_needed", `Please confirm: stop being ${what} with ${other.name}? You'll still be friends; nothing else changes.`);
  const [a, b] = pair(c.id, other.id);
  await tx.query("DELETE FROM romances WHERE a_id = $1 AND b_id = $2", [a, b]);
  await tx.query("UPDATE romance_requests SET status = 'cancelled', resolved_at = $3 WHERE status = 'pending' AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))", [c.id, other.id, now]);
  await emit(tx, c.id, "romance_ended", {}, now);
  return { message: `You and ${other.name} are no longer ${what}. You're still friends, and nothing else has changed.` };
}

// ───────────────────────────── visits (shared helper) ─────────────────────────────

/** Starts a bounded visit to `host`'s home. The host row must already be locked (it is the capacity lock). */
async function startVisit(tx: Tx, c: CharRow, host: Other, now: Date, until?: Date) {
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "You're travelling. Try again when you arrive.");
  if (ctx.shift) throw new GameError("on_shift", "You're on shift. Go after work.");
  if (ctx.running) throw new GameError("busy", "Finish or cancel what you're doing first.");
  await tx.query("UPDATE home_visits SET ended_at = ends_at WHERE host_id = $1 AND ended_at IS NULL AND ends_at <= $2", [host.id, now]);
  await tx.query("UPDATE home_visits SET ended_at = $2 WHERE guest_id = $1 AND ended_at IS NULL", [c.id, now]);
  const guests = Number((await tx.query("SELECT count(*) AS n FROM home_visits WHERE host_id = $1 AND ended_at IS NULL", [host.id])).rows[0].n);
  if (guests >= VISIT_CAPACITY) throw new GameError("full_house", `${host.name}'s home already has ${VISIT_CAPACITY} guests. Try again a bit later.`);
  const standard = new Date(now.getTime() + durationMs(VISIT_MINUTES));
  const ends = until && until < standard ? until : standard;
  const v = await tx.query("INSERT INTO home_visits (guest_id, host_id, started_at, ends_at) VALUES ($1, $2, $3, $4) RETURNING id", [c.id, host.id, now, ends]);
  await emit(tx, c.id, "visited_friend", {}, now);
  return v.rows[0].id as string;
}

/** The host ends a guest's visit (any visit to their home). */
export async function endGuestVisit(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  const r = await tx.query("UPDATE home_visits SET ended_at = $3 WHERE host_id = $1 AND guest_id = $2 AND ended_at IS NULL RETURNING id", [c.id, other.id, now]);
  if (!r.rowCount) throw new GameError("not_visiting", `${other.name} isn't visiting you.`);
  return { message: `You asked ${other.name} to head home. Their visit has ended.` };
}

// ───────────────────────────── invitations ─────────────────────────────

const MAX_PENDING_INVITES = 20;

async function requirePendingRoom(tx: Tx, hostId: string) {
  const n = Number((await tx.query("SELECT count(*) AS n FROM invitations WHERE host_id = $1 AND status = 'pending'", [hostId])).rows[0].n);
  if (n >= MAX_PENDING_INVITES) throw new GameError("too_many", `You have ${MAX_PENDING_INVITES} invitations waiting. Revoke some or wait for answers.`);
}

export async function inviteToVisit(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  await requireFriends(tx, c, other);
  await expireFamily(tx, c.id, now);
  await requirePendingRoom(tx, c.id);
  const expires = new Date(now.getTime() + durationMs(VISIT_INVITE_MINUTES));
  const ins = await tx.query(
    "INSERT INTO invitations (kind, host_id, guest_id, created_at, expires_at) VALUES ('visit', $1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id",
    [c.id, other.id, now, expires],
  );
  if (!ins.rowCount) throw new GameError("already_invited", `${other.name} already has an invitation from you. You can revoke it from Invitations.`);
  return { message: `Invited ${other.name} round. The invitation lasts until ${clockOf(expires)} and you can revoke it any time.` };
}

/** Who owns the household `charId` belongs to (themselves if they own one with members). */
async function membershipOf(tx: Tx, charId: string) {
  return ((await tx.query("SELECT owner_id, joined_at FROM household_members WHERE member_id = $1", [charId])).rows[0] as { owner_id: string; joined_at: Date }) ?? null;
}

async function memberCount(tx: Tx, ownerId: string) {
  return Number((await tx.query("SELECT count(*) AS n FROM household_members WHERE owner_id = $1", [ownerId])).rows[0].n);
}

async function householdGate(tx: Tx, owner: CharRow | Other, guest: Other | CharRow, pts: number) {
  if (await membershipOf(tx, owner.id)) throw new GameError("is_member", "You're a member of someone else's household. Leave it before inviting people to yours.");
  if (await membershipOf(tx, guest.id)) throw new GameError("in_household", `${guest.name} is already part of a household.`);
  if ((await memberCount(tx, guest.id)) > 0) throw new GameError("has_household", `${guest.name} already runs their own household.`);
  if ((await memberCount(tx, owner.id)) >= HOUSEHOLD_MAX_MEMBERS) throw new GameError("household_full", `A household can have up to ${HOUSEHOLD_MAX_MEMBERS} members besides the owner.`);
  const romantic = !!(await romanceBetween(tx, owner.id, guest.id));
  if (!romantic && pts < HOUSEHOLD_MIN_POINTS) throw new GameError("not_close", `You need to be at least ${HOUSEHOLD_MIN_TITLE}s (${pts}/${HOUSEHOLD_MIN_POINTS}) or a couple to share a household.`);
}

export async function inviteToHousehold(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  await lockPair(tx, accountId, p.characterId);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  const pts = await requireFriends(tx, c, other);
  await expireFamily(tx, c.id, now);
  await householdGate(tx, c, other, pts);
  await requirePendingRoom(tx, c.id);
  const ins = await tx.query(
    "INSERT INTO invitations (kind, host_id, guest_id, created_at, expires_at) VALUES ('household', $1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id",
    [c.id, other.id, now, new Date(now.getTime() + HOUSEHOLD_INVITE_DAYS * DAY_MS)],
  );
  if (!ins.rowCount) throw new GameError("already_invited", `You've already invited ${other.name} to your household.`);
  return {
    message: `Asked ${other.name} to join your household. If they accept, they can cook with their own groceries, sleep and shower at yours — never sell or move your things, spend your money or read your messages.`,
  };
}

async function peekInvitation(tx: Tx, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new GameError("no_invitation", "That invitation couldn't be found.");
  const r = (await tx.query("SELECT host_id, guest_id FROM invitations WHERE id = $1", [id])).rows[0];
  if (!r) throw new GameError("no_invitation", "That invitation couldn't be found.");
  return r as { host_id: string; guest_id: string };
}

/** Locks both people, then the invitation, and checks the caller is the invited guest. */
async function lockInvitationAsGuest(tx: Tx, accountId: string, id: unknown, now: Date) {
  const peek = await peekInvitation(tx, id);
  const mine = (await tx.query("SELECT id FROM characters WHERE account_id = $1", [accountId])).rows[0];
  if (mine) await lockPair(tx, accountId, mine.id === peek.host_id ? peek.guest_id : peek.host_id);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const inv = (await tx.query("SELECT * FROM invitations WHERE id = $1 FOR UPDATE", [id])).rows[0];
  // Consent: only the invited person can accept or join; the host can only revoke.
  if (inv.host_id === c.id) throw new GameError("not_guest", "Only the person you invited can accept. You can revoke it instead.");
  if (inv.guest_id !== c.id) throw new GameError("no_invitation", "That invitation couldn't be found.");
  return { c, inv, host: await playerById(tx, inv.host_id) };
}

const KIND_NAME: Record<string, string> = { visit: "visit", household: "household", party: "party" };

export async function respondInvitation(tx: Tx, accountId: string, p: { invitationId: string; accept: boolean }, now: Date) {
  const { c, inv, host } = await lockInvitationAsGuest(tx, accountId, p.invitationId, now);
  if (inv.status === "pending" && new Date(inv.expires_at) <= now) {
    await tx.query("UPDATE invitations SET status = 'expired', resolved_at = expires_at WHERE id = $1", [inv.id]);
    return { message: `That ${KIND_NAME[inv.kind]} invitation from ${host.name} had expired.` };
  }
  if (inv.status === "revoked") throw new GameError("revoked", `${host.name} withdrew that invitation.`);
  if (inv.status !== "pending") throw new GameError("not_pending", `That invitation was already ${inv.status}.`);
  if (!p.accept) {
    await tx.query("UPDATE invitations SET status = 'declined', resolved_at = $2 WHERE id = $1", [inv.id, now]);
    return { message: `Declined ${host.name}'s ${KIND_NAME[inv.kind]} invitation.` };
  }
  const pts = await requireFriends(tx, c, host);
  if (inv.kind === "visit") {
    const visitId = await startVisit(tx, c, host, now);
    await tx.query("UPDATE invitations SET status = 'accepted', resolved_at = $2, visit_id = $3 WHERE id = $1", [inv.id, now, visitId]);
    return { message: `You popped round to ${host.name}'s home at their invitation.` };
  }
  if (inv.kind === "household") {
    await householdGate(tx, host, c, pts);
    const ins = await tx.query("INSERT INTO household_members (member_id, owner_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [c.id, host.id, now]);
    if (!ins.rowCount) throw new GameError("in_household", "You're already part of a household.");
    await tx.query("UPDATE invitations SET status = 'accepted', resolved_at = $2 WHERE id = $1", [inv.id, now]);
    await tx.query("UPDATE invitations SET status = 'revoked', resolved_at = $2 WHERE kind = 'household' AND guest_id = $1 AND status = 'pending'", [c.id, now]);
    await emit(tx, c.id, "household_joined", {}, now);
    return { message: `You've joined ${host.name}'s household. Visit them to cook with your own groceries, sleep or shower there.` };
  }
  const party = (await tx.query("SELECT * FROM player_parties WHERE id = $1", [inv.party_id])).rows[0];
  if (party.ended_at || new Date(party.ends_at) <= now) throw new GameError("party_over", `${host.name}'s party is over.`);
  await tx.query("UPDATE invitations SET status = 'accepted', resolved_at = $2 WHERE id = $1", [inv.id, now]);
  return { message: `You're on the list for ${host.name}'s party. Join from Invitations any time before ${clockOf(new Date(party.ends_at))}.` };
}

export async function revokeInvitation(tx: Tx, accountId: string, p: { invitationId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  await peekInvitation(tx, p.invitationId);
  const inv = (await tx.query("SELECT * FROM invitations WHERE id = $1 FOR UPDATE", [p.invitationId])).rows[0];
  if (inv.host_id !== c.id) throw new GameError("not_host", "Only the person who sent an invitation can revoke it.");
  if (inv.kind === "household" && inv.status === "accepted") throw new GameError("use_remove", "They've already joined. Remove them from the household instead.");
  if (inv.status !== "pending" && inv.status !== "accepted") throw new GameError("not_active", `That invitation was already ${inv.status}.`);
  await tx.query("UPDATE invitations SET status = 'revoked', resolved_at = $2 WHERE id = $1", [inv.id, now]);
  const guest = await playerById(tx, inv.guest_id);
  let ended = false;
  if (inv.status === "accepted") {
    // An invitation is not indefinite permission: revoking it ends the visit it opened.
    const r = await tx.query("UPDATE home_visits SET ended_at = $3 WHERE host_id = $1 AND guest_id = $2 AND ended_at IS NULL RETURNING id", [c.id, guest.id, now]);
    ended = !!r.rowCount;
  }
  return { message: `Invitation to ${guest.name} revoked${ended ? " and their visit has ended" : ""}.` };
}

// ───────────────────────────── households ─────────────────────────────

export async function leaveHousehold(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const r = await tx.query("DELETE FROM household_members WHERE member_id = $1 RETURNING owner_id", [c.id]);
  if (!r.rowCount) throw new GameError("not_member", "You're not part of anyone's household.");
  const owner = await playerById(tx, r.rows[0].owner_id);
  return { message: `You've left ${owner.name}'s household. You're still friends.` };
}

export async function removeHouseholdMember(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  const r = await tx.query("DELETE FROM household_members WHERE owner_id = $1 AND member_id = $2", [c.id, other.id]);
  if (!r.rowCount) throw new GameError("not_member", `${other.name} isn't in your household.`);
  return { message: `${other.name} is no longer part of your household. You're still friends.` };
}

/** Where a household member is right now: visiting the owner's home, or not. */
async function hostVisit(tx: Tx, c: CharRow, now: Date) {
  const m = await membershipOf(tx, c.id);
  if (!m) return null;
  const owner = await playerById(tx, m.owner_id);
  const v = (await tx.query("SELECT id FROM home_visits WHERE guest_id = $1 AND host_id = $2 AND ended_at IS NULL AND ends_at > $3", [c.id, owner.id, now])).rows[0];
  return { owner, visiting: !!v };
}

/** "Can a member do this at the owner's home?": the owner's furniture and outages, the member's own needs, groceries and wallet. */
function hostHomeBlocker(def: ActivityDef, ctx: Ctx, hostHome: Ctx["home"], owner: Other) {
  if (!HOST_HOME_ACTIVITY(def.id)) return `Household members can cook, sleep, shower and use the bathroom at ${owner.name}'s — not that.`;
  const asGuest: Ctx = { ...ctx, home: hostHome, c: { ...ctx.c, id: owner.id, created_at: owner.created_at, location: "home" } };
  const b = activityBlocker(def, asGuest);
  return b ? b.replace("placed at home", `in ${owner.name}'s home`) : null;
}

const hostMinutes = (def: ActivityDef, hostHome: Ctx["home"]) => (def.id.startsWith("cook_") && hostHome.hasCooker ? Math.round(def.minutes * 0.7 * 10) / 10 : def.minutes);

export async function useHostHome(tx: Tx, accountId: string, p: { activityId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const hv = await hostVisit(tx, c, now);
  if (!hv) throw new GameError("not_member", "Only household members can use someone else's home.");
  if (!hv.visiting) throw new GameError("not_there", `Visit ${hv.owner.name}'s home first (People → Players → Visit).`);
  const def = activityDef(String(p.activityId ?? ""));
  if (!def) throw new GameError("unknown_activity", "That activity doesn't exist.");
  const ctx = await loadCtx(tx, c, now);
  const hostHome = await homeContext(tx, { id: hv.owner.id } as CharRow);
  const blocker = hostHomeBlocker(def, ctx, hostHome, hv.owner);
  if (blocker) throw new GameError("blocked", blocker);
  const id = crypto.randomUUID();
  // The member's own wallet and cupboard only: the owner's money and groceries are never touched.
  const cost = policyActivityCost(ctx.policy, def, now);
  await moveMoney(tx, c, -cost, "spend", `${def.label} at ${hv.owner.name}'s`, { type: "activity", id });
  if (def.consumes) await changeItems(tx, c.id, def.consumes, -1);
  await tx.query(
    `INSERT INTO activities (id, character_id, def_id, location, status, started_at, ends_at, cost_pence, period_key)
     VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8)`,
    [id, c.id, def.id, c.location, now, new Date(now.getTime() + durationMs(hostMinutes(def, hostHome))), cost, londonDayKey(now)],
  );
  await tx.query("INSERT INTO host_home_uses (activity_id, member_id, host_id, created_at) VALUES ($1, $2, $3, $4)", [id, c.id, hv.owner.id, now]);
  return { message: `${def.label} at ${hv.owner.name}'s home started${def.consumes ? " (with your own groceries)" : ""}.` };
}

// ───────────────────────────── parties with real players ─────────────────────────────

async function openPartyOf(tx: Tx, hostId: string, now: Date, lock = false) {
  return (await tx.query(`SELECT * FROM player_parties WHERE host_id = $1 AND ended_at IS NULL AND ends_at > $2 ORDER BY started_at DESC LIMIT 1${lock ? " FOR UPDATE" : ""}`, [hostId, now])).rows[0] ?? null;
}

function partyBlocker(ctx: Ctx): string | null {
  if (ctx.journey) return "You're travelling. Open the party when you're home.";
  if (ctx.c.location !== "home") return "You need to be at home to host.";
  if (!ctx.home.tags.has("speakers")) return "Place party speakers at home first.";
  if (PARTY_IDS.reduce((n, id) => n + (ctx.todayCounts[id] ?? 0), 0) < 1) return "Throw a house party first (tap your speakers), then open it to friends.";
  return null;
}

export async function openParty(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const ctx = await loadCtx(tx, c, now);
  const blocker = partyBlocker(ctx);
  if (blocker) throw new GameError("blocked", blocker);
  const ends = new Date(now.getTime() + durationMs(PLAYER_PARTY_MINUTES));
  const ins = await tx.query(
    "INSERT INTO player_parties (host_id, day_key, started_at, ends_at, capacity) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (host_id, day_key) DO NOTHING RETURNING id",
    [c.id, londonDayKey(now), now, ends, PARTY_GUEST_CAP],
  );
  if (!ins.rowCount) throw new GameError("already_opened", "You've already opened a party to friends today. One a day!");
  await emit(tx, c.id, "player_party_opened", {}, now);
  return { message: `Your party is open to friends until ${clockOf(ends)}. Invite up to ${PARTY_GUEST_CAP} from Invitations.` };
}

export async function inviteToParty(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const party = await openPartyOf(tx, c.id, now);
  if (!party) throw new GameError("no_party", "Open your party to friends first.");
  const other = await otherPlayer(tx, c, p.characterId);
  await requireFriends(tx, c, other);
  const ins = await tx.query(
    "INSERT INTO invitations (kind, host_id, guest_id, party_id, created_at, expires_at) VALUES ('party', $1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id",
    [c.id, other.id, party.id, now, party.ends_at],
  );
  if (!ins.rowCount) throw new GameError("already_invited", `${other.name} is already invited.`);
  return { message: `Invited ${other.name} to your party. They can join from wherever they are.` };
}

export async function joinParty(tx: Tx, accountId: string, p: { invitationId: string }, now: Date) {
  const { c, inv, host } = await lockInvitationAsGuest(tx, accountId, p.invitationId, now);
  if (inv.kind !== "party") throw new GameError("not_party", "That isn't a party invitation.");
  if (inv.status === "revoked") throw new GameError("revoked", `${host.name} withdrew that invitation.`);
  if (inv.status === "declined") throw new GameError("declined", "You declined that invitation.");
  if (inv.status !== "pending" && inv.status !== "accepted") throw new GameError("party_over", `${host.name}'s party is over.`);
  // The party row is the capacity lock: guests are counted and reserved under it, one at a time.
  const party = (await tx.query("SELECT * FROM player_parties WHERE id = $1 FOR UPDATE", [inv.party_id])).rows[0];
  if (party.ended_at || new Date(party.ends_at) <= now) throw new GameError("party_over", `${host.name}'s party is over.`);
  await requireFriends(tx, c, host);
  const first = (await tx.query("INSERT INTO party_guests (party_id, guest_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [party.id, c.id, now])).rowCount === 1;
  if (first) {
    const slot = await tx.query("UPDATE player_parties SET guest_count = guest_count + 1 WHERE id = $1 AND guest_count < capacity RETURNING guest_count", [party.id]);
    // Throwing rolls back the guest row too, so a full house never leaves a half-joined guest.
    if (!slot.rowCount) throw new GameError("party_full", `${host.name}'s party is full: ${party.capacity} guests already. Maybe next time!`);
  }
  await startVisit(tx, c, host, now, new Date(party.ends_at));
  await tx.query("UPDATE invitations SET status = 'accepted', resolved_at = COALESCE(resolved_at, $2) WHERE id = $1", [inv.id, now]);
  if (!first) return { message: `Welcome back to ${host.name}'s party. (The party bonus is once per party.)` };
  const before = { ...c.needs };
  c.needs = applyEffects(c.needs, PARTY_GUEST_REWARD);
  await saveNeeds(tx, c, now);
  const parts = [`Social +${Math.round(c.needs.social - before.social)}`, `Fun +${Math.round(c.needs.fun - before.fun)}`];
  const m = await grantMoodlet(tx, c, "good_company", "player_party", now);
  if (m) parts.push(`feeling: ${m.toLowerCase()}`);
  const r = await romanceBetween(tx, c.id, host.id);
  if (r) {
    await tx.query("UPDATE romances SET bonus = bonus + $3 WHERE a_id = $1 AND b_id = $2", [r.a_id, r.b_id, ROMANCE_PARTY_BONUS]);
    parts.push(`relationship +${ROMANCE_PARTY_BONUS}`);
  }
  await emit(tx, c.id, "player_party_joined", {}, now);
  await emit(tx, host.id, "player_party_guest", {}, now);
  return { message: `You joined ${host.name}'s party: ${parts.join(", ")}.` };
}

export async function endParty(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const party = await openPartyOf(tx, c.id, now, true);
  if (!party) throw new GameError("no_party", "You don't have a party open.");
  await tx.query("UPDATE player_parties SET ended_at = $2 WHERE id = $1", [party.id, now]);
  await tx.query("UPDATE invitations SET status = 'revoked', resolved_at = $2 WHERE party_id = $1 AND status = 'pending'", [party.id, now]);
  const sent = await tx.query("UPDATE home_visits v SET ended_at = $3 FROM party_guests g WHERE g.party_id = $1 AND v.guest_id = g.guest_id AND v.host_id = $2 AND v.ended_at IS NULL", [party.id, c.id, now]);
  return { message: `Party over! ${sent.rowCount ? `${sent.rowCount} guest${sent.rowCount === 1 ? "" : "s"} headed home.` : ""}`.trim() };
}

// ───────────────────────────── view ─────────────────────────────

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

/** The player's relationships, household and invitations for the canonical state. */
export async function familyView(tx: Tx, c: CharRow, ctx: Ctx, now: Date) {
  await expireFamily(tx, c.id, now);
  const r = await romanceOf(tx, c.id);
  let romance = null;
  if (r) {
    const otherId = r.a_id === c.id ? r.b_id : r.a_id;
    const other = await playerById(tx, otherId);
    const value = romanceValue(r, (await friendPoints(tx, c.id, otherId)) ?? 0);
    const proposal = (await tx.query("SELECT 1 FROM romance_requests WHERE status = 'pending' AND kind = 'partner' AND (from_id = $1 OR to_id = $1)", [c.id])).rowCount! > 0;
    romance = {
      characterId: other.id,
      name: other.name,
      status: r.status,
      stage: romanceStage(r.status, value),
      value,
      max: ROMANCE_MAX_VALUE,
      since: iso(r.started_at)!,
      partneredAt: iso(r.partnered_at),
      canPropose: r.status === "dating" && value >= PARTNER_MIN_VALUE && !proposal,
    };
  }
  const reqs = (
    await tx.query(
      `SELECT q.id, q.kind, q.from_id, q.expires_at, o.id AS other_id, o.name FROM romance_requests q
       JOIN characters o ON o.id = CASE WHEN q.from_id = $1 THEN q.to_id ELSE q.from_id END
       WHERE q.status = 'pending' AND (q.from_id = $1 OR q.to_id = $1) ORDER BY q.created_at DESC`,
      [c.id],
    )
  ).rows.map((x) => ({ id: x.id as string, kind: x.kind as "date" | "partner", incoming: x.from_id !== c.id, characterId: x.other_id as string, name: x.name as string, expiresAt: iso(x.expires_at)! }));

  const membership = await membershipOf(tx, c.id);
  const ownerId = membership ? membership.owner_id : c.id;
  const members = (
    await tx.query("SELECT o.id, o.name, m.joined_at FROM household_members m JOIN characters o ON o.id = m.member_id WHERE m.owner_id = $1 ORDER BY m.joined_at", [ownerId])
  ).rows.map((x) => ({ id: x.id as string, name: x.name as string, joinedAt: iso(x.joined_at)! }));
  let household = null;
  if (membership || members.length) {
    const owner = await playerById(tx, ownerId);
    household = { role: membership ? ("member" as const) : ("owner" as const), owner: { id: owner.id, name: owner.name }, members, max: HOUSEHOLD_MAX_MEMBERS };
  }

  // A member visiting the owner's home sees what they may use there (the owner's furniture, their own groceries).
  let hostHome = null;
  const hv = membership ? await hostVisit(tx, c, now) : null;
  if (hv?.visiting) {
    const home = await homeContext(tx, { id: hv.owner.id } as CharRow);
    hostHome = {
      hostId: hv.owner.id,
      hostName: hv.owner.name,
      actions: ACTIVITIES.filter((d) => d.location === "home" && HOST_HOME_ACTIVITY(d.id))
        .map((d) => {
          const reason = hostHomeBlocker(d, ctx, home, hv.owner);
          return { id: d.id, label: d.label, minutes: hostMinutes(d, home), available: !reason, reason, needsTag: d.requires ?? null };
        })
        .filter((a) => !a.needsTag || home.tags.has(a.needsTag)),
    };
  }

  const invRows = (
    await tx.query(
      `SELECT i.*, h.name AS host_name, g.name AS guest_name, pp.ends_at AS party_ends, pp.ended_at AS party_ended,
         EXISTS (SELECT 1 FROM party_guests pg WHERE pg.party_id = i.party_id AND pg.guest_id = i.guest_id) AS joined
       FROM invitations i JOIN characters h ON h.id = i.host_id JOIN characters g ON g.id = i.guest_id
       LEFT JOIN player_parties pp ON pp.id = i.party_id
       WHERE (i.host_id = $1 OR i.guest_id = $1)
         AND (i.status = 'pending' OR (i.status = 'accepted' AND i.kind = 'party' AND pp.ended_at IS NULL AND pp.ends_at > $2)
              OR (i.status = 'accepted' AND i.kind = 'visit' AND EXISTS (SELECT 1 FROM home_visits v WHERE v.id = i.visit_id AND v.ended_at IS NULL AND v.ends_at > $2)))
       ORDER BY i.created_at DESC LIMIT 60`,
      [c.id, now],
    )
  ).rows;
  const inv = (x: Record<string, unknown>) => ({
    id: x.id as string,
    kind: x.kind as "visit" | "household" | "party",
    status: x.status as "pending" | "accepted",
    hostId: x.host_id as string,
    hostName: x.host_name as string,
    guestId: x.guest_id as string,
    guestName: x.guest_name as string,
    expiresAt: iso(x.expires_at as Date)!,
    joined: !!x.joined,
  });

  const mine = await openPartyOf(tx, c.id, now);
  const guests = mine
    ? (await tx.query("SELECT o.id, o.name FROM party_guests g JOIN characters o ON o.id = g.guest_id WHERE g.party_id = $1 ORDER BY g.joined_at", [mine.id])).rows.map((x) => ({
        id: x.id as string,
        name: x.name as string,
      }))
    : [];
  const openedToday = !mine && (await tx.query("SELECT 1 FROM player_parties WHERE host_id = $1 AND day_key = $2", [c.id, londonDayKey(now)])).rowCount! > 0;

  return {
    family: {
      romance,
      romanceRequests: { incoming: reqs.filter((x) => x.incoming), outgoing: reqs.filter((x) => !x.incoming) },
      household,
      hostHome,
      invitations: { incoming: invRows.filter((x) => x.guest_id === c.id).map(inv), outgoing: invRows.filter((x) => x.host_id === c.id).map(inv) },
      party: {
        open: mine ? { id: mine.id as string, endsAt: iso(mine.ends_at)!, capacity: Number(mine.capacity), guestCount: Number(mine.guest_count), guests } : null,
        canOpen: !mine && !openedToday && !partyBlocker(ctx),
        reason: mine ? null : openedToday ? "You've already opened a party to friends today." : partyBlocker(ctx),
        guestReward: PARTY_GUEST_REWARD,
      },
      rules: {
        dateMinPoints: DATE_MIN_POINTS,
        dateMinTitle: DATE_MIN_TITLE,
        partnerMinValue: PARTNER_MIN_VALUE,
        householdMinPoints: HOUSEHOLD_MIN_POINTS,
        householdMinTitle: HOUSEHOLD_MIN_TITLE,
        householdMax: HOUSEHOLD_MAX_MEMBERS,
        partyCap: PARTY_GUEST_CAP,
      },
      notBuilt: NOT_BUILT.map((x) => ({ ...x })),
    },
  };
}
