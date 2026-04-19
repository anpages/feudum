/**
 * Convert a single snake_case row from Supabase into the camelCase shape
 * the rest of the codebase expects (matches Drizzle's $inferSelect types).
 *
 * Top-level only — JSON columns like `result` keep their inner shape.
 */
export function snakeToCamel<T = Record<string, unknown>>(row: Record<string, unknown> | null | undefined): T {
  if (!row) return row as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  }
  return out as T
}

export function snakeToCamelArray<T = Record<string, unknown>>(rows: Record<string, unknown>[] | null | undefined): T[] {
  if (!rows) return []
  return rows.map(r => snakeToCamel<T>(r))
}
