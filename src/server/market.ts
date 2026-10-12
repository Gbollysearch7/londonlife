import crypto from "node:crypto";
import { furnitureDef } from "@/content/catalogue";
import { MARKET, marketFee } from "@/content/market";
import { GameError, type Tx } from "./db";
import { lockPair } from "./social";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { emit, fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";
import { companyView, settleCompany } from "./company";
import { lockOtherCharacter, playerJobsView, settleOwnJobs } from "./playerJobs";

/** True when the furniture instance is locked by an active listing. */
export async function isListed(tx: Tx, furnitureId: string) {
  return (await tx.query("SELECT 1 FROM market_listings WHERE furniture_id = $1 AND status = 'active'", [furnitureId])).rowCount! > 0;
}

/** Shared-economy settlement for one locked character: company day results and their own escrow refunds/releases. */
export async function settleShared(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  return [...(await settleCompany(tx, c, now)), ...(await settleOwnJobs(tx, c, now))];
}

function price(p: { pricePence?: unknown }) {
  const n = Number(p.pricePence);
  if (!Number.isInteger(n) || n < MARKET.minPricePence || n > MARKET.maxPricePence) {
    throw new GameError("bad_price", `Set a price between ${fmtMoney(MARKET.minPricePence)} and ${fmtMoney(MARKET.maxPricePence)}.`);
  }
  return n;
}

export async function listItem(tx: Tx, accountId: string, p: { instanceId: string; pricePence: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const amount = price(p);
  const inst = (await tx.query("SELECT * FROM furniture WHERE id = $1 AND character_id = $2 FOR UPDATE", [p.instanceId, c.id])).rows[0];
  if (!inst) throw new GameError("not_owned", "You don't own that item.");
  if (inst.home_id) throw new GameError("placed", "Move it to storage before listing it.");
  const active = Number((await tx.query("SELECT count(*) AS n FROM market_listings WHERE seller_id = $1 AND status = 'active'", [c.id])).rows[0].n);
  if (active >= MARKET.maxActiveListings) throw new GameError("too_many", `You can have up to ${MARKET.maxActiveListings} items listed at once.`);
  const id = crypto.randomUUID();
  const ins = await tx.query(
    `INSERT INTO market_listings (id, seller_id, furniture_id, def_id, colour, price_pence, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'active',$7) ON CONFLICT (furniture_id) WHERE status = 'active' DO NOTHING`,
    [id, c.id, inst.id, inst.def_id, inst.colour, amount, now],
  );
  if (!ins.rowCount) throw new GameError("already_listed", "That item is already listed.");
  const name = furnitureDef(inst.def_id)?.name ?? inst.def_id;
  await emit(tx, c.id, "market_listed", { def: inst.def_id }, now);
  return { message: `${name} listed for ${fmtMoney(amount)}. It stays in your storage, locked, until it sells or you cancel.`, listingId: id };
}

export async function cancelListing(tx: Tx, accountId: string, p: { listingId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const res = await tx.query(
    "UPDATE market_listings SET status = 'cancelled', closed_at = $3 WHERE id = $1 AND seller_id = $2 AND status = 'active' RETURNING def_id",
    [p.listingId, c.id, now],
  );
  if (!res.rowCount) throw new GameError("not_active", "That listing isn't active — it may already have sold.");
  return { message: `Listing cancelled. ${furnitureDef(res.rows[0].def_id)?.name ?? "The item"} is back in your storage.` };
}

/**
 * Buys a listing in one transaction: buyer pays the price, the seller receives it less the market fee,
 * and the furniture instance moves to the buyer's storage. The listing row lock means it can sell once.
 */
export async function buyListing(tx: Tx, accountId: string, p: { listingId: string }, now: Date) {
  // Lock buyer and seller in a fixed (id) order so two opposite purchases can't deadlock.
  const pre = (await tx.query("SELECT seller_id FROM market_listings WHERE id = $1", [UUID_RE.test(String(p.listingId)) ? p.listingId : null])).rows[0];
  if (pre) await lockPair(tx, accountId, pre.seller_id);
  const buyer = await requireCharacter(tx, accountId);
  await settle(tx, buyer, now);
  const peek = (await tx.query("SELECT seller_id FROM market_listings WHERE id = $1", [p.listingId])).rows[0];
  if (!peek) throw new GameError("not_found", "That listing doesn't exist.");
  if (peek.seller_id === buyer.id) throw new GameError("own_listing", "You can't buy your own listing. Cancel it instead.");
  const seller = await lockOtherCharacter(tx, peek.seller_id);
  const l = (await tx.query("SELECT * FROM market_listings WHERE id = $1 FOR UPDATE", [p.listingId])).rows[0];
  if (l.status !== "active") throw new GameError("sold", "Sorry — that item has already sold or been withdrawn.");
  const amount = Number(l.price_pence);
  const fee = marketFee(amount);
  const name = furnitureDef(l.def_id)?.name ?? l.def_id;
  await moveMoney(tx, buyer, -amount, "market", `Bought ${name} from ${seller.name}`, { type: "listing", id: l.id });
  const moved = await tx.query(
    "UPDATE furniture SET character_id = $2, home_id = NULL, x = NULL, y = NULL WHERE id = $1 AND character_id = $3 AND home_id IS NULL",
    [l.furniture_id, buyer.id, seller.id],
  );
  if (!moved.rowCount) throw new GameError("unavailable", "That item is no longer available.");
  await moveMoney(tx, seller, amount - fee, "market", `Sold ${name}: ${fmtMoney(amount)} less ${fmtMoney(fee)} market fee`, { type: "listing", id: l.id });
  await tx.query("UPDATE market_listings SET status = 'sold', buyer_id = $2, fee_pence = $3, closed_at = $4 WHERE id = $1", [l.id, buyer.id, fee, now]);
  await emit(tx, buyer.id, "market_bought", { def: l.def_id }, now);
  await emit(tx, seller.id, "market_sold", { def: l.def_id }, now);
  return { message: `Bought ${name} for ${fmtMoney(amount)}. It's in your storage — place it at home.` };
}

export async function marketView(tx: Tx, c: CharRow, now: Date) {
  const row = (r: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: String(r.id),
    defId: String(r.def_id),
    name: furnitureDef(r.def_id)?.name ?? String(r.def_id),
    category: furnitureDef(r.def_id)?.category ?? "Decor",
    colour: String(r.colour),
    pricePence: Number(r.price_pence),
    feePence: marketFee(Number(r.price_pence)),
    listedAt: new Date(r.created_at).toISOString(),
  });
  const forSale = (
    await tx.query(
      `SELECT l.*, ch.name AS seller_name FROM market_listings l JOIN characters ch ON ch.id = l.seller_id
       WHERE l.status = 'active' AND l.seller_id <> $1 ORDER BY l.created_at DESC LIMIT 40`,
      [c.id],
    )
  ).rows.map((r) => ({ ...row(r), seller: String(r.seller_name) }));
  const mine = (await tx.query("SELECT * FROM market_listings WHERE seller_id = $1 AND status = 'active' ORDER BY created_at DESC", [c.id])).rows.map((r) => ({
    ...row(r),
    furnitureId: String(r.furniture_id),
  }));
  const history = (
    await tx.query(
      `SELECT l.*, s.name AS seller_name, b.name AS buyer_name FROM market_listings l
       JOIN characters s ON s.id = l.seller_id LEFT JOIN characters b ON b.id = l.buyer_id
       WHERE l.status = 'sold' AND (l.seller_id = $1 OR l.buyer_id = $1) ORDER BY l.closed_at DESC LIMIT 10`,
      [c.id],
    )
  ).rows.map((r) => ({
    ...row(r),
    side: r.seller_id === c.id ? ("sold" as const) : ("bought" as const),
    other: String(r.seller_id === c.id ? r.buyer_name ?? "a player" : r.seller_name),
    netPence: r.seller_id === c.id ? Number(r.price_pence) - Number(r.fee_pence) : -Number(r.price_pence),
    at: new Date(r.closed_at).toISOString(),
  }));
  return {
    market: { feeRate: MARKET.feeRate, minPricePence: MARKET.minPricePence, maxPricePence: MARKET.maxPricePence, maxListings: MARKET.maxActiveListings, forSale, mine, history, listedIds: mine.map((m) => m.furnitureId) },
    ...(await companyView(tx, c, now)),
    ...(await playerJobsView(tx, c, now)),
  };
}
