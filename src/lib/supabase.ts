import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  import.meta.env.STORAGE_VITE_SUPABASE_URL as string,
  import.meta.env.STORAGE_VITE_SUPABASE_ANON_KEY as string,
)
