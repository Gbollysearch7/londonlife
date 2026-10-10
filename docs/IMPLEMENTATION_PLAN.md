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

| # | Work item | Spec | Acceptance |
|---|---|---|---|
| 1.1 | Scaffold app, DB migrations, command runner with idempotency keys | 35 | Same key returns same receipt; rejected command never partially debits |
| 1.2 | Accounts: sign-up (18+ confirmation), sign-in, sessions | 5.2, 32 | Password never in game state; one active character per account |
| 1.3 | Character creation: appearance → two traits → ambition → origin, assigned once | 5 | Reload/double-submit cannot reroll; two identical traits rejected |
| 1.4 | Needs settlement with server timestamps, offline cap and newcomer grace | 7, 31 | Interval never subtracted twice; clamp 0–100 |
| 1.5 | Ledger, wallet, receipts, money history | 15 | Balance always equals ledger sum |
| 1.6 | Activity engine: start / complete / cancel with lifecycle and cancel rules | 8, 31 | Reward once; consumed ingredients not refunded |
| 1.7 | Starter home: cutaway 3D room with real owned furniture (bed, toilet, shower, hob, fridge, storage) | 12, 28 | Renderer shows actual instances |
| 1.8 | Food: groceries inventory, cook recipe → meal item → eat | 13 | Cooking and eating are separate; no free ingredients |
| 1.9 | One borough (Camden/King's Cross slice): street scene, Food Hall, Common Room, home | 29, 30 | Same venue id on map, street door and interior |
| 1.10 | Travel: walk / bus quote, fare once, location changes on arrival | 14 | Preview does not move; reconnect resumes journey |
| 1.11 | NPC greeting and £20 tutorial service task | 19, 31 | Paid once; NPC clearly labelled |
| 1.12 | Furniture buy + placement (ghost, rotate, collision, store) | 12 | Rotation changes footprint; keyboard and touch controls |
| 1.13 | Daily missions (three) with event-driven progress and single claim | 20 | Claim from two tabs pays once |
| 1.14 | HUD, need detail, activity/journey progress, phone shell with honest unavailable apps | 6, 32 | Every visible control works or explains why not |
| 1.15 | Playwright route for the first twenty minutes with poor origin | 33, 37 | Passes against a real database |

Development may accelerate timers only behind an explicit dev flag (ch. 7.2).

## Milestones 2–5

Per spec chapter 38. Differentiators slot in as follows once confirmed: commuting and local-regular status in Milestone 2; flatmates, the flat hunt and photo mode in Milestones 2–3; Claude-powered NPC conversations in Milestone 2 behind a budget cap; London calendar events, allotment and blue plaques in Milestones 2 and 5.

## Feature-status matrix

| Ch. | System | Milestone | Status |
|---|---|---|---|
| 1–4 | Direction, labels, core loop, sequence | — | Adopted as rules |
| 5 | Character creation and identity | M1 | Not started |
| 6 | Main interface and navigation | M1 (shell), M2 (all apps) | Not started |
| 7 | Needs, mood, health, clock | M1 (needs/clock), M2 (mood/health) | Not started |
| 8 | Activity engine | M1 | Not started |
| 9 | Skills and courses | M1 (skills), M2 (courses) | Not started |
| 10 | Careers, shifts, promotions | M2 | Not started |
| 11 | Homes, tenancy, ownership | M1 (starter home), M2 (tiers), M3 (player tenancy) | Not started |
| 12 | Furniture and placement | M1 | Not started |
| 13 | Utilities, food, staff | M1 (food), M2 (utilities/staff) | Not started |
| 14 | Travel, vehicles, streets | M1 (walk/bus/street), M2 (all modes, vehicles) | Not started |
| 15 | Wallet, bank, tax, bills | M1 (wallet/ledger), M2 (bank/bills/tax) | Not started |
| 16 | Businesses, companies, shops | M3 | Deferred |
| 17 | Land, construction, fleets | M5 | Deferred |
| 18 | Player work and escrow | M3 | Deferred |
| 19 | Social, family, visits, parties | M1 (NPC greeting), M3 (players) | Not started |
| 20 | Reputation, missions, wishes, perks | M1 (missions), M2 (rest) | Not started |
| 21 | Stories and daily treasure | M2 | Deferred |
| 22 | Real-time table games (friendly only) | M4 | Deferred |
| 23 | Casino and predictions | — | Out of scope (decision log 2026-10-10) |
| 24 | Weather, condition, insurance | M1 (weather display), M5 (risk) | Not started |
| 25 | Government and elections | M4 | Deferred |
| 26 | Game crime, custody, court | M4 | Deferred, crime mechanic still an open decision |
| 27 | Feed, rankings, ads, notifications, moderation | M3–M4 | Deferred |
| 28 | Visual identity | M1 onward | Not started |
| 29 | Boroughs | M1 (one slice), M2 (seven clusters) | Not started |
| 30 | Venue catalogue (35; venue 36 out of scope) | M1 (2 venues), M2 (all) | Not started |
| 31 | Balance sheet | M1 | Not started |
| 32 | Screen contracts | M1 onward | Not started |
| 33 | First twenty minutes | M1 | Not started |
| 34 | Wardrobe, pets, prestige | M2 (wardrobe), M5 (pets/prestige) | Deferred |
| 35 | Architecture | M1 | Not started |
| 36 | Assets, performance, accessibility | M1 onward | Not started |
| 37 | Acceptance suite | Every milestone | Not started |

## Open decisions still with the owner

- Confirm stack and eventual hosting provider.
- Confirm which differentiators to include.
- Final brand/title.
- Whether the fictional crime mechanic (ch. 26) is kept at all.
- Monetisation (none planned; no real-money flows will be built without explicit approval).
