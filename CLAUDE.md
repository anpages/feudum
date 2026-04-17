# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Feudum** — a medieval browser strategy game built from scratch, mechanically inspired by classic OGame (pre-microtransaction era). This is NOT a fork or modification of OGame; it is a clean reimplementation with a medieval theme.

**Live URLs:**
- Production: https://ogame-xi.vercel.app
- GitHub: https://github.com/anpages/feudum

## Local development

`npm run dev` (Vite only) does NOT run the API. Always use `npm start` for full-stack local work:

```bash
npm start            # vercel dev → frontend + API on http://localhost:3000
```

How it works: `vercel dev` reads `devCommand: "vite --port 3000"` from `vercel.json`, starts Vite for the frontend, and serves `api/index.ts` as a local serverless function at `/api/*`. Environment variables are loaded automatically from `.env.local`.

```bash
# Other commands
npm run dev          # Vite only (localhost:5173) — use only for pure frontend work without API
npm run build        # tsc -b && vite build (used by Vercel CI)
npm run lint         # ESLint

# Database — load env first: set -a && source .env.local && set +a
npm run db:generate  # Generate migration SQL from schema changes in db/schema/
npm run db:migrate   # Apply pending migrations to Neon
npm run db:studio    # Open Drizzle Studio browser UI

# Deploy
vercel --prod        # Deploy to production manually (push to main also auto-deploys)
```

## OGame reference repo

**Path:** `/home/anpages/ogame-ref` — local clone of OGameX (PHP/Laravel). **Read-only.**
Always consult it before implementing any game mechanic to extract the exact formulas.

### Key files to read per feature

| Feature | Reference file(s) |
|---------|------------------|
| Building costs & production formulas | `app/GameObjects/BuildingObjects.php` |
| Research costs & requirements | `app/GameObjects/ResearchObjects.php` |
| Ship / unit stats & costs | `app/GameObjects/MilitaryShipObjects.php`, `CivilShipObjects.php` |
| Defense stats & costs | `app/GameObjects/DefenseObjects.php` |
| Build time formula | `app/Services/PlanetService.php` → `getBuildingConstructionTime()` |
| Unit build time | `app/Services/PlanetService.php` → `getUnitConstructionTime()` |
| Resource production tick | `app/Services/PlanetService.php` → `updateResourcesUntil()` |
| Building queue logic | `app/Services/BuildingQueueService.php` |
| Research queue logic | `app/Services/ResearchQueueService.php` |
| Unit queue logic | `app/Services/UnitQueueService.php` |
| Fleet / army missions | `app/GameMissions/AttackMission.php`, `TransportMission.php`, etc. |
| Battle engine | `app/BattleEngine/` |
| Galaxy / map | `app/Http/Controllers/GalaxyController.php` |

### Core formulas extracted from reference

**Resource production per hour** (store result in `kingdoms.*_production`):
```
wood  (sawmill   lv): 30 * lv * 1.1^lv
stone (quarry    lv): 20 * lv * 1.1^lv
grain (grainFarm lv): 10 * lv * 1.1^lv  (no temperature factor in medieval variant)
population (windmill lv): 20 * lv * 1.1^lv
```

**Building cost** — base costs × factor^(level-1):
```
sawmill:   60 wood, 15 stone, factor 1.5
quarry:    48 wood, 24 stone, factor 1.6
grainFarm: 225 wood, 75 stone, factor 1.5
windmill:  75 wood, 30 stone, factor 1.5
```

**Building construction time (seconds)**:
```
time = ((wood + stone) / (2500 * max(4 - nextLevel/2, 1) * (1 + workshop) * speed * 2^engineersGuild)) * 3600
minimum: 1 second
```
`workshop` = Workshop level (robot_factory), `engineersGuild` = Engineers Guild level (nano_factory), `speed` = server economy speed (default 1).

## Architecture

### Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config in `src/index.css`) |
| Data fetching | React Query — global polling every 10s (`staleTime: 5s`) |
| State | Zustand (available for global UI state) |
| Backend | Hono — all routes under `/api`, deployed as Vercel serverless functions |
| Database | Neon (serverless PostgreSQL) via `@neondatabase/serverless` |
| ORM | Drizzle ORM — schema in `db/schema/`, migrations in `db/migrations/` |
| Auth | Better Auth (not yet wired up) |
| Deploy | Vercel — `vercel.json` rewrites `/api/*` → `api/index.ts` |

### Real-time approach

Vercel serverless doesn't support persistent WebSockets. Game state is fetched via React Query polling (10s interval). Resource counts are interpolated locally every second in `useResourceTicker` using server-provided production rates — this keeps the UI feeling live without extra requests.

### Folder layout

```
api/index.ts           Hono entry point — mount new routers here
api/routes/            One file per feature domain
db/schema/             Drizzle table definitions (one file per domain)
db/index.ts            Neon connection + re-exports all schema types
src/components/layout/ GameLayout, ResourceBar, NavBar
src/hooks/             useKingdom (React Query), useResourceTicker (local ticker)
src/lib/api.ts         Thin fetch wrapper (api.get / api.post / api.patch)
src/lib/format.ts      formatResource, formatDuration
src/pages/             One file per route — mostly placeholders
```

### tsconfig split

- `tsconfig.app.json` — covers `src/` only (browser + Vite client types)
- `tsconfig.node.json` — covers `api/`, `db/`, `vite.config.ts`, `drizzle.config.ts` (Node types)

### Adding a new API route

1. Create `api/routes/<feature>.ts` exporting a `new Hono()` router
2. Mount it in `api/index.ts`: `app.route('/<feature>', featureRouter)`
3. Add a corresponding hook in `src/hooks/use<Feature>.ts` using `api.get()`

### Adding a new DB table

1. Add a file in `db/schema/<table>.ts`
2. Export it from `db/schema/index.ts`
3. Run `npm run db:generate` then `npm run db:migrate`

## Theme mapping (OGame → Feudum)

| OGame | Feudum |
|-------|--------|
| Metal / Metal mine | Wood / Sawmill |
| Crystal / Crystal mine | Stone / Quarry |
| Deuterium / Synthesizer | Grain / Grain Farm |
| Solar plant | Windmill |
| Fusion reactor | Cathedral |
| Robot factory | Workshop |
| Nano factory | Engineers Guild |
| Shipyard | Barracks |
| Research lab | Academy |
| Planet | Kingdom |
| Galaxy / System / Position | Realm / Region / Slot |
| Fleet mission | Army mission |
| Espionage probe | Scout |
| Colony ship | Colonist |
| Recycler | Scavenger |
| Light/Heavy fighter | Squire / Knight |
| Cruiser / Battleship | Paladin / Warlord |
| Battlecruiser / Bomber | Grand Knight / Siege Master |
| Destroyer / Deathstar | War Machine / Dragon Knight |

Research mapping: see `db/schema/research.ts` — each field has an inline comment with the OGame equivalent.

## Design tokens

Custom Tailwind colors defined in `src/index.css` via `@theme`:
- `parchment` / `parchment-dark` — main text / surface colors
- `gold` / `gold-light` — primary accent (headings, active nav)
- `crimson` — danger / full resources
- `forest` — secondary accent
- `ink` — dark text on light surfaces

Use `font-display` class for headings (Cinzel serif) and `font-body` for long text (Crimson Text).

---

## Roadmap

### Phase 1 — Foundation (current)
- [x] Project scaffolding: Vite + React + TypeScript + Tailwind v4
- [x] Hono API entry point (Vercel serverless)
- [x] Drizzle schema: users, kingdoms, research, queues, army_missions
- [x] Neon database provisioned and migrated
- [x] Vercel deployment pipeline (push to main → auto-deploy)
- [x] Resource bar with local ticker (1s interpolation)
- [x] Navigation layout (Reino / Construcción / Academia / Cuartel / Mapa)

### Phase 2 — Auth & Onboarding
- [ ] Better Auth setup: email/password register + login
- [ ] Session middleware on Hono routes
- [ ] `POST /api/auth/register` — creates user + first kingdom at random position
- [ ] `POST /api/auth/login` / logout
- [ ] Protected route redirect (unauthenticated → /login)
- [ ] Login page UI

### Phase 3 — Kingdom & Resources
- [ ] `GET /api/kingdoms/me` — returns kingdom with fresh resource calculation
- [ ] Resource update on every API call: apply `production * elapsed_hours` since `lastResourceUpdate`
- [ ] `useKingdom` hook wired to real endpoint
- [ ] Overview page: kingdom stats, resource totals, production rates

### Phase 4 — Construction (Buildings)
- [ ] `api/lib/buildings.ts` — cost & production formulas from reference (all buildings)
- [ ] `GET /api/buildings` — current levels + upgrade cost + time remaining
- [ ] `POST /api/buildings/upgrade` — deducts resources, enqueues build, optimistic update
- [ ] Queue processing: complete finished items on each API request (lazy evaluation)
- [ ] BuildingsPage UI: grid of buildings, level, cost, countdown timer
- [ ] `useBuildings` hook with optimistic update on upgrade

### Phase 5 — Research (Academy)
- [ ] `api/lib/research.ts` — cost formulas (base cost × 2^level pattern)
- [ ] `GET /api/research` — current levels + next upgrade cost + requirements
- [ ] `POST /api/research/upgrade` — one active research at a time per player
- [ ] ResearchPage UI: tech tree with requirements shown
- [ ] `useResearch` hook

### Phase 6 — Barracks (Units & Defenses)
- [ ] `api/lib/units.ts` — unit stats (attack, shield, hull, speed, capacity, cost)
- [ ] `GET /api/barracks` — available units, current counts, queue
- [ ] `POST /api/barracks/train` — enqueue unit production
- [ ] Unit queue: time per unit, parallel production
- [ ] BarracksPage UI: two tabs (Unidades / Defensas), amounts, costs
- [ ] `useBarracks` hook

### Phase 7 — Map & Galaxy
- [ ] Populate kingdoms table with NPC kingdoms for empty slots
- [ ] `GET /api/map?realm=1&region=1` — returns all slots in a region with kingdom names/owners
- [ ] MapPage UI: grid of realms → regions → slots, player highlights
- [ ] Click slot → kingdom detail (owner, points)

### Phase 8 — Army Missions
- [ ] `api/lib/speed.ts` — travel time formula (distance × base speed / unit speed)
- [ ] `POST /api/armies/send` — validate army, deduct units from kingdom, create army_mission row
- [ ] Mission types: attack, transport, spy, colonize, pillage, return
- [ ] Mission processing: background arrival check on each request (lazy)
- [ ] `GET /api/armies` — active missions with countdown
- [ ] Fleet page UI: send form + active missions list
- [ ] `useArmies` hook with optimistic send

### Phase 9 — Battle Engine
- [ ] Port OGame rapid-fire / shield / attack formula to TypeScript (`api/lib/battle.ts`)
- [ ] Reference: `/home/anpages/ogame-ref/app/BattleEngine/`
- [ ] Battle report generation and storage
- [ ] POST-battle: distribute loot, update units/defenses, create debris field (Scavenger missions)
- [ ] Battle reports page + messaging

### Phase 10 — Rankings & Polish
- [ ] Points system: sum of resources spent on buildings + research + units
- [ ] `GET /api/rankings` — top players sorted by points
- [ ] Rankings page UI
- [ ] Messages system (attack reports, spy reports, player messages)
- [ ] Server settings: economy speed, universe size, new kingdom rules
- [ ] Mobile-responsive layout pass
