import { useState } from 'react'
import { GiScrollQuill, GiAnvil, GiSpellBook, GiCrossedSwords, GiCompass, GiLaurelCrown, GiSwordman } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAchievements, type Achievement } from './useAchievements'
import type { AchievementCategory } from './types'

// ── Category config ───────────────────────────────────────────────────────────

type CatConfig = { id: AchievementCategory | 'all'; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }

const CATS: CatConfig[] = [
  { id: 'all',       label: 'Todos',         Icon: GiScrollQuill   },
  { id: 'buildings', label: 'Edificios',     Icon: GiAnvil         },
  { id: 'research',  label: 'Investigación', Icon: GiSpellBook     },
  { id: 'military',  label: 'Militar',       Icon: GiSwordman      },
  { id: 'combat',    label: 'Combate',       Icon: GiCrossedSwords },
  { id: 'explore',   label: 'Exploración',   Icon: GiCompass       },
  { id: 'season',    label: 'Temporada',     Icon: GiLaurelCrown   },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export function AchievementsPage() {
  const [cat, setCat] = useState<AchievementCategory | 'all'>('all')
  const { data, isLoading } = useAchievements()

  const achievements = data?.achievements ?? []
  const filtered     = cat === 'all' ? achievements : achievements.filter(a => a.cat === cat)
  const unlockedTotal = achievements.filter(a => a.unlocked).length

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Progreso</span>
        <h1 className="page-title mt-0.5">Logros</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          {unlockedTotal} / {achievements.length} desbloqueados
        </p>
      </div>

      {/* Category tabs */}
      <div className="anim-fade-up-1 flex gap-1.5 flex-wrap">
        {CATS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setCat(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-ui text-xs font-semibold transition-all ${
              cat === id
                ? 'bg-gold-soft border-gold/30 text-gold-dim shadow-sm'
                : 'border-gold/10 text-ink-muted hover:border-gold/20 hover:bg-parchment-warm'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <AchievementsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 anim-fade-up-2">
          {filtered.map(a => (
            <AchievementCard key={a.id} achievement={a} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Achievement card ──────────────────────────────────────────────────────────

function AchievementCard({ achievement: a }: { achievement: Achievement }) {
  const locked = !a.unlocked
  return (
    <Card className={`p-4 flex gap-3 transition-all ${locked ? 'opacity-50 grayscale' : ''} ${a.isNew ? 'ring-2 ring-gold/50 shadow-gold/10 shadow-lg' : ''}`}>
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 ${
        locked ? 'bg-obsidian border border-gold/10' : 'bg-gold/10 border border-gold/25'
      }`}>
        {locked ? '🔒' : a.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-ui text-sm font-semibold text-ink">{a.name}</p>
          {a.isNew && <Badge variant="gold" className="text-[0.55rem]">¡Nuevo!</Badge>}
        </div>
        <p className="font-body text-xs text-ink-muted/70 mt-0.5 leading-relaxed">{a.desc}</p>
        {a.unlockedAt && (
          <p className="font-body text-[0.6rem] text-ink-muted/40 mt-1">
            {new Date(a.unlockedAt).toLocaleDateString('es-ES')}
          </p>
        )}
      </div>
    </Card>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AchievementsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 anim-fade-up-2">
      {[...Array(9)].map((_, i) => (
        <Card key={i} className="p-4 flex gap-3">
          <div className="skeleton w-11 h-11 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-40" />
          </div>
        </Card>
      ))}
    </div>
  )
}
