import { pool } from "@/server/db";
import { runCommand, loadStateFor } from "@/server/commands";

let n = 0;
export const key = () => `test-key-${Date.now()}-${n++}-${Math.random().toString(36).slice(2)}`;

export async function resetDb() {
  await pool().query("TRUNCATE accounts, treasure_days CASCADE");
}

export async function makeAccount(email = `p${n++}@example.test`) {
  const r = await pool().query(
    "INSERT INTO accounts (email, password_hash, adult_confirmed_at) VALUES ($1, 'x', now()) RETURNING id",
    [email],
  );
  return r.rows[0].id as string;
}

export const appearance = { body: 0, skin: 2, hairStyle: 1, hairColour: 0, top: 0, bottom: 0, shoes: 0 };

/** Creates a character with a fixed origin by controlling the random draw. */
export async function makeCharacter(accountId: string, at: Date, originDraw = 0.3) {
  const { withTx } = await import("@/server/db");
  const { createCharacter } = await import("@/server/game");
  await withTx((tx) => createCharacter(tx, accountId, { name: "Ada", appearance, traits: ["foodie", "tidy"], ambition: "founder" }, at, () => originDraw));
}

export const cmd = (account: string, type: string, payload: unknown, at: Date, k = key()) => runCommand(account, k, type, payload, at);
export const state = (account: string, at: Date) => loadStateFor(account, at) as Promise<any>;

export async function ledgerMatches(account: string) {
  const r = await pool().query(
    `SELECT c.cash_pence, COALESCE(SUM(l.amount_pence), 0) AS total FROM characters c LEFT JOIN ledger_entries l ON l.character_id = c.id
     WHERE c.account_id = $1 GROUP BY c.cash_pence`,
    [account],
  );
  return Number(r.rows[0].cash_pence) === Number(r.rows[0].total);
}

export const minutes = (base: Date, m: number) => new Date(base.getTime() + m * 60_000);
