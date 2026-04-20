import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from '@/components/ErrorBoundary'

// When a new deploy removes old JS chunks, dynamic imports fail.
// Vite fires 'vite:preloadError' — force a hard reload to pick up the new build.
window.addEventListener('vite:preloadError', () => window.location.reload())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // data considered fresh for 30s
      gcTime: 5 * 60_000,         // keep unused cache 5 min
      retry: 1,
      refetchOnWindowFocus: true,  // sync when user returns to tab
      refetchOnReconnect: true,    // sync after network reconnect
      // No refetchInterval — Supabase Realtime handles live updates
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>
)
