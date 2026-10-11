/**
 * Shared life between real players (spec ch. 19, 27). DESIGN DEFAULTS: limits and thresholds
 * are initial values to balance, chosen to keep contact consensual and the economy sane.
 */

/** A player counts as "online now" if the server saw them within this window. */
export const ONLINE_WINDOW_MS = 2 * 60_000;

export const MESSAGE_MAX_CHARS = 500;
/** Sends allowed per sender in any rolling minute (all conversations). */
export const MESSAGES_PER_MINUTE = 20;
export const THREAD_PAGE = 50;

export const FRIEND_REQUEST_DAYS = 7;
/** Requests one player may have waiting at once, and may send per London day. */
export const MAX_PENDING_OUTGOING = 10;
export const MAX_REQUESTS_PER_DAY = 20;
/** After a decline, the same sender must wait this long before asking again. */
export const REREQUEST_COOLDOWN_DAYS = 3;

export const GIFT_MAX_PENCE = 50_000;
/** Total a player may give or pay to other players per London day. */
export const DAILY_TRANSFER_CAP_PENCE = 100_000;
export const MONEY_REQUEST_DAYS = 3;
export const MAX_PENDING_MONEY_REQUESTS = 5;
export const NOTE_MAX_CHARS = 140;

/** Real minutes a visit lasts before the guest heads home (shortened only by the dev time scale). */
export const VISIT_MINUTES = 30;
/** Guests one home can hold at once (the source showed a cap of eight). */
export const VISIT_CAPACITY = 8;

/**
 * Friendship grows only when both people take part on the same London day.
 * A shared day pays MUTUAL_DAY points, plus a bonus if a gift or a visit happened that day.
 */
export const FRIEND_POINTS = { mutualDay: 2, gift: 1, visit: 1 };

/** Accepted friends start as Acquaintances. */
export const PLAYER_FRIEND_TIERS = [
  { points: 0, title: "Acquaintance" },
  { points: 6, title: "Friend" },
  { points: 15, title: "Good friend" },
  { points: 30, title: "Best friend" },
];
export const BEST_FRIEND_POINTS = PLAYER_FRIEND_TIERS[PLAYER_FRIEND_TIERS.length - 1].points;

export function playerFriendTier(points: number) {
  let i = 0;
  for (let k = 0; k < PLAYER_FRIEND_TIERS.length; k++) if (points >= PLAYER_FRIEND_TIERS[k].points) i = k;
  const next = PLAYER_FRIEND_TIERS[i + 1];
  return { level: i, title: PLAYER_FRIEND_TIERS[i].title, next: next ? next.points : null, best: i === PLAYER_FRIEND_TIERS.length - 1 };
}

export const REPORT_REASONS = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hateful content" },
  { id: "spam", label: "Spam or scams" },
  { id: "sexual", label: "Sexual or inappropriate content" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "other", label: "Something else" },
] as const;

export const RANKING_SIZE = 20;
export const FEED_PAGE = 30;

/** Public events that can appear in the city feed (only for players who share them). */
export const FEED_EVENT_TYPES = ["promoted", "story_completed", "treasure_found", "moved_home", "home_bought", "certified"] as const;

/**
 * Message bodies and notes: trimmed, internal whitespace runs kept, control characters removed.
 * Rendering is always as text (React escapes it), never as HTML.
 */
export function cleanText(raw: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return String(raw ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max + 1);
}
