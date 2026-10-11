/**
 * Logical backup of every London Life game table to one JSON file.
 * Run: DATABASE_URL=postgresql://… npx tsx scripts/backup.ts [out-file]
 * Default out-file: backups/london-life-<timestamp>.json. See src/server/backup.ts for what is (and isn't) included.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { databaseDigest, exportDatabase, ledgerImbalances } from "@/server/backup";

async function main() {
  const url = process.env.DATABASE_URL ?? "postgresql://london:london@localhost:5432/london_life";
  const out = process.argv[2] ?? path.join("backups", `london-life-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const imbalanced = await ledgerImbalances(client);
    if (imbalanced.length) console.warn(`Warning: ${imbalanced.length} character(s) have cash that doesn't match their ledger. Backing up as-is.`);
    const backup = await exportDatabase(client);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(backup));
    const digest = await databaseDigest(client);
    const rows = Object.values(digest).reduce((n, t) => n + t.rows, 0);
    console.log(`Backed up ${backup.tables.length} tables, ${rows} rows, ${backup.migrations.length} migrations → ${out}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
