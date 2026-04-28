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
npm run db:migrate   # Apply pending migrations to Supabase
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
| Data fetching | React Query (caché) + Supabase Realtime (WebSocket) para invalidación |
| State | Zustand (available for global UI state) |
| Backend | Hono — all routes under `/api`, deployed as Vercel serverless functions |
| Database | Supabase (PostgreSQL) via `postgres` + Drizzle ORM |
| ORM | Drizzle ORM — schema in `db/schema/`, migrations in `db/migrations/` |
| Auth | Custom JWT: Node.js `crypto.scrypt` + `jose` (httpOnly cookie `feudum_session`, 30d) |
| Deploy | Vercel — `vercel.json` rewrites `/api/*` → `api/index.ts` |

### Real-time approach

El juego usa **Supabase Realtime** (WebSocket) para detectar cambios en la BD e invalidar el caché de React Query. No hay polling periódico.

Flujo:
1. `useRealtime` (`src/features/realtime/useRealtime.ts`) abre un canal WebSocket a Supabase al montar el layout
2. Supabase emite un evento `postgres_changes` cuando cambia una fila en `kingdoms`, `building_queue`, `research_queue`, `unit_queue`, `army_missions`, `messages` o `user_achievements`
3. El handler llama a `queryClient.invalidateQueries(key)` — React Query hace el fetch al API de Hono
4. La UI se actualiza con los datos frescos

**`useResourceTicker`** interpola los recursos localmente cada segundo usando las tasas de producción ya conocidas — esto mantiene los contadores vivos visualmente sin ninguna petición adicional.

> **Nota para la migración a DO:** Supabase Realtime requiere que la BD esté en Supabase. Al mover la BD a PostgreSQL propio en DO, hay que reemplazar `useRealtime` con SSE (`/api/events`) o WebSockets nativos en el servidor Hono.

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
| `admin` | `adminService` | `useAdminSettings`, `useAdminUsers`, `useAdminFleet`, `useUpdateSettings`, `useToggleAdmin`, `useDevAction`, `useFastForward` | `NpcMonitorTab`, `BattlesTab`, `ExpeditionsTab`, `ServerTab`, `PlayersTab`, `NpcProfileTab` |
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
db/index.ts               DB connection + re-exports all schema types
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

**Aesthetic:** Illuminated Parchment — warm cream surfaces, dark ink text, gold accents. The game interior is LIGHT themed (not dark).

> ⚠️ **IMPORTANT:** `bg-game` does NOT exist as a CSS class. Do NOT use it. Set backgrounds explicitly.

### Color tokens (valores reales en `src/index.css` `@theme`)

| Token | Hex | Use |
|-------|-----|-----|
| `ink` | #1c1208 | Primary text (dark ink on parchment) |
| `ink-mid` | #4a3820 | Secondary text |
| `ink-muted` | #8a7456 | Muted/placeholder text |
| `parchment` | #faf6ef | Primary background surface |
| `parchment-warm` | #f4ead8 | Warm background variant |
| `parchment-deep` | #ede3cc | Deep parchment sections |
| `surface` | #ffffff | White card/header surface |
| `gold` | #b8860b | Primary accent, borders |
| `gold-light` | #d4a017 | Brighter gold, headings |
| `gold-dim` | #8a6e1a | Subtle gold |
| `gold-soft` | #fef9e7 | Button hover background |
| `crimson` | #9b1a1a | Danger, errors |
| `crimson-light` | #c22b2b | Bright danger |
| `forest` | #1e5414 | Positive/production |
| `forest-light` | #2a7a1e | Bright positive |

**body CSS:** `background: #faf6ef; color: #1c1208` — all pages inherit this.

### Typography
- `font-display` → **Cinzel** serif — reserved for h1/logo only (kingdom name in ResourceBar, LoginPage title)
- `font-ui` → **Outfit** — all UI chrome: buttons, nav labels, badges, resource values, form labels
- `font-body` → **Inter** — body copy, descriptions, form inputs

> **Rule:** Never use Cinzel at small sizes (< 1rem) — it becomes illegible. Use `font-ui` (Outfit) for anything below `text-base`.

### CSS utility classes (defined in `src/index.css`)

| Class | Purpose |
|-------|---------|
| `.glass` / `.glass-strong` | Glass-morphism panel (semi-transparent surface) |
| `.card-medieval` | Parchment card with animated four-corner ornament |
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
- [x] Supabase database provisioned and migrated
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

### Phase 12 — Deployment Mission ✅
- [x] **Deployment** — move units to own colony, one-way (no return)
  - Only valid target: own kingdom (different slot)
  - Units added to destination on arrival, no return trip
  - MapPage "Desplegar" button on own kingdoms; result shown in MissionRow

### Phase 13 — Active NPCs ✅
- [x] **NPC kingdoms as real DB rows** — NPCs behave exactly like real players
  - Each NPC is its own `users` row with `role='npc'` — NEVER in `auth.users`; email nullable
  - AI state lives in `npc_state` table (keyed by `user_id`): `is_boss`, `npc_level`, `next_check`, `current_research`, `build_available_at`, `last_attack_at`, `last_decision`
  - `npcPersonality()` → `'economy'|'military'|'balanced'` and `npcClass()` → `'collector'|'general'|'discoverer'` are deterministic coord-hashes — NOT stored in DB (`api/lib/npc-engine.js`)
  - NPC buildings/units/research in the same normalized tables as players; loot deducted from real stored values
  - Spy returns real NPC resource + troop data (reads same buildings/units tables)
  - Seeded via `startNewSeason()` at ~50% density (`NPC_DENSITY`); boss: `npc_state.is_boss=true`
  - Configurable: `NPC_AGGRESSION`, `NPC_ATTACK_INTERVAL_HOURS`, `NPC_BASH_LIMIT` in `api/lib/config.js`
  - Map reads NPC kingdoms from DB; Wang hash retained as slot-display fallback only
- [x] **Two-cron architecture** — split by cadence and concern:
  - `GET /api/cron/npc-builder` (every minute) — `next_check` gating gives each NPC a staggered 8-12 min window. Handles: resource tick, construction, unit training, research, fleetsave on incoming attack
  - `GET /api/cron/npc-military-ai` (every 20 min) — runs all NPCs without gating. Handles: attack, scavenge, expedition, colonize
- [x] **Growth AI cascade (npc-builder)** — ordered priority:
  - **Nivel 0**: fleetsave if incoming attack, complete expired queues, redirect if storage full
  - **Nivel 0D**: collector/economy with nearby debris → explicitly push `horsemanship lv6` then `runemastery lv2`, then train scavenger (requires barracks lv4 + those techs). Saving for colonist does NOT block this level
  - **Nivel 1**: personality-specific building milestones per age bracket (`MILESTONES` in `npc-engine.js`). Storage buildings (granary/stonehouse/silo) gated at 70% resource utilization
  - **Nivel 1.5**: colonist — age ≥168h + barracks lv4 + cartography lv3; saving for colonist falls through to Nivel 2
  - **Nivel 2** (parallel): build + train in same tick. `getTickFlavor` rotates per-minute with per-NPC `posShift` (not per-hour lock): `military`=troops/buildings/troops, `economy`=buildings/buildings/research, `balanced`=buildings/troops/research
- [x] **Military AI (npc-military-ai)**:
  - `FLEET_RESERVE = 0.20` — global constant; no mission may leave < 20% combat fleet home
  - `attackAI`: sendRatio capped at 80%; pre-attack spy scout before committing force
  - `scavengeAI`: skips if debris < 500; sends `min(all, ceil(debris×10/20000))` scavengers
  - `expeditionAI`: discoverer 35%, balanced 12%, all others 5%; fleet reserve check enforced; slot = `UNIVERSE.maxSlot+1` (no hardcoded 16)
  - `colonizeAI`: uses `UNIVERSE.maxRegion`/`UNIVERSE.maxSlot` — no hardcoded bounds
  - Unit reqs: merchant (barracks 2), caravan (barracks 6), scavenger (barracks 4 + horsemanship 6 + runemastery 2), colonist (barracks 4 + cartography 3), scout (barracks 3 + spycraft 2)
  - Tick result persisted: `npc_last_tick` (JSON) + `npc_tick_history` (last 48, JSON array)
- [x] **Battle resolution lazy**: `GET /api/armies` + `GET /api/messages` trigger `resolveIncomingNpcAttacks()`; winner NPC gets loot on return; loser units gone permanently

### Phase 13.5 — Season System, Achievements & Push ✅
- [x] **Season card on Overview** — prominent `<SeasonCard>` on OverviewPage: boss name, lore, army size, difficulty stars, live countdown, "Atacar" CTA linking to /armies with pre-filled coords
- [x] **Military modal on Overview** — clicking "Fuerza militar" opens a `<Sheet>` with full army breakdown: combat / support / defenses, columns Total | Misión | Libre
- [x] **Season fixes** — character class resets to null on `resetSeason()`; admin users included in player seeding; random slot placement (not sequential)
- [x] **Rankings split** — `GET /api/rankings?type=players|npcs`; RankingsPage has Jugadores/NPCs tabs; boss kingdom shown with dragon icon + npcLevel
- [x] **Achievement system** — `api/lib/achievements.js`: 23 achievements across 6 categories (buildings, research, military, combat, exploration, season); `checkAndUnlock(userId)` called after battles/spy/colonize; `GET /api/achievements`; `user_achievements` DB table (migration 0018)
- [x] **PWA push notifications** — VAPID Web Push (`web-push` package); `push_subscriptions` DB table; `POST /api/push/subscribe` (subscribe + unsubscribe); `GET /api/push/vapid-public-key`; custom service worker `src/sw.ts` (Workbox precaching + push event handler); `usePushNotifications` hook; toggle card in ProfilePage; push sent to defender on attack and to winner on boss kill
- [x] **Building prerequisites** — sawmill lv1 required before workshop/barracks/academy/granary; quarry lv1 for stonehouse; grainFarm lv1 for silo — prevents new players from wasting starting resources
- [x] **Energy pill always visible** — EnergyPill shown even when both produced and consumed are 0 (was hidden at game start)
- [x] **Admin panel redesign** — all tabs use `card-medieval` + CSS grid rows (no HTML tables); SeasonTab merged into ServerTab; default tab is NpcMonitorTab
- [x] **NPC Monitor tab** — `GET /api/admin/npc-stats`: tick status bar, 4 metric cards, buildings avg/max, army distribution stacked bar, combat units per type, support unit adoption, defenses adoption, resources avg, active missions, tick history table (last 24 ticks)

### Phase 14 — Expeditions ✅
- [x] **Expedition** (`ExpeditionMission` en ref) — `api/lib/expedition.js` + `api/lib/missions/expedition.js`
  - Target: slot `UNIVERSE.maxSlot + 1` (= 16, "Tierras Ignotas")
  - 10 outcomes con pesos OGame: nothing 25, resources 35, units 17, ether 7.5, delay 7.5, speedup 2.75, bandits 3, demons 1.5, merchant 0.4, black_hole 0.2
  - `bandits`/`demons` resuelven combate vs flota generada; `merchant` propone trade aceptar/rechazar
  - Discoverer: `combatMultiplier=0.5` y +50% en outcomes de recursos/unidades

### Phase 14 — Misiles ✅
- [x] **Misiles balísticos** (`MissileMission` en ref) — `api/lib/missions/missile.js`
  - Unidad `ballistic` (almacenada en `armoury`, hull 4000, sin retorno)
  - Atacan únicamente defensas; `trebuchet` como interceptor
  - Daño = `12000 × (1 + 0.1 × swordsmanship_atk)` por misil que pasa
  - Defensa absorbe según `hull × (1 + 0.1 × armoury_def) / 10`
  - Reporte completo: misiles enviados / interceptados / daño por defensa

### Phase 18 — Éter (Dark Matter) ✅
- [x] **Éter** — recurso premium del juego (no se compra con dinero)
  - DB: `users.ether` (integer) + tabla `ether_transactions` (type, amount, reason)
  - Se obtiene como outcome de expedición (`ether` weight 7.5)
- [x] **Cambio de clase con Éter** — `api/users/class.js` cobra Éter para cambiar `characterClass` (primera elección gratis)
- [x] **Aceleradores (Halvings)** — `api/queues/accelerate.js` reduce a la mitad un edificio/investigación/unidad de la cola gastando Éter

### Phase 19 — Clases de personaje ✅
- [x] **3 clases** selectables — `users.character_class` ('collector' | 'general' | 'discoverer')
  - **Collector**: +25% producción minas (`tick.js` classBonus), +10% energía (`tick.js` energyClassBonus), +100% velocidad y +25% carga de transportes (`speed.js`/`battle.js`)
  - **General**: +100% velocidad combat units y scavenger, -50% consumo grano, +2 niveles efectivos en sword/armoury/fort en batalla, +20% carga scavenger
  - **Discoverer**: -25% tiempo investigación, -50% probabilidad combate en expedición, +50% recursos/unidades en expedición, +2 slots de expedición simultáneos

### Phase 21 — Rankings ✅ (parcial)
- [x] **Rankings multi-categoría** — `GET /api/rankings?category=total|buildings|research|units|economy`
  - Implementado en `api/rankings/index.js` con `VALID_CATEGORIES`
  - El parámetro `category` decide qué columna del breakdown se usa para `points`
- [ ] **Scheduler de mantenimiento** (sin tabla `highscores`, todo se calcula on-the-fly)
  - Cleanup de `debrisFields` antiguos y mensajes expirados — pendiente de evaluar si hace falta
- [ ] **Enhanced debris fields** — expiry + auto-cleanup, JSON metadata

### Phase 20 — Drives de unidades ✅
- [x] **Bonus de velocidad por research** — `src/lib/game/speed.js`
  - horsemanship (+10%/lv), cartography (+20%/lv), tradeRoutes (+30%/lv)
  - Cada unidad asignada a un drive primario; upgrades escalonados al alcanzar
    cierto nivel cambian la unidad a un drive mejor (scavenger → cartography lv17 → tradeRoutes lv15)
  - General y Collector aplican multiplicadores adicionales sobre el resultado

### Phase 22 — Pulido pendiente (a evaluar)
Las siguientes features no tienen código todavía y no ha sido confirmado si se implementan o se descartan:
- [ ] **Buddy/notes/vacation/chat/fleet templates** — features sociales OGame; sin código
- [ ] **Improved NPC espionage** — datos aleatorios variados, eventos de detección
- [ ] **Ban system (admin)** — sin tabla `bans`
- [ ] **Admin: fleet timing tools** — sin código

> Nota: Phase 15 (alianzas), Phase 16 (ACS), Phase 17 (lunas + Jump Gate + Sensor Phalanx + Moon Destruction + Planet Move) **descartadas del juego** y eliminadas de este roadmap.
