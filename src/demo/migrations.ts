import m001 from "../../db/migrations/001_init.sql";
import m002 from "../../db/migrations/002_careers.sql";
import m003 from "../../db/migrations/003_minigames.sql";
import m004 from "../../db/migrations/004_stories.sql";

/** Every migration, in order. Keep in sync with db/migrations. */
export const MIGRATIONS: [string, string][] = [
  ["001_init.sql", m001],
  ["002_careers.sql", m002],
  ["003_minigames.sql", m003],
  ["004_stories.sql", m004],
];

/** PGlite has gen_random_uuid built in; the pgcrypto extension line is dropped. */
export const forPglite = (sql: string) => sql.replace(/CREATE EXTENSION[^;]*;/, "");
