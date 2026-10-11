/**
 * Logical backup and restore of every game table (spec ch. 35.4: "backup and restore are tested").
 * pg_dump isn't available everywhere the game runs, so this exports rows as JSON in foreign-key dependency
 * order and restores them in one transaction.
 *
 * Every value travels as Postgres's own text form (`col::text`) and comes back through the column type's
 * input function, so bigint pence, numeric, jsonb, arrays, timestamps and floats round-trip exactly.
 * Sequences are saved and restored too, so new ids continue where the original left off.
 *
 * Not included: schema_migrations (the backup records the list instead and restore requires the same list),
 * and live credentials that must never sit in a backup file: sessions, password reset links and sign-in
 * throttle rows. Everyone signs in again after a restore; accounts and password hashes are kept.
 */

export interface Q {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const BACKUP_FORMAT = "london-life-backup";
export const BACKUP_VERSION = 1;
export const EXCLUDED_TABLES = new Set(["schema_migrations", "sessions", "password_reset_tokens", "auth_attempts"]);

export interface BackupTable {
  name: string;
  columns: string[];
  /** Each row is an array aligned with `columns`: Postgres text values, or null. */
  rows: (string | null)[][];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  migrations: string[];
  tables: BackupTable[];
  sequences: { name: string; value: string | null }[];
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

interface ForeignKey {
  child: string;
  parent: string;
  childCols: string[];
  parentCols: string[];
}

async function listTables(q: Q): Promise<string[]> {
  const r = await q.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  return r.rows.map((x) => String(x.tablename));
}

async function foreignKeys(q: Q): Promise<ForeignKey[]> {
  const r = await q.query(
    `SELECT cl.relname AS child, pl.relname AS parent,
            ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY k.i) AS child_cols,
            ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, i) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n ORDER BY k.i) AS parent_cols
     FROM pg_constraint c
     JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace cn ON cn.oid = cl.relnamespace
     JOIN pg_class pl ON pl.oid = c.confrelid
     WHERE c.contype = 'f' AND cn.nspname = 'public'`,
  );
  return r.rows.map((x) => ({ child: x.child, parent: x.parent, childCols: x.child_cols, parentCols: x.parent_cols }));
}

/** Parents before children (Kahn's algorithm, alphabetical among equals so output is stable). Self-references are handled per row. */
export function dependencyOrder(tables: string[], fks: { child: string; parent: string }[]): string[] {
  const set = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const fk of fks) if (fk.child !== fk.parent && set.has(fk.child) && set.has(fk.parent)) deps.get(fk.child)!.add(fk.parent);
  const out: string[] = [];
  const done = new Set<string>();
  while (out.length < tables.length) {
    const ready = tables.filter((t) => !done.has(t) && [...deps.get(t)!].every((p) => done.has(p))).sort();
    if (!ready.length) throw new Error(`Foreign keys form a cycle between: ${tables.filter((t) => !done.has(t)).join(", ")}`);
    for (const t of ready) {
      out.push(t);
      done.add(t);
    }
  }
  return out;
}

/** Orders rows so a row referenced through a self-foreign-key is restored before rows pointing at it. */
export function orderSelfReferences(rows: (string | null)[][], refCol: number, keyCol: number): (string | null)[][] {
  const pending = [...rows];
  const keys = new Set(rows.map((r) => r[keyCol]));
  const placed = new Set<string | null>();
  const out: (string | null)[][] = [];
  while (pending.length) {
    const before = pending.length;
    for (let i = 0; i < pending.length; ) {
      const ref = pending[i][refCol];
      if (ref === null || !keys.has(ref) || placed.has(ref)) {
        placed.add(pending[i][keyCol]);
        out.push(pending.splice(i, 1)[0]);
      } else i++;
    }
    if (pending.length === before) throw new Error("Rows reference each other in a loop and can't be ordered.");
  }
  return out;
}

async function columnsOf(q: Q, table: string): Promise<{ name: string; type: string }[]> {
  const r = await q.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
     FROM pg_attribute a
     WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
     ORDER BY a.attnum`,
    [`public.${ident(table)}`],
  );
  return r.rows.map((x) => ({ name: String(x.name), type: String(x.type) }));
}

async function primaryKey(q: Q, table: string): Promise<string[]> {
  const r = await q.query(
    `SELECT a.attname AS name FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`,
    [`public.${ident(table)}`],
  );
  return r.rows.map((x) => String(x.name));
}

async function appliedMigrations(q: Q): Promise<string[]> {
  const r = await q.query("SELECT name FROM schema_migrations ORDER BY name");
  return r.rows.map((x) => String(x.name));
}

async function gameTables(q: Q) {
  const tables = (await listTables(q)).filter((t) => !EXCLUDED_TABLES.has(t));
  const fks = await foreignKeys(q);
  return { order: dependencyOrder(tables, fks), fks };
}

/** Reads every game table. Run it against a quiet database or accept a point-in-time view of one transaction. */
export async function exportDatabase(q: Q, now = new Date()): Promise<Backup> {
  await q.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const { order } = await gameTables(q);
    const tables: BackupTable[] = [];
    for (const name of order) {
      const cols = await columnsOf(q, name);
      const pk = await primaryKey(q, name);
      const values = cols.map((c) => `t.${ident(c.name)}::text`).join(", ");
      const orderBy = pk.length ? ` ORDER BY ${pk.map((c) => `t.${ident(c)}`).join(", ")}` : "";
      const r = await q.query(`SELECT COALESCE(json_agg(ARRAY[${values}]${orderBy}), '[]')::text AS j FROM public.${ident(name)} t`);
      tables.push({ name, columns: cols.map((c) => c.name), rows: JSON.parse(r.rows[0].j) });
    }
    const seq = await q.query("SELECT sequencename AS name, last_value::text AS value FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename");
    const backup: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now.toISOString(),
      migrations: await appliedMigrations(q),
      tables,
      sequences: seq.rows.map((x) => ({ name: String(x.name), value: x.value === null ? null : String(x.value) })),
    };
    await q.query("COMMIT");
    return backup;
  } catch (err) {
    await q.query("ROLLBACK");
    throw err;
  }
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text) as Backup;
  if (b?.format !== BACKUP_FORMAT) throw new Error("This file isn't a London Life backup.");
  if (b.version !== BACKUP_VERSION) throw new Error(`Backup version ${b.version} isn't supported by this build (expects ${BACKUP_VERSION}).`);
  return b;
}

/**
 * Restores a backup into a database migrated to exactly the same migrations. The target must hold no game
 * rows unless `replace` is set, in which case everything (including sessions) is cleared first. All or nothing.
 */
export async function importDatabase(q: Q, backup: Backup, opts: { replace?: boolean } = {}): Promise<{ tables: number; rows: number }> {
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) throw new Error("Unsupported backup format.");
  await q.query("BEGIN");
  try {
    const have = await appliedMigrations(q).catch(() => [] as string[]);
    if (JSON.stringify(have) !== JSON.stringify([...backup.migrations].sort())) {
      const missing = backup.migrations.filter((m) => !have.includes(m));
      const extra = have.filter((m) => !backup.migrations.includes(m));
      throw new Error(
        `The target database's migrations don't match the backup.${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}${extra.length ? ` Not in backup: ${extra.join(", ")}.` : ""} Migrate the target to the backup's version first.`,
      );
    }
    const { order, fks } = await gameTables(q);
    const byName = new Map(backup.tables.map((t) => [t.name, t]));
    const unknown = backup.tables.filter((t) => !order.includes(t.name)).map((t) => t.name);
    if (unknown.length) throw new Error(`The target database has no table named ${unknown.join(", ")}.`);
    if (opts.replace) {
      const all = (await listTables(q)).filter((t) => t !== "schema_migrations");
      if (all.length) await q.query(`TRUNCATE ${all.map((t) => `public.${ident(t)}`).join(", ")} CASCADE`);
    } else {
      for (const name of order) {
        const r = await q.query(`SELECT EXISTS (SELECT 1 FROM public.${ident(name)}) AS any`);
        if (r.rows[0].any) throw new Error(`The target database already has rows in ${name}. Restore into an empty database, or pass --replace.`);
      }
    }
    let rows = 0;
    for (const name of order) {
      const t = byName.get(name);
      if (!t || !t.rows.length) continue;
      const cols = await columnsOf(q, name);
      const types = new Map(cols.map((c) => [c.name, c.type]));
      for (const c of t.columns) if (!types.has(c)) throw new Error(`Column ${name}.${c} in the backup doesn't exist in the target.`);
      let data = t.rows;
      for (const fk of fks.filter((f) => f.child === name && f.parent === name && f.childCols.length === 1)) {
        data = orderSelfReferences(data, t.columns.indexOf(fk.childCols[0]), t.columns.indexOf(fk.parentCols[0]));
      }
      const target = t.columns.map(ident).join(", ");
      const source = t.columns.map((c, i) => `(r->>${i})::${types.get(c)}`).join(", ");
      for (let i = 0; i < data.length; i += 500) {
        const chunk = data.slice(i, i + 500);
        await q.query(`INSERT INTO public.${ident(name)} (${target}) OVERRIDING SYSTEM VALUE SELECT ${source} FROM json_array_elements($1::json) r`, [JSON.stringify(chunk)]);
        rows += chunk.length;
      }
    }
    for (const s of backup.sequences) {
      const exists = await q.query("SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = $1", [s.name]);
      if (!exists.rowCount) continue;
      if (s.value === null) await q.query(`ALTER SEQUENCE public.${ident(s.name)} RESTART`);
      else await q.query("SELECT setval($1::regclass, $2::bigint, true)", [`public.${ident(s.name)}`, s.value]);
    }
    await q.query("COMMIT");
    return { tables: backup.tables.length, rows };
  } catch (err) {
    await q.query("ROLLBACK");
    throw err;
  }
}

/** Row count and content hash per game table, for proving a restore reproduced the original. */
export async function databaseDigest(q: Q): Promise<Record<string, { rows: number; md5: string }>> {
  const { order } = await gameTables(q);
  const out: Record<string, { rows: number; md5: string }> = {};
  for (const name of order) {
    const r = await q.query(`SELECT count(*)::int AS n, md5(COALESCE(string_agg(t::text, E'\\n' ORDER BY t::text), '')) AS h FROM public.${ident(name)} t`);
    out[name] = { rows: Number(r.rows[0].n), md5: String(r.rows[0].h) };
  }
  return out;
}

/** Characters whose cash differs from the sum of their ledger entries (should always be none). */
export async function ledgerImbalances(q: Q): Promise<{ characterId: string; cash: string; ledger: string }[]> {
  const r = await q.query(
    `SELECT c.id, c.cash_pence::text AS cash, COALESCE(SUM(l.amount_pence), 0)::text AS ledger
     FROM characters c LEFT JOIN ledger_entries l ON l.character_id = c.id
     GROUP BY c.id, c.cash_pence HAVING c.cash_pence <> COALESCE(SUM(l.amount_pence), 0)`,
  );
  return r.rows.map((x) => ({ characterId: x.id, cash: x.cash, ledger: x.ledger }));
}
