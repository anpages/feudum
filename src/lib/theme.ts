import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'auto'

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = dark ? '#0e0c07' : '#f5e6c8'
}

interface ThemeStore {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'auto' as ThemeMode,
      setMode: (mode) => {
        set({ mode })
        applyTheme(mode)
      },
    }),
    { name: 'feudum-theme' }
  )
)

export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (useTheme.getState().mode === 'auto') applyTheme('auto')
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
