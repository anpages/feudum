import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authService } from './services/authService'

const PROFILE_KEY = ['auth', 'profile'] as const

// ── Session store: a tiny external store that mirrors Supabase auth state ─────
// Reading from it is synchronous (it pulls from localStorage on init), so
// `isAuthenticated` is decided immediately on first render — no API roundtrip,
// no flicker to /login when a network call is slow.

type SessionState = { session: Session | null; ready: boolean }

let state: SessionState = { session: null, ready: false }
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())

// Kick off the initial session read once at module load.
supabase.auth.getSession().then(({ data: { session } }) => {
  state = { session, ready: true }
  notify()
})

// Keep the store in sync with future auth events (refresh, signout, signin).
supabase.auth.onAuthStateChange((_event, session) => {
  state = { session, ready: true }
  notify()
})

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const getSnapshot = () => state

export function useAuth() {
  const qc = useQueryClient()
  const { session, ready } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const prevUserId = useRef<string | null>(null)

  // Profile is fetched only when there is a session. It powers username/admin
  // checks but does NOT gate isAuthenticated — so a slow API can't kick the
  // user back to /login.
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: authService.me,
    enabled: !!session,
    retry: 1,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  })

  // When the user changes (login as different account, signout), nuke the cache
  // so we never render data for the wrong user.
  useEffect(() => {
    const uid = session?.user?.id ?? null
    if (prevUserId.current && prevUserId.current !== uid) {
      qc.clear()
    }
    prevUserId.current = uid
  }, [session?.user?.id, qc])

  const logout = async () => {
    await supabase.auth.signOut()
    qc.clear()
  }

  return {
    session,
    user: profile,
    isAuthenticated: !!session,
    isLoading: !ready || (!!session && profileLoading && !profile),
    signInWithGoogle: authService.signInWithGoogle,
    logout,
  }
}
