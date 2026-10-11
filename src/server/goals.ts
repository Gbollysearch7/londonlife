import { AMBITION_MILESTONES, PERKS, WISHES, WISHES_PER_DAY, checkinReward, friendTier, moodletDef, perkDef, perkEffects, wishDef } from "@/content/goals";
import { AMBITIONS, AMBITION_COOLDOWN_DAYS, HOME_TIERS } from "@/content/character";
import { CAREERS } from "@/content/careers";
import { VENUES } from "@/content/world";
import { levelForXp } from "@/sim/progression";
import { missionProgress, type EventRow } from "@/sim/setup";
import { durationMs, londonDayKey } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const prevDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

async function addStarsRep(tx: Tx, c: CharRow, stars: number, rep: number) {
  if (!stars && !rep) return;
  await tx.query("UPDATE characters SET stars = stars + $2, reputation_xp = reputation_xp + $3 WHERE id = $1", [c.id, stars, rep]);
  c.stars += stars;
  c.reputation_xp += rep;
}

// ───────────────────────────── moodlets ─────────────────────────────

/** Grants (or refreshes) a moodlet. Positive moodlets last longer with the Sunny Side perk. */
export async function grantMoodlet(tx: Tx, c: CharRow, id: string, source: string, now: Date) {
  const def = moodletDef(id);
  if (!def) return null;
  const mult = def.strength > 0 ? perkEffects(c.perks).moodDuration : 1;
  const expires = new Date(now.getTime() + durationMs(def.minutes * mult));
  await tx.query(
    `INSERT INTO moodlets (character_id, moodlet_id, strength, expires_at, source) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (character_id, moodlet_id) DO UPDATE SET strength = EXCLUDED.strength, expires_at = GREATEST(moodlets.expires_at, EXCLUDED.expires_at), source = EXCLUDED.source`,
    [c.id, id, def.strength, expires, source],
  );
  return def.label;
}

export async function activeMoodlets(tx: Tx, c: CharRow, now: Date) {
  await tx.query("DELETE FROM moodlets WHERE character_id = $1 AND expires_at <= $2", [c.id, now]);
  const rows = (await tx.query("SELECT * FROM moodlets WHERE character_id = $1 ORDER BY expires_at DESC", [c.id])).rows;
  return rows.map((r) => {
    const d = moodletDef(r.moodlet_id);
    return { id: String(r.moodlet_id), label: d?.label ?? r.moodlet_id, icon: d?.icon ?? "·", strength: Number(r.strength), expiresAt: new Date(r.expires_at).toISOString() };
  });
}

// ───────────────────────────── check-in ─────────────────────────────

export async function dailyCheckIn(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const day = londonDayKey(now);
  const last = (await tx.query("SELECT day, streak FROM checkins WHERE character_id = $1 ORDER BY day DESC LIMIT 1", [c.id])).rows[0];
  if (last?.day === day) throw new GameError("already_checked_in", "You've already checked in today. Come back tomorrow!");
  const streak = last?.day === prevDay(day) ? Number(last.streak) + 1 : 1;
  const reward = checkinReward(streak);
  const ins = await tx.query("INSERT INTO checkins (character_id, day, streak, reward, claimed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [c.id, day, streak, reward, now]);
  if (!ins.rowCount) throw new GameError("already_checked_in", "You've already checked in today.");
  await moveMoney(tx, c, reward.pence, "checkin", `Daily check-in, day ${streak}`);
  await addStarsRep(tx, c, reward.stars, reward.rep);
  return { message: `Day ${streak} check-in: ${fmtMoney(reward.pence)}${reward.stars ? `, +${reward.stars} star${reward.stars > 1 ? "s" : ""}` : ""}, +${reward.rep} reputation.`, streak };
}

// ───────────────────────────── wishes ─────────────────────────────

function assignWishes(charId: string, day: string) {
  const pool = [...WISHES];
  const out: string[] = [];
  let h = hash(`${charId}:${day}:wishes`);
  while (out.length < WISHES_PER_DAY && pool.length) {
    out.push(pool.splice(h % pool.length, 1)[0].id);
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
  }
  return out;
}

async function wishState(tx: Tx, c: CharRow, now: Date) {
  const day = londonDayKey(now);
  await tx.query("INSERT INTO wish_assignments (character_id, period_key, wish_ids) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [c.id, day, assignWishes(c.id, day)]);
  const ids = (await tx.query("SELECT wish_ids FROM wish_assignments WHERE character_id = $1 AND period_key = $2", [c.id, day])).rows[0].wish_ids as string[];
  const events = (await tx.query("SELECT type, data FROM game_events WHERE character_id = $1 AND period_key = $2", [c.id, day])).rows as EventRow[];
  const claims = (await tx.query("SELECT wish_id FROM wish_claims WHERE character_id = $1 AND period_key = $2", [c.id, day])).rows.map((r) => r.wish_id as string);
  return { day, ids, events, claims };
}

export async function claimWish(tx: Tx, accountId: string, p: { wishId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const w = await wishState(tx, c, now);
  const def = wishDef(p.wishId);
  if (!def || !w.ids.includes(def.id)) throw new GameError("not_assigned", "That isn't one of today's wishes.");
  if (missionProgress({ ...def, pool: "Easy", reward: { pence: 0, rep: 0 } }, w.events) < def.target) throw new GameError("not_ready", "Not done yet.");
  const ins = await tx.query("INSERT INTO wish_claims (character_id, period_key, wish_id, stars, claimed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [c.id, w.day, def.id, def.stars, now]);
  if (!ins.rowCount) throw new GameError("already_claimed", "Already claimed.");
  await addStarsRep(tx, c, def.stars, 0);
  return { message: `Wish granted: +${def.stars} star${def.stars > 1 ? "s" : ""}.` };
}

// ───────────────────────────── perks ─────────────────────────────

export async function buyPerk(tx: Tx, accountId: string, p: { perkId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const def = perkDef(p.perkId);
  if (!def) throw new GameError("bad_perk", "Unknown perk.");
  if (c.perks.includes(def.id)) throw new GameError("owned", `You already have ${def.name}.`);
  if (c.stars < def.stars) throw new GameError("insufficient_stars", `${def.name} costs ${def.stars} stars; you have ${c.stars}.`);
  // Settle at the old rates first so the new perk never applies to time already passed.
  await settle(tx, c, now);
  const ins = await tx.query("INSERT INTO perks (character_id, perk_id, stars, bought_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [c.id, def.id, def.stars, now]);
  if (!ins.rowCount) throw new GameError("owned", `You already have ${def.name}.`);
  await tx.query("UPDATE characters SET stars = stars - $2 WHERE id = $1", [c.id, def.stars]);
  return { message: `${def.name} unlocked: ${def.blurb}` };
}

// ───────────────────────────── friendships & ambitions ─────────────────────────────

async function friendships(tx: Tx, c: CharRow) {
  const rows = (await tx.query("SELECT data->>'npc' AS npc, count(*) AS n FROM game_events WHERE character_id = $1 AND type = 'npc_time' GROUP BY 1", [c.id])).rows;
  const points = Object.fromEntries(rows.map((r) => [r.npc, Number(r.n)]));
  return VENUES.flatMap((v) => v.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, venue: v.name, venueId: v.id, points: points[n.id] ?? 0, ...friendTier(points[n.id] ?? 0) }))).sort(
    (a, b) => b.points - a.points,
  );
}

const HOME_PRICES: Record<string, number> = { student_hall: 800000, shared_room: 800000, outer_studio: 1800000, one_bed: 3600000 };

async function ambitionProgress(tx: Tx, c: CharRow, friends: Awaited<ReturnType<typeof friendships>>): Promise<{ progress: number; note: string }> {
  const lv = async (skill: string) => levelForXp(Number((await tx.query("SELECT xp FROM skills WHERE character_id = $1 AND skill_id = $2", [c.id, skill])).rows[0]?.xp ?? 0));
  switch (c.ambition) {
    case "music_master": {
      const m = await lv("music");
      return { progress: m / 10, note: `Music level ${m} of 10.` };
    }
    case "career_top": {
      const p = (await tx.query("SELECT * FROM career_progress WHERE character_id = $1", [c.id])).rows[0];
      if (!p) return { progress: 0, note: "Join a career in the Jobs app to start climbing." };
      const steps = (Number(p.rank) - 1) * 3 + (Number(p.grade) - 1);
      const name = CAREERS.find((k) => k.id === p.career_id)?.name ?? "your career";
      return { progress: steps / 14, note: `${steps} of 14 promotions in ${name}.` };
    }
    case "four_friends": {
      const best = friends.map((f) => Math.min(1, f.points / 25)).slice(0, 4);
      const progress = best.reduce((a, b) => a + b, 0) / 4;
      const count = friends.filter((f) => f.level >= 4).length;
      return { progress, note: `${count} of 4 best friends. Spend time with locals to grow closer.` };
    }
    case "home_owner": {
      const home = (await tx.query("SELECT * FROM homes WHERE character_id = $1", [c.id])).rows[0];
      if (home?.owned) return { progress: 1, note: "You own your home." };
      const price = HOME_PRICES[home?.tier_id] ?? 800000;
      const tier = HOME_TIERS.find((t) => t.id === home?.tier_id)?.name ?? "your home";
      return { progress: Math.min(0.95, c.cash_pence / price), note: `Saving towards ${fmtMoney(price)} to buy ${tier.toLowerCase()} (Homes app).` };
    }
    case "founder": {
      const e = await lv("enterprise");
      const pitched = (await tx.query("SELECT 1 FROM story_rewards WHERE character_id = $1 AND story_id = 'five_minute_pitch'", [c.id])).rowCount! > 0;
      return { progress: Math.min(1, (e / 10) * 0.8 + (pitched ? 0.2 : 0)), note: `Enterprise level ${e} of 10${pitched ? " · pitched to investors" : " · try The Five-Minute Pitch story"}. Companies arrive with shared play.` };
    }
    default:
      return { progress: 0, note: "" };
  }
}

export async function claimAmbition(tx: Tx, accountId: string, p: { milestone: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const m = AMBITION_MILESTONES.find((x) => x.at === Number(p.milestone));
  if (!m) throw new GameError("bad_milestone", "Unknown milestone.");
  const { progress } = await ambitionProgress(tx, c, await friendships(tx, c));
  if (progress + 1e-9 < m.at) throw new GameError("not_ready", "You haven't reached that milestone yet.");
  const ins = await tx.query("INSERT INTO ambition_claims (character_id, ambition_id, milestone, stars, claimed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [c.id, c.ambition, m.at, m.stars, now]);
  if (!ins.rowCount) throw new GameError("already_claimed", "Already claimed.");
  await addStarsRep(tx, c, m.stars, Math.round(m.at * 100));
  return { message: `Ambition milestone ${Math.round(m.at * 100)}%: +${m.stars} stars.` };
}

export async function changeAmbition(tx: Tx, accountId: string, p: { ambitionId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const def = AMBITIONS.find((a) => a.id === p.ambitionId);
  if (!def) throw new GameError("bad_ambition", "Unknown ambition.");
  if (def.id === c.ambition) throw new GameError("same", "That's already your ambition.");
  const row = (await tx.query("SELECT ambition_changed_at FROM characters WHERE id = $1", [c.id])).rows[0];
  const last = row.ambition_changed_at ? new Date(row.ambition_changed_at) : null;
  const readyAt = last ? last.getTime() + AMBITION_COOLDOWN_DAYS * 86_400_000 : 0;
  if (readyAt > now.getTime()) throw new GameError("cooldown", `You can change your ambition again on ${new Date(readyAt).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" })}.`);
  await tx.query("UPDATE characters SET ambition = $2, ambition_changed_at = $3 WHERE id = $1", [c.id, def.id, now]);
  return { message: `New ambition: ${def.name}. Milestones you've already claimed stay claimed.` };
}

// ───────────────────────────── view ─────────────────────────────

export async function goalsView(tx: Tx, c: CharRow, now: Date) {
  const day = londonDayKey(now);
  const last = (await tx.query("SELECT day, streak FROM checkins WHERE character_id = $1 ORDER BY day DESC LIMIT 1", [c.id])).rows[0];
  const claimedToday = last?.day === day;
  const streak = claimedToday ? Number(last.streak) : last?.day === prevDay(day) ? Number(last.streak) : 0;
  const nextStreak = claimedToday ? streak + 1 : streak + 1;
  const w = await wishState(tx, c, now);
  const friends = await friendships(tx, c);
  const amb = await ambitionProgress(tx, c, friends);
  const ambDef = AMBITIONS.find((a) => a.id === c.ambition)!;
  const claims = (await tx.query("SELECT milestone FROM ambition_claims WHERE character_id = $1 AND ambition_id = $2", [c.id, c.ambition])).rows.map((r) => Number(r.milestone));
  const changed = (await tx.query("SELECT ambition_changed_at FROM characters WHERE id = $1", [c.id])).rows[0].ambition_changed_at;
  const changeReadyAt = changed ? new Date(new Date(changed).getTime() + AMBITION_COOLDOWN_DAYS * 86_400_000) : null;
  return {
    checkin: {
      claimedToday,
      streak,
      todayReward: checkinReward(claimedToday ? streak : nextStreak),
      day: claimedToday ? streak : nextStreak,
      cycle: Array.from({ length: 7 }, (_, i) => checkinReward(i + 1)),
    },
    wishes: w.ids.map((id) => {
      const d = wishDef(id)!;
      const progress = missionProgress({ ...d, pool: "Easy", reward: { pence: 0, rep: 0 } }, w.events);
      return { id, title: d.title, target: d.target, progress, stars: d.stars, claimed: w.claims.includes(id), claimable: progress >= d.target && !w.claims.includes(id) };
    }),
    perks: PERKS.map((p) => ({ ...p, owned: c.perks.includes(p.id), affordable: c.stars >= p.stars })),
    friends,
    ambition: {
      id: ambDef.id,
      name: ambDef.name,
      blurb: ambDef.blurb,
      progress: amb.progress,
      note: amb.note,
      milestones: AMBITION_MILESTONES.map((m) => ({ ...m, claimed: claims.includes(m.at), claimable: amb.progress + 1e-9 >= m.at && !claims.includes(m.at) })),
      canChange: !changeReadyAt || changeReadyAt <= now,
      changeReadyAt: changeReadyAt?.toISOString() ?? null,
      options: AMBITIONS,
    },
  };
}
