import { Swords, Package, Eye, Pickaxe, Tent, Flag, Compass, Rocket } from 'lucide-react'
import {
  GiLightFighter, GiHeavyFighter, GiMountedKnight, GiKnightBanner,
  GiCrossedSwords, GiSiegeTower, GiBattleMech, GiDragonHead,
  GiTrade, GiCaravan, GiCampingTent, GiVulture, GiSpyglass,
} from 'react-icons/gi'
import type { IconType } from 'react-icons'
import type { MissionType } from '@/shared/types'

export const COMBAT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'squire',       name: 'Escudero',            Icon: GiLightFighter },
  { id: 'knight',       name: 'Caballero',            Icon: GiHeavyFighter },
  { id: 'paladin',      name: 'Paladín',              Icon: GiMountedKnight },
  { id: 'warlord',      name: 'Señor de la Guerra',   Icon: GiKnightBanner },
  { id: 'grandKnight',  name: 'Gran Caballero',       Icon: GiCrossedSwords },
  { id: 'siegeMaster',  name: 'Maestro de Asedio',    Icon: GiSiegeTower },
  { id: 'warMachine',   name: 'Máquina de Guerra',    Icon: GiBattleMech },
  { id: 'dragonKnight', name: 'Caballero Dragón',     Icon: GiDragonHead },
]

export const SUPPORT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'merchant',  name: 'Mercader',   Icon: GiTrade },
  { id: 'caravan',   name: 'Caravana',   Icon: GiCaravan },
  { id: 'colonist',  name: 'Colonista',  Icon: GiCampingTent },
  { id: 'scavenger', name: 'Carroñero',  Icon: GiVulture },
  { id: 'scout',     name: 'Explorador', Icon: GiSpyglass },
]

export const ALL_UNIT_META = [...COMBAT_UNITS, ...SUPPORT_UNITS]

export const MISSION_META: Record<MissionType, {
  label: string
  Icon: typeof Swords
  color: string
  desc: string
}> = {
  attack:     { label: 'Ataque',              Icon: Swords,   color: 'text-crimson',  desc: 'Atacar y saquear el reino objetivo.' },
  transport:  { label: 'Transporte',          Icon: Package,  color: 'text-forest',   desc: 'Transportar recursos al reino objetivo.' },
  spy:        { label: 'Espionaje',           Icon: Eye,      color: 'text-gold-dim', desc: 'Solo Exploradores. Recopila información.' },
  scavenge:   { label: 'Recolección',         Icon: Pickaxe,  color: 'text-stone',    desc: 'Envía Carroñeros a recolectar escombros.' },
  colonize:   { label: 'Colonización',        Icon: Tent,     color: 'text-forest',   desc: 'Envía Colonistas a fundar una nueva colonia.' },
  deploy:     { label: 'Despliegue',          Icon: Flag,     color: 'text-gold',     desc: 'Mover tropas a una colonia propia. Sin retorno.' },
  expedition: { label: 'Expedición',          Icon: Compass,  color: 'text-gold',     desc: 'Explora las Tierras Ignotas. Destino fijo: slot 16.' },
  missile:    { label: 'Bombardeo Alquímico', Icon: Rocket,   color: 'text-crimson',  desc: 'Lanza Bombas Alquímicas. Solo daña defensas. Los trebuchets interceptan 1 bomba cada uno.' },
}
