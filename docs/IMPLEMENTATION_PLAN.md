# London Life — Implementation Plan

Companion to [`LONDON_LIFE_SPEC.md`](../LONDON_LIFE_SPEC.md). The spec defines behaviour; this file defines build order, architecture and honest status. Update the status matrix in the same commit as the work it describes.

Status key: **Not started** · **In progress** · **Done** (acceptance criteria pass) · **Out of scope** (decision logged) · **Deferred** (later milestone).

## Architecture (provisional)

| Layer | Choice | Notes |
|---|---|---|
| App shell | Next.js (App Router) + React + TypeScript | One repo; versions confirmed against official docs at scaffold time. |
| 3D | Three.js via react-three-fiber + drei | Stylised procedural kit first; licensed/generated models replace placeholders later. |
| Server authority | Next.js route handlers calling a pure `sim/` domain layer | Every mutation is a command with an idempotency key; client never computes final outcomes. |
| Data | Postgres (local 16 in development; hosted later) | Migrations in SQL; integer pence; immutable ledger; unique period keys. |
| Auth | Email + password with hashed credentials, server sessions | 18+ confirmation at sign-up. Account identity never shown in game. |
| Realtime | Deferred to Milestone 3 | Presence, chat, visits, games. |
| Content | Versioned TypeScript/JSON in `content/` | Activities, furniture, recipes, careers, homes, venues, balance constants. |
| Tests | Vitest for domain invariants; Playwright for the first-twenty-minutes route | Chromium is preinstalled. |

### Repository layout

```
app/            Next.js routes: welcome, create, play; api/ command handlers
src/sim/        Pure simulation: needs settlement, activities, ledger, placement, travel
src/server/     DB access, command runner (auth, idempotency, transactions)
src/content/    Versioned game content and balance tables
src/world/      3D scenes: home cutaway, borough street, city map
src/ui/         HUD, sheets, phone, directory, receipts
db/migrations/  SQL schema
tests/          Unit, integration and end-to-end
```

## Milestone 1 — Complete foundation (vertical slice)

Goal: a low-income character can play the spec's first twenty minutes (ch. 33), reload, and find everything exactly as left.

**Status: Done (2026-10-10).** Proven by `tests/e2e/first-twenty-minutes.spec.ts`, which signs up, creates a character, plays the full route in a real browser and checks persistence after reload. 20 unit and 16 integration tests cover the invariants below.

| # | Work item | Spec | Status | Evidence / notes |
|---|---|---|---|---|
| 1.1 | Scaffold, DB migrations, command runner with idempotency keys | 35 | Done | Same key replays receipt (integration F); rejected command rolls back fully |
| 1.2 | Accounts: sign-up (18+ confirmation), sign-in, sessions | 5.2, 32 | Done | scrypt hashes, httpOnly cookie; email never in game state |
| 1.3 | Character creation, origin assigned once | 5 | Done | Reload and racing requests can't reroll (integration A, e2e) |
| 1.4 | Needs settlement, offline cap, newcomer grace | 7, 31 | Done | 8 h cap, first-day floor of 25, trait rates applied once (unit) |
| 1.5 | Ledger, wallet, receipts, money history | 15 | Done | Ledger sum equals balance after every flow tested |
| 1.6 | Activity engine with lifecycle and cancel rules | 8, 31 | Done | One running activity; reward once; costs at start, no refunds on cancel |
| 1.7 | Starter home: 3D cutaway with real owned furniture | 12, 28 | Done | Procedural original models; placeholder-grade art (see limitations) |
| 1.8 | Groceries → cook → meal item → eat | 13 | Done | Separate actions; Jollof gated at Cooking 2 |
| 1.9 | Camden slice: street, Food Hall, Common Room, home | 29, 30 | Done | Street is shown as the journey view; free-roam walking is Milestone 2 |
| 1.10 | Travel: walk / bus, fare once, arrive on arrival | 14 | Done | Cancel keeps origin; bus fare not refunded (stated) |
| 1.11 | NPC greeting and £20 tutorial task | 19, 31 | Done | Nia and Bev labelled NPC; £20 pays once |
| 1.12 | Furniture buy + placement | 12 | Done | Ghost, rotate, collision, wall and rug layers, keyboard + buttons + tap |
| 1.13 | Daily missions with event-driven progress | 20 | Done | One per pool, one swap/day, all-three bonus; login streak is Milestone 2 |
| 1.14 | HUD, needs detail, progress, phone shell | 6, 32 | Done | Unbuilt apps shown as "Coming later" with their milestone |
| 1.15 | Playwright route for the first twenty minutes | 33, 37 | Done | Passes against a real database at 60× dev speed |

### Known limitations after Milestone 1

- **Art** is original but procedural and placeholder-grade: blocky characters, simple furniture. Real models are needed before visual sign-off (ch. 28, 36).
- **Street** appears during journeys; free-roam walking with click-to-walk is not built yet.
- **Rent, bills, tax, savings** are not live; origins show "first weeks covered".
- **Ambition progress** is tracked only for Music Mastery; others need careers, housing, friendships and companies.
- **Mood** uses needs, capped décor and weather; time-limited moodlets arrive with Milestone 2.
- **No sound** yet.
- **Performance** has not been measured on real phones; the ch. 36 targets are untested.
- Health/illness, login streak, wishes, perks, stories, careers and courses are Milestone 2.

## Milestone 2 — Depth, city content and game feel

Goal: turn the slice into a game that is fun to play for days — a living, walkable world; a city worth exploring; reasons to come back; and the full needs–skills–career–money–housing loop.

**Status: In progress — the bulk is built (2026-10-11).** Every item below marked Done is covered by unit/integration tests (142 tests) and the two end-to-end routes (`first-twenty-minutes`, `day-out`) pass against the real Next.js server and Postgres. The production build passes.

| # | Work item | Spec | Status | Evidence / notes |
|---|---|---|---|---|
| 2.1 | Living world: new avatar rig (two-segment limbs, blinking face, moods, 20+ blended poses, held props, outfits) | 28 | Done | Procedural original art; pose viewer screenshots |
| 2.2 | Tap-to-walk with A* pathfinding; avatar walks to the real furniture/venue anchor and animates the activity | 14, 28 | Done | `tests/unit/nav.test.ts`, layout reachability tests |
| 2.3 | Tappable furniture, NPCs and venue hotspots with an action card (cost, effects, blockers) | 6, 12, 32 | Done | Accessible list in "Here" sheet unchanged |
| 2.4 | Feedback: floating rewards, level-up/promotion banners, particles, synthesised sound with mute | 28 | Done | Presentation only; never changes state |
| 2.5 | Lighting: smooth day/night by London time, sky dome, soft shadows, readable night interiors | 28 | Done | |
| 2.6 | Data-driven venue kit; 15 venues with layouts, NPCs, background crowds | 29, 30 | Done | 15 of 35 venues (see below) |
| 2.7 | City map in 3D (Thames, districts, landmarks, pins, routes, filters); distance travel; taxi; Tube carriage scene | 14, 29 | Done | `tests/integration/city.test.ts` |
| 2.8 | Opening hours and activity time windows | 30 | Done | Enforced on the server |
| 2.9 | Minigames: pub quiz and rhythm (open mic, busking, dance battle) with server scoring and capped rewards | 10, 22, 30 | Done | Rhythm taps are client-submitted, so rewards are bounded and daily-limited |
| 2.10 | Branching stories as authored graphs (5 stories), story map view, daily city treasure | 21 | Done | Graph validity + 11-way treasure race tests |
| 2.11 | Daily check-in streak, wishes, perk shop, moodlets, NPC friendships, ambition milestones | 7, 19, 20 | Done | `tests/integration/goals.test.ts` |
| 2.12 | Rent every Saturday 09:00 (DST-safe), starter support, arrears without eviction, savings with daily interest | 15, 31 | Done | `tests/integration/economy.test.ts` |
| 2.13 | Seven home tiers: move (deposit + fee, storage for what doesn't fit) or buy; home district changes travel | 11 | Done | |
| 2.14 | Courses: five courses, classes, notes, quizzes, certificates, career bonus | 9 | Done | 75 original questions |
| 2.15 | Wardrobe (buy styles, wear in any colour) and salon hair changes | 34 | Done | |
| 2.16 | Fictional health (cold from neglect; nurse, remedy or rest), Borough Health Centre, food delivery | 7.3, 13 | Done | |
| 2.17 | Remaining venues (20 of 35), staff, utilities/outages, vehicles, skill rust, house parties | 9, 13, 14, 19, 30 | Not started | Rust is a source behaviour still to verify; vehicles slated for Milestone 5 |
| 2.18 | Balance simulations (7/30/90-day) and tuning report | 31 | Not started | Values are design defaults |

### Known limitations after this round

- Art is original and procedural; it is far livelier than Milestone 1 but still not final, hand-made art.
- 15 of the 35 venue definitions are playable; the rest (stadium, hotel, motors, airport, etc.) are not built yet.
- Rhythm minigame inputs come from the client; rewards are capped and limited per day for that reason.
- Sound is synthesised ambience and effects, not recorded audio; volume levels exist in code, the UI exposes mute.
- Performance on real phones is unmeasured; scenes are light (one canvas, a few point lights) but untested on devices.
- Other players: everything is single-player. NPCs are always labelled; no simulated user is presented as a player.

## Milestones 3–5

Unchanged from spec chapter 38. Milestone 3 (shared life: presence, chat, consent-based relationships, visits, player jobs, companies) needs a realtime server and two or more real accounts to validate; Milestone 4 adds friendly real-time games and civic systems; Milestone 5 the late-game economy. None of these are started, and none are faked.

## Feature-status matrix

| Ch. | System | Milestone | Status |
|---|---|---|---|
| 1–4 | Direction, labels, core loop, sequence | — | Adopted as rules |
| 5 | Character creation and identity | M1 | Done (ambition change now in Goals app) |
| 6 | Main interface and navigation | M1–M2 | Done for built apps; later apps listed as "coming" with their milestone |
| 7 | Needs, mood, health, clock | M1–M2 | Done: needs, clock, moodlets, fictional health |
| 8 | Activity engine | M1 | Done (now with minigame activities and real-time settlement for cooldowns) |
| 9 | Skills and courses | M1–M2 | Done except skill rust |
| 10 | Careers, shifts, promotions | M2 | Done (5 careers; certificates and perks feed performance) |
| 11 | Homes, tenancy, ownership | M2 | Done for personal homes (7 tiers, rent, move, buy); player tenancy is M3 |
| 12 | Furniture and placement | M1 | Done (tap furniture to use, move or store) |
| 13 | Utilities, food, staff | M2 | In progress — food and delivery done; utilities and staff not started |
| 14 | Travel, vehicles, streets | M2 | In progress — walk, bus, Tube, taxi, 3D map done; vehicles not started |
| 15 | Wallet, bank, tax, bills | M2 | Done for wallet, savings, rent bills, wage tax; bonds not started |
| 16 | Businesses, companies, shops | M3 | Deferred |
| 17 | Land, construction, fleets | M5 | In progress — courier firm done (register with a car, seeded daily contract board, timed runs with fuel/wear, paid once on completion, firm levels, per-car daily limit; `tests/integration/fleets.test.ts`); land, construction and coach routes not started |
| 18 | Player work and escrow | M3 | Deferred |
| 19 | Social, family, visits, parties | M2 (NPCs), M3 (players) | In progress — NPC friendships done; players M3 |
| 20 | Reputation, missions, wishes, perks | M2 | Done |
| 21 | Stories and daily treasure | M2 | Done (5 stories; treasure claim order is atomic) |
| 22 | Real-time table games (friendly only) | M4 | Deferred (single-player quiz and rhythm games exist) |
| 23 | Casino and predictions | — | Out of scope (decision log 2026-10-10) |
| 24 | Weather, condition, insurance | M1–M5 | In progress — weather affects mood, light, sound and walking (soaked); insurance M5 |
| 25 | Government and elections | M4 | Deferred |
| 26 | Game crime, custody, court | M4 | Deferred, crime mechanic still an open decision |
| 27 | Feed, rankings, ads, notifications, moderation | M3–M4 | Deferred · ads done: weekly billboard slots sold atomically, preset templates/colours/slogans only (no free text), shown in four venues and the street, refunded only if never shown (`tests/integration/fleets.test.ts`) |
| 28 | Visual identity | M1–M2 | In progress — living procedural world; final art pending |
| 29 | Boroughs | M2 | In progress — 6 districts on the map, 15 venues |
| 30 | Venue catalogue (35; venue 36 out of scope) | M2 | In progress — 15 of 35 |
| 31 | Balance sheet | M2 | In progress — values in content data; simulations pending |
| 32 | Screen contracts | M1–M2 | In progress |
| 33 | First twenty minutes | M1 | Done (e2e passes) |
| 34 | Wardrobe, pets, prestige | M2/M5 | In progress — wardrobe and salon done; pets and prestige M5 |
| 35 | Architecture | M1 | Done for single-player scope (realtime pending) |
| 36 | Assets, performance, accessibility | M1 onward | In progress — keyboard/labels/reduced motion; accessible alternatives for 3D-only actions; perf unmeasured |
| 37 | Acceptance suite | Every milestone | In progress — A–R integration groups, two e2e routes |

## Open decisions still with the owner

- Confirm stack and eventual hosting provider.
- Confirm which differentiators to include.
- Final brand/title.
- Whether the fictional crime mechanic (ch. 26) is kept at all.
- Monetisation (none planned; no real-money flows will be built without explicit approval).
