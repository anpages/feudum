# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Responde siempre en español, independientemente del idioma en que esté escrito el código o los mensajes del sistema.

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

How it works: `vercel dev` reads `devCommand: "vite"` from `vercel.json`, injects a free `$PORT` env var, starts Vite on that port, and serves `api/index.ts` as a local serverless function at `/api/*`. The gateway itself listens on :3000. Environment variables are loaded automatically from `.env.local`.

> **Port note:** `devCommand` must NOT hardcode `--port 3000` — that causes Vite and `vercel dev` to fight over the same port and the gateway falls back to :3001. Vite reads `process.env.PORT` (set in `vite.config.ts` → `server.port`).

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
| Auth | Custom JWT: Node.js `crypto.scrypt` + `jose` (httpOnly cookie `feudum_session`, 30d) |
| Deploy | Vercel — `vercel.json` rewrites `/api/*` → `api/index.ts` |

### Real-time approach

Vercel serverless doesn't support persistent WebSockets. Game state is fetched via React Query polling (10s interval). Resource counts are interpolated locally every second in `useResourceTicker` using server-provided production rates — this keeps the UI feeling live without extra requests.

### Folder layout

```
api/index.ts              Hono entry point — mount new routers here
api/routes/               One file per feature domain
db/schema/                Drizzle table definitions (one file per domain)
db/index.ts               Neon connection + re-exports all schema types
src/components/layout/    GameLayout, ResourceBar, NavBar
src/components/ui/        Card, Button, Badge, ProgressBar (+ index.ts barrel)
src/hooks/                useKingdom (React Query), useResourceTicker (local ticker)
src/lib/api.ts            Thin fetch wrapper (api.get / api.post / api.patch)
src/lib/cn.ts             clsx + tailwind-merge utility
src/lib/format.ts         formatResource, formatDuration
src/pages/                One file per route
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

## Design system

**Aesthetic:** Dark Illuminated Manuscript — near-black obsidian surfaces, gold-leaf accents, glass-morphism panels, noise-texture background.

### Color tokens (`src/index.css` `@theme`)

| Token | Hex | Use |
|-------|-----|-----|
| `parchment` | #f5e6c8 | Primary text |
| `parchment-dark` | #e8d5a3 | Secondary text |
| `parchment-dim` | #c4b08a | Muted text |
| `ink` | #2c1810 | Dark text on light bg |
| `gold` | #c9a227 | Primary accent, borders |
| `gold-light` | #e8c547 | Headings, active states |
| `gold-dim` | #8a6e1a | Subtle gold |
| `crimson` | #8b1a1a | Danger, full resources |
| `crimson-light` | #c22b2b | Bright danger |
| `forest` | #2d4a1e | Positive/production |
| `forest-light` | #4a7a32 | Bright positive |
| `void` | #0a0705 | Page background |
| `obsidian` | #110d08 | Card background |
| `tomb` | #1a1208 | Elevated surface |
| `dusk` | #251a0d | Hover surface |

### Typography
- `font-display` → **Cinzel** serif — reserved for h1/logo only (kingdom name in ResourceBar, LoginPage title)
- `font-ui` → **Outfit** — all UI chrome: buttons, nav labels, badges, resource values, form labels
- `font-body` → **Inter** — body copy, descriptions, form inputs

> **Rule:** Never use Cinzel at small sizes (< 1rem) — it becomes illegible. Use `font-ui` (Outfit) for anything below `text-base`.

### CSS utility classes (defined in `src/index.css`)

| Class | Purpose |
|-------|---------|
| `.bg-game` | Page background with noise texture + radial glows |
| `.glass` / `.glass-strong` | Glass-morphism panel |
| `.card-medieval` | Dark card with animated four-corner ornament |
| `.card-corner-tr` / `.card-corner-bl` | Required child divs for the other two corners |
| `.btn` + `.btn-primary/ghost/danger` | Button variants |
| `.badge` + `.badge-gold/crimson/forest/stone` | Badge variants |
| `.progress-track` + `.progress-fill` | Resource fill bar (add `.full` at 100%) |
| `.game-input` | Styled text/email/password input |
| `.resource-bar` | Sticky 52px frosted top header |
| `.resource-item` | Individual resource pill inside the bar |
| `.game-nav` | Sticky nav bar (top: 52px) |
| `.nav-link` + `.active` | Nav tab with gold underline glow |
| `.section-heading` | Small caps section label |
| `.divider` | Ornamental horizontal rule with center slot |
| `.skeleton` | Shimmer loading placeholder |
| `.anim-fade-up` / `.anim-fade-up-{1-5}` | Staggered page entry animation |
| `.anim-pulse-gold` / `.anim-float` / `.anim-glow` | Ambient animations |
| `.no-scrollbar` | Hide scrollbar (used on nav + resource bar) |

### UI components (`src/components/ui/`)

- **`<Card>`** — wraps `.card-medieval` and auto-injects the two corner `<div>`s
- **`<Button variant="primary|ghost|danger" size="sm|md|lg">`**
- **`<Badge variant="gold|crimson|forest|stone">`**
- **`<ProgressBar value={n} max={n}>`** — turns crimson at 100%

Import from `@/components/ui` (barrel export).

### Layout structure
- `ResourceBar` — sticky at `top:0`, height 52px. Shows kingdom name, 3 resource pills (value + mini fill bar + rate on lg), population.
- `NavBar` — sticky at `top:52px`. Cinzel uppercase tabs; active tab gets gold bottom border + blur glow.
- `GameLayout` — wraps both, renders `<Outlet>` in `max-w-7xl mx-auto px-4 sm:px-6 py-8`.

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
- [x] Complete design system (Dark Illuminated Manuscript aesthetic)
  - `src/index.css` — all tokens, component classes, animations
  - `src/components/ui/` — Card, Button, Badge, ProgressBar
  - `src/lib/cn.ts` — clsx + tailwind-merge utility
  - ResourceBar, NavBar, GameLayout fully redesigned
  - OverviewPage, BuildingsPage, LoginPage — rich UI shells ready for API wiring
- [x] Fix port conflict: `vercel dev` gateway on :3000, Vite reads `$PORT`

### Phase 2 — Auth & Onboarding ✅
- [x] Custom JWT auth (scrypt password hash via Node.js `crypto`, JWT via `jose`)
- [x] `api/lib/crypto.ts` — scrypt hash/verify (no external deps)
- [x] `api/lib/jwt.ts` — 30-day JWT signed with `BETTER_AUTH_SECRET`
- [x] `api/middleware/session.ts` — Hono `requireAuth` middleware (reads `feudum_session` cookie)
- [x] `POST /api/auth/register` — creates user + research row + kingdom at random slot
- [x] `POST /api/auth/login` / `POST /api/auth/logout`
- [x] `GET /api/auth/me` — returns current user (used for session check)
- [x] Protected route in React (`ProtectedRoute` in `App.tsx`)
- [x] `useAuth` hook — React Query `['auth','me']` + login/register/logout mutations
- [x] Login page fully wired (form submission, error display, redirect on success)
- [x] Logout button in ResourceBar
- [x] `ProtectedRoute` returns `null` during auth check (no loading skeleton flash)

### Phase 3 — Kingdom & Resources ✅
- [x] `GET /api/kingdoms/me` — returns kingdom with lazy resource tick applied
- [x] Resource tick: `min(resource + production * elapsed_hours, capacity)` on every request
- [x] `populationUsed` calculated from mobile unit columns on every request
- [x] `useKingdom` hook wired to real endpoint (10s polling)
- [x] Overview page: live queues, kingdom stats, resource totals, production rates, ranking

### Phase 4 — Construction (Buildings) ✅
- [x] `api/lib/buildings.js` — 15 buildings with cost/production/storage formulas
- [x] `GET /api/buildings` — current levels + upgrade cost + time remaining + requirements
- [x] `POST /api/buildings/upgrade` — deducts wood/stone/grain, enqueues build
- [x] Queue processing: lazy evaluation on each API request
- [x] BuildingsPage UI: grid with countdown timers, cost display, requirements
- [x] `useBuildings` hook with optimistic update + completion toast
- [x] Storage buildings: granary/stonehouse/silo update capacity via `storageCapacity()` formula
- [x] Utility buildings: workshop/engineersGuild reduce build time; cathedral/alchemistTower add production

### Phase 5 — Research (Academy) ✅
- [x] `api/lib/research.js` — cost formulas (base cost × 2^level), build time
- [x] `GET /api/research` — current levels + next upgrade cost + requirements
- [x] `POST /api/research/upgrade` — one active research at a time per player
- [x] ResearchPage UI: tech tree with requirements, countdown timer
- [x] `useResearch` hook with optimistic update + completion toast

### Phase 6 — Barracks (Units & Defenses) ✅
- [x] `api/lib/units.js` — 13 units + 11 defenses with full stats (attack, shield, hull, speed, cargo, cost)
- [x] `GET /api/barracks` — available units, current counts, queue
- [x] `POST /api/barracks/train` — enqueue unit production
- [x] Unit queue: time per unit, batch production
- [x] BarracksPage UI: two tabs (Unidades / Defensas), amounts, costs, requirements
- [x] `useBarracks` hook with completion toast

### Phase 7 — Map & Galaxy ✅
- [x] NPC kingdoms generated deterministically (Wang hash, ~30% occupancy) — no DB rows needed
- [x] `GET /api/map?realm=1&region=1` — real + NPC kingdoms, player highlight, debris per slot
- [x] MapPage UI: grid of slots, click → detail panel with action buttons
- [x] Detail panel: Atacar / Espiar / Transportar / Colonizar / Recolectar escombros → navigate to /armies with pre-filled coords

### Phase 8 — Army Missions ✅
- [x] `api/lib/speed.js` — travel time formula based on slowest unit speed
- [x] `POST /api/armies/send` — validate army, deduct units, create mission row
- [x] Mission types: attack, transport, spy, colonize, scavenge
- [x] `POST /api/armies/recall` — abort active mission, return time = elapsed so far
- [x] Mission processing: lazy arrival + return on each GET /api/armies request
- [x] `GET /api/armies` — active missions with countdown
- [x] ArmiesPage UI: send form (pre-filled via URL params), active missions list, recall button
- [x] `useArmies` + `useSendArmy` + `useRecallArmy` hooks
- [x] ambassadorHall reduces travel time 5%/level (max 40%)

### Phase 9 — Battle Engine ✅
- [x] `api/lib/battle.js` — OGame rapid-fire / shield / attack formula
- [x] Battle rounds: hull damage, shield absorption, rapid-fire checks
- [x] Loot: 50% of defender resources, capped by cargo capacity
- [x] Debris: 30% of lost units' cost → debrisFields table
- [x] Scavenger missions: collect debris proportionally to cargo capacity
- [x] Spy missions: OGame tech-diff formula, detection chance, counter-spy notification
- [x] Colonize: creates new kingdom row at target slot
- [x] Battle reports + spy reports stored as messages for attacker and defender

### Phase 10 — Rankings & Polish (partial)
- [x] `GET /api/rankings` — top players sorted by points (sum of resource columns)
- [x] Rankings page UI
- [x] Messages system: battle reports, spy reports; MessagesPage with detail panel
- [x] Toast notifications on queue completion (buildings, research, units)
- [x] 404 page
- [x] Profile page: username editing, account info (`GET/PATCH /api/users/me`)
- [x] Debris fields displayed on map slots
- [ ] **Points system**: points field in kingdoms never updated — needs increment on upgrade/train
- [ ] **Research combat bonuses**: `weapons`/`shielding`/`armor` levels not applied in `battle.js`
- [ ] **Colony management UI**: colonized kingdoms not selectable; `kingdoms/me` always returns first kingdom
- [ ] **Mission result display**: colonize/scavenge result not shown in ArmiesPage MissionRow
- [ ] **Player-to-player messages**: only automated reports exist, no manual messaging
- [ ] **Server settings**: economy speed, universe size hardcoded
- [ ] **Mobile layout pass**: responsive design exists but untested on real devices
