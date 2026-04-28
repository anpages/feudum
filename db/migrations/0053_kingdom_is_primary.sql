-- Capital vs colonias secundarias.
-- Cada user tiene una "capital" (primera colonia, inviolable en el futuro sistema
-- de conquista). Las nuevas colonias se crean siempre como secundarias.
ALTER TABLE "kingdoms" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;

-- Backfill: marcar como is_primary la kingdom más antigua (created_at) de cada user.
-- DISTINCT ON ordenado por user_id, created_at ASC = primera kingdom por user.
UPDATE "kingdoms" k
SET    "is_primary" = true
WHERE  k.id IN (
  SELECT DISTINCT ON (user_id) id
  FROM   "kingdoms"
  ORDER  BY user_id, created_at ASC, id ASC
);

-- Índice parcial para lookups rápidos de capital por usuario
CREATE INDEX IF NOT EXISTS idx_kingdoms_user_primary
  ON "kingdoms"(user_id) WHERE is_primary = true;
