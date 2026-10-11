import crypto from "node:crypto";
import { FURNITURE, furnitureDef } from "@/content/catalogue";
import { isOpenAt, venue } from "@/content/world";
import { londonHour } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { type CharRow, emit, fmtMoney, furniturePrice, grantOnce, loadCtx, moveMoney, requireCharacter, settle } from "./game";

/** Venues part A: the Riverside Arts House gallery sells original art that becomes owned furniture. */
export const GALLERY_VENUE = "riverside_arts" as const;
export const GALLERY_ART = FURNITURE.filter((f) => f.soldAt === GALLERY_VENUE);
const artKey = (id: string) => `art:${id}`;

export async function buyArtwork(tx: Tx, accountId: string, p: { artId: string; colour?: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "Wait until you arrive.");
  const gallery = venue(GALLERY_VENUE)!;
  if (c.location !== GALLERY_VENUE) throw new GameError("wrong_place", `Original art is sold at the ${gallery.name} gallery desk.`);
  if (!isOpenAt(gallery, londonHour(now))) throw new GameError("closed", `${gallery.name} is closed.`);
  const def = furnitureDef(String(p?.artId ?? ""));
  if (!def || def.soldAt !== GALLERY_VENUE) throw new GameError("bad_item", "That piece isn't for sale here.");
  // Each piece is an original: one per character, ever (selling it later doesn't put it back on the wall).
  if (!(await grantOnce(tx, c.id, artKey(def.id), now))) throw new GameError("already_owned", `You already bought ${def.name}; it's a one-off original.`);
  const colour = p.colour && def.colours.includes(p.colour) ? p.colour : def.colours[0];
  const price = furniturePrice(def.pricePence, c.perks);
  const id = crypto.randomUUID();
  await moveMoney(tx, c, -price, "furniture", `Original art: ${def.name}`, { type: "furniture", id });
  await tx.query("INSERT INTO furniture (id, character_id, def_id, colour, price_pence) VALUES ($1,$2,$3,$4,$5)", [id, c.id, def.id, colour, price]);
  await emit(tx, c.id, "furniture_bought", { def: def.id }, now);
  await emit(tx, c.id, "art_bought", { def: def.id }, now);
  return { message: `${def.name} by ${def.artist} is yours for ${fmtMoney(price)}. It's waiting in storage — place it at home.`, instanceId: id };
}

export async function galleryView(tx: Tx, c: CharRow, now: Date) {
  const owned = new Set(
    (await tx.query("SELECT reward_key FROM once_rewards WHERE character_id = $1 AND reward_key LIKE 'art:%'", [c.id])).rows.map((r) => String(r.reward_key)),
  );
  const here = c.location === GALLERY_VENUE;
  const open = isOpenAt(venue(GALLERY_VENUE)!, londonHour(now));
  return {
    gallery: {
      here,
      open,
      pieces: GALLERY_ART.map((f) => {
        const pricePence = furniturePrice(f.pricePence, c.perks);
        const bought = owned.has(artKey(f.id));
        const reason = bought ? "Already yours — originals are one of a kind." : !open ? "The gallery is closed." : pricePence > c.cash_pence ? `Costs ${fmtMoney(pricePence)}; you have ${fmtMoney(c.cash_pence)}.` : null;
        return { id: f.id, name: f.name, artist: f.artist ?? "", blurb: f.blurb, pricePence, colours: f.colours, surface: f.surface, decor: f.decor ?? 0, bought, reason };
      }),
    },
  };
}
