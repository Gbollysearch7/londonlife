import { Pool } from "pg";

const globalForPool = globalThis as unknown as { __llPool?: Pool };

export function pool(): Pool {
  if (!globalForPool.__llPool) {
    globalForPool.__llPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "postgresql://london:london@localhost:5432/london_life",
      max: 10,
    });
  }
  return globalForPool.__llPool;
}

/** The only database surface the game rules use, so the same rules can also run on PGlite in the test build. */
export interface Tx {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** A rule rejection: rolled back, shown to the player, never a partial debit. */
export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
