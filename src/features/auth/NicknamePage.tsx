import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Shield, RefreshCw, Check } from 'lucide-react'
import { authService } from '@/features/auth/services/authService'

const PREFIXES = [
  'Hierro',
  'Piedra',
  'Dorado',
  'Oscuro',
  'Valiente',
  'Fierro',
  'Trueno',
  'Roble',
  'Rojo',
  'Plata',
]
const SUFFIXES = [
  'Guardián',
  'Espada',
  'Forja',
  'Torre',
  'Halcón',
  'Lobo',
  'Escudo',
  'Lanza',
  'Cuervo',
  'Hacha',
]
const CLASSIC = [
  'Aldric',
  'Berthold',
  'Cedric',
  'Dunstan',
  'Edmund',
  'Godfrey',
  'Harold',
  'Oswin',
  'Radulf',
  'Wulfric',
]

function generateSuggestions(): string[] {
  const pool: string[] = []
  while (pool.length < 2) {
    const c = CLASSIC[Math.floor(Math.random() * CLASSIC.length)]
    if (!pool.includes(c)) pool.push(c)
  }
  while (pool.length < 4) {
    const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
    const s = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
    const name = `${p}${s}`
    if (!pool.includes(name)) pool.push(name)
  }
  return pool.sort(() => Math.random() - 0.5)
}

export function NicknamePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [suggestions, setSuggestions] = useState(() => generateSuggestions())
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const nickname = custom.trim() || selected || ''
  const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(nickname)

  function refresh() {
    setSelected(null)
    setSuggestions(generateSuggestions())
  }

  async function handleSubmit() {
    if (!isValid || loading) return
    setError('')
    setLoading(true)
    try {
      await authService.setNickname(nickname)
      qc.setQueryData(['auth', 'profile'], (old: { id: string; username: string | null } | undefined) =>
        old ? { ...old, username: nickname } : old
      )
      navigate('/overview', { replace: true })
    } catch (e: unknown) {
      const body = e instanceof Error ? e.message : String(e)
      console.error('[nickname] error:', body)
      if (body.includes('nickname_taken')) {
        setError('Ese nombre ya está en uso. Elige otro.')
      } else if (body.includes('already_set')) {
        await qc.invalidateQueries({ queryKey: ['auth', 'profile'] })
        navigate('/overview', { replace: true })
      } else {
        setError(`Error: ${body}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-login min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md anim-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-gold/8 border border-gold/20">
            <Shield size={24} className="text-gold" />
          </div>
          <h1 className="font-display text-2xl text-ink tracking-[0.14em] uppercase">
            Elige tu nombre
          </h1>
          <p className="font-body text-ink-muted text-sm mt-2">
            Este será tu nombre en el reino. No podrás cambiarlo después.
          </p>
        </div>

        <div className="card-medieval p-6 rounded space-y-6">
          <div className="card-corner-tr" />
          <div className="card-corner-bl" />

          {/* Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="section-heading">Nombres sugeridos</span>
              <button
                onClick={refresh}
                className="flex items-center gap-1.5 text-xs font-ui text-ink-muted hover:text-gold transition-colors"
              >
                <RefreshCw size={11} />
                Nuevos
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map(name => (
                <button
                  key={name}
                  onClick={() => {
                    setSelected(name)
                    setCustom('')
                  }}
                  className={`
                    py-2.5 px-3 rounded border text-sm font-ui font-medium transition-all duration-150 text-left
                    ${
                      selected === name && !custom
                        ? 'border-gold bg-gold/8 text-gold'
                        : 'border-gold/20 bg-parchment-warm text-ink-mid hover:border-gold/40 hover:bg-gold/5'
                    }
                  `}
                >
                  <span className="flex items-center justify-between">
                    {name}
                    {selected === name && !custom && <Check size={13} className="text-gold" />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="divider">◆</div>

          {/* Custom input */}
          <div>
            <label className="section-heading block mb-2">O escribe el tuyo</label>
            <input
              type="text"
              value={custom}
              onChange={e => {
                setCustom(e.target.value)
                setSelected(null)
              }}
              placeholder="Tu nombre de jugador…"
              maxLength={20}
              className="game-input w-full"
            />
            <p className="mt-1.5 font-body text-xs text-ink-muted/60">
              3–20 caracteres · letras, números y guion bajo
            </p>
          </div>

          {error && (
            <p className="font-ui text-xs text-crimson px-3 py-2 rounded bg-crimson/5 border border-crimson/15">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Guardando…' : 'Entrar al reino'}
          </button>
        </div>
      </div>
    </div>
  )
}
