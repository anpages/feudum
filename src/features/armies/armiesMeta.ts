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
  unitHint?: string
}> = {
  attack:     {
    label: 'Ataque', Icon: Swords, color: 'text-crimson',
    desc: 'Atacar y saquear el reino objetivo.',
    unitHint: undefined,
  },
  transport:  {
    label: 'Transporte', Icon: Package, color: 'text-forest',
    desc: 'Transportar recursos a otro reino propio o aliado.',
    unitHint: 'Solo Mercaderes (5.000 cap.) y Caravanas (25.000 cap.) transportan recursos. Las tropas de combate tienen capacidad 0.',
  },
  spy:        {
    label: 'Espionaje', Icon: Eye, color: 'text-gold-dim',
    desc: 'Solo Exploradores. Cuantos más envíes, más detallado es el informe.',
  },
  scavenge:   {
    label: 'Recolección', Icon: Pickaxe, color: 'text-stone',
    desc: 'Recoge escombros del slot. Los Carroñeros tienen 20.000 de capacidad cada uno.',
  },
  colonize:   {
    label: 'Colonización', Icon: Tent, color: 'text-forest',
    desc: 'Funda una nueva colonia en un slot vacío. Se consume 1 Colonista al llegar.',
  },
  deploy:     {
    label: 'Despliegue', Icon: Flag, color: 'text-gold',
    desc: 'Mueve tropas a una colonia propia. Sin retorno — las unidades quedan allí permanentemente.',
  },
  expedition: {
    label: 'Expedición', Icon: Compass, color: 'text-gold',
    desc: 'Explora las Tierras Ignotas (slot 16). Cada expedición puede terminar de 10 formas distintas.',
    unitHint: 'Exploradores solos: no combaten ni traen recursos. Combina tropas de combate (para encuentros y descubrir unidades) con Mercaderes o Caravanas (para traer recursos).',
  },
  missile:    {
    label: 'Bombardeo', Icon: Rocket, color: 'text-crimson',
    desc: 'Lanza Bombas Alquímicas. Solo daña defensas, no unidades. Cada Trebuchet enemigo intercepta 1 bomba.',
  },
}
