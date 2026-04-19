import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Non-pooling URL required for migrations (PgBouncer doesn't support DDL)
    url: process.env.STORAGE_POSTGRES_URL_NON_POOLING!,
  },
})
