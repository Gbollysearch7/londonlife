import { HOME_TIERS, type Appearance } from "@/content/character";
import { careerDef, roleTitle } from "@/content/careers";
import { courseDef } from "@/content/courses";
import { storyDef, storyNode } from "@/content/stories";
import {
  BEST_FRIEND_POINTS,
  DAILY_TRANSFER_CAP_PENCE,
  FEED_EVENT_TYPES,
  FEED_PAGE,
  FRIEND_POINTS,
  FRIEND_REQUEST_DAYS,
  GIFT_MAX_PENCE,
  MAX_PENDING_MONEY_REQUESTS,
  MAX_PENDING_OUTGOING,
  MAX_REQUESTS_PER_DAY,
  MESSAGES_PER_MINUTE,
  MESSAGE_MAX_CHARS,
  MONEY_REQUEST_DAYS,
  NOTE_MAX_CHARS,
  ONLINE_WINDOW_MS,
  RANKING_SIZE,
  REPORT_REASONS,
  REREQUEST_COOLDOWN_DAYS,
  THREAD_PAGE,
  VISIT_CAPACITY,
  VISIT_MINUTES,
  cleanText,
  playerFriendTier,
} from "@/content/social";
import { reputation } from "@/sim/progression";
import { durationMs, londonDayKey } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { emit, fmtMoney, loadCtx, lockCharacter, moveMoney, requireCharacter, settle, type CharRow } from "./game";

/**
 * Shared life between real players (spec ch. 19, 27, 35.4): presence, friends with consent,
 * 1:1 messages, gifts and money requests, home visits, blocks and reports, rankings and the city feed.
 * Every rule is enforced here on the server; the phone UI only reflects it.
 */

const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
const isOnline = (at: Date | null | undefined, now: Date) => !!at && now.getTime() - new Date(at).getTime() <= ONLINE_WINDOW_MS;

interface Other {
  id: string;
  account_id: string;
  name: string;
}

async function otherPlayer(tx: Tx, me: CharRow, id: unknown): Promise<Other> {
  if (typeof id !== "string" || !UUID.test(id)) throw new GameError("no_player", "That player couldn't be found.");
  if (id === me.id) throw new GameError("self", "That's you!");
  const r = await tx.query("SELECT id, account_id, name FROM characters WHERE id = $1", [id]);
  if (!r.rowCount) throw new GameError("no_player", "That player couldn't be found.");
  return r.rows[0] as Other;
}

async function blockBetween(tx: Tx, x: string, y: string) {
  const r = await tx.query("SELECT blocker_id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)", [x, y]);
  return { iBlocked: r.rows.some((b) => b.blocker_id === x), theyBlocked: r.rows.some((b) => b.blocker_id === y) };
}

async function requireNoBlock(tx: Tx, me: string, other: string) {
  const b = await blockBetween(tx, me, other);
  if (b.iBlocked) throw new GameError("blocked", "You've blocked this player. Unblock them first.");
  // Deliberately vague: being blocked is not announced.
  if (b.theyBlocked) throw new GameError("unavailable", "This player isn't accepting contact.");
}

async function friendship(tx: Tx, x: string, y: string, lock = false) {
  const [a, b] = pair(x, y);
  const r = await tx.query(`SELECT * FROM friendships WHERE a_id = $1 AND b_id = $2${lock ? " FOR UPDATE" : ""}`, [a, b]);
  return r.rows[0] ?? null;
}

async function requireFriend(tx: Tx, me: CharRow, other: Other) {
  await requireNoBlock(tx, me.id, other.id);
  if (!(await friendship(tx, me.id, other.id))) throw new GameError("not_friends", `You and ${other.name} need to be friends first. Send a friend request from their profile.`);
}

/** Locks two characters in a fixed order so two players acting on each other at once can't deadlock. */
async function lockPair(tx: Tx, accountId: string, otherId: string) {
  const mine = await tx.query("SELECT id FROM characters WHERE account_id = $1", [accountId]);
  if (!mine.rowCount) throw new GameError("no_character", "Create your character first.", 409);
  if (UUID.test(String(otherId))) await tx.query("SELECT id FROM characters WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [[mine.rows[0].id, otherId]]);
}

export async function touchPresence(tx: Tx, charId: string, now: Date) {
  await tx.query(
    `INSERT INTO social_profiles (character_id, last_active_at) VALUES ($1, $2)
     ON CONFLICT (character_id) DO UPDATE SET last_active_at = GREATEST(social_profiles.last_active_at, EXCLUDED.last_active_at)`,
    [charId, now],
  );
}

async function settingsOf(tx: Tx, charId: string) {
  const r = (await tx.query("SELECT share_feed, read_receipts FROM social_profiles WHERE character_id = $1", [charId])).rows[0];
  return { shareFeed: r ? !!r.share_feed : true, readReceipts: r ? !!r.read_receipts : true };
}

// ───────────────────────────── friendship value ─────────────────────────────

/**
 * Records that `actor` interacted with a friend today. Points are paid only for days both took part
 * (a shared day), with small bonuses for a gift or a visit; each is capped once per pair per day.
 */
async function interact(tx: Tx, actor: string, other: string, kind: "message" | "gift" | "visit" | "transfer", now: Date) {
  const f = await friendship(tx, actor, other, true);
  if (!f) return 0;
  const [a, b] = pair(actor, other);
  const day = londonDayKey(now);
  const side = actor === a ? "a_active" : "b_active";
  const extra = kind === "gift" ? ", gift = true" : kind === "visit" ? ", visit = true" : "";
  await tx.query("INSERT INTO friendship_days (a_id, b_id, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [a, b, day]);
  const row = (await tx.query(`UPDATE friendship_days SET ${side} = true${extra} WHERE a_id = $1 AND b_id = $2 AND day = $3 RETURNING *`, [a, b, day])).rows[0];
  const target = row.a_active && row.b_active ? FRIEND_POINTS.mutualDay + (row.gift ? FRIEND_POINTS.gift : 0) + (row.visit ? FRIEND_POINTS.visit : 0) : 0;
  const delta = target - Number(row.points_awarded);
  if (delta <= 0) return 0;
  await tx.query("UPDATE friendship_days SET points_awarded = $4 WHERE a_id = $1 AND b_id = $2 AND day = $3", [a, b, day, target]);
  await tx.query("UPDATE friendships SET points = points + $3 WHERE a_id = $1 AND b_id = $2", [a, b, delta]);
  return delta;
}

/** Player friendships as ambition progress (each 0..1, best friend = 1). Used by the Four Best Friends ambition. */
export async function playerFriendProgress(tx: Tx, charId: string) {
  const r = await tx.query("SELECT points FROM friendships WHERE a_id = $1 OR b_id = $1", [charId]);
  return r.rows.map((x) => ({ progress: Math.min(1, Number(x.points) / BEST_FRIEND_POINTS), best: Number(x.points) >= BEST_FRIEND_POINTS }));
}

// ───────────────────────────── friend requests ─────────────────────────────

async function expireRequests(tx: Tx, charId: string, now: Date) {
  await tx.query("UPDATE friend_requests SET status = 'expired', resolved_at = expires_at WHERE status = 'pending' AND expires_at <= $2 AND (from_id = $1 OR to_id = $1)", [charId, now]);
  await tx.query(
    "UPDATE money_transfers SET status = 'expired', resolved_at = expires_at WHERE status = 'pending' AND expires_at <= $2 AND (payer_id = $1 OR payee_id = $1)",
    [charId, now],
  );
  await tx.query("UPDATE home_visits SET ended_at = ends_at WHERE ended_at IS NULL AND ends_at <= $2 AND (guest_id = $1 OR host_id = $1)", [charId, now]);
}

async function makeFriends(tx: Tx, x: string, y: string, now: Date) {
  const [a, b] = pair(x, y);
  await tx.query("INSERT INTO friendships (a_id, b_id, points, since) VALUES ($1, $2, 0, $3) ON CONFLICT DO NOTHING", [a, b, now]);
}

export async function sendFriendRequest(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  await requireNoBlock(tx, c.id, other.id);
  await expireRequests(tx, c.id, now);
  if (await friendship(tx, c.id, other.id)) throw new GameError("already_friends", `You and ${other.name} are already friends.`);
  const pending = (await tx.query("SELECT * FROM friend_requests WHERE status = 'pending' AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)) FOR UPDATE", [c.id, other.id])).rows[0];
  if (pending?.from_id === c.id) throw new GameError("already_sent", `You've already asked ${other.name}. They can accept or decline.`);
  if (pending) {
    // They asked first: sending back is the recipient's own consent, so it accepts their request.
    await tx.query("UPDATE friend_requests SET status = 'accepted', resolved_at = $2 WHERE id = $1", [pending.id, now]);
    await makeFriends(tx, c.id, other.id, now);
    await emit(tx, c.id, "player_friend", {}, now);
    return { message: `${other.name} had already asked you. You're now friends!` };
  }
  const declined = await tx.query("SELECT resolved_at FROM friend_requests WHERE from_id = $1 AND to_id = $2 AND status = 'declined' AND resolved_at > $3 LIMIT 1", [
    c.id,
    other.id,
    new Date(now.getTime() - REREQUEST_COOLDOWN_DAYS * DAY_MS),
  ]);
  if (declined.rowCount) throw new GameError("cooldown", `${other.name} declined recently. You can ask again in a few days.`);
  const out = (await tx.query("SELECT count(*) AS n FROM friend_requests WHERE from_id = $1 AND status = 'pending'", [c.id])).rows[0];
  if (Number(out.n) >= MAX_PENDING_OUTGOING) throw new GameError("too_many", `You have ${MAX_PENDING_OUTGOING} requests waiting. Withdraw one or wait for answers.`);
  const today = (await tx.query("SELECT count(*) AS n FROM friend_requests WHERE from_id = $1 AND created_at > $2", [c.id, new Date(now.getTime() - DAY_MS)])).rows[0];
  if (Number(today.n) >= MAX_REQUESTS_PER_DAY) throw new GameError("rate_limited", "You've sent a lot of requests today. Try again tomorrow.");
  await tx.query("INSERT INTO friend_requests (from_id, to_id, status, created_at, expires_at) VALUES ($1, $2, 'pending', $3, $4)", [
    c.id,
    other.id,
    now,
    new Date(now.getTime() + FRIEND_REQUEST_DAYS * DAY_MS),
  ]);
  return { message: `Friend request sent to ${other.name}. It lasts ${FRIEND_REQUEST_DAYS} days.` };
}

async function lockRequest(tx: Tx, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new GameError("no_request", "That request couldn't be found.");
  const r = await tx.query("SELECT * FROM friend_requests WHERE id = $1 FOR UPDATE", [id]);
  if (!r.rowCount) throw new GameError("no_request", "That request couldn't be found.");
  return r.rows[0];
}

export async function respondFriendRequest(tx: Tx, accountId: string, p: { requestId: string; accept: boolean }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const req = await lockRequest(tx, p.requestId);
  // Consent: only the person who was asked can answer. The sender can only withdraw.
  if (req.from_id === c.id) throw new GameError("not_recipient", "Only the person you asked can accept or decline. You can withdraw it instead.");
  if (req.to_id !== c.id) throw new GameError("no_request", "That request couldn't be found.");
  if (req.status === "pending" && new Date(req.expires_at) <= now) {
    await tx.query("UPDATE friend_requests SET status = 'expired', resolved_at = expires_at WHERE id = $1", [req.id]);
    return { message: "That request had expired. Send one back if you'd like to be friends." };
  }
  if (req.status !== "pending") throw new GameError("not_pending", `That request was already ${req.status}.`);
  const from = (await tx.query("SELECT name FROM characters WHERE id = $1", [req.from_id])).rows[0];
  if (!p.accept) {
    await tx.query("UPDATE friend_requests SET status = 'declined', resolved_at = $2 WHERE id = $1", [req.id, now]);
    return { message: `Declined ${from.name}'s request.` };
  }
  await requireNoBlock(tx, c.id, req.from_id);
  await tx.query("UPDATE friend_requests SET status = 'accepted', resolved_at = $2 WHERE id = $1", [req.id, now]);
  await makeFriends(tx, c.id, req.from_id, now);
  await emit(tx, c.id, "player_friend", {}, now);
  return { message: `You and ${from.name} are now friends.` };
}

export async function withdrawFriendRequest(tx: Tx, accountId: string, p: { requestId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const req = await lockRequest(tx, p.requestId);
  if (req.from_id !== c.id) throw new GameError("not_sender", "Only the sender can withdraw a request.");
  if (req.status !== "pending") throw new GameError("not_pending", `That request was already ${req.status}.`);
  await tx.query("UPDATE friend_requests SET status = 'withdrawn', resolved_at = $2 WHERE id = $1", [req.id, now]);
  return { message: "Request withdrawn." };
}

/** Ends what two people share: friendship, pending money requests and any open visit between them. */
async function separate(tx: Tx, x: string, y: string, now: Date) {
  const [a, b] = pair(x, y);
  await tx.query("DELETE FROM friendships WHERE a_id = $1 AND b_id = $2", [a, b]);
  await tx.query(
    "UPDATE money_transfers SET status = 'cancelled', resolved_at = $3 WHERE status = 'pending' AND ((payer_id = $1 AND payee_id = $2) OR (payer_id = $2 AND payee_id = $1))",
    [x, y, now],
  );
  await tx.query("UPDATE home_visits SET ended_at = $3 WHERE ended_at IS NULL AND ((guest_id = $1 AND host_id = $2) OR (guest_id = $2 AND host_id = $1))", [x, y, now]);
}

export async function unfriend(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  if (!(await friendship(tx, c.id, other.id))) throw new GameError("not_friends", `You and ${other.name} aren't friends.`);
  await separate(tx, c.id, other.id, now);
  return { message: `You're no longer friends with ${other.name}. Your messages stay, but you can't send new ones.` };
}

export async function blockPlayer(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  const ins = await tx.query("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [c.id, other.id, now]);
  if (!ins.rowCount) throw new GameError("already_blocked", `${other.name} is already blocked.`);
  // A block stops all contact at once, including anything still waiting for an answer.
  await tx.query(
    "UPDATE friend_requests SET status = 'blocked', resolved_at = $3 WHERE status = 'pending' AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))",
    [c.id, other.id, now],
  );
  await separate(tx, c.id, other.id, now);
  return { message: `${other.name} is blocked. They can't message you, send requests or visit, and they aren't told.` };
}

export async function unblockPlayer(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  const del = await tx.query("DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2", [c.id, other.id]);
  if (!del.rowCount) throw new GameError("not_blocked", `${other.name} isn't blocked.`);
  return { message: `${other.name} is unblocked. You're not friends any more; send a request if you'd like to be.` };
}

// ───────────────────────────── messages ─────────────────────────────

function requireClientId(v: unknown) {
  if (typeof v !== "string" || v.length < 8 || v.length > 64) throw new GameError("bad_client_id", "Missing message id. Please try again.");
  return v;
}

async function conversationFor(tx: Tx, x: string, y: string, now: Date) {
  const [a, b] = pair(x, y);
  await tx.query("INSERT INTO conversations (a_id, b_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [a, b, now]);
  return (await tx.query("SELECT * FROM conversations WHERE a_id = $1 AND b_id = $2", [a, b])).rows[0];
}

async function postMessage(tx: Tx, conversationId: string, sender: string, clientId: string, kind: string, body: string, refId: string | null, now: Date) {
  const ins = await tx.query(
    `INSERT INTO messages (conversation_id, sender_id, client_id, kind, body, ref_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (sender_id, client_id) DO NOTHING RETURNING id`,
    [conversationId, sender, clientId, kind, body, refId, now],
  );
  if (!ins.rowCount) return null;
  const id = Number(ins.rows[0].id);
  await tx.query("UPDATE conversations SET last_message_at = $2 WHERE id = $1", [conversationId, now]);
  // Your own message is read by you.
  await tx.query(
    `INSERT INTO conversation_reads (conversation_id, character_id, last_read_id, read_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (conversation_id, character_id) DO UPDATE SET last_read_id = GREATEST(conversation_reads.last_read_id, EXCLUDED.last_read_id)`,
    [conversationId, sender, id, now],
  );
  return id;
}

export async function sendMessage(tx: Tx, accountId: string, p: { characterId: string; body: string; clientId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const clientId = requireClientId(p.clientId);
  // A retry of a message that already arrived is a quiet success, never a duplicate.
  const dup = await tx.query("SELECT id FROM messages WHERE sender_id = $1 AND client_id = $2", [c.id, clientId]);
  if (dup.rowCount) return { message: "", messageId: Number(dup.rows[0].id), duplicate: true };
  const other = await otherPlayer(tx, c, p.characterId);
  await requireFriend(tx, c, other);
  const body = cleanText(p.body, MESSAGE_MAX_CHARS);
  if (!body) throw new GameError("empty", "Write something first.");
  if (body.length > MESSAGE_MAX_CHARS) throw new GameError("too_long", `Messages can be up to ${MESSAGE_MAX_CHARS} characters.`);
  const recent = (await tx.query("SELECT count(*) AS n FROM messages WHERE sender_id = $1 AND created_at > $2", [c.id, new Date(now.getTime() - 60_000)])).rows[0];
  if (Number(recent.n) >= MESSAGES_PER_MINUTE) throw new GameError("rate_limited", "You're sending messages very fast. Wait a moment and try again.");
  const conv = await conversationFor(tx, c.id, other.id, now);
  const id = await postMessage(tx, conv.id, c.id, clientId, "text", body, null, now);
  await interact(tx, c.id, other.id, "message", now);
  return { message: "", messageId: id };
}

// ───────────────────────────── money between friends ─────────────────────────────

function requireAmount(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new GameError("bad_amount", "Enter an amount of at least 1p.");
  if (n > GIFT_MAX_PENCE) throw new GameError("too_much", `The most you can send at once is ${fmtMoney(GIFT_MAX_PENCE)}.`);
  return n;
}

async function paidToday(tx: Tx, charId: string, now: Date) {
  const r = await tx.query("SELECT COALESCE(SUM(amount_pence), 0) AS s FROM money_transfers WHERE payer_id = $1 AND status = 'completed' AND period_key = $2", [charId, londonDayKey(now)]);
  return Number(r.rows[0].s);
}

async function requireUnderCap(tx: Tx, charId: string, amount: number, now: Date) {
  const used = await paidToday(tx, charId, now);
  if (used + amount > DAILY_TRANSFER_CAP_PENCE)
    throw new GameError("daily_cap", `You can give up to ${fmtMoney(DAILY_TRANSFER_CAP_PENCE)} a day to other players; ${fmtMoney(Math.max(0, DAILY_TRANSFER_CAP_PENCE - used))} left today.`);
}

export async function sendGift(tx: Tx, accountId: string, p: { characterId: string; amountPence: number; note?: string; clientId: string }, now: Date) {
  await lockPair(tx, accountId, p.characterId);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const clientId = requireClientId(p.clientId);
  const dup = await tx.query("SELECT status FROM money_transfers WHERE created_by = $1 AND client_id = $2", [c.id, clientId]);
  if (dup.rowCount) return { message: "That gift was already sent." };
  const other = await otherPlayer(tx, c, p.characterId);
  await requireFriend(tx, c, other);
  const amount = requireAmount(p.amountPence);
  const note = cleanText(p.note, NOTE_MAX_CHARS);
  if (note.length > NOTE_MAX_CHARS) throw new GameError("too_long", `Notes can be up to ${NOTE_MAX_CHARS} characters.`);
  await requireUnderCap(tx, c.id, amount, now);
  if (c.cash_pence < amount) throw new GameError("insufficient_funds", `You need ${fmtMoney(amount)} but have ${fmtMoney(c.cash_pence)}.`);
  // The unique (sender, client id) row is written first, so the recipient can only ever be credited once.
  const t = await tx.query(
    `INSERT INTO money_transfers (kind, payer_id, payee_id, created_by, amount_pence, note, status, client_id, period_key, created_at, resolved_at)
     VALUES ('gift', $1, $2, $1, $3, $4, 'completed', $5, $6, $7, $7) ON CONFLICT DO NOTHING RETURNING id`,
    [c.id, other.id, amount, note, clientId, londonDayKey(now), now],
  );
  if (!t.rowCount) return { message: "That gift was already sent." };
  const id = t.rows[0].id as string;
  const recipient = (await lockCharacter(tx, other.account_id))!;
  await moveMoney(tx, c, -amount, "gift", `Gift to ${other.name}`, { type: "transfer", id });
  await moveMoney(tx, recipient, amount, "gift", `Gift from ${c.name}`, { type: "transfer", id });
  const conv = await conversationFor(tx, c.id, other.id, now);
  await postMessage(tx, conv.id, c.id, `gift:${id}`, "gift", `Sent you ${fmtMoney(amount)}${note ? `: ${note}` : "."}`, id, now);
  await interact(tx, c.id, other.id, "gift", now);
  await emit(tx, c.id, "gift_sent", {}, now);
  return { message: `Sent ${fmtMoney(amount)} to ${other.name}.` };
}

export async function requestMoney(tx: Tx, accountId: string, p: { characterId: string; amountPence: number; note?: string; clientId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const clientId = requireClientId(p.clientId);
  const dup = await tx.query("SELECT 1 FROM money_transfers WHERE created_by = $1 AND client_id = $2", [c.id, clientId]);
  if (dup.rowCount) return { message: "That request was already sent." };
  const other = await otherPlayer(tx, c, p.characterId);
  await requireFriend(tx, c, other);
  const amount = requireAmount(p.amountPence);
  const note = cleanText(p.note, NOTE_MAX_CHARS);
  if (note.length > NOTE_MAX_CHARS) throw new GameError("too_long", `Notes can be up to ${NOTE_MAX_CHARS} characters.`);
  await expireRequests(tx, c.id, now);
  const open = (await tx.query("SELECT count(*) AS n FROM money_transfers WHERE created_by = $1 AND kind = 'request' AND status = 'pending'", [c.id])).rows[0];
  if (Number(open.n) >= MAX_PENDING_MONEY_REQUESTS) throw new GameError("too_many", `You have ${MAX_PENDING_MONEY_REQUESTS} money requests waiting already.`);
  const t = await tx.query(
    `INSERT INTO money_transfers (kind, payer_id, payee_id, created_by, amount_pence, note, status, client_id, period_key, created_at, expires_at)
     VALUES ('request', $1, $2, $2, $3, $4, 'pending', $5, $6, $7, $8) ON CONFLICT DO NOTHING RETURNING id`,
    [other.id, c.id, amount, note, clientId, londonDayKey(now), now, new Date(now.getTime() + MONEY_REQUEST_DAYS * DAY_MS)],
  );
  if (!t.rowCount) return { message: "That request was already sent." };
  const conv = await conversationFor(tx, c.id, other.id, now);
  await postMessage(tx, conv.id, c.id, `request:${t.rows[0].id}`, "money_request", `Asked you for ${fmtMoney(amount)}${note ? `: ${note}` : "."}`, t.rows[0].id, now);
  return { message: `Asked ${other.name} for ${fmtMoney(amount)}. No money moves unless they accept.` };
}

export async function respondMoneyRequest(tx: Tx, accountId: string, p: { transferId: string; accept: boolean }, now: Date) {
  if (typeof p.transferId !== "string" || !UUID.test(p.transferId)) throw new GameError("no_request", "That request couldn't be found.");
  const peek = (await tx.query("SELECT payer_id, payee_id FROM money_transfers WHERE id = $1 AND kind = 'request'", [p.transferId])).rows[0];
  if (!peek) throw new GameError("no_request", "That request couldn't be found.");
  const mine = (await tx.query("SELECT id FROM characters WHERE account_id = $1", [accountId])).rows[0];
  if (mine) await lockPair(tx, accountId, mine.id === peek.payer_id ? peek.payee_id : peek.payer_id);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const t = (await tx.query("SELECT * FROM money_transfers WHERE id = $1 FOR UPDATE", [p.transferId])).rows[0];
  // Consent: only the person asked to pay can accept; asking never moves money by itself.
  if (t.payee_id === c.id) throw new GameError("not_payer", "Only the person you asked can pay this. You can cancel it instead.");
  if (t.payer_id !== c.id) throw new GameError("no_request", "That request couldn't be found.");
  if (t.status === "pending" && t.expires_at && new Date(t.expires_at) <= now) {
    await tx.query("UPDATE money_transfers SET status = 'expired', resolved_at = expires_at WHERE id = $1", [t.id]);
    return { message: "That request had expired, so nothing was paid." };
  }
  if (t.status !== "pending") throw new GameError("not_pending", `That request was already ${t.status}.`);
  const payee = (await tx.query("SELECT id, account_id, name FROM characters WHERE id = $1", [t.payee_id])).rows[0] as Other;
  const amount = Number(t.amount_pence);
  if (!p.accept) {
    await tx.query("UPDATE money_transfers SET status = 'declined', resolved_at = $2 WHERE id = $1", [t.id, now]);
    return { message: `Declined ${payee.name}'s request for ${fmtMoney(amount)}.` };
  }
  await requireFriend(tx, c, payee);
  await requireUnderCap(tx, c.id, amount, now);
  if (c.cash_pence < amount) throw new GameError("insufficient_funds", `You need ${fmtMoney(amount)} but have ${fmtMoney(c.cash_pence)}.`);
  await tx.query("UPDATE money_transfers SET status = 'completed', resolved_at = $2, period_key = $3 WHERE id = $1", [t.id, now, londonDayKey(now)]);
  const recipient = (await lockCharacter(tx, payee.account_id))!;
  await moveMoney(tx, c, -amount, "gift", `Paid ${payee.name}'s request`, { type: "transfer", id: t.id });
  await moveMoney(tx, recipient, amount, "gift", `${c.name} paid your request`, { type: "transfer", id: t.id });
  const conv = await conversationFor(tx, c.id, payee.id, now);
  await postMessage(tx, conv.id, c.id, `paid:${t.id}`, "system", `Paid your request for ${fmtMoney(amount)}.`, t.id, now);
  await interact(tx, c.id, payee.id, "transfer", now);
  return { message: `Paid ${fmtMoney(amount)} to ${payee.name}.` };
}

export async function cancelMoneyRequest(tx: Tx, accountId: string, p: { transferId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  if (typeof p.transferId !== "string" || !UUID.test(p.transferId)) throw new GameError("no_request", "That request couldn't be found.");
  const t = (await tx.query("SELECT * FROM money_transfers WHERE id = $1 AND kind = 'request' FOR UPDATE", [p.transferId])).rows[0];
  if (!t || t.created_by !== c.id) throw new GameError("no_request", "Only the person who asked can cancel a request.");
  if (t.status !== "pending") throw new GameError("not_pending", `That request was already ${t.status}.`);
  await tx.query("UPDATE money_transfers SET status = 'cancelled', resolved_at = $2 WHERE id = $1", [t.id, now]);
  return { message: "Money request cancelled." };
}

// ───────────────────────────── home visits ─────────────────────────────

export async function visitHome(tx: Tx, accountId: string, p: { characterId: string }, now: Date) {
  // Both rows are locked up front (in id order): the host row is also the capacity lock.
  await lockPair(tx, accountId, p.characterId);
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  await requireFriend(tx, c, other);
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "You're travelling. Visit when you arrive.");
  if (ctx.shift) throw new GameError("on_shift", "You're on shift. Visit after work.");
  if (ctx.running) throw new GameError("busy", "Finish or cancel what you're doing first.");
  await expireRequests(tx, other.id, now);
  await tx.query("UPDATE home_visits SET ended_at = $2 WHERE guest_id = $1 AND ended_at IS NULL", [c.id, now]);
  const guests = (await tx.query("SELECT count(*) AS n FROM home_visits WHERE host_id = $1 AND ended_at IS NULL", [other.id])).rows[0];
  if (Number(guests.n) >= VISIT_CAPACITY) throw new GameError("full_house", `${other.name}'s home already has ${VISIT_CAPACITY} guests. Try again a bit later.`);
  await tx.query("INSERT INTO home_visits (guest_id, host_id, started_at, ends_at) VALUES ($1, $2, $3, $4)", [c.id, other.id, now, new Date(now.getTime() + durationMs(VISIT_MINUTES))]);
  await interact(tx, c.id, other.id, "visit", now);
  await emit(tx, c.id, "visited_friend", {}, now);
  return { message: `You popped round to ${other.name}'s home. Look around; it's theirs, so you can't move or use anything.` };
}

export async function leaveVisit(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const r = await tx.query("UPDATE home_visits SET ended_at = LEAST($2, ends_at) WHERE guest_id = $1 AND ended_at IS NULL RETURNING host_id", [c.id, now]);
  if (!r.rowCount) throw new GameError("not_visiting", "You're not visiting anyone.");
  return { message: "You headed home." };
}

// ───────────────────────────── settings & reports ─────────────────────────────

export async function updateSocialSettings(tx: Tx, accountId: string, p: { shareFeed?: boolean; readReceipts?: boolean }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await touchPresence(tx, c.id, now);
  if (typeof p.shareFeed === "boolean") await tx.query("UPDATE social_profiles SET share_feed = $2 WHERE character_id = $1", [c.id, p.shareFeed]);
  if (typeof p.readReceipts === "boolean") await tx.query("UPDATE social_profiles SET read_receipts = $2 WHERE character_id = $1", [c.id, p.readReceipts]);
  const s = await settingsOf(tx, c.id);
  return { message: `Saved. City feed sharing ${s.shareFeed ? "on" : "off"}; read receipts ${s.readReceipts ? "on" : "off"}.` };
}

export async function reportPlayer(tx: Tx, accountId: string, p: { characterId: string; reason: string; note?: string; block?: boolean }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const other = await otherPlayer(tx, c, p.characterId);
  if (!REPORT_REASONS.some((r) => r.id === p.reason)) throw new GameError("bad_reason", "Choose a reason for the report.");
  const note = cleanText(p.note, 500);
  if (note.length > 500) throw new GameError("too_long", "Keep the note under 500 characters.");
  // Context for moderators: the latest messages between the two, the relationship and any requests.
  const [a, b] = pair(c.id, other.id);
  const conv = (await tx.query("SELECT id FROM conversations WHERE a_id = $1 AND b_id = $2", [a, b])).rows[0];
  const msgs = conv
    ? (await tx.query("SELECT id, sender_id, kind, body, created_at FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 30", [conv.id])).rows.reverse()
    : [];
  const requests = (
    await tx.query("SELECT id, from_id, status, created_at FROM friend_requests WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1) ORDER BY created_at DESC LIMIT 10", [c.id, other.id])
  ).rows;
  const context = {
    conversationId: conv?.id ?? null,
    messages: msgs.map((m) => ({ id: Number(m.id), from: m.sender_id === c.id ? "reporter" : "reported", kind: m.kind, body: m.body, at: new Date(m.created_at).toISOString() })),
    friends: !!(await friendship(tx, c.id, other.id)),
    requests: requests.map((r) => ({ id: r.id, from: r.from_id === c.id ? "reporter" : "reported", status: r.status, at: new Date(r.created_at).toISOString() })),
    reportedName: other.name,
  };
  const ins = await tx.query(
    "INSERT INTO reports (reporter_id, target_id, reason, note, context, period_key, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
    [c.id, other.id, p.reason, note, context, londonDayKey(now), now],
  );
  if (!ins.rowCount) throw new GameError("already_reported", `You've already reported ${other.name} today. Moderators will review it.`);
  if (p.block) {
    await tx.query("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [c.id, other.id, now]);
    await tx.query(
      "UPDATE friend_requests SET status = 'blocked', resolved_at = $3 WHERE status = 'pending' AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))",
      [c.id, other.id, now],
    );
    await separate(tx, c.id, other.id, now);
  }
  return { message: `Thanks. Your report about ${other.name} was recorded for review${p.block ? " and they're blocked" : ""}.` };
}

// ───────────────────────────── public values ─────────────────────────────

const TIER_PRICES = () => JSON.stringify(Object.fromEntries(HOME_TIERS.map((t) => [t.id, t.pricePence ?? 0])));

/**
 * Net worth exactly as the Bank app shows it: cash + savings + half the furniture paid
 * + the owned home's price (or the rent deposit held) − unpaid bills. One SQL definition serves
 * profiles and rankings, so the two always agree.
 */
const NET_WORTH_SQL = `(c.cash_pence + c.savings_pence + (COALESCE(f.s, 0)::bigint + 1) / 2
  + CASE WHEN h.owned THEN COALESCE((($1::jsonb) ->> h.tier_id)::bigint, 0) ELSE COALESCE(h.deposit_pence, 0) END
  - COALESCE(bl.s, 0)::bigint)`;
const NET_WORTH_JOINS = `LEFT JOIN homes h ON h.character_id = c.id
  LEFT JOIN (SELECT character_id, SUM(price_pence) AS s FROM furniture GROUP BY character_id) f ON f.character_id = c.id
  LEFT JOIN (SELECT character_id, SUM(amount_pence) AS s FROM bills WHERE status = 'unpaid' GROUP BY character_id) bl ON bl.character_id = c.id`;

async function publicProfile(tx: Tx, viewer: CharRow, id: string, now: Date) {
  const r = await tx.query(
    `SELECT c.id, c.name, c.appearance, c.reputation_xp, c.ambition, h.tier_id, h.district, h.owned, p.last_active_at, ${NET_WORTH_SQL} AS net_worth
     FROM characters c ${NET_WORTH_JOINS} LEFT JOIN social_profiles p ON p.character_id = c.id WHERE c.id = $2`,
    [TIER_PRICES(), id],
  );
  const row = r.rows[0];
  if (!row) throw new GameError("no_player", "That player couldn't be found.");
  const blocks = await blockBetween(tx, viewer.id, id);
  if (blocks.theyBlocked) throw new GameError("no_player", "That player couldn't be found.");
  const career = (await tx.query("SELECT career_id, rank, grade FROM career_progress WHERE character_id = $1", [id])).rows[0];
  const k = career ? careerDef(career.career_id) : null;
  const certs = (await tx.query("SELECT course_id FROM course_progress WHERE character_id = $1 AND certified_at IS NOT NULL ORDER BY certified_at", [id])).rows;
  const counts = (
    await tx.query("SELECT type, count(*) AS n FROM game_events WHERE character_id = $1 AND type IN ('treasure_found', 'story_completed') GROUP BY type", [id])
  ).rows;
  const n = (t: string) => Number(counts.find((x) => x.type === t)?.n ?? 0);
  const friendsCount = Number((await tx.query("SELECT count(*) AS n FROM friendships WHERE a_id = $1 OR b_id = $1", [id])).rows[0].n);
  const badges: string[] = [];
  if (row.owned) badges.push("Home owner");
  for (const cert of certs) badges.push(`Certified: ${courseDef(cert.course_id)?.name ?? cert.course_id}`);
  if (n("treasure_found")) badges.push(`Treasure hunter ×${n("treasure_found")}`);
  if (n("story_completed")) badges.push(`Storyteller ×${n("story_completed")}`);
  if (friendsCount >= 5) badges.push("Well connected");
  const tier = HOME_TIERS.find((t) => t.id === row.tier_id);
  const rep = reputation(Number(row.reputation_xp));
  const isSelf = id === viewer.id;
  const f = isSelf ? null : await friendship(tx, viewer.id, id);
  let relation: "self" | "friend" | "incoming" | "outgoing" | "blocked" | "none" = "none";
  let requestId: string | null = null;
  if (isSelf) relation = "self";
  else if (blocks.iBlocked) relation = "blocked";
  else if (f) relation = "friend";
  else {
    const req = (
      await tx.query("SELECT id, from_id FROM friend_requests WHERE status = 'pending' AND expires_at > $3 AND ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))", [viewer.id, id, now])
    ).rows[0];
    if (req) {
      relation = req.from_id === viewer.id ? "outgoing" : "incoming";
      requestId = req.id;
    }
  }
  return {
    id: row.id as string,
    name: row.name as string,
    appearance: row.appearance as Appearance,
    title: rep.title,
    reputationXp: rep.xp,
    reputationLevel: rep.level,
    career: k ? { name: k.name, role: roleTitle(k, Number(career.rank), Number(career.grade)) } : null,
    home: { district: row.district as string, tier: tier?.name ?? "Home" },
    netWorthPence: Number(row.net_worth),
    badges,
    friendsCount,
    online: isOnline(row.last_active_at, now),
    relation,
    requestId,
    friendship: f ? { points: Number(f.points), ...playerFriendTier(Number(f.points)), since: new Date(f.since).toISOString() } : null,
  };
}

async function rankings(tx: Tx, viewer: CharRow, now: Date) {
  const board = async (valueSql: string, extra: unknown[]) => {
    const n = extra.length;
    const r = await tx.query(
      `SELECT * FROM (
         SELECT c.id, c.name, ${valueSql} AS value, row_number() OVER (ORDER BY ${valueSql} DESC, c.created_at, c.id) AS rank
         FROM characters c ${NET_WORTH_JOINS}
       ) x WHERE rank <= $${n + 1} OR id = $${n + 2} ORDER BY rank`,
      [...extra, RANKING_SIZE, viewer.id],
    );
    const rows = r.rows.map((x) => ({ id: x.id as string, name: x.name as string, value: Number(x.value), rank: Number(x.rank), you: x.id === viewer.id }));
    return { top: rows.filter((x) => x.rank <= RANKING_SIZE), you: rows.find((x) => x.you) ?? null };
  };
  const rep = await board("c.reputation_xp", []);
  const worth = await board(NET_WORTH_SQL, [TIER_PRICES()]);
  return {
    updatedAt: now.toISOString(),
    reputation: { ...rep, top: rep.top.map((x) => ({ ...x, title: reputation(x.value).title })) },
    netWorth: worth,
  };
}

function feedText(type: string, data: Record<string, string>) {
  switch (type) {
    case "promoted":
      return `was promoted to ${data.role ?? "a new role"}.`;
    case "story_completed": {
      const s = storyDef(data.story);
      const ending = s && data.ending ? storyNode(s, data.ending)?.ending?.title : null;
      return `finished the story “${s?.title ?? "a story"}”${ending ? `: ${ending}` : ""}.`;
    }
    case "treasure_found":
      // Never says where: other players are still hunting today.
      return "found today's hidden city treasure.";
    case "moved_home": {
      const t = HOME_TIERS.find((x) => x.id === data.tier);
      return `moved into a ${t?.name.toLowerCase() ?? "new home"} in ${t?.district ?? "London"}.`;
    }
    case "home_bought": {
      const t = HOME_TIERS.find((x) => x.id === data.tier);
      return `bought their ${t?.name.toLowerCase() ?? "home"}.`;
    }
    case "certified":
      return `earned a certificate in ${courseDef(data.course)?.name ?? "a course"}.`;
    default:
      return "did something memorable.";
  }
}

async function feed(tx: Tx, viewer: CharRow, before: number | null) {
  const r = await tx.query(
    `SELECT e.id, e.type, e.data, e.created_at, c.id AS cid, c.name FROM game_events e
     JOIN characters c ON c.id = e.character_id
     LEFT JOIN social_profiles p ON p.character_id = c.id
     WHERE e.type = ANY($1::text[]) AND COALESCE(p.share_feed, true)
       AND ($2::bigint IS NULL OR e.id < $2)
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $3 AND b.blocked_id = c.id) OR (b.blocker_id = c.id AND b.blocked_id = $3))
     ORDER BY e.id DESC LIMIT $4`,
    [[...FEED_EVENT_TYPES], before, viewer.id, FEED_PAGE],
  );
  const items = r.rows.map((e) => ({
    id: Number(e.id),
    characterId: e.cid as string,
    name: e.name as string,
    you: e.cid === viewer.id,
    text: feedText(e.type, e.data ?? {}),
    type: e.type as string,
    at: new Date(e.created_at).toISOString(),
  }));
  return { items, nextBefore: items.length === FEED_PAGE ? items[items.length - 1].id : null };
}

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

async function playerCards(tx: Tx, viewer: CharRow, where: string, params: unknown[], now: Date) {
  const r = await tx.query(
    `SELECT c.id, c.name, c.reputation_xp, p.last_active_at,
       EXISTS (SELECT 1 FROM friendships f WHERE (f.a_id = c.id AND f.b_id = $1) OR (f.b_id = c.id AND f.a_id = $1)) AS friend,
       EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $1 AND b.blocked_id = c.id) AS blocked
     FROM characters c LEFT JOIN social_profiles p ON p.character_id = c.id
     WHERE c.id <> $1 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = c.id AND b.blocked_id = $1) AND ${where}
     ORDER BY p.last_active_at DESC NULLS LAST, c.name LIMIT 20`,
    [viewer.id, ...params],
  );
  return r.rows.map((x) => ({
    id: x.id as string,
    name: x.name as string,
    title: reputation(Number(x.reputation_xp)).title,
    online: isOnline(x.last_active_at, now),
    friend: !!x.friend,
    blocked: !!x.blocked,
  }));
}

async function thread(tx: Tx, viewer: CharRow, otherId: unknown, before: number | null, now: Date) {
  const other = await otherPlayer(tx, viewer, otherId);
  const blocks = await blockBetween(tx, viewer.id, other.id);
  if (blocks.theyBlocked) throw new GameError("no_player", "That player couldn't be found.");
  const [a, b] = pair(viewer.id, other.id);
  const conv = (await tx.query("SELECT id FROM conversations WHERE a_id = $1 AND b_id = $2", [a, b])).rows[0];
  const friends = !!(await friendship(tx, viewer.id, other.id));
  const base = { characterId: other.id, name: other.name, friends, blocked: blocks.iBlocked, canSend: friends && !blocks.iBlocked };
  if (!conv) return { ...base, messages: [], readUpTo: null as number | null, hasOlder: false };
  const rows = (
    await tx.query("SELECT id, sender_id, kind, body, ref_id, created_at FROM messages WHERE conversation_id = $1 AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT $3", [
      conv.id,
      before,
      THREAD_PAGE + 1,
    ])
  ).rows;
  const hasOlder = rows.length > THREAD_PAGE;
  const page = rows.slice(0, THREAD_PAGE).reverse();
  // Opening the thread marks everything in it as read.
  const newest = (await tx.query("SELECT max(id) AS m FROM messages WHERE conversation_id = $1", [conv.id])).rows[0].m;
  if (newest)
    await tx.query(
      `INSERT INTO conversation_reads (conversation_id, character_id, last_read_id, read_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (conversation_id, character_id) DO UPDATE SET last_read_id = GREATEST(conversation_reads.last_read_id, EXCLUDED.last_read_id), read_at = EXCLUDED.read_at`,
      [conv.id, viewer.id, Number(newest), now],
    );
  // Read receipts show only when both people have them switched on.
  const mineOn = (await settingsOf(tx, viewer.id)).readReceipts;
  const theirsOn = (await settingsOf(tx, other.id)).readReceipts;
  const theirRead = (await tx.query("SELECT last_read_id FROM conversation_reads WHERE conversation_id = $1 AND character_id = $2", [conv.id, other.id])).rows[0];
  const transfers = page.filter((m) => m.ref_id).map((m) => m.ref_id);
  const tRows = transfers.length ? (await tx.query("SELECT id, status, payer_id, kind FROM money_transfers WHERE id = ANY($1::uuid[])", [transfers])).rows : [];
  return {
    ...base,
    messages: page.map((m) => {
      const t = tRows.find((x) => x.id === m.ref_id);
      return {
        id: Number(m.id),
        mine: m.sender_id === viewer.id,
        kind: m.kind as "text" | "gift" | "money_request" | "system",
        body: m.body as string,
        at: new Date(m.created_at).toISOString(),
        transfer: t && t.kind === "request" ? { id: t.id as string, status: t.status as string, youPay: t.payer_id === viewer.id } : null,
      };
    }),
    readUpTo: mineOn && theirsOn ? Number(theirRead?.last_read_id ?? 0) : null,
    hasOlder,
  };
}

/** Read-only social queries (search, profiles, threads, rankings, feed). Opening a thread marks it read. */
export async function socialQuery(tx: Tx, accountId: string, op: string, params: Record<string, unknown>, now: Date) {
  const c = await lockCharacter(tx, accountId);
  if (!c) throw new GameError("no_character", "Create your character first.", 409);
  await touchPresence(tx, c.id, now);
  const before = params.before === undefined || params.before === null || params.before === "" ? null : Number(params.before);
  if (before !== null && !Number.isInteger(before)) throw new GameError("bad_query", "Bad page.");
  switch (op) {
    case "search": {
      const q = String(params.q ?? "").trim();
      if (q.length < 1 || q.length > 24) throw new GameError("bad_query", "Type part of a character's name.");
      return { players: await playerCards(tx, c, "c.name ILIKE $2", [`%${escapeLike(q)}%`], now) };
    }
    case "online":
      return { players: await playerCards(tx, c, "p.last_active_at > $2", [new Date(now.getTime() - ONLINE_WINDOW_MS)], now) };
    case "profile": {
      if (typeof params.id !== "string" || !UUID.test(params.id)) throw new GameError("no_player", "That player couldn't be found.");
      return { profile: await publicProfile(tx, c, params.id, now) };
    }
    case "thread":
      return { thread: await thread(tx, c, params.id, before, now) };
    case "rankings":
      return { rankings: await rankings(tx, c, now) };
    case "feed":
      return { feed: await feed(tx, c, before) };
    case "pulse":
      return { pulse: await pulse(tx, c, now) };
    default:
      throw new GameError("bad_query", "Unknown social query.");
  }
}

async function conversationsFor(tx: Tx, c: CharRow, now: Date) {
  const r = await tx.query(
    `SELECT cv.id, cv.last_message_at, o.id AS other_id, o.name, p.last_active_at,
       (SELECT body FROM messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS preview,
       (SELECT sender_id FROM messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS preview_from,
       (SELECT count(*) FROM messages m WHERE m.conversation_id = cv.id AND m.sender_id <> $1 AND m.id > COALESCE(r.last_read_id, 0)) AS unread
     FROM conversations cv
     JOIN characters o ON o.id = CASE WHEN cv.a_id = $1 THEN cv.b_id ELSE cv.a_id END
     LEFT JOIN conversation_reads r ON r.conversation_id = cv.id AND r.character_id = $1
     LEFT JOIN social_profiles p ON p.character_id = o.id
     WHERE (cv.a_id = $1 OR cv.b_id = $1) AND cv.last_message_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = o.id AND b.blocked_id = $1)
     ORDER BY cv.last_message_at DESC LIMIT 50`,
    [c.id],
  );
  return r.rows.map((x) => ({
    characterId: x.other_id as string,
    name: x.name as string,
    online: isOnline(x.last_active_at, now),
    lastMessageAt: new Date(x.last_message_at).toISOString(),
    preview: `${x.preview_from === c.id ? "You: " : ""}${String(x.preview ?? "").slice(0, 80)}`,
    unread: Number(x.unread),
  }));
}

async function pulse(tx: Tx, c: CharRow, now: Date) {
  const conversations = await conversationsFor(tx, c, now);
  const incoming = Number((await tx.query("SELECT count(*) AS n FROM friend_requests WHERE to_id = $1 AND status = 'pending' AND expires_at > $2", [c.id, now])).rows[0].n);
  return { unreadTotal: conversations.reduce((s, x) => s + x.unread, 0), conversations, incomingRequests: incoming };
}

// ───────────────────────────── canonical state slice ─────────────────────────────

/** The player's social slice of the canonical state. Loading it also counts as being active. */
export async function socialView(tx: Tx, c: CharRow, now: Date) {
  await touchPresence(tx, c.id, now);
  await expireRequests(tx, c.id, now);
  const settings = await settingsOf(tx, c.id);
  const friends = (
    await tx.query(
      `SELECT o.id, o.name, f.points, f.since, p.last_active_at FROM friendships f
       JOIN characters o ON o.id = CASE WHEN f.a_id = $1 THEN f.b_id ELSE f.a_id END
       LEFT JOIN social_profiles p ON p.character_id = o.id
       WHERE f.a_id = $1 OR f.b_id = $1 ORDER BY f.points DESC, o.name`,
      [c.id],
    )
  ).rows.map((x) => ({
    id: x.id as string,
    name: x.name as string,
    online: isOnline(x.last_active_at, now),
    points: Number(x.points),
    since: new Date(x.since).toISOString(),
    ...playerFriendTier(Number(x.points)),
  }));
  const reqRows = (
    await tx.query(
      `SELECT r.id, r.from_id, r.to_id, r.created_at, r.expires_at, o.id AS other_id, o.name FROM friend_requests r
       JOIN characters o ON o.id = CASE WHEN r.from_id = $1 THEN r.to_id ELSE r.from_id END
       WHERE r.status = 'pending' AND (r.from_id = $1 OR r.to_id = $1) ORDER BY r.created_at DESC`,
      [c.id],
    )
  ).rows;
  const req = (x: Record<string, unknown>) => ({ id: x.id as string, characterId: x.other_id as string, name: x.name as string, createdAt: new Date(x.created_at as Date).toISOString(), expiresAt: new Date(x.expires_at as Date).toISOString() });
  const moneyRows = (
    await tx.query(
      `SELECT t.*, o.id AS other_id, o.name FROM money_transfers t
       JOIN characters o ON o.id = CASE WHEN t.payer_id = $1 THEN t.payee_id ELSE t.payer_id END
       WHERE t.kind = 'request' AND t.status = 'pending' AND (t.payer_id = $1 OR t.payee_id = $1) ORDER BY t.created_at DESC`,
      [c.id],
    )
  ).rows;
  const money = (x: Record<string, unknown>) => ({
    id: x.id as string,
    characterId: x.other_id as string,
    name: x.name as string,
    amountPence: Number(x.amount_pence),
    note: x.note as string,
    expiresAt: new Date(x.expires_at as Date).toISOString(),
  });
  const blocked = (await tx.query("SELECT o.id, o.name FROM blocks b JOIN characters o ON o.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY o.name", [c.id])).rows.map((x) => ({
    id: x.id as string,
    name: x.name as string,
  }));
  const conversations = await conversationsFor(tx, c, now);

  // An open visit is shown only while the two are still friends (a block or unfriend ends it at once).
  const v = (
    await tx.query(
      `SELECT v.ends_at, o.id, o.name, o.appearance, h.tier_id, h.district, p.last_active_at FROM home_visits v
       JOIN characters o ON o.id = v.host_id JOIN homes h ON h.character_id = o.id
       LEFT JOIN social_profiles p ON p.character_id = o.id
       WHERE v.guest_id = $1 AND v.ended_at IS NULL AND v.ends_at > $2`,
      [c.id, now],
    )
  ).rows[0];
  let visit = null;
  if (v) {
    const tier = HOME_TIERS.find((t) => t.id === v.tier_id)!;
    const furniture = (await tx.query("SELECT id, def_id, x, y, rot, colour FROM furniture WHERE character_id = $1 AND home_id IS NOT NULL ORDER BY created_at, id", [v.id])).rows.map((f) => ({
      id: f.id as string,
      defId: f.def_id as string,
      x: Number(f.x),
      y: Number(f.y),
      rot: Number(f.rot),
      colour: f.colour as string,
    }));
    visit = {
      hostId: v.id as string,
      hostName: v.name as string,
      hostAppearance: v.appearance as Appearance,
      hostOnline: isOnline(v.last_active_at, now),
      endsAt: new Date(v.ends_at).toISOString(),
      home: { tierName: tier.name, district: v.district as string, gridW: tier.gridW, gridD: tier.gridD },
      furniture,
    };
  }
  const visitors = (
    await tx.query("SELECT o.id, o.name FROM home_visits v JOIN characters o ON o.id = v.guest_id WHERE v.host_id = $1 AND v.ended_at IS NULL AND v.ends_at > $2 ORDER BY v.started_at", [c.id, now])
  ).rows.map((x) => ({ id: x.id as string, name: x.name as string }));

  return {
    social: {
      settings,
      friends,
      incoming: reqRows.filter((x) => x.to_id === c.id).map(req),
      outgoing: reqRows.filter((x) => x.from_id === c.id).map(req),
      moneyRequests: { incoming: moneyRows.filter((x) => x.payer_id === c.id).map(money), outgoing: moneyRows.filter((x) => x.payee_id === c.id).map(money) },
      blocked,
      conversations,
      unreadTotal: conversations.reduce((s, x) => s + x.unread, 0),
      visit,
      visitors,
      limits: { giftMaxPence: GIFT_MAX_PENCE, dailyCapPence: DAILY_TRANSFER_CAP_PENCE, paidTodayPence: await paidToday(tx, c.id, now), messageMax: MESSAGE_MAX_CHARS, noteMax: NOTE_MAX_CHARS, visitCapacity: VISIT_CAPACITY },
      reportReasons: REPORT_REASONS.map((r) => ({ ...r })),
    },
  };
}
