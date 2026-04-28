-- Puntos de Interés (POI) — recursos especiales en slots vacíos del mapa.
-- Generados al inicio de temporada con seed determinista. Visibilidad privada
-- por usuario (cada jugador construye su mapa de POI descubiertos).

CREATE TABLE IF NOT EXISTS "points_of_interest" (
  "realm"     integer NOT NULL,
  "region"    integer NOT NULL,
  "slot"      integer NOT NULL,
  "type"      varchar(40) NOT NULL,
  "magnitude" integer NOT NULL DEFAULT 100,
  "claimed_by_kingdom_id" uuid REFERENCES "kingdoms"("id") ON DELETE SET NULL,
  "claimed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm", "region", "slot")
);

CREATE INDEX IF NOT EXISTS idx_poi_claimed
  ON "points_of_interest" ("claimed_by_kingdom_id")
  WHERE "claimed_by_kingdom_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_poi_active
  ON "points_of_interest" ("realm", "region")
  WHERE "magnitude" > 0;

-- Tabla de descubrimientos: relación N:M user-POI.
-- Cada user que expediciona al slot del POI obtiene una fila aquí — eso es lo
-- que le da visibilidad. Si nunca expedicionó, no lo ve.
CREATE TABLE IF NOT EXISTS "poi_discoveries" (
  "poi_realm"     integer NOT NULL,
  "poi_region"    integer NOT NULL,
  "poi_slot"      integer NOT NULL,
  "user_id"       uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "discovered_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("poi_realm", "poi_region", "poi_slot", "user_id"),
  FOREIGN KEY ("poi_realm", "poi_region", "poi_slot")
    REFERENCES "points_of_interest"("realm", "region", "slot") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_poi_discoveries_user
  ON "poi_discoveries" ("user_id");
