import { currentAccountId } from "./auth";
import { pool } from "./db";

/** Where a visitor belongs: welcome, character creation or the game. */
export async function routeFor(): Promise<"welcome" | "create" | "play"> {
  const accountId = await currentAccountId();
  if (!accountId) return "welcome";
  const r = await pool().query("SELECT 1 FROM characters WHERE account_id = $1", [accountId]);
  return r.rowCount ? "play" : "create";
}
