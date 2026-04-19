import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface Props {
  children: ReactNode
  resetKey?: string
  fallback?: (reset: () => void, error: Error) => ReactNode
}

interface State {
  error: Error | null
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset, this.state.error)
    return <DefaultFallback reset={this.reset} error={this.state.error} />
  }
}

function DefaultFallback({ reset, error }: { reset: () => void; error: Error }) {
  const navigate = useNavigate()
  return (
    <div className="bg-game min-h-screen flex items-center justify-center px-6">
      <div className="card-medieval max-w-md w-full p-8 text-center space-y-5">
        <div className="card-corner-tr" />
        <div className="card-corner-bl" />
        <div className="text-5xl">⚔</div>
        <div>
          <h1 className="font-display text-2xl text-gold-light">Un percance en el reino</h1>
          <p className="font-body text-sm text-parchment-dim mt-2">
            Algo se ha roto y los heraldos no han podido restablecer el orden.
          </p>
        </div>
        <pre className="text-left font-ui text-[0.65rem] text-parchment-dim/60 bg-void/40 border border-gold/10 rounded px-3 py-2 overflow-auto max-h-24">
          {error.message}
        </pre>
        <div className="flex items-center justify-center gap-2">
          <button onClick={reset} className="btn btn-primary">Reintentar</button>
          <button onClick={() => navigate('/overview')} className="btn btn-ghost">Ir al reino</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Page-level boundary: auto-resets when the route changes so a broken page
 * doesn't trap the user. Wrap inside <GameLayout> around <Outlet>.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundaryInner resetKey={pathname}>{children}</ErrorBoundaryInner>
}

/**
 * Outer boundary: catches catastrophic errors before any router context exists.
 * Reload is the only recovery.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="bg-game min-h-screen flex items-center justify-center px-6">
        <div className="card-medieval max-w-md w-full p-8 text-center space-y-5">
          <div className="card-corner-tr" />
          <div className="card-corner-bl" />
          <div className="text-5xl">🏰</div>
          <h1 className="font-display text-2xl text-gold-light">El reino ha caído</h1>
          <p className="font-body text-sm text-parchment-dim">
            Un error catastrófico ha derribado las murallas. Recarga la página para reconstruir.
          </p>
          <pre className="text-left font-ui text-[0.65rem] text-parchment-dim/60 bg-void/40 border border-gold/10 rounded px-3 py-2 overflow-auto max-h-24">
            {this.state.error.message}
          </pre>
          <button onClick={() => location.reload()} className="btn btn-primary">Recargar</button>
        </div>
      </div>
    )
  }
}
