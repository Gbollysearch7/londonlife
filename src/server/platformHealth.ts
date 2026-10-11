import fs from "node:fs";
import path from "node:path";
import type { Tx } from "./db";

/**
 * Service health for monitoring (spec ch. 35.4): database reachability, migration status and, on request,
 * a ledger-versus-balance check. Reports counts and migration file names only: no connection strings,
 * no error text from the driver, no account or character data.
 */
export interface HealthReport {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  database: { reachable: boolean; latencyMs: number | null };
  migrations: { expected: number; applied: number; latest: string | null; pending: string[]; unknown: string[] } | null;
  ledger?: { characters: number; imbalanced: number };
}

export function migrationFiles(dir = path.join(process.cwd(), "db", "migrations")): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return [];
  }
}

export async function healthReport(q: Tx, expected: string[], opts: { deep?: boolean } = {}, now = new Date()): Promise<HealthReport> {
  const checkedAt = now.toISOString();
  const started = Date.now();
  try {
    await q.query("SELECT 1");
  } catch {
    return { status: "down", checkedAt, database: { reachable: false, latencyMs: null }, migrations: null };
  }
  const latencyMs = Date.now() - started;
  let applied: string[] = [];
  try {
    const r = await q.query("SELECT name FROM schema_migrations ORDER BY name");
    applied = r.rows.map((x) => String(x.name));
  } catch {
    applied = []; // the table doesn't exist until the first migration run
  }
  const have = new Set(applied);
  const want = new Set(expected);
  const pending = expected.filter((n) => !have.has(n));
  const unknown = applied.filter((n) => !want.has(n));
  const report: HealthReport = {
    status: pending.length || unknown.length ? "degraded" : "ok",
    checkedAt,
    database: { reachable: true, latencyMs },
    migrations: { expected: expected.length, applied: applied.length, latest: applied[applied.length - 1] ?? null, pending, unknown },
  };
  if (opts.deep && !pending.length) {
    const r = await q.query(
      `SELECT count(*)::int AS characters,
              count(*) FILTER (WHERE c.cash_pence <> COALESCE(l.total, 0))::int AS imbalanced
       FROM characters c
       LEFT JOIN (SELECT character_id, SUM(amount_pence) AS total FROM ledger_entries GROUP BY character_id) l ON l.character_id = c.id`,
    );
    report.ledger = { characters: Number(r.rows[0].characters), imbalanced: Number(r.rows[0].imbalanced) };
    if (report.ledger.imbalanced > 0) report.status = "degraded";
  }
  return report;
}
