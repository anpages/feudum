import { createClient } from '@supabase/supabase-js'

declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

export const supabase = createClient(
  __SUPABASE_URL__,
  __SUPABASE_ANON_KEY__,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: localStorage,
      // Disable automatic URL code exchange — AuthCallbackPage handles it
      // explicitly. With both active, the PKCE code gets used twice (race)
      // and the second exchange fails with "invalid grant".
      detectSessionInUrl: false,
    },
  }
)
