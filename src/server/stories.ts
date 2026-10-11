import crypto from "node:crypto";
import { STORIES, TREASURE_SPOTS, choiceChance, storyDef, storyLayout, storyNode, treasureReward, type StoryChoice } from "@/content/stories";
import type { SkillId } from "@/content/types";
import { isOpenAt, venue } from "@/content/world";
import { applyEffects } from "@/sim/needs";
import { seededRandom } from "@/sim/shift";
import { londonDayKey, londonHour } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { effectiveLevels } from "./skills";
import { perkEffects } from "@/content/goals";
import { grantMoodlet } from "./goals";
import { addXp, emit, fmtMoney, grantOnce, loadCtx, moveMoney, requireCharacter, saveNeeds, settle, type CharRow } from "./game";

/** Effective (rust-adjusted) levels, shared with every other skill check. */
async function levels(tx: Tx, charId: string, now: Date) {
  return (await effectiveLevels(tx, charId, now)) as Partial<Record<SkillId, number>>;
}

async function activeRun(tx: Tx, charId: string, lock = false) {
  return (await tx.query(`SELECT * FROM story_runs WHERE character_id = $1 AND status = 'running'${lock ? " FOR UPDATE" : ""}`, [charId])).rows[0] ?? null;
}

const cap = (s: string) => (s === "enterprise" ? "Enterprise" : s[0].toUpperCase() + s.slice(1));

/** Why a choice can't be taken right now, or null. Shared by the view and the command. */
function choiceBlocker(choice: StoryChoice, c: CharRow, lv: Partial<Record<SkillId, number>>) {
  if (choice.requires && (lv[choice.requires.skill] ?? 0) < choice.requires.level) return `Needs ${cap(choice.requires.skill)} level ${choice.requires.level}.`;
  if (choice.costPence && choice.costPence > c.cash_pence) return `Costs ${fmtMoney(choice.costPence)}; you have ${fmtMoney(c.cash_pence)}.`;
  return null;
}

export async function startStory(tx: Tx, accountId: string, p: { storyId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const story = storyDef(p.storyId);
  if (!story) throw new GameError("bad_story", "Unknown story.");
  if (await activeRun(tx, c.id)) throw new GameError("story_active", "Finish or leave your current story first.");
  await tx.query("INSERT INTO story_runs (id, character_id, story_id, node_id, status, started_at) VALUES ($1,$2,$3,$4,'running',$5)", [
    crypto.randomUUID(),
    c.id,
    story.id,
    story.start,
    now,
  ]);
  return { message: `Story started: ${story.title}.` };
}

export async function chooseStory(tx: Tx, accountId: string, p: { choiceId: string; nodeId?: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const run = await activeRun(tx, c.id, true);
  if (!run) throw new GameError("no_story", "You're not in a story right now.");
  // A stale tab choosing for an old scene is refused rather than applied to the new one.
  if (p.nodeId && p.nodeId !== run.node_id) throw new GameError("stale", "The story has moved on — refresh to see where you are.");
  const story = storyDef(run.story_id)!;
  const node = storyNode(story, run.node_id)!;
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "Wait until you arrive.");
  if (ctx.running || ctx.shift) throw new GameError("busy", "Finish what you're doing first.");
  if (node.location && c.location !== node.location) throw new GameError("wrong_place", `This part of the story happens at ${venue(node.location)!.name}.`);
  const choice = node.choices.find((x) => x.id === p.choiceId);
  if (!choice) throw new GameError("bad_choice", "That isn't one of the options.");
  const lv = await levels(tx, c.id, now);
  const blocked = choiceBlocker(choice, c, lv);
  if (blocked) throw new GameError("blocked", blocked);

  const parts: string[] = [];
  if (choice.costPence) await moveMoney(tx, c, -choice.costPence, "story", `${story.title}: ${choice.label}`, { type: "story", id: run.id });
  if (choice.needs) {
    c.needs = applyEffects(c.needs, choice.needs);
    await saveNeeds(tx, c, now);
  }
  // Choice XP pays once per character per choice, so replaying a story can't farm skills.
  if (choice.xp && (await grantOnce(tx, c.id, `story_xp:${story.id}:${node.id}:${choice.id}`, now))) {
    const x = await addXp(tx, c, choice.xp.skill, choice.xp.amount, now);
    parts.push(`${cap(x.skill)} +${x.gained} XP`);
  }
  const log = run.log as { node: string; choice: string; roll?: number; success?: boolean; at: string }[];
  let next = choice.next;
  const chance = choiceChance(choice, lv, perkEffects(c.perks).socialChance);
  const entry: (typeof log)[number] = { node: node.id, choice: choice.id, at: now.toISOString() };
  if (chance !== null) {
    // Rolled once on the server from the run and step; the result is stored, so a reload can't reroll it.
    const roll = seededRandom(`story:${run.id}:${node.id}:${choice.id}:${log.length}`)();
    entry.roll = Math.round(roll * 1000) / 1000;
    entry.success = roll < chance;
    if (!entry.success && choice.failNext) next = choice.failNext;
    parts.unshift(entry.success ? "It worked!" : "It didn't go your way.");
  }
  log.push(entry);
  const target = storyNode(story, next)!;
  if (target.ending) {
    await tx.query("UPDATE story_runs SET node_id = $2, log = $3, status = 'completed', completed_at = $4, ending = $2 WHERE id = $1", [run.id, next, JSON.stringify(log), now]);
    const first = await tx.query("INSERT INTO story_rewards (character_id, story_id, ending, granted_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [c.id, story.id, next, now]);
    const e = target.ending;
    if (first.rowCount) {
      if (e.pence) await moveMoney(tx, c, e.pence, "story", `${story.title}: ${e.title}`, { type: "story", id: run.id });
      await tx.query("UPDATE characters SET reputation_xp = reputation_xp + $2, stars = stars + $3 WHERE id = $1", [c.id, e.rep, e.stars]);
      parts.push(`+${e.rep} reputation${e.stars ? `, +${e.stars} star${e.stars > 1 ? "s" : ""}` : ""}${e.pence ? `, ${fmtMoney(e.pence)}` : ""}`);
    } else parts.push("(replay — rewards are paid once per story)");
    await emit(tx, c.id, "story_completed", { story: story.id, ending: next }, now);
    if (e.rep >= 45) await grantMoodlet(tx, c, "story_high", story.id, now);
    return { message: `${e.title}. ${parts.join(" · ")}`, ending: e.title };
  }
  await tx.query("UPDATE story_runs SET node_id = $2, log = $3 WHERE id = $1", [run.id, next, JSON.stringify(log)]);
  return { message: parts.length ? parts.join(" · ") : "The story continues…" };
}

export async function leaveStory(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const run = await activeRun(tx, c.id, true);
  if (!run) throw new GameError("no_story", "You're not in a story right now.");
  await tx.query("UPDATE story_runs SET status = 'abandoned', completed_at = $2 WHERE id = $1", [run.id, now]);
  return { message: `Left “${storyDef(run.story_id)!.title}”. Money already spent isn't refunded; you can start again later.` };
}

export async function storyView(tx: Tx, c: CharRow, now: Date) {
  const run = await activeRun(tx, c.id);
  const rewards = (await tx.query("SELECT story_id, ending FROM story_rewards WHERE character_id = $1", [c.id])).rows;
  const lv = await levels(tx, c.id, now);
  const catalogue = STORIES.map((s) => {
    const r = rewards.find((x) => x.story_id === s.id);
    const best = s.nodes.filter((n) => n.ending).reduce((m, n) => Math.max(m, n.ending!.rep), 0);
    const stars = s.nodes.filter((n) => n.ending).reduce((m, n) => Math.max(m, n.ending!.stars), 0);
    return { id: s.id, title: s.title, blurb: s.blurb, completed: !!r, endingTitle: r ? storyNode(s, r.ending)?.ending?.title ?? null : null, maxRep: best, maxStars: stars, endings: s.nodes.filter((n) => n.ending).length };
  });
  let active = null;
  if (run) {
    const story = storyDef(run.story_id)!;
    const node = storyNode(story, run.node_id)!;
    const log = run.log as { node: string; choice: string; success?: boolean }[];
    const layout = storyLayout(story);
    active = {
      runId: String(run.id),
      storyId: story.id,
      title: story.title,
      nodeId: node.id,
      text: node.text,
      location: node.location ?? null,
      locationName: node.location ? venue(node.location)!.name : null,
      here: !node.location || node.location === c.location,
      choices: node.choices.map((ch) => {
        const chance = choiceChance(ch, lv, perkEffects(c.perks).socialChance);
        return {
          id: ch.id,
          label: ch.label,
          costPence: ch.costPence ?? 0,
          chance: chance === null ? null : Math.round(chance * 100),
          chanceSkill: ch.chance?.skill ? cap(ch.chance.skill) : null,
          xp: ch.xp ? { skill: cap(ch.xp.skill), amount: ch.xp.amount } : null,
          reason: choiceBlocker(ch, c, lv),
        };
      }),
      graph: {
        nodes: story.nodes.map((n) => ({
          id: n.id,
          x: layout.pos[n.id]?.x ?? 0,
          y: layout.pos[n.id]?.y ?? 0,
          visited: log.some((l) => l.node === n.id),
          current: n.id === node.id,
          ending: n.ending ? n.ending.title : null,
          place: n.location ? venue(n.location)!.name : null,
        })),
        edges: layout.edges,
        path: [...log.map((l) => l.node), node.id],
      },
    };
  }
  return { catalogue, active };
}

// ───────────────────────────── treasure ─────────────────────────────

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Today's spot is the same for every player in the city. */
export const treasureFor = (day: string) => TREASURE_SPOTS[hash(`treasure:${day}`) % TREASURE_SPOTS.length];

export async function claimTreasure(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const day = londonDayKey(now);
  const spot = treasureFor(day);
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "Wait until you arrive.");
  if (c.location !== spot.venue) throw new GameError("wrong_place", "There's no treasure here today. Read the clue again.");
  const v = venue(spot.venue)!;
  if (!isOpenAt(v, londonHour(now))) throw new GameError("closed", `${v.name} is closed right now.`);
  await tx.query("INSERT INTO treasure_days (day) VALUES ($1) ON CONFLICT DO NOTHING", [day]);
  // Locking the day row serialises claims, so ranks are unique and in order.
  const counter = (await tx.query("SELECT claims FROM treasure_days WHERE day = $1 FOR UPDATE", [day])).rows[0];
  const mine = await tx.query("SELECT 1 FROM treasure_claims WHERE day = $1 AND character_id = $2", [day, c.id]);
  if (mine.rowCount) throw new GameError("already_claimed", "You've already found today's treasure.");
  const rank = Number(counter.claims) + 1;
  const reward = treasureReward(rank);
  await tx.query("UPDATE treasure_days SET claims = $2 WHERE day = $1", [day, rank]);
  await tx.query("INSERT INTO treasure_claims (day, character_id, rank, reward_pence, claimed_at) VALUES ($1,$2,$3,$4,$5)", [day, c.id, rank, reward, now]);
  await moveMoney(tx, c, reward, "treasure", `Daily treasure (finder #${rank})`, { type: "treasure", id: day });
  await emit(tx, c.id, "treasure_found", { venue: spot.venue }, now);
  await grantMoodlet(tx, c, "lucky_find", "treasure", now);
  return { message: `You found today's treasure! Finder #${rank}: ${fmtMoney(reward)}.`, rank };
}

export async function treasureView(tx: Tx, c: CharRow, now: Date) {
  const day = londonDayKey(now);
  const spot = treasureFor(day);
  const mine = (await tx.query("SELECT rank, reward_pence FROM treasure_claims WHERE day = $1 AND character_id = $2", [day, c.id])).rows[0];
  const total = Number((await tx.query("SELECT claims FROM treasure_days WHERE day = $1", [day])).rows[0]?.claims ?? 0);
  const first = (
    await tx.query("SELECT ch.name, t.rank FROM treasure_claims t JOIN characters ch ON ch.id = t.character_id WHERE t.day = $1 ORDER BY t.rank LIMIT 3", [day])
  ).rows.map((r) => ({ name: String(r.name), rank: Number(r.rank) }));
  const here = c.location === spot.venue;
  return {
    day,
    clue: spot.clue,
    district: venue(spot.venue)!.district,
    found: !!mine,
    rank: mine ? Number(mine.rank) : null,
    rewardPence: mine ? Number(mine.reward_pence) : null,
    totalFinders: total,
    firstFinders: first,
    nextReward: treasureReward(total + 1),
    /** Only revealed once you're standing in the right place. */
    anchor: here && !mine ? spot.anchor : null,
  };
}
