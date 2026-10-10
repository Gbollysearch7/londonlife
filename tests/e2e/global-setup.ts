import { Client } from "pg";
import { migrate } from "../../scripts/migrate";

export default async function globalSetup() {
  const url = "postgresql://london:london@localhost:5432/london_life_test";
  await migrate(url);
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("TRUNCATE accounts CASCADE");
  await c.end();
}
