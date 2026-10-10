/**
 * Browser stand-in for src/server/db.ts: the same game rules run against Postgres compiled to WebAssembly (PGlite).
 * Used only by the test build; the real game uses a Postgres server.
 */
import type { PGlite, Transaction } from "@electric-sql/pglite";

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface Tx {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let db: PGlite | null = null;
export function setDb(d: PGlite) {
  db = d;
}

function adapt(q: PGlite | Transaction): Tx {
  return {
    async query(sql, params = []) {
      const r = await q.query(sql, params as unknown[]);
      return { rows: r.rows as any[], rowCount: r.rows.length || r.affectedRows || 0 }; // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  };
}

export const pool = () => adapt(db!);

export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db!.transaction((t) => fn(adapt(t)));
}
