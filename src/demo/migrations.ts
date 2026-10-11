import m001 from "../../db/migrations/001_init.sql";
import m002 from "../../db/migrations/002_careers.sql";
import m003 from "../../db/migrations/003_minigames.sql";
import m004 from "../../db/migrations/004_stories.sql";
import m005 from "../../db/migrations/005_goals.sql";
import m006 from "../../db/migrations/006_economy.sql";
import m007 from "../../db/migrations/007_health_delivery.sql";
import m008 from "../../db/migrations/008_minigame_begin.sql";
import m009 from "../../db/migrations/009_household.sql";
import m010 from "../../db/migrations/010_social.sql";
import m011 from "../../db/migrations/011_market.sql";

/** Every migration, in order. Keep in sync with db/migrations. */
export const MIGRATIONS: [string, string][] = [
  ["001_init.sql", m001],
  ["002_careers.sql", m002],
  ["003_minigames.sql", m003],
  ["004_stories.sql", m004],
  ["005_goals.sql", m005],
  ["006_economy.sql", m006],
  ["007_health_delivery.sql", m007],
  ["008_minigame_begin.sql", m008],
  ["009_household.sql", m009],
  ["010_social.sql", m010],
  ["011_market.sql", m011],
];

/** PGlite has gen_random_uuid built in; the pgcrypto extension line is dropped. */
export const forPglite = (sql: string) => sql.replace(/CREATE EXTENSION[^;]*;/, "");
