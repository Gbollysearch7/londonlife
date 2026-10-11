import { APPEARANCE_OPTIONS, type Appearance } from "@/content/character";
import { GARMENTS, SALON, WARDROBE_SHOP, garmentDef, type Slot } from "@/content/wardrobe";
import { isOpenAt, venue } from "@/content/world";
import { londonHour } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { emit, fmtMoney, loadCtx, moveMoney, requireCharacter, settle, type CharRow } from "./game";

async function owned(tx: Tx, charId: string) {
  const rows = (await tx.query("SELECT item_id FROM owned_garments WHERE character_id = $1", [charId])).rows.map((r) => r.item_id as string);
  return new Set([...GARMENTS.filter((g) => g.starter).map((g) => g.id), ...rows]);
}

async function requireOpenAt(tx: Tx, c: CharRow, place: string, now: Date) {
  const ctx = await loadCtx(tx, c, now);
  const v = venue(place as never)!;
  if (ctx.journey || c.location !== place) throw new GameError("wrong_place", `Only at ${v.name}.`);
  if (!isOpenAt(v, londonHour(now))) throw new GameError("closed", `${v.name} is closed right now.`);
  if (ctx.running || ctx.shift) throw new GameError("busy", "Finish what you're doing first.");
}

export async function buyGarment(tx: Tx, accountId: string, p: { itemId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const g = garmentDef(p.itemId);
  if (!g || g.starter) throw new GameError("bad_item", "That isn't for sale.");
  await requireOpenAt(tx, c, WARDROBE_SHOP, now);
  if ((await owned(tx, c.id)).has(g.id)) throw new GameError("owned", `You already own the ${g.name.toLowerCase()}.`);
  await moveMoney(tx, c, -g.pricePence, "wardrobe", g.name);
  await tx.query("INSERT INTO owned_garments (character_id, item_id, price_pence, bought_at) VALUES ($1,$2,$3,$4)", [c.id, g.id, g.pricePence, now]);
  await emit(tx, c.id, "garment_bought", { item: g.id }, now);
  return { message: `Bought the ${g.name.toLowerCase()}. Wear it from the Wardrobe app.` };
}

const STYLE_KEY: Record<Slot, keyof NonNullable<Appearance["outfit"]>> = { top: "top", bottom: "bottom", hat: "hat", glasses: "glasses", scarf: "scarf" };

/** Equip owned styles and pick colours from the palette. Free and reversible. */
export async function equipOutfit(
  tx: Tx,
  accountId: string,
  p: { top?: string; bottom?: string; hat?: string | null; glasses?: boolean; scarf?: boolean; topColour?: number; bottomColour?: number; shoesColour?: number },
  now: Date,
) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const have = await owned(tx, c.id);
  const a: Appearance = { ...c.appearance, outfit: { ...(c.appearance.outfit ?? {}) } };
  const wear = (slot: Slot, id: string | null | undefined) => {
    if (id === undefined) return;
    if (id === null) {
      if (slot === "top" || slot === "bottom") throw new GameError("bad_outfit", "You'll need to wear something.");
      delete a.outfit![STYLE_KEY[slot]];
      return;
    }
    const g = garmentDef(id);
    if (!g || g.slot !== slot) throw new GameError("bad_outfit", "That doesn't go there.");
    if (!have.has(g.id)) throw new GameError("not_owned", `You don't own the ${g.name.toLowerCase()} yet.`);
    (a.outfit as Record<string, number | boolean>)[STYLE_KEY[slot]] = slot === "glasses" || slot === "scarf" ? true : g.style;
  };
  wear("top", p.top);
  wear("bottom", p.bottom);
  wear("hat", p.hat);
  if (p.glasses !== undefined) wear("glasses", p.glasses ? "glasses" : null);
  if (p.scarf !== undefined) wear("scarf", p.scarf ? "scarf" : null);
  const colour = (key: "top" | "bottom" | "shoes", v: number | undefined) => {
    if (v === undefined) return;
    if (!Number.isInteger(v) || v < 0 || v >= APPEARANCE_OPTIONS[key].length) throw new GameError("bad_colour", "Pick one of the colours shown.");
    a[key] = v;
  };
  colour("top", p.topColour);
  colour("bottom", p.bottomColour);
  colour("shoes", p.shoesColour);
  await tx.query("UPDATE characters SET appearance = $2 WHERE id = $1", [c.id, a]);
  return { message: "Outfit updated." };
}

export async function changeHair(tx: Tx, accountId: string, p: { hairStyle: number; hairColour: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  await requireOpenAt(tx, c, SALON.venue, now);
  const style = Number(p.hairStyle);
  const colour = Number(p.hairColour);
  if (!Number.isInteger(style) || style < 0 || style >= APPEARANCE_OPTIONS.hairStyle.length) throw new GameError("bad_style", "Pick a style.");
  if (!Number.isInteger(colour) || colour < 0 || colour >= APPEARANCE_OPTIONS.hairColour.length) throw new GameError("bad_colour", "Pick a colour.");
  const cost = (style !== c.appearance.hairStyle ? SALON.stylePence : 0) + (colour !== c.appearance.hairColour ? SALON.colourPence : 0);
  if (!cost) throw new GameError("no_change", "That's the look you already have.");
  await moveMoney(tx, c, -cost, "salon", `New hair at Crown & Curl`);
  await tx.query("UPDATE characters SET appearance = $2 WHERE id = $1", [c.id, { ...c.appearance, hairStyle: style, hairColour: colour }]);
  await emit(tx, c.id, "hair_changed", {}, now);
  return { message: `Precious works her magic. New look for ${fmtMoney(cost)}!` };
}

export async function wardrobeView(tx: Tx, c: CharRow) {
  const have = await owned(tx, c.id);
  return {
    shop: WARDROBE_SHOP,
    items: GARMENTS.map((g) => ({ ...g, owned: have.has(g.id) })),
    salon: SALON,
  };
}
