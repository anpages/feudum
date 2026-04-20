import { useState } from 'react'
import { TreePine, Mountain, Wheat, Gift } from 'lucide-react'
import {
  GiWoodAxe, GiMining, GiAnvil,
  GiSpellBook, GiSwordman, GiCrossedSwords, GiCompass, GiLaurelCrown,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useAchievements, useClaimAchievement, type Achievement } from './useAchievements'
import { formatResource } from '@/lib/format'
import type { AchievementCategory } from './types'

type ChapterConfig = {
  id: AchievementCategory
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  hint: string
}

const CHAPTERS: ChapterConfig[] = [
  { id: 'inicio',          label: 'Primeros Pasos',  Icon: GiWoodAxe,      hint: 'Construye los edificios de producción básicos' },
  { id: 'economia',        label: 'Producción',      Icon: GiMining,       hint: 'Mejora tus minas para tener recursos estables' },
  { id: 'infraestructura', label: 'Infraestructura', Icon: GiAnvil,        hint: 'Taller, Cuartel, Academia y edificios de soporte' },
  { id: 'investigacion',   label: 'Investigación',   Icon: GiSpellBook,    hint: 'Recorre el árbol de investigaciones' },
  { id: 'ejercito',        label: 'Ejército',        Icon: GiSwordman,     hint: 'Entrena tropas desde el primer escudero al Caballero Dragón' },
  { id: 'combate',         label: 'Combate',         Icon: GiCrossedSwords, hint: 'Espía, ataca y conquista' },
  { id: 'expansion',       label: 'Expansión',       Icon: GiCompass,      hint: 'Transporta, explora y coloniza' },
  { id: 'temporada',       label: 'Temporada',       Icon: GiLaurelCrown,  hint: 'El camino hacia el Campeón de Temporada' },
]

export function AchievementsPage() {
  const [cat, setCat] = useState<AchievementCategory>('inicio')
  const { data, isLoading } = useAchievements()

  const achievements  = data?.achievements ?? []
  const filtered      = [...achievements.filter(a => a.cat === cat)].sort((a, b) => a.order - b.order)
  const unlockedTotal = achievements.filter(a => a.unlocked).length
  const pendingTotal  = data?.pendingCount ?? 0

  const chapterProgress = (id: AchievementCategory) => {
    const ch = achievements.filter(a => a.cat === id)
    return { unlocked: ch.filter(a => a.unlocked).length, total: ch.length }
  }

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Guía de Progresión</span>
        <h1 className="page-title mt-0.5">Logros</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          {unlockedTotal} / {achievements.length} desbloqueados
          {pendingTotal > 0 && (
            <span className="ml-2 font-ui text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#b8860b', color: '#faf6ef' }}>
              {pendingTotal} recompensa{pendingTotal > 1 ? 's' : ''} disponible{pendingTotal > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Chapter tabs */}
      <div className="anim-fade-up-1 flex gap-1.5 flex-wrap">
        {CHAPTERS.map(({ id, label, Icon }) => {
          const { unlocked, total } = chapterProgress(id)
          const complete = total > 0 && unlocked === total
          const active   = cat === id
          return (
            <button
              key={id}
              onClick={() => setCat(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-ui text-xs font-semibold transition-all ${
                active
                  ? 'bg-gold-soft border-gold/30 text-gold-dim shadow-sm'
                  : complete
                    ? 'border-forest/30 text-forest bg-forest/5 hover:bg-forest/10'
                    : 'border-gold/10 text-ink-muted hover:border-gold/20 hover:bg-parchment-warm'
              }`}
            >
              <Icon size={12} />
              {label}
              <span className={`font-ui text-[0.55rem] tabular-nums ${active ? 'text-gold-dim' : complete ? 'text-forest' : 'text-ink-muted/60'}`}>
                {unlocked}/{total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Chapter hint */}
      {!isLoading && (
        <p className="font-body text-xs text-ink-muted/70 italic -mt-2 anim-fade-up-1">
          {CHAPTERS.find(c => c.id === cat)?.hint}
        </p>
      )}

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

function AchievementCard({ achievement: a }: { achievement: Achievement }) {
  const claim  = useClaimAchievement()
  const locked = !a.unlocked

  const hasReward = a.reward && (a.reward.wood > 0 || a.reward.stone > 0 || a.reward.grain > 0)

  return (
    <Card className={`p-4 flex gap-3 transition-all ${locked ? 'opacity-50 grayscale' : ''} ${a.pending ? 'ring-2 ring-gold/40' : ''}`}>
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 ${
        locked ? 'bg-parchment-deep border border-gold/10' : 'bg-gold/10 border border-gold/25'
      }`}>
        {locked ? '🔒' : a.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-semibold text-ink">{a.name}</p>
        <p className="font-body text-xs text-ink-muted mt-0.5 leading-relaxed">{a.desc}</p>

        {/* Reward — shown as what you RECEIVE, not as a cost */}
        {hasReward && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="flex items-center gap-0.5 font-ui text-[0.58rem] text-gold-dim">
              <Gift size={8} />
              Recompensa:
            </span>
            {a.reward!.wood  > 0 && (
              <span className="flex items-center gap-0.5 font-ui text-[0.6rem]" style={{ color: '#7a5c2e' }}>
                <TreePine size={8} />+{formatResource(a.reward!.wood)}
              </span>
            )}
            {a.reward!.stone > 0 && (
              <span className="flex items-center gap-0.5 font-ui text-[0.6rem]" style={{ color: '#7a5c2e' }}>
                <Mountain size={8} />+{formatResource(a.reward!.stone)}
              </span>
            )}
            {a.reward!.grain > 0 && (
              <span className="flex items-center gap-0.5 font-ui text-[0.6rem]" style={{ color: '#7a5c2e' }}>
                <Wheat size={8} />+{formatResource(a.reward!.grain)}
              </span>
            )}
          </div>
        )}

        {a.claimedAt && (
          <p className="font-body text-[0.6rem] text-ink-muted/60 mt-1.5">
            Reclamado · {new Date(a.claimedAt).toLocaleDateString('es-ES')}
          </p>
        )}

        {a.unlockedAt && !a.claimedAt && !hasReward && (
          <p className="font-body text-[0.6rem] text-ink-muted/60 mt-1.5">
            Desbloqueado · {new Date(a.unlockedAt).toLocaleDateString('es-ES')}
          </p>
        )}

        {a.pending && (
          <button
            onClick={() => claim.mutate(a.id)}
            disabled={claim.isPending}
            className="mt-2 px-3 py-1 rounded border font-ui text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: '#b8860b', color: '#faf6ef', border: '1px solid #9a7010' }}
          >
            {claim.isPending ? 'Reclamando…' : 'Reclamar recompensa'}
          </button>
        )}
      </div>
    </Card>
  )
}

function AchievementsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 anim-fade-up-2">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-4 flex gap-3">
          <div className="skeleton w-11 h-11 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-40" />
            <div className="skeleton h-2.5 w-24" />
          </div>
        </Card>
      ))}
    </div>
  )
}
