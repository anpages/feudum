/**
 * Achievement catalog and pure check logic.
 * Server uses checkAndUnlock() (in api/lib/achievements.js) which queries DB
 * and feeds into checkConditions() from here.
 */

export const ACHIEVEMENTS = [
  // Buildings
  { id: 'first_building',  cat: 'buildings', name: 'Primer Ladrillo',          desc: 'Construye cualquier edificio por primera vez',         icon: '🧱', reward: { wood: 500,     stone: 500,     grain: 0      } },
  { id: 'sawmill_5',       cat: 'buildings', name: 'Maestro Leñador',          desc: 'Aserradero nivel 5',                                   icon: '🪵', reward: { wood: 5000,    stone: 0,       grain: 0      } },
  { id: 'sawmill_10',      cat: 'buildings', name: 'Señor del Bosque',         desc: 'Aserradero nivel 10',                                  icon: '🌲', reward: { wood: 20000,   stone: 0,       grain: 0      } },
  { id: 'barracks_5',      cat: 'buildings', name: 'Capitán de Guardia',       desc: 'Cuartel nivel 5',                                      icon: '🏰', reward: { wood: 5000,    stone: 5000,    grain: 0      } },
  { id: 'barracks_10',     cat: 'buildings', name: 'Gran Mariscal',            desc: 'Cuartel nivel 10',                                     icon: '⚔️',  reward: { wood: 20000,   stone: 20000,   grain: 0      } },
  { id: 'workshop_5',      cat: 'buildings', name: 'Artesano Experto',         desc: 'Taller nivel 5',                                       icon: '🔨', reward: { wood: 10000,   stone: 5000,    grain: 0      } },
  { id: 'full_economy',    cat: 'buildings', name: 'Arquitecto del Reino',     desc: 'Todos los edificios económicos al nivel 5',             icon: '👑', reward: { wood: 25000,   stone: 25000,   grain: 10000  } },

  // Research
  { id: 'first_research',  cat: 'research',  name: 'Iniciado en el Saber',    desc: 'Completa tu primera investigación',                    icon: '📜', reward: { wood: 1000,    stone: 1000,    grain: 500    } },
  { id: 'dragonlore_1',    cat: 'research',  name: 'Llamado del Dragón',      desc: 'Desbloquea Lore del Dragón',                           icon: '🐉', reward: { wood: 10000,   stone: 5000,    grain: 5000   } },
  { id: 'all_combat_1',    cat: 'research',  name: 'Estratega',               desc: 'Espadería, Armería y Fortif. al menos nivel 1',        icon: '🛡️',  reward: { wood: 5000,    stone: 3000,    grain: 0      } },
  { id: 'research_8',      cat: 'research',  name: 'Gran Sabio',              desc: 'Investiga 8 disciplinas distintas',                    icon: '🎓', reward: { wood: 20000,   stone: 10000,   grain: 5000   } },

  // Units
  { id: 'first_unit',      cat: 'military',  name: 'Primera Guardia',         desc: 'Entrena tu primera unidad',                            icon: '⚔️',  reward: { wood: 1000,    stone: 500,     grain: 0      } },
  { id: 'army_100',        cat: 'military',  name: 'Centurión',               desc: 'Ten 100 tropas de combate activas',                    icon: '🪖', reward: { wood: 10000,   stone: 5000,    grain: 0      } },
  { id: 'army_1000',       cat: 'military',  name: 'Señor de la Guerra',      desc: 'Ten 1.000 tropas de combate activas',                  icon: '🗡️',  reward: { wood: 50000,   stone: 25000,   grain: 0      } },
  { id: 'dragon_knight',   cat: 'military',  name: 'Orden del Dragón',        desc: 'Entrena tu primer Caballero Dragón',                   icon: '🐲', reward: { wood: 100000,  stone: 100000,  grain: 50000  } },

  // Combat
  { id: 'first_win',       cat: 'combat',    name: 'Bautismo de Fuego',       desc: 'Gana tu primera batalla',                              icon: '🏆', reward: { wood: 2000,    stone: 2000,    grain: 1000   } },
  { id: 'wins_10',         cat: 'combat',    name: 'Veterano de Guerra',      desc: 'Gana 10 batallas',                                     icon: '🎖️',  reward: { wood: 15000,   stone: 10000,   grain: 5000   } },
  { id: 'wins_50',         cat: 'combat',    name: 'Conquistador',            desc: 'Gana 50 batallas',                                     icon: '💀', reward: { wood: 50000,   stone: 50000,   grain: 20000  } },
  { id: 'big_loot',        cat: 'combat',    name: 'Gran Saqueo',             desc: 'Saquea más de 50.000 recursos en una sola batalla',    icon: '💰', reward: { wood: 20000,   stone: 20000,   grain: 10000  } },
  { id: 'boss_slayer',     cat: 'combat',    name: 'Matador de Dioses',       desc: 'Derrota al Jefe de Temporada',                         icon: '☠️',  reward: { wood: 500000,  stone: 500000,  grain: 200000 } },

  // Exploration
  { id: 'first_spy',       cat: 'explore',   name: 'Sombra en la Noche',      desc: 'Completa tu primera misión de espionaje',              icon: '🕵️',  reward: { wood: 1000,    stone: 1000,    grain: 0      } },
  { id: 'first_colony',    cat: 'explore',   name: 'Colonizador',             desc: 'Establece una colonia',                                icon: '🌍', reward: { wood: 10000,   stone: 5000,    grain: 5000   } },
  { id: 'colonies_3',      cat: 'explore',   name: 'Señor de los Mares',      desc: 'Controla 3 reinos (colonia incluido)',                  icon: '⛵', reward: { wood: 20000,   stone: 10000,   grain: 10000  } },

  // Season
  { id: 'season_champion', cat: 'season',    name: 'Campeón de la Temporada', desc: 'Gana una temporada',                                   icon: '🏅', reward: { wood: 1000000, stone: 1000000, grain: 500000 } },
]

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))

export function checkConditions(data) {
  const { k, res, winCount, spyCount, colonyCount, bigLoot, bossKilled } = data

  const COMBAT_UNITS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
  const armySize = COMBAT_UNITS.reduce((s, u) => s + (k[u] ?? 0), 0)

  const resValues = res ? Object.entries(res).filter(([key]) =>
    !['id','userId','createdAt','updatedAt'].includes(key)
  ).map(([, v]) => v) : []
  const researchCount = resValues.filter(v => v > 0).length

  const ecoBuildings = ['sawmill','quarry','grainFarm','windmill']
  const fullEco = ecoBuildings.every(b => (k[b] ?? 0) >= 5)

  const unlocked = []

  const check = (id, cond) => { if (cond) unlocked.push(id) }

  check('first_building',
    ['sawmill','quarry','grainFarm','windmill','workshop','engineersGuild','barracks',
     'granary','stonehouse','silo','academy','cathedral','alchemistTower','ambassadorHall','armoury']
    .some(b => (k[b] ?? 0) >= 1))

  check('sawmill_5',    (k.sawmill   ?? 0) >= 5)
  check('sawmill_10',   (k.sawmill   ?? 0) >= 10)
  check('barracks_5',   (k.barracks  ?? 0) >= 5)
  check('barracks_10',  (k.barracks  ?? 0) >= 10)
  check('workshop_5',   (k.workshop  ?? 0) >= 5)
  check('full_economy', fullEco)

  check('first_research', researchCount >= 1)
  check('dragonlore_1',   (res?.dragonlore ?? 0) >= 1)
  check('all_combat_1',
    (res?.swordsmanship ?? 0) >= 1 &&
    (res?.armoury       ?? 0) >= 1 &&
    (res?.fortification ?? 0) >= 1)
  check('research_8',     researchCount >= 8)

  check('first_unit',     (k.squire ?? 0) + (k.knight ?? 0) + (k.paladin ?? 0) >= 1
                       || (k.dragonKnight ?? 0) >= 1)
  check('army_100',       armySize >= 100)
  check('army_1000',      armySize >= 1000)
  check('dragon_knight',  (k.dragonKnight ?? 0) >= 1)

  check('first_win',      winCount >= 1)
  check('wins_10',        winCount >= 10)
  check('wins_50',        winCount >= 50)
  check('big_loot',       bigLoot)
  check('boss_slayer',    bossKilled)

  check('first_spy',      spyCount >= 1)
  check('first_colony',   colonyCount >= 1)
  check('colonies_3',     colonyCount >= 2) // 3 total kingdoms = 2 extra + main

  check('season_champion', bossKilled)

  return unlocked
}
