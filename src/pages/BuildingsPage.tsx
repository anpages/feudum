import { ArrowUp, Clock, Lock, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface BuildingDef {
  id: string
  name: string
  description: string
  emoji: string
  baseWood: number
  baseStone: number
  factor: number
  produces: string | null
  requires?: { id: string; level: number; label: string }
}

const BUILDINGS: BuildingDef[] = [
  { id: 'sawmill',        name: 'Aserradero',          description: 'Tala los bosques del reino para producir madera sin cesar.',                        emoji: '🪓', baseWood: 60,        baseStone: 15,     factor: 1.5, produces: 'Madera'    },
  { id: 'quarry',         name: 'Cantera',              description: 'Extrae bloques de piedra de las colinas circundantes.',                              emoji: '⛏',  baseWood: 48,        baseStone: 24,     factor: 1.6, produces: 'Piedra'    },
  { id: 'grainFarm',      name: 'Granja',               description: 'Cultiva extensos campos de trigo y cebada para la población.',                      emoji: '🌾', baseWood: 225,       baseStone: 75,     factor: 1.5, produces: 'Grano'     },
  { id: 'windmill',       name: 'Molino de Viento',     description: 'Aumenta la capacidad máxima de población del reino.',                               emoji: '⚙',  baseWood: 75,        baseStone: 30,     factor: 1.5, produces: 'Población' },
  { id: 'workshop',       name: 'Taller',               description: 'Mecánicos expertos reducen los tiempos de toda construcción.',                      emoji: '🔨', baseWood: 400,       baseStone: 120,    factor: 2.0, produces: null        },
  { id: 'engineersGuild', name: 'Gremio de Ingenieros', description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.', emoji: '📐', baseWood: 1_000_000, baseStone: 500_000, factor: 2.0, produces: null, requires: { id: 'workshop', level: 10, label: 'Taller Nv 10' } },
]

function buildCost(base: number, factor: number, level: number) {
  return Math.floor(base * Math.pow(factor, level))
}

export function BuildingsPage() {
  const levels: Record<string, number> = {}

  return (
    <div className="space-y-8">

      <div className="anim-fade-up">
        <span className="section-heading">Infraestructura</span>
        <h1 className="page-title mt-0.5">Construcción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Mejora tus edificios para aumentar la producción y desbloquear nuevas capacidades.
        </p>
      </div>

      <section>
        <span className="section-heading anim-fade-up-1">Edificios disponibles</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {BUILDINGS.map((b, i) => {
            const lv        = levels[b.id] ?? 0
            const costWood  = buildCost(b.baseWood,  b.factor, lv)
            const costStone = buildCost(b.baseStone, b.factor, lv)
            const reqLevel  = b.requires ? (levels[b.requires.id] ?? 0) : Infinity
            const isLocked  = !!b.requires && reqLevel < b.requires.level

            return (
              <BuildingCard
                key={b.id}
                building={b}
                level={lv}
                costWood={costWood}
                costStone={costStone}
                isLocked={isLocked}
                animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
              />
            )
          })}
        </div>
      </section>

    </div>
  )
}

function BuildingCard({ building, level, costWood, costStone, isLocked, animClass }: {
  building: BuildingDef; level: number; costWood: number; costStone: number; isLocked: boolean; animClass: string
}) {
  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>

      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5 shrink-0">{building.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">
              {building.name}
            </h3>
            <Badge variant={level > 0 ? 'gold' : 'stone'} className="shrink-0">
              Nv {level}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">
            {building.description}
          </p>
        </div>
      </div>

      {building.produces && (
        <div className="flex items-center gap-1.5 text-forest-light text-xs">
          <TrendingUp size={10} />
          <span className="font-ui font-semibold uppercase tracking-wide">
            Produce: {building.produces}
          </span>
        </div>
      )}

      <div className="divider">◆</div>

      <div className="flex items-center gap-4 text-ink-muted text-xs">
        <div className="flex items-center gap-1.5">
          <span>🪵</span>
          <span className="font-ui tabular-nums text-ink-mid">{costWood.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>🪨</span>
          <span className="font-ui tabular-nums text-ink-mid">{costStone.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">~2m</span>
        </div>
      </div>

      {isLocked ? (
        <Button variant="ghost" className="w-full mt-auto" disabled>
          <Lock size={11} />
          Requiere {building.requires!.label}
        </Button>
      ) : (
        <Button variant="primary" className="w-full mt-auto" disabled title="Disponible en Fase 4">
          <ArrowUp size={11} />
          Mejorar a Nv {level + 1}
        </Button>
      )}

    </Card>
  )
}
