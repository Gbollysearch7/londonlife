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

## Milestones 2–5

Per spec chapter 38. Differentiators slot in as follows once confirmed: commuting and local-regular status in Milestone 2; flatmates, the flat hunt and photo mode in Milestones 2–3; Claude-powered NPC conversations in Milestone 2 behind a budget cap; London calendar events, allotment and blue plaques in Milestones 2 and 5.

## Feature-status matrix

| Ch. | System | Milestone | Status |
|---|---|---|---|
| 1–4 | Direction, labels, core loop, sequence | — | Adopted as rules |
| 5 | Character creation and identity | M1 | Done (ambition change cooldown UI pending) |
| 6 | Main interface and navigation | M1 (shell), M2 (all apps) | In progress — shell done |
| 7 | Needs, mood, health, clock | M1 (needs/clock), M2 (mood/health) | In progress — needs and clock done |
| 8 | Activity engine | M1 | Done |
| 9 | Skills and courses | M1 (skills), M2 (courses) | In progress — skills/XP done; rust and courses pending |
| 10 | Careers, shifts, promotions | M2 | Not started |
| 11 | Homes, tenancy, ownership | M1 (starter home), M2 (tiers), M3 (player tenancy) | In progress — starter homes done |
| 12 | Furniture and placement | M1 | Done (design finishes pending) |
| 13 | Utilities, food, staff | M1 (food), M2 (utilities/staff) | In progress — food done |
| 14 | Travel, vehicles, streets | M1 (walk/bus/street), M2 (all modes, vehicles) | In progress — walk/bus done |
| 15 | Wallet, bank, tax, bills | M1 (wallet/ledger), M2 (bank/bills/tax) | In progress — wallet and ledger done |
| 16 | Businesses, companies, shops | M3 | Deferred |
| 17 | Land, construction, fleets | M5 | Deferred |
| 18 | Player work and escrow | M3 | Deferred |
| 19 | Social, family, visits, parties | M1 (NPC greeting), M3 (players) | In progress — NPC chat done |
| 20 | Reputation, missions, wishes, perks | M1 (missions), M2 (rest) | In progress — missions and reputation done |
| 21 | Stories and daily treasure | M2 | Deferred |
| 22 | Real-time table games (friendly only) | M4 | Deferred |
| 23 | Casino and predictions | — | Out of scope (decision log 2026-10-10) |
| 24 | Weather, condition, insurance | M1 (weather display), M5 (risk) | In progress — daily weather done |
| 25 | Government and elections | M4 | Deferred |
| 26 | Game crime, custody, court | M4 | Deferred, crime mechanic still an open decision |
| 27 | Feed, rankings, ads, notifications, moderation | M3–M4 | Deferred |
| 28 | Visual identity | M1 onward | In progress — procedural kit; real art needed |
| 29 | Boroughs | M1 (one slice), M2 (seven clusters) | In progress — Camden slice |
| 30 | Venue catalogue (35; venue 36 out of scope) | M1 (2 venues), M2 (all) | In progress — 2 of 35 |
| 31 | Balance sheet | M1 | In progress — M1 values in content data; simulations pending |
| 32 | Screen contracts | M1 onward | In progress |
| 33 | First twenty minutes | M1 | Done (career/course step labelled Milestone 2) |
| 34 | Wardrobe, pets, prestige | M2 (wardrobe), M5 (pets/prestige) | Deferred |
| 35 | Architecture | M1 | Done for M1 scope (realtime pending) |
| 36 | Assets, performance, accessibility | M1 onward | In progress — keyboard/labels/reduced motion; perf unmeasured |
| 37 | Acceptance suite | Every milestone | In progress — A, B, C, E, F, J (partial) covered |

## Open decisions still with the owner

- Confirm stack and eventual hosting provider.
- Confirm which differentiators to include.
- Final brand/title.
- Whether the fictional crime mechanic (ch. 26) is kept at all.
- Monetisation (none planned; no real-money flows will be built without explicit approval).
