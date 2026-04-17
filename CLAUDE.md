# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Feudum** — a medieval browser strategy game built from scratch, mechanically inspired by classic OGame (pre-microtransaction era). This is NOT a fork or modification of OGame; it is a clean reimplementation with a medieval theme.

**Reference repo:** `/home/anpages/ogame-ref` (OGameX — PHP/Laravel OGame clone). Use it read-only to extract game formulas, cost tables, and timing calculations before implementing any game mechanic.

**Live URLs:**
- Production: https://ogame-xi.vercel.app
- GitHub: https://github.com/anpages/feudum

## Commands

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # tsc -b && vite build
npm run lint         # ESLint

# Database (requires DATABASE_URL in .env.local)
npm run db:generate  # Generate migration SQL from schema changes
npm run db:migrate   # Apply pending migrations to Neon
npm run db:studio    # Open Drizzle Studio (DB browser)

# Deploy
vercel --prod        # Deploy to production
```

To load env vars for DB commands in the shell: `set -a && source .env.local && set +a`

## Architecture

### Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config in `src/index.css`) |
| Data fetching | React Query — global polling every 10s (`staleTime: 5s`) |
| State | Zustand (not yet used, available for global UI state) |
| Backend | Hono — all routes under `/api`, deployed as Vercel serverless functions |
| Database | Neon (serverless PostgreSQL) via `@neondatabase/serverless` |
| ORM | Drizzle ORM — schema in `db/schema/`, migrations in `db/migrations/` |
| Auth | Better Auth (not yet wired up) |
| Deploy | Vercel — `vercel.json` rewrites `/api/*` → `api/index.ts` |

### Real-time approach

Vercel serverless doesn't support persistent WebSockets. Game state is fetched via React Query polling (10s interval). Resource counts are interpolated locally every second in `useResourceTicker` using server-provided production rates — this keeps the UI feeling live without extra requests.

### Folder layout

```
api/index.ts          Hono app entry point — mount new routers here
api/routes/           (empty) — add one file per feature domain
db/schema/            Drizzle table definitions (one file per domain)
db/index.ts           Neon connection + re-exports all schema types
src/components/layout/ GameLayout, ResourceBar, NavBar
src/hooks/            useKingdom (React Query), useResourceTicker (local ticker)
src/lib/api.ts        Thin fetch wrapper (api.get / api.post / api.patch)
src/lib/format.ts     formatResource, formatDuration
src/pages/            One file per route — currently placeholders
```

### tsconfig split

- `tsconfig.app.json` — covers `src/` only (browser environment, Vite client types)
- `tsconfig.node.json` — covers `api/`, `db/`, `vite.config.ts`, `drizzle.config.ts` (Node environment)

### Adding a new API route

1. Create `api/routes/<feature>.ts` exporting a `new Hono()` router
2. Mount it in `api/index.ts`: `app.route('/<feature>', featureRouter)`
3. Add a corresponding hook in `src/hooks/use<Feature>.ts` using `api.get()`

### Adding a new DB table

1. Add a file in `db/schema/<table>.ts`
2. Export it from `db/schema/index.ts`
3. Run `npm run db:generate` then `npm run db:migrate`

## Theme mapping (OGame → Feudum)

Every OGame concept has a medieval equivalent. When reading the reference repo, apply this mapping:

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

Research mapping: see `db/schema/research.ts` — each field has an inline comment with its OGame equivalent.

## Design tokens

Custom Tailwind colors defined in `src/index.css` via `@theme`:
- `parchment` / `parchment-dark` — main text / surface colors
- `gold` / `gold-light` — primary accent (headings, active nav)
- `crimson` — danger / full resources
- `forest` — secondary accent
- `ink` — dark text on light surfaces

Use `font-display` class for headings (Cinzel serif) and `font-body` for long text (Crimson Text).
