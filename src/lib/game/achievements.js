/**
 * Achievement catalog + pure condition logic.
 * Each achievement has an `order` field within its `cat` chapter so the UI
 * can render them as a progression guide rather than a random list.
 *
 * checkConditions(data) → string[]  (IDs that should be unlocked)
 * Server-side: api/lib/achievements.js feeds DB data into checkConditions.
 */

export const ACHIEVEMENTS = [

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 1 — Primeros Pasos
  // Guía: construye los 4 edificios de producción básicos y el Taller
  // ═══════════════════════════════════════════════════════════════
  { id: 'sawmill_1',       cat: 'inicio',          order:  1, name: 'Primer Golpe de Hacha',       icon: '🪓', reward: { wood: 500,     stone: 0,       grain: 0      }, desc: 'Construye el Aserradero nivel 1. La madera es el recurso más básico del reino.' },
  { id: 'quarry_1',        cat: 'inicio',          order:  2, name: 'Primera Cantera',             icon: '⛏️',  reward: { wood: 0,       stone: 500,     grain: 0      }, desc: 'Construye la Cantera nivel 1. La piedra da solidez a todo lo que construyes.' },
  { id: 'grain_farm_1',    cat: 'inicio',          order:  3, name: 'Primera Cosecha',             icon: '🌾', reward: { wood: 0,       stone: 0,       grain: 500    }, desc: 'Construye la Granja de Grano nivel 1. Sin grano no podrás mantener un ejército.' },
  { id: 'windmill_1',      cat: 'inicio',          order:  4, name: 'El Molino del Viento',        icon: '🌬️',  reward: { wood: 300,     stone: 300,     grain: 0      }, desc: 'Construye el Molino nivel 1. Amplifica la producción agrícola y la población.' },
  { id: 'first_storage',   cat: 'inicio',          order:  5, name: 'Primer Almacén',              icon: '🏚️',  reward: { wood: 500,     stone: 500,     grain: 500    }, desc: 'Construye un almacén (Granero, Casa de Piedra o Silo). Tu producción supera tu capacidad.' },
  { id: 'workshop_1',      cat: 'inicio',          order:  6, name: 'El Taller',                   icon: '🔨', reward: { wood: 800,     stone: 400,     grain: 0      }, desc: 'Construye el Taller nivel 1. Reduce los tiempos de construcción de todos los edificios.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 2 — Producción
  // Guía: sube las minas progresivamente para tener recursos estables
  // ═══════════════════════════════════════════════════════════════
  { id: 'all_prod_2',      cat: 'economia',        order:  1, name: 'Economía en Marcha',          icon: '📦', reward: { wood: 1500,    stone: 1500,    grain: 500    }, desc: 'Aserradero, Cantera y Granja al nivel 2. La producción comienza a ser estable.' },
  { id: 'all_prod_3',      cat: 'economia',        order:  2, name: 'Economía Sólida',             icon: '📊', reward: { wood: 3000,    stone: 3000,    grain: 1500   }, desc: 'Aserradero, Cantera y Granja al nivel 3. Ya puedes financiar una expansión militar.' },
  { id: 'sawmill_5',       cat: 'economia',        order:  3, name: 'Maestro Leñador',             icon: '🪵', reward: { wood: 6000,    stone: 0,       grain: 0      }, desc: 'Aserradero nivel 5. Tu producción de madera domina el territorio.' },
  { id: 'quarry_5',        cat: 'economia',        order:  4, name: 'Maestro Cantero',             icon: '🪨', reward: { wood: 0,       stone: 6000,    grain: 0      }, desc: 'Cantera nivel 5. Extraes piedra a un ritmo envidiable.' },
  { id: 'grain_farm_5',    cat: 'economia',        order:  5, name: 'Granjero Experto',            icon: '🌻', reward: { wood: 0,       stone: 0,       grain: 6000   }, desc: 'Granja de Grano nivel 5. La abundancia de grano permite alimentar un ejército enorme.' },
  { id: 'all_prod_5',      cat: 'economia',        order:  6, name: 'Arquitecto del Reino',        icon: '🏰', reward: { wood: 15000,   stone: 15000,   grain: 8000   }, desc: 'Aserradero, Cantera y Granja al nivel 5. Una economía floreciente.' },
  { id: 'sawmill_10',      cat: 'economia',        order:  7, name: 'Señor del Bosque',            icon: '🌲', reward: { wood: 25000,   stone: 0,       grain: 0      }, desc: 'Aserradero nivel 10. Los bosques del reino entero trabajan para ti.' },
  { id: 'quarry_10',       cat: 'economia',        order:  8, name: 'Señor de la Piedra',          icon: '🏔️', reward: { wood: 0,       stone: 25000,   grain: 0      }, desc: 'Cantera nivel 10. Las montañas te rinden pleitesía.' },
  { id: 'all_prod_10',     cat: 'economia',        order:  9, name: 'Imperio Económico',           icon: '👑', reward: { wood: 50000,   stone: 50000,   grain: 25000  }, desc: 'Aserradero, Cantera y Granja al nivel 10. Tu reino es una potencia económica.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 3 — Infraestructura
  // Guía: construye los edificios de soporte que aceleran todo lo demás
  // ═══════════════════════════════════════════════════════════════
  { id: 'workshop_3',      cat: 'infraestructura', order:  1, name: 'Taller Experto',              icon: '⚒️',  reward: { wood: 3000,    stone: 2000,    grain: 0      }, desc: 'Taller nivel 3. Tus constructores trabajan el doble de rápido.' },
  { id: 'workshop_5',      cat: 'infraestructura', order:  2, name: 'Artesano Maestro',            icon: '🛠️',  reward: { wood: 8000,    stone: 5000,    grain: 0      }, desc: 'Taller nivel 5. La construcción en tu reino es casi instantánea.' },
  { id: 'first_barracks',  cat: 'infraestructura', order:  3, name: 'El Cuartel',                  icon: '🪖', reward: { wood: 1000,    stone: 1000,    grain: 500    }, desc: 'Construye el Cuartel nivel 1. A partir de ahora puedes entrenar soldados.' },
  { id: 'barracks_5',      cat: 'infraestructura', order:  4, name: 'Capitán de Guardia',          icon: '⚔️',  reward: { wood: 10000,   stone: 10000,   grain: 0      }, desc: 'Cuartel nivel 5. Entrenas tropas más rápido y con mayor capacidad.' },
  { id: 'barracks_10',     cat: 'infraestructura', order:  5, name: 'Gran Mariscal',               icon: '🏯', reward: { wood: 30000,   stone: 30000,   grain: 10000  }, desc: 'Cuartel nivel 10. El mayor cuartel posible. Tu ejército es formidable.' },
  { id: 'first_academy',   cat: 'infraestructura', order:  6, name: 'La Academia',                 icon: '📚', reward: { wood: 1000,    stone: 1000,    grain: 0      }, desc: 'Construye la Academia nivel 1. Desbloquea el árbol de investigaciones.' },
  { id: 'cathedral_1',     cat: 'infraestructura', order:  7, name: 'La Catedral',                 icon: '⛪', reward: { wood: 2000,    stone: 2000,    grain: 1000   }, desc: 'Construye la Catedral nivel 1. Aumenta la producción general del reino.' },
  { id: 'engineers_1',     cat: 'infraestructura', order:  8, name: 'El Gremio de Ingenieros',     icon: '⚙️',  reward: { wood: 3000,    stone: 2000,    grain: 0      }, desc: 'Construye el Gremio de Ingenieros. Combinado con el Taller, la construcción es instantánea.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 4 — Investigación
  // Guía: recorre el árbol de investigaciones para mejorar combate y logística
  // ═══════════════════════════════════════════════════════════════
  { id: 'first_research',  cat: 'investigacion',   order:  1, name: 'Iniciado en el Saber',        icon: '📜', reward: { wood: 1000,    stone: 1000,    grain: 500    }, desc: 'Completa tu primera investigación. Cada una mejora tu reino para siempre.' },
  { id: 'swordsmanship_1', cat: 'investigacion',   order:  2, name: 'Filo de la Espada',           icon: '⚔️',  reward: { wood: 2000,    stone: 1000,    grain: 0      }, desc: 'Investiga Espadería nivel 1. Tus tropas atacan con mayor eficacia en combate.' },
  { id: 'armoury_res_1',   cat: 'investigacion',   order:  3, name: 'Armadura de Hierro',          icon: '🛡️',  reward: { wood: 2000,    stone: 1000,    grain: 0      }, desc: 'Investiga Armería nivel 1. Tus tropas absorben más daño antes de caer.' },
  { id: 'fortification_1', cat: 'investigacion',   order:  4, name: 'Muros Inexpugnables',         icon: '🏰', reward: { wood: 2000,    stone: 2000,    grain: 0      }, desc: 'Investiga Fortaleza nivel 1. Tus defensas resisten mucho más en combate.' },
  { id: 'all_combat_res',  cat: 'investigacion',   order:  5, name: 'Estratega',                   icon: '🗺️',  reward: { wood: 8000,    stone: 5000,    grain: 2000   }, desc: 'Espadería, Armería y Fortaleza al menos a nivel 1. El triángulo del combate perfecto.' },
  { id: 'cartography_1',   cat: 'investigacion',   order:  6, name: 'Cartógrafo',                  icon: '🧭', reward: { wood: 3000,    stone: 1000,    grain: 0      }, desc: 'Investiga Cartografía nivel 1. Aumenta el alcance de tus misiones militares.' },
  { id: 'horsemanship_1',  cat: 'investigacion',   order:  7, name: 'Jinete Veloz',                icon: '🐎', reward: { wood: 3000,    stone: 1000,    grain: 1000   }, desc: 'Investiga Equitación nivel 1. Tus tropas se mueven más rápido por el territorio.' },
  { id: 'spycraft_1',      cat: 'investigacion',   order:  8, name: 'Arte del Espionaje',          icon: '🔍', reward: { wood: 2000,    stone: 2000,    grain: 0      }, desc: 'Investiga Espionaje nivel 1. Tus exploradores obtienen información más detallada.' },
  { id: 'dragonlore_1',    cat: 'investigacion',   order:  9, name: 'Llamado del Dragón',          icon: '🐉', reward: { wood: 15000,   stone: 10000,   grain: 5000   }, desc: 'Investiga Lore del Dragón nivel 1. Desbloquea el entrenamiento del Caballero Dragón.' },
  { id: 'research_10',     cat: 'investigacion',   order: 10, name: 'Gran Sabio',                  icon: '🎓', reward: { wood: 20000,   stone: 15000,   grain: 8000   }, desc: 'Investiga 10 disciplinas distintas. Has dominado gran parte del saber disponible.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 5 — Ejército
  // Guía: entrena tropas progresivamente hasta la élite
  // ═══════════════════════════════════════════════════════════════
  { id: 'first_unit',      cat: 'ejercito',        order:  1, name: 'Primera Guardia',             icon: '🗡️',  reward: { wood: 500,     stone: 500,     grain: 0      }, desc: 'Entrena tu primera unidad de combate. Un reino sin ejército es presa fácil.' },
  { id: 'army_10',         cat: 'ejercito',        order:  2, name: 'Puñado de Valientes',         icon: '👥', reward: { wood: 800,     stone: 400,     grain: 0      }, desc: 'Ten 10 tropas de combate. Un pequeño destacamento defiende tu puerta.' },
  { id: 'army_50',         cat: 'ejercito',        order:  3, name: 'Destacamento',                icon: '⚔️',  reward: { wood: 2000,    stone: 1000,    grain: 0      }, desc: 'Ten 50 tropas de combate. Ya puedes lanzar ataques modestos.' },
  { id: 'army_100',        cat: 'ejercito',        order:  4, name: 'Centurión',                   icon: '🪖', reward: { wood: 6000,    stone: 4000,    grain: 0      }, desc: 'Ten 100 tropas de combate. Una fuerza respetable.' },
  { id: 'first_knight',    cat: 'ejercito',        order:  5, name: 'El Primer Caballero',         icon: '🏇', reward: { wood: 3000,    stone: 2000,    grain: 0      }, desc: 'Entrena tu primer Caballero. Una tropa superior al Escudero en todo.' },
  { id: 'first_defense',   cat: 'ejercito',        order:  6, name: 'Las Murallas del Reino',      icon: '🏰', reward: { wood: 1500,    stone: 2000,    grain: 0      }, desc: 'Construye tu primera defensa. Las murallas salvan reinos.' },
  { id: 'defense_50',      cat: 'ejercito',        order:  7, name: 'Fortaleza',                   icon: '🛡️',  reward: { wood: 5000,    stone: 8000,    grain: 0      }, desc: 'Ten 50 defensas activas. Tu reino es difícil de asaltar.' },
  { id: 'army_500',        cat: 'ejercito',        order:  8, name: 'Comandante',                  icon: '🎖️',  reward: { wood: 20000,   stone: 15000,   grain: 5000   }, desc: 'Ten 500 tropas de combate. Tu nombre infunde respeto.' },
  { id: 'army_1000',       cat: 'ejercito',        order:  9, name: 'Señor de la Guerra',          icon: '👑', reward: { wood: 40000,   stone: 30000,   grain: 10000  }, desc: 'Ten 1.000 tropas de combate activas. Nadie se atreve a desafiarte.' },
  { id: 'dragon_knight',   cat: 'ejercito',        order: 10, name: 'Orden del Dragón',            icon: '🐲', reward: { wood: 80000,   stone: 60000,   grain: 25000  }, desc: 'Entrena tu primer Caballero Dragón. La élite absoluta de tu ejército.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 6 — Combate
  // Guía: desde el primer espionaje hasta las grandes batallas
  // ═══════════════════════════════════════════════════════════════
  { id: 'first_spy',       cat: 'combate',         order:  1, name: 'Sombra en la Noche',          icon: '🕵️',  reward: { wood: 500,     stone: 500,     grain: 0      }, desc: 'Completa tu primera misión de espionaje. Conoce a tu enemigo antes de atacar.' },
  { id: 'spy_5',           cat: 'combate',         order:  2, name: 'Red de Espías',               icon: '👁️',  reward: { wood: 2000,    stone: 1000,    grain: 0      }, desc: 'Completa 5 misiones de espionaje. La información es la mejor arma.' },
  { id: 'first_attack',    cat: 'combate',         order:  3, name: 'El Primer Asalto',            icon: '🔥', reward: { wood: 1000,    stone: 1000,    grain: 500    }, desc: 'Envía tu primera misión de ataque. Ha llegado el momento de probar tu ejército.' },
  { id: 'first_win',       cat: 'combate',         order:  4, name: 'Primera Victoria',            icon: '🏆', reward: { wood: 3000,    stone: 2000,    grain: 1000   }, desc: 'Gana tu primera batalla. La guerra empieza a tener sentido.' },
  { id: 'wins_5',          cat: 'combate',         order:  5, name: 'Guerrero',                    icon: '⚔️',  reward: { wood: 7000,    stone: 5000,    grain: 2000   }, desc: 'Gana 5 batallas. Te estás convirtiendo en un temible adversario.' },
  { id: 'first_missile',   cat: 'combate',         order:  6, name: 'Alquimista de la Guerra',     icon: '💣', reward: { wood: 5000,    stone: 5000,    grain: 0      }, desc: 'Lanza tu primera Bomba Alquímica. Las defensas enemigas no son eternas.' },
  { id: 'wins_10',         cat: 'combate',         order:  7, name: 'Veterano de Guerra',          icon: '🎖️',  reward: { wood: 12000,   stone: 8000,    grain: 4000   }, desc: 'Gana 10 batallas. Tu nombre resuena en los campos de batalla.' },
  { id: 'loot_10k',        cat: 'combate',         order:  8, name: 'Saqueador',                   icon: '💰', reward: { wood: 8000,    stone: 8000,    grain: 4000   }, desc: 'Saquea más de 10.000 recursos en una sola batalla. El botín es grande.' },
  { id: 'wins_25',         cat: 'combate',         order:  9, name: 'Condottiero',                 icon: '🗡️',  reward: { wood: 25000,   stone: 20000,   grain: 8000   }, desc: 'Gana 25 batallas. Eres un veterano con cicatrices de honor.' },
  { id: 'big_loot',        cat: 'combate',         order: 10, name: 'Gran Saqueo',                 icon: '💎', reward: { wood: 20000,   stone: 20000,   grain: 10000  }, desc: 'Saquea más de 50.000 recursos en una sola batalla. Una hazaña legendaria.' },
  { id: 'wins_50',         cat: 'combate',         order: 11, name: 'Conquistador',                icon: '💀', reward: { wood: 50000,   stone: 50000,   grain: 20000  }, desc: 'Gana 50 batallas. Eres una leyenda viva de la guerra.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 7 — Expansión
  // Guía: transporte, expediciones, recolección y colonización
  // ═══════════════════════════════════════════════════════════════
  { id: 'first_transport', cat: 'expansion',       order:  1, name: 'Primera Ruta de Suministro',  icon: '🚛', reward: { wood: 1000,    stone: 1000,    grain: 1000   }, desc: 'Envía tu primera misión de transporte. Conecta tus reinos con rutas de suministro.' },
  { id: 'first_scavenge',  cat: 'expansion',       order:  2, name: 'Carroñero del Campo',         icon: '🔩', reward: { wood: 1500,    stone: 1500,    grain: 0      }, desc: 'Recolecta escombros de batalla. Los restos de la guerra tienen valor.' },
  { id: 'first_expedition',cat: 'expansion',       order:  3, name: 'Explorador',                  icon: '🧭', reward: { wood: 2000,    stone: 2000,    grain: 1000   }, desc: 'Envía tu primera expedición al slot 16. Las Tierras Ignotas guardan secretos.' },
  { id: 'expeditions_5',   cat: 'expansion',       order:  4, name: 'Aventurero',                  icon: '🗺️',  reward: { wood: 8000,    stone: 5000,    grain: 3000   }, desc: 'Completa 5 expediciones. Las Tierras Ignotas empiezan a revelar sus secretos.' },
  { id: 'first_colony',    cat: 'expansion',       order:  5, name: 'Colonizador',                 icon: '🌍', reward: { wood: 12000,   stone: 8000,    grain: 5000   }, desc: 'Establece tu primera colonia. Los límites de tu reino se han expandido.' },
  { id: 'colonies_2',      cat: 'expansion',       order:  6, name: 'Señor de Tierras',            icon: '⛵', reward: { wood: 20000,   stone: 12000,   grain: 10000  }, desc: 'Controla 2 colonias (3 reinos en total). Tu dominio se extiende por el mapa.' },
  { id: 'first_deploy',    cat: 'expansion',       order:  7, name: 'Refuerzos',                   icon: '🚩', reward: { wood: 3000,    stone: 2000,    grain: 1000   }, desc: 'Despliega tropas a una colonia. El despliegue es una orden sin retorno.' },

  // ═══════════════════════════════════════════════════════════════
  // Capítulo 8 — Temporada
  // Guía: el camino final hacia la victoria de temporada
  // ═══════════════════════════════════════════════════════════════
  { id: 'boss_spy',        cat: 'temporada',       order:  1, name: 'Reconocimiento del Jefe',     icon: '🔭', reward: { wood: 20000,   stone: 15000,   grain: 8000   }, desc: 'Espía al Jefe de Temporada. Necesitas conocer su ejército antes de atacar.' },
  { id: 'boss_attacked',   cat: 'temporada',       order:  2, name: 'El Gran Desafío',             icon: '⚡', reward: { wood: 40000,   stone: 30000,   grain: 15000  }, desc: 'Ataca al Jefe de Temporada. La batalla definitiva ha comenzado.' },
  { id: 'season_champion', cat: 'temporada',       order:  3, name: 'Campeón de la Temporada',     icon: '🏅', reward: { wood: 500000,  stone: 400000,  grain: 200000 }, desc: 'Derrota al Jefe Caballero Dragón. El universo entero canta tu nombre.' },
]

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))

// ── Pure condition checker ────────────────────────────────────────────────────
// data = { k, res, winCount, loot10k, bigLoot, spyCount, colonyCount,
//          bossKilled, bossSpy, bossAttacked,
//          attackCount, transportCount, expeditionCount, scavengeCount,
//          missileCount, deployCount }
export function checkConditions(data) {
  const {
    k, res,
    winCount, loot10k, bigLoot,
    spyCount, colonyCount,
    bossKilled, bossSpy, bossAttacked,
    attackCount, transportCount, expeditionCount, scavengeCount,
    missileCount, deployCount,
  } = data

  const COMBAT_UNITS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
  const DEFENSE_UNITS = ['archer','crossbowman','ballista','trebuchet','mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon']

  const armySize    = COMBAT_UNITS.reduce((s, u) => s + (k[u] ?? 0), 0)
  const defenseSize = DEFENSE_UNITS.reduce((s, u) => s + (k[u] ?? 0), 0)

  const resValues = res ? Object.entries(res).filter(([key]) =>
    !['id','userId','createdAt','updatedAt'].includes(key)
  ).map(([, v]) => v) : []
  const researchCount = resValues.filter(v => v > 0).length

  const unlocked = []
  const check = (id, cond) => { if (cond) unlocked.push(id) }

  // ── Cap 1: Inicio ──────────────────────────────────────────────────────────
  check('sawmill_1',       (k.sawmill      ?? 0) >= 1)
  check('quarry_1',        (k.quarry       ?? 0) >= 1)
  check('grain_farm_1',    (k.grainFarm    ?? 0) >= 1)
  check('windmill_1',      (k.windmill     ?? 0) >= 1)
  check('first_storage',   (k.granary ?? 0) >= 1 || (k.stonehouse ?? 0) >= 1 || (k.silo ?? 0) >= 1)
  check('workshop_1',      (k.workshop     ?? 0) >= 1)

  // ── Cap 2: Producción ──────────────────────────────────────────────────────
  const minProd = (lv) => (k.sawmill ?? 0) >= lv && (k.quarry ?? 0) >= lv && (k.grainFarm ?? 0) >= lv
  check('all_prod_2',      minProd(2))
  check('all_prod_3',      minProd(3))
  check('sawmill_5',       (k.sawmill      ?? 0) >= 5)
  check('quarry_5',        (k.quarry       ?? 0) >= 5)
  check('grain_farm_5',    (k.grainFarm    ?? 0) >= 5)
  check('all_prod_5',      minProd(5))
  check('sawmill_10',      (k.sawmill      ?? 0) >= 10)
  check('quarry_10',       (k.quarry       ?? 0) >= 10)
  check('all_prod_10',     minProd(10))

  // ── Cap 3: Infraestructura ─────────────────────────────────────────────────
  check('workshop_3',      (k.workshop      ?? 0) >= 3)
  check('workshop_5',      (k.workshop      ?? 0) >= 5)
  check('first_barracks',  (k.barracks      ?? 0) >= 1)
  check('barracks_5',      (k.barracks      ?? 0) >= 5)
  check('barracks_10',     (k.barracks      ?? 0) >= 10)
  check('first_academy',   (k.academy       ?? 0) >= 1)
  check('cathedral_1',     (k.cathedral     ?? 0) >= 1)
  check('engineers_1',     (k.engineersGuild ?? 0) >= 1)

  // ── Cap 4: Investigación ───────────────────────────────────────────────────
  check('first_research',  researchCount >= 1)
  check('swordsmanship_1', (res?.swordsmanship ?? 0) >= 1)
  check('armoury_res_1',   (res?.armoury       ?? 0) >= 1)
  check('fortification_1', (res?.fortification ?? 0) >= 1)
  check('all_combat_res',
    (res?.swordsmanship ?? 0) >= 1 &&
    (res?.armoury       ?? 0) >= 1 &&
    (res?.fortification ?? 0) >= 1)
  check('cartography_1',   (res?.cartography   ?? 0) >= 1)
  check('horsemanship_1',  (res?.horsemanship  ?? 0) >= 1)
  check('spycraft_1',      (res?.spycraft      ?? 0) >= 1)
  check('dragonlore_1',    (res?.dragonlore    ?? 0) >= 1)
  check('research_10',     researchCount >= 10)

  // ── Cap 5: Ejército ────────────────────────────────────────────────────────
  check('first_unit',      armySize >= 1)
  check('army_10',         armySize >= 10)
  check('army_50',         armySize >= 50)
  check('army_100',        armySize >= 100)
  check('first_knight',    (k.knight ?? 0) >= 1)
  check('first_defense',   defenseSize >= 1)
  check('defense_50',      defenseSize >= 50)
  check('army_500',        armySize >= 500)
  check('army_1000',       armySize >= 1000)
  check('dragon_knight',   (k.dragonKnight ?? 0) >= 1)

  // ── Cap 6: Combate ─────────────────────────────────────────────────────────
  check('first_spy',       spyCount      >= 1)
  check('spy_5',           spyCount      >= 5)
  check('first_attack',    attackCount   >= 1)
  check('first_win',       winCount      >= 1)
  check('wins_5',          winCount      >= 5)
  check('first_missile',   missileCount  >= 1)
  check('wins_10',         winCount      >= 10)
  check('loot_10k',        loot10k)
  check('wins_25',         winCount      >= 25)
  check('big_loot',        bigLoot)
  check('wins_50',         winCount      >= 50)

  // ── Cap 7: Expansión ───────────────────────────────────────────────────────
  check('first_transport', transportCount  >= 1)
  check('first_scavenge',  scavengeCount   >= 1)
  check('first_expedition',expeditionCount >= 1)
  check('expeditions_5',   expeditionCount >= 5)
  check('first_colony',    colonyCount     >= 1)
  check('colonies_2',      colonyCount     >= 2)
  check('first_deploy',    deployCount     >= 1)

  // ── Cap 8: Temporada ───────────────────────────────────────────────────────
  check('boss_spy',        bossSpy)
  check('boss_attacked',   bossAttacked)
  check('season_champion', bossKilled)

  return unlocked
}
