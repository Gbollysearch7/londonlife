import type { SkillId } from "@/content/types";
import { rustInfo, type RustInfo } from "@/sim/rust";
import type { Tx } from "./db";

/**
 * The one place skill levels for gating are computed. Activity gates, career entry and promotion,
 * story choices and minigame scoring all read effective (rust-adjusted) levels from here.
 */
export async function skillRust(tx: Tx, charId: string, now: Date): Promise<Record<string, RustInfo>> {
  const rows = (
    await tx.query(
      "SELECT s.skill_id, s.xp, s.best_level, s.last_used_at, c.created_at FROM skills s JOIN characters c ON c.id = s.character_id WHERE s.character_id = $1",
      [charId],
    )
  ).rows;
  return Object.fromEntries(
    rows.map((r) => [
      r.skill_id,
      rustInfo({ xp: Number(r.xp), bestLevel: Number(r.best_level), lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null }, now, new Date(r.created_at)),
    ]),
  );
}

/** Effective level per skill, for every skill check. */
export async function effectiveLevels(tx: Tx, charId: string, now: Date): Promise<Partial<Record<SkillId, number>> & Record<string, number>> {
  const info = await skillRust(tx, charId, now);
  return Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.effective]));
}

export async function effectiveLevel(tx: Tx, charId: string, skill: string, now: Date) {
  return (await effectiveLevels(tx, charId, now))[skill] ?? 0;
}
