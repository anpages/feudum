import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Vercel's Supabase integration provisions STORAGE_* env vars; locally we use
// VITE_*. Resolve once at build-time so the client always finds the URL/key.
// Validate values strictly: in Vercel the VITE_* vars were once set to garbage
// (e.g. literal "y"), and a falsy-only check let that garbage win. Treat any
// value that doesn't look like a real Supabase URL / JWT as missing.
const isValidUrl = (v: string | undefined): v is string =>
  !!v && /^https?:\/\/.+/.test(v)
const isValidKey = (v: string | undefined): v is string =>
  !!v && v.length >= 100   // anon JWTs are ~200 chars; anything shorter is bogus

const pickUrl = (...candidates: (string | undefined)[]) =>
  candidates.find(isValidUrl) ?? ''
const pickKey = (...candidates: (string | undefined)[]) =>
  candidates.find(isValidKey) ?? ''

const SUPABASE_URL = pickUrl(
  process.env.VITE_SUPABASE_URL,
  process.env.STORAGE_VITE_SUPABASE_URL,
  process.env.STORAGE_SUPABASE_URL,
)
const SUPABASE_ANON_KEY = pickKey(
  process.env.VITE_SUPABASE_ANON_KEY,
  process.env.STORAGE_VITE_SUPABASE_ANON_KEY,
  process.env.STORAGE_SUPABASE_ANON_KEY,
)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[vite] WARNING: Supabase URL or anon key missing/invalid — bundle will not authenticate')
}

export default defineConfig({
  envPrefix: ['VITE_'],
  define: {
    __SUPABASE_URL__:      JSON.stringify(SUPABASE_URL),
    __SUPABASE_ANON_KEY__: JSON.stringify(SUPABASE_ANON_KEY),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Feudum — Estrategia Medieval',
        short_name: 'Feudum',
        description: 'Construye tu reino medieval, investiga tecnologías y conquista el mundo.',
        theme_color: '#f5e6c8',
        background_color: '#f5e6c8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'es',
        categories: ['games', 'strategy'],
        icons: [
          { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Mi Reino',        short_name: 'Reino',    url: '/overview',  icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }] },
          { name: 'Construcción',    short_name: 'Construir',url: '/buildings', icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }] },
          { name: 'Cuartel',         short_name: 'Cuartel',  url: '/barracks',  icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }] },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      '@supabase/ssr',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@db': path.resolve(__dirname, './db'),
      '@api': path.resolve(__dirname, './api'),
    },
  },
})
