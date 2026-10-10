import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

export async function migrate(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const dir = path.join(__dirname, "..", "db", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (done.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL ?? "postgresql://london:london@localhost:5432/london_life";
  migrate(url).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
