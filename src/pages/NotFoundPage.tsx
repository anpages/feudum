import { Link } from 'react-router-dom'
import { GiCastle } from 'react-icons/gi'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-parchment-light flex items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm">
        <GiCastle size={48} className="mx-auto text-gold/40" />
        <div>
          <p className="font-display text-6xl text-gold font-semibold">404</p>
          <h1 className="font-display text-xl text-ink mt-1">Tierra desconocida</h1>
          <p className="font-body text-sm text-ink-muted mt-2">
            Este territorio no aparece en ningún mapa del reino.
          </p>
        </div>
        <Link
          to="/overview"
          className="btn btn-primary inline-flex"
        >
          Volver al Reino
        </Link>
      </div>
    </div>
  )
}
