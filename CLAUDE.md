# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Responde siempre en español, independientemente del idioma en que esté escrito el código o los mensajes del sistema.

## Project

**Feudum** — a medieval browser strategy game built from scratch, mechanically inspired by classic OGame (pre-microtransaction era). This is NOT a fork or modification of OGame; it is a clean reimplementation with a medieval theme.

**Live URLs:**
- Production: https://feudum.anpages.com (custom domain) / https://ogame-xi.vercel.app (Vercel alias)
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

### Frontend architecture — feature-based with service layer

Esta es la arquitectura canónica del proyecto. **Toda nueva feature debe seguirla sin excepción.**

```
src/
├── shared/
│   ├── types/
│   │   ├── user.ts        AuthUser, UserProfile
│   │   ├── kingdom.ts     KingdomSummary, Resources
│   │   ├── mission.ts     ArmyMission, MissionType, MissionState, MissionResult, SendArmyParams
│   │   └── index.ts       barrel re-export
│   └── services/
│       └── http.ts        cliente HTTP tipado: http.get / http.post / http.patch / http.delete
├── features/
│   └── <feature>/
│       ├── types.ts           tipos específicos de la feature (respuestas API, DTOs)
│       ├── services/
│       │   └── <feature>Service.ts   llamadas HTTP puras — sin React, sin estado
│       ├── hooks/             (opcional) subdirectorio si hay muchos hooks
│       ├── use<Feature>.ts    React Query hooks — importan del servicio, no de http directamente
│       ├── components/
│       │   └── <SubComponent>.tsx   sub-componentes extraídos de la page
│       └── <Feature>Page.tsx  composición (~80–120 líneas), sin lógica HTTP inline
├── components/
│   ├── layout/    GameLayout, ResourceBar, NavBar  (compartidos, sin cambios)
│   └── ui/        Card, Button, Badge, ProgressBar, RequirementsList  (barrel: @/components/ui)
└── lib/
    ├── api.ts     re-exporta http como `api` — solo para compatibilidad, usar http directamente
    ├── auth.ts    re-exporta authService como `authApi` — solo para compatibilidad
    ├── cn.ts      clsx + tailwind-merge
    ├── format.ts  formatResource, formatDuration
    ├── toast.ts   Zustand toast store
    └── labels.ts  BUILDING_LABELS, RESEARCH_LABELS, UNIT_LABELS
```

#### Reglas de la arquitectura

1. **Tipos compartidos** — si un tipo se usa en más de una feature, va en `src/shared/types/`. Tipos de uso exclusivo de una feature van en `features/<feature>/types.ts`.
2. **HTTP solo en servicios** — los hooks nunca llaman `http.*` directamente. Toda llamada a la API va en `features/<feature>/services/<feature>Service.ts`.
3. **Hooks = React Query + lógica** — los hooks importan del servicio como `queryFn: featureService.getAll`. Gestionan caché, optimistic updates y efectos secundarios (toasts).
4. **Pages = composición** — las pages no contienen lógica HTTP inline ni componentes grandes embebidos. Extraer sub-componentes a `features/<feature>/components/` en cuanto superen ~80 líneas.
5. **`lib/api.ts` y `lib/auth.ts`** son shims de compatibilidad y no se amplían. El código nuevo importa desde `@/shared/services/http` o desde el servicio de la feature.

#### Features existentes

| Feature | Servicio | Hook(s) | Sub-componentes |
|---------|----------|---------|-----------------|
| `auth` | `authService` | `useAuth` | — |
| `kingdom` | `kingdomService` | `useKingdom`, `useKingdoms`, `useSwitchKingdom`, `useResourceTicker` | — |
| `buildings` | `buildingsService` | `useBuildings`, `useUpgradeBuilding` | `BuildingCard` |
| `research` | `researchService` | `useResearch`, `useUpgradeResearch` | — |
| `barracks` | `barracksService` | `useBarracks`, `useTrainUnit` | — |
| `armies` | `armiesService` | `useArmies`, `useSendArmy`, `useRecallArmy` | `MissionRow` |
| `map` | `mapService` | `useMap` | — |
| `messages` | `messagesService` | `useMessages`, `useMarkAllRead`, `useSendMessage`, `useUnreadCount` | — |
| `rankings` | `rankingsService` | `useRankings` | — |
| `profile` | `profileService` | `useProfile`, `useUpdateProfile` | — |
| `admin` | `adminService` | `useAdminSettings`, `useAdminUsers`, `useAdminFleet`, `useUpdateSettings`, `useToggleAdmin`, `useDevAction`, `useFastForward` | — |
| `overview` | — | (usa `useKingdom` directamente) | — |

#### Añadir una nueva feature — checklist

1. Crear `src/features/<feature>/types.ts` con los tipos de respuesta
2. Crear `src/features/<feature>/services/<feature>Service.ts` con las llamadas `http.*`
3. Crear `src/features/<feature>/use<Feature>.ts` con los React Query hooks que usan el servicio
4. Crear `src/features/<feature>/<Feature>Page.tsx` que compone hooks + sub-componentes
5. Si los sub-componentes superan ~80 líneas, extraerlos a `features/<feature>/components/`
6. Registrar la ruta en `src/App.tsx`
7. Si el tipo es compartido entre features, añadirlo a `src/shared/types/` y re-exportarlo desde `index.ts`

### Backend folder layout

```
api/index.ts              Hono entry point — mount new routers here
api/routes/               One file per feature domain
api/lib/                  Shared backend helpers (buildings.js, units.js, battle.js, tick.js, config.js…)
api/middleware/           session.ts (requireAuth), admin.ts
db/schema/                Drizzle table definitions (one file per domain)
db/index.ts               Neon connection + re-exports all schema types
```

### tsconfig split

- `tsconfig.app.json` — covers `src/` only (browser + Vite client types)
- `tsconfig.node.json` — covers `api/`, `db/`, `vite.config.ts`, `drizzle.config.ts` (Node types)

### Adding a new API route

1. Create `api/routes/<feature>.ts` exporting a `new Hono()` router
2. Mount it in `api/index.ts`: `app.route('/<feature>', featureRouter)`
3. Follow the frontend checklist above to wire up the service + hook

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

### Phase 10 — Rankings & Polish ✅
- [x] `GET /api/rankings` — top players sorted by points (calcPoints with all 15 buildings)
- [x] Rankings page UI
- [x] Messages system: battle reports, spy reports, player-to-player; MessagesPage with detail panel
- [x] Toast notifications on queue completion (buildings, research, units)
- [x] 404 page
- [x] Profile page: username editing, account info (`GET/PATCH /api/users/me`)
- [x] Debris fields displayed on map slots
- [x] Research combat bonuses: swordsmanship/armoury/fortification applied in battle.js
- [x] Colony management: `kingdoms/me?id=X`, `GET /api/kingdoms`, KingdomSelector in ResourceBar
- [x] Mission result display: colonize/scavenge/pillage shown in ArmiesPage MissionRow
- [x] Server settings: ECONOMY_SPEED, UNIVERSE.* via env vars in `api/lib/config.js`
- [x] Mobile layout: MapPage panel order, ArmiesPage mission selector, SlotRow responsive

### Phase 11 — New Missions ✅
- [x] Pillage mission: NPC-only quick raid, loot via cargo capacity, small casualty rate
- [x] MapPage: "Saquear" button for NPC slots; Transport hidden vs NPCs

### Phase 12 — Deployment Mission (pending)
- [ ] **Deployment** (`DeploymentMission` in OGame ref) — move units to own colony, one-way (no return)
  - Only valid target: own kingdom (different slot)
  - Units added to destination on arrival, no return trip
  - Simple: no battle, no loot
  - Ref: `app/GameMissions/DeployMission.php`

### Phase 13 — Active NPCs (pending)
- [ ] **NPC kingdoms as real DB rows** — NPCs behave exactly like real players (custom Feudum feature, not in OGame ref)
  - **DB**: add `isNpc: boolean` + `npcLevel: int` to `kingdoms` table; create one system NPC user (`id = -1`) as owner of all NPC kingdoms
  - **Seeder**: on first migration / admin action, populate the universe with NPC kingdoms (replace Wang hash map generation with real rows); NPC buildings pre-set per `npcLevel` (1=weak, 2=medium, 3=strong)
  - **Resources**: NPC kingdoms tick exactly like player kingdoms — they accumulate wood/stone/grain over time and can be looted down to zero
  - **Units**: NPC kingdoms have real unit counts in their kingdom row — units destroyed in battle are permanently deducted
  - **Spy**: spying an NPC returns real resource and troop data (same endpoint, no special case)
  - **Pillage / Attack**: loot deducted from NPC's actual stored resources; debris generated from actual destroyed units
  - **NPC rebuild AI** (lazy scheduler on `GET /api/kingdoms/me`): if NPC has enough resources, spend them to train units up to a target army size per `npcLevel`
  - **NPC attack AI** — runs via Vercel Cron Job (`/api/cron/npc-tick`, every hour, defined in `vercel.json`), NOT lazily on player requests. For each NPC above attack threshold with cooldown elapsed: pick target player kingdom with most accumulated resources within range, deduct units from NPC, create `army_missions` row with real future `arrivalTime`. Mission travels in DB while player is offline.
  - **Battle resolution** — still lazy: on `GET /api/armies` or `GET /api/messages`, arrived NPC missions are processed (battle engine runs, report saved). Player logs in hours later and finds the battle already done, resources stolen, troops dead — exactly like OGame.
  - **NPC target selection** — player kingdom with most wood+stone+grain within 3-slot radius; if none, expand radius. Prioritises resource-rich targets like a real player would.
  - **NPC army sent** — 60–80% of available troops (random factor); reserves remainder for defense. Composition weighted toward fastest/strongest units.
  - **NPC return**: if NPC wins, return mission created with loot; resources added to NPC kingdom on arrival. If NPC loses, units are gone permanently.
  - **NPC rebuild AI** — also runs in the same hourly cron: if NPC has enough resources, spend them to train units toward target army size per `npcLevel`. Uses existing barracks train logic.
  - **Battle report**: defender (player) gets full report in messages with real NPC fleet composition. Player may log in hours after the battle happened.
  - **Configurable**: `NPC_AGGRESSION` (0=off, 1=low, 2=medium, 3=high), `NPC_ATTACK_INTERVAL_HOURS` (default: 24/12/6 per aggression level), `NPC_REBUILD_INTERVAL_HOURS` in `api/lib/config.js` and admin panel
  - **Vercel Cron**: free tier allows 2 cron jobs; `/api/cron/npc-tick` runs hourly. Secured with `CRON_SECRET` header check.
  - **Map**: MapPage reads NPC kingdoms from DB instead of generating via Wang hash; existing slot layout preserved

### Phase 14 — Expeditions (pending)
- [ ] **Expedition** (`ExpeditionMission` in OGame ref) — exploration with random encounters
  - Target: empty slot beyond map edge (special coord e.g. slot 16)
  - 10 weighted outcomes: resources, units, nothing, black_hole, delay, speedup, pirates, aliens, merchant, dark_matter
  - Scales with fleet size and `exploration` research level
  - NPCFleetGeneratorService for pirate/alien combats
  - Merchant mechanic: propose resource trade, accept/reject
  - Ref: `app/GameMissions/ExpeditionMission.php`, `app/Services/NPCFleetGeneratorService.php`

### Phase 14 — Missiles (pending)
- [ ] **Missile strikes** (`MissileMission` in OGame ref) — interplanetary missiles
  - Requires `trebuchet` defense (already exists) as interceptors
  - New unit type: `ballistic` missile (one-way, no return, stored in armoury)
  - Range: `cartography` research level × 5 − 1 regions
  - Targets defenses only, no unit damage
  - Ref: `app/GameMissions/MissileMission.php`

### Phase 15 — Alliances (pending)
- [ ] **Alliance system** (`AllianceController` in OGame ref)
  - DB tables: `alliances`, `alliance_members`, `alliance_ranks`, `alliance_applications`, `alliance_highscores`
  - Create/join (with application text)/leave/disband alliance
  - Alliance tag, name, internal text, external text, logo URL, homepage
  - Custom rank system with granular permissions
  - Accept/reject applications
  - Transfer leadership, kick members
  - Alliance rankings (sum of member points), calculated by scheduler
  - Alliance chat (message thread per alliance)
  - Alliance depot: shared resource pool with per-rank permissions
  - Ref: `app/Http/Controllers/AllianceController.php`, `app/Services/AllianceService.php`, `app/Services/AllianceDepotService.php`

### Phase 16 — ACS (Allied Combat System) (pending)
- [ ] **Fleet Unions** — coordinate multi-player attacks/defenses
  - DB tables: `fleet_unions`, `fleet_union_invites`
  - Create union (defines destination, max fleets, max players)
  - Invite other players; join union
  - All fleets arrive simultaneously at target
  - Ref: `app/Models/FleetUnion.php`, `app/Services/FleetUnionService.php`
- [ ] **ACS Defend mission** — send army to defend ally's kingdom
  - Configurable hold time (hours) — fleet waits at destination
  - Participates in battle if attacked during hold
  - Returns automatically after hold expires
  - Requires Fleet Union
  - Ref: `app/GameMissions/AcsDefendMission.php`

### Phase 17 — Moon System (pending)
- [ ] **Moon** — new entity spawned from large battles
  - Spawn chance proportional to fleet size destroyed (configurable)
  - Separate fields count, max buildings differ from kingdom
  - New buildings exclusive to moons: Jump Gate, Sensor Phalanx
  - Ref: `app/Models/Planet.php` (type: Planet | Moon), `app/Services/PlanetService.php`
- [ ] **Jump Gate** — teleport army between own moons
  - Cooldown between uses (configurable)
  - No travel time, one-way per cooldown
  - Ref: `app/Http/Controllers/JumpGateController.php`
- [ ] **Sensor Phalanx** — scan enemy fleet movements
  - Range based on building level
  - Shows incoming/outgoing missions at target coordinate
  - Ref: `app/Http/Controllers/PhalanxController.php`
- [ ] **Moon Destruction mission** — destroy enemy moon with Dragon Knights
  - Probability formula based on fleet size
  - Catastrophic failure chance (lose fleet + trigger moon destruction)
  - Ref: `app/GameMissions/MoonDestructionMission.php`
- [ ] **Planet Move** — relocate kingdom to new coordinate
  - Requires Jump Gate
  - Cooldown between moves
  - Atomic DB transaction
  - Ref: `app/Models/PlanetMove.php`, `app/Services/PlanetMoveService.php`

### Phase 18 — Dark Matter & Premium (pending)
- [ ] **Dark Matter** — obtainable in-game resource (no real money required)
  - Obtained via Expeditions (one of the 10 outcomes)
  - DB: `dark_matter_transactions` (user_id, type, amount, reason)
  - Ref: `app/Services/DarkMatterService.php`
- [ ] **Accelerators (Halvings)** — spend Dark Matter to halve build/research/train times
  - One per item per queue slot
  - Ref: `app/Services/HalvingService.php`

### Phase 19 — Character Classes (pending)
- [ ] **3 character classes** selectable per player (cost: Dark Matter to change)
  - DB: `users.character_class`
  - **Collector** — +25% mine production, +100% transport speed, +50% Crawler bonus
  - **General** — +100% combat unit speed, -50% grain consumption, +2 fleet slots, +2 combat research levels
  - **Discoverer** — -25% research time, +2 expedition slots, -50% expedition enemy chance, +20% phalanx range, 75% loot from inactive players
  - Each class unlocks a special exclusive unit
  - Ref: `app/Enums/CharacterClass.php`, `app/Services/CharacterClassService.php`

### Phase 20 — Social Features (pending)
- [ ] **Buddy system** — add/remove friends, see online status, block players
  - DB: `buddy_requests` (user_id, buddy_id, status)
  - Ref: `app/Http/Controllers/BuddiesController.php`, `app/Services/BuddyService.php`
- [ ] **Player search** — search players by username or coordinate
  - Ref: `app/Http/Controllers/SearchController.php`
- [ ] **Player notes / bookmarks** — private notes attached to coordinates
  - DB: `notes` (user_id, coordinate, title, content)
  - Ref: `app/Http/Controllers/NotesController.php`
- [ ] **Fleet templates** — save army compositions for reuse
  - DB: `fleet_templates` (user_id, name, units_composition JSON)
  - Ref: `app/Models/FleetTemplate.php`
- [ ] **Vacation mode** — temporary protection against attacks
  - DB: `users.vacation_mode_enabled_at`, `users.vacation_mode_until`
  - Minimum duration enforced; blocks all outgoing missions while active
- [ ] **Real-time notifications** — Server-Sent Events for new messages/arrivals
- [ ] **Global chat** — real-time chat channel for all players
  - DB: `chat_messages` (user_id, message, created_at)
  - Ref: `app/Http/Controllers/ChatController.php`, `app/Services/ChatService.php`

### Phase 21 — Rankings & Automation (pending)
- [ ] **Multi-category rankings** — separate leaderboards for buildings, research, units, economy
  - DB: `highscores` table with category column
  - Ref: `app/Models/Highscore.php`, `app/Services/HighscoreService.php`
- [ ] **Alliance rankings** — sum of all member points
  - DB: `alliance_highscores`
  - Ref: `app/Models/AllianceHighscore.php`
- [ ] **Scheduler / cron jobs** — automated background tasks
  - Hourly: recalculate highscores + alliance scores
  - Daily: cleanup expired debris fields, cleanup old wreck data
  - Periodic: Dark Matter regeneration (if enabled)
  - Ref: `app/Console/Commands/Scheduler/`
- [ ] **Enhanced debris fields** — expiry + auto-cleanup, JSON metadata
  - Ref: `app/Models/WreckField.php`, `app/Services/WreckFieldService.php`

### Phase 22 — User Options & Polish (pending)
- [ ] **User options page** — privacy settings, notification preferences, visual theme
  - Ref: `app/Http/Controllers/OptionsController.php`
- [ ] **Rewards / achievements** — milestone-based reward system
  - Ref: `app/Http/Controllers/RewardsController.php`
- [ ] **Research speed bonus** — `horsemanship`/`cartography` applied to travel time calc
- [ ] **Improved NPC espionage** — varied random troop data, detection events
- [ ] **Ban system (admin)** — temporary/permanent bans with reason and history
  - DB: `bans` (user_id, admin_id, reason, expires_at)
  - Ref: `app/Models/Ban.php`
- [ ] **Admin: fleet timing tools** — debug and adjust mission timers
  - Ref: `app/Http/Controllers/Admin/FleetTimingController.php`
