/**
 * Restores a backup made by scripts/backup.ts.
 * Run: DATABASE_URL=postgresql://… npx tsx scripts/restore.ts <backup-file> [--replace]
 *
 * The target is migrated first (same migration files as the backup); restore then refuses to run unless the
 * migration lists match exactly. Without --replace the target must hold no game rows. With --replace every
 * table (sessions included) is cleared first. The whole restore is one transaction: it lands fully or not at all.
 */
import fs from "node:fs";
import { Client } from "pg";
import { migrate } from "./migrate";
import { importDatabase, ledgerImbalances, parseBackup } from "@/server/backup";

async function main() {
  const file = process.argv[2];
  const replace = process.argv.includes("--replace");
  if (!file || file.startsWith("--")) throw new Error("Usage: npx tsx scripts/restore.ts <backup-file> [--replace]");
  const url = process.env.DATABASE_URL ?? "postgresql://london:london@localhost:5432/london_life";
  const backup = parseBackup(fs.readFileSync(file, "utf8"));
  await migrate(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { tables, rows } = await importDatabase(client, backup, { replace });
    const imbalanced = await ledgerImbalances(client);
    console.log(`Restored ${tables} tables, ${rows} rows from ${file} (backup taken ${backup.createdAt}).`);
    if (imbalanced.length) console.warn(`Warning: ${imbalanced.length} character(s) have cash that doesn't match their ledger.`);
    else console.log("Ledger check: every character's cash matches their ledger.");
    console.log("Sessions aren't kept in backups, so players sign in again.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
