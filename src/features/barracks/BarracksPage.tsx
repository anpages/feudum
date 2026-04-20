import { useState, useCallback } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLightFighter,
  GiHeavyFighter,
  GiMountedKnight,
  GiKnightBanner,
  GiCrossedSwords,
  GiSiegeTower,
  GiBattleMech,
  GiDragonHead,
  GiTrade,
  GiCaravan,
  GiCampingTent,
  GiVulture,
  GiSpyglass,
  GiBowArrow,
  GiCrossbow,
  GiBallista,
  GiCatapult,
  GiWizardStaff,
  GiDragonBreath,
  GiWoodBeam,
  GiBrickWall,
  GiMoai,
  GiWatchtower,
  GiMissileLauncher,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useBarracks, useTrainUnit, type UnitInfo } from '@/features/barracks/useBarracks'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { UnitCard } from '@/features/barracks/components/UnitCard'

// ── Static metadata ───────────────────────────────────────────────────────────

const UNIT_META: Record<string, { name: string; Icon: IconType; description: string }> = {
  squire:      { Icon: GiLightFighter,  name: 'Escudero',            description: 'Infantería ligera, rápida y económica.' },
  knight:      { Icon: GiHeavyFighter,  name: 'Caballero',           description: 'Combatiente pesado con armadura reforzada.' },
  paladin:     { Icon: GiMountedKnight, name: 'Paladín',             description: 'Caballería de élite, equilibrio entre velocidad y potencia.' },
  warlord:     { Icon: GiKnightBanner,  name: 'Señor de la Guerra',  description: 'Comandante de la batalla. Destrucción masiva.' },
  grandKnight: { Icon: GiCrossedSwords, name: 'Gran Caballero',      description: 'Interceptor de alta tecnología.' },
  siegeMaster: { Icon: GiSiegeTower,    name: 'Maestro de Asedio',   description: 'Especialista en destruir defensas.' },
  warMachine:  { Icon: GiBattleMech,    name: 'Máquina de Guerra',   description: 'El destructor más poderoso.' },
  dragonKnight:{ Icon: GiDragonHead,    name: 'Caballero Dragón',    description: 'La unidad definitiva. Capaz de destruir reinos.' },
  merchant:    { Icon: GiTrade,         name: 'Mercader',            description: 'Transporte ligero de recursos.' },
  caravan:     { Icon: GiCaravan,       name: 'Caravana',            description: 'Transporte pesado de alta capacidad.' },
  colonist:    { Icon: GiCampingTent,   name: 'Colonista',           description: 'Funda nuevos reinos en territorios vacíos.' },
  scavenger:   { Icon: GiVulture,       name: 'Carroñero',           description: 'Recoge los escombros de batallas.' },
  scout:       { Icon: GiSpyglass,      name: 'Explorador',          description: 'Espía reinos enemigos sin ser detectado.' },
  // Defenses
  archer:      { Icon: GiBowArrow,      name: 'Arquero',             description: 'Defensa ligera. Eficaz contra infantería.' },
  crossbowman: { Icon: GiCrossbow,      name: 'Ballestero',          description: 'Defensa reforzada con alcance mayor.' },
  ballista:    { Icon: GiBallista,      name: 'Ballista',            description: 'Artillería pesada. Destruye unidades acorazadas.' },
  trebuchet:   { Icon: GiCatapult,      name: 'Trebuchet',           description: 'Cañón de asedio. Intercepta misiles balísticos (1:1).' },
  mageTower:   { Icon: GiWizardStaff,   name: 'Torre Maga',          description: 'Defensa arcana con escudo masivo.' },
  dragonCannon:{ Icon: GiDragonBreath,  name: 'Cañón Dragón',        description: 'Turreta de plasma dracónico. Devastadora.' },
  palisade:    { Icon: GiWoodBeam,      name: 'Palizada',            description: 'Escudo pequeño. Protege toda la defensa.' },
  castleWall:  { Icon: GiBrickWall,     name: 'Muralla',             description: 'Escudo máximo. Protección total del reino.' },
  moat:        { Icon: GiMoai,          name: 'Foso',                description: 'Barrera defensiva. Ralentiza a los atacantes.' },
  catapult:    { Icon: GiCatapult,      name: 'Catapulta',           description: 'Arma de asedio. Destruye posiciones enemigas.' },
  beacon:      { Icon: GiWatchtower,    name: 'Faro',                description: 'Torre de vigilancia. Detecta ejércitos enemigos.' },
  // Missiles
  ballistic:   { Icon: GiMissileLauncher, name: 'Misil Balístico',   description: 'Misil de un solo uso. Daña defensas enemigas a distancia. Los trebuchets lo interceptan.' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'units' | 'support' | 'missiles'

const BARRACKS_GUIDE_KEY = 'barracks_guide_seen'

export function BarracksPage() {
  const [tab, setTab] = useState<Tab>('units')
  const [guideVisible, setGuideVisible] = useState(() => !localStorage.getItem(BARRACKS_GUIDE_KEY))
  const { data, isLoading, refetch } = useBarracks()
  const { data: kingdom } = useKingdom()
  const { data: researchData } = useResearch()
  const resources = useResourceTicker(kingdom)
  const train = useTrainUnit()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    await syncQueues()
    refetch()
  }, [refetch, syncQueues])

  function dismissGuide() {
    localStorage.setItem(BARRACKS_GUIDE_KEY, '1')
    setGuideVisible(false)
  }

  if (isLoading) return <BarracksSkeleton />

  const TAB_ITEMS: Record<Tab, UnitInfo[]> = {
    units:   data?.units   ?? [],
    support: data?.support ?? [],
    missiles: data?.missiles ?? [],
  }

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Ejército</span>
        <h1 className="page-title mt-0.5">Cuartel</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Entrena unidades de combate y apoyo para proteger y expandir tu reino.
        </p>
      </div>

      {/* Beginner guide */}
      {guideVisible && (
        <div className="anim-fade-up-1 flex items-start gap-3 px-4 py-3.5 rounded-lg border border-gold/20 bg-gold-soft">
          <Lightbulb size={15} className="text-gold shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-ui text-xs font-semibold text-ink">¿Por dónde empezar?</p>
            <p className="font-body text-xs text-ink-muted leading-relaxed">
              Entrena <strong className="text-ink">Escuderos</strong> (Combate) para tener tropas baratas.
              Luego un <strong className="text-ink">Explorador</strong> (Apoyo) para espiar reinos vecinos antes de atacar.
            </p>
          </div>
          <button onClick={dismissGuide} className="shrink-0 p-1 rounded text-ink-muted hover:text-ink transition-colors">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="anim-fade-up-1">
        <div className="flex gap-1 p-1 bg-parchment-warm rounded-md w-fit">
          {([
            ['units',    'Combate'],
            ['support',  'Apoyo'],
            ['missiles', 'Misiles'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-xs font-ui font-semibold uppercase tracking-wide transition-all ${
                tab === t
                  ? 'bg-white text-gold shadow-sm border border-gold/15'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {TAB_ITEMS[tab].map((u, i) => {
          const meta = UNIT_META[u.id]
          if (!meta) return null
          return (
            <UnitCard
              key={u.id}
              unit={u}
              meta={meta}
              resources={resources}
              kingdom={kingdom}
              research={researchData?.research}
              isTraining={train.isPending && train.variables?.unit === u.id}
              onTrain={amount => train.mutate({ unit: u.id, amount })}
              onCountdownEnd={handleCountdownEnd}
              onAccelerate={u.inQueue ? () => accelerate.mutate('unit') : undefined}
              isAccelerating={accelerate.isPending}
              animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}`}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BarracksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" />
        <div className="skeleton h-8 w-32" />
      </div>
      <div className="skeleton h-9 w-40 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex gap-3">
              <div className="skeleton w-8 h-8 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-2.5 w-full" />
              </div>
            </div>
            <div className="skeleton h-10 w-full rounded" />
            <div className="skeleton h-9 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  )
}
