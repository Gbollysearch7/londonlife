# London Life

An original London life simulation for adults (18+). Design spec: [`LONDON_LIFE_SPEC.md`](LONDON_LIFE_SPEC.md). Build plan and honest feature status: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

**Current state: Milestone 1 done, Milestone 2 mostly built.** A walkable 3D London: tap to walk, tap furniture and locals to act, and watch your Londoner cook, sleep, dance and busk. Fifteen venues across six districts on a 3D city map; walk, bus, Tube or taxi. Careers, courses, a pub quiz and rhythm performances, branching stories, a daily treasure hunt, wishes, perks, moodlets, friendships with named locals, rent and savings, homes to rent or buy, a wardrobe and salon, fictional health and food delivery. All outcomes are decided on the server and saved after every action. See the status matrix in the implementation plan for what's done and what isn't.

## Run locally

Requirements: Node 20+ and PostgreSQL 14+.

```bash
npm install
createuser -P london          # password: london (or change DATABASE_URL)
createdb -O london london_life
cp .env.example .env.local    # edit DATABASE_URL if needed
npm run db:migrate
npm run dev                   # http://localhost:3000
```

`LL_TIME_SCALE` in `.env.local` speeds up activity and journey timers **in development only** (e.g. `30` makes a 20-minute sleep take 40 seconds). It is ignored when `NODE_ENV=production`.

## Tests

```bash
createdb -O london london_life_test
npm test             # unit tests (needs, placement, missions, calendar) + integration tests against Postgres
npm run test:e2e     # Playwright: the first twenty minutes and a Milestone 2 "day out", then reload and persistence
                     # (set PW_CHROMIUM=/path/to/chrome to use an installed Chrome instead of Playwright's download)
npm run build:test   # standalone single-page test build in dist-test/ (Postgres runs in the browser)
npm run lint         # TypeScript typecheck
```

## How it's built

| Folder | Contents |
|---|---|
| `src/content/` | Versioned game content and balance tables (traits, origins, furniture, recipes, activities, venues, missions). No balance numbers live in UI code. |
| `src/sim/` | Pure simulation: needs settlement, placement rules, XP and reputation, mission assignment, shifts, London calendar (DST-safe weekly schedule). |
| `src/server/` | Postgres access, auth (scrypt + httpOnly session cookie, 18+ confirmation), the idempotent command runner and all game rules: activities, careers, minigames, stories and treasure, goals, economy, courses, wardrobe, health. |
| `app/api/` | `POST /api/command` (every mutation, with an idempotency key) and `GET /api/state` (settles and returns canonical state). |
| `src/world/` | Three.js scenes via react-three-fiber: home cutaway, data-driven venue kit (`venues/`), 3D city map, street and Tube journeys, avatar rig and poses, pathfinding, effects. Original procedural models. |
| `src/ui/` | HUD, sheets, phone apps, placement controls. |
| `db/migrations/` | SQL schema. |

Key guarantees, each covered by tests:

- An origin is assigned once per account; a refresh or racing request never re-rolls it.
- Every change to cash writes a ledger row in the same transaction; balance always equals the ledger total.
- A retried request with the same idempotency key replays the original receipt instead of charging twice.
- Only one activity and one journey can run at a time; rewards settle exactly once.
- Location changes only when a journey arrives; cancelling keeps you at the origin.
- Missions and one-time rewards can't be claimed twice, even from two tabs.
- Story chance rolls and minigame questions/beat maps are decided on the server and stored, so a reload can't reroll them; story endings pay once.
- Daily treasure claims get unique, ordered ranks even when many players claim at once.
- Rent is billed once per week; savings interest is credited once per London day; nothing settles twice.

## Deploying

Not deployed yet. Any Node host plus a managed Postgres works: set `DATABASE_URL`, run `npm run db:migrate`, `npm run build`, `npm start`. Public release waits for owner review (spec ch. 38).
