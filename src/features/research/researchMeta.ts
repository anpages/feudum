type Desc = string | ((currentLevel: number) => string)
export const RESEARCH_META: Record<string, { name: string; description: Desc; category: string }> = {
  alchemy:          { category: 'Ciencia',       name: 'Alquimia',          description: 'Desbloquea toda la rama mística.' },
  pyromancy:        { category: 'Ciencia',       name: 'Piromagia',         description: 'Control del fuego para armas y defensas.' },
  runemastery:      { category: 'Ciencia',       name: 'Maestría Rúnica',   description: 'Inscripciones de poder en armaduras y muros.' },
  mysticism:        { category: 'Ciencia',       name: 'Misticismo',        description: 'Conocimiento del espacio entre mundos.' },
  dragonlore:       { category: 'Ciencia',       name: 'Lore de Dragones',  description: 'Los secretos más oscuros de las criaturas antiguas.' },
  swordsmanship:    { category: 'Combate',       name: 'Espadachín',
    description: lv => `+10% ataque/nivel · Nv.${lv + 1} → ×${((lv + 1) * 0.1 + 1).toFixed(1)} ataque` },
  armoury:          { category: 'Combate',       name: 'Armadura',
    description: lv => `+10% escudo/nivel · Nv.${lv + 1} → ×${((lv + 1) * 0.1 + 1).toFixed(1)} escudo` },
  fortification:    { category: 'Combate',       name: 'Fortificación',
    description: lv => `+10% vida/nivel · Nv.${lv + 1} → ×${((lv + 1) * 0.1 + 1).toFixed(1)} vida` },
  horsemanship:     { category: 'Logística',     name: 'Equitación',
    description: lv => `+10% vel. combustión/nivel · Nv.${lv + 1} → +${(lv + 1) * 10}% velocidad` },
  cartography:      { category: 'Logística',     name: 'Cartografía',
    description: lv => `+20% vel. impulso/nivel · Nv.${lv + 1} → +${(lv + 1) * 20}% velocidad` },
  tradeRoutes:      { category: 'Logística',     name: 'Rutas Comerciales',
    description: lv => `+30% vel. hiperespacio/nivel · Nv.${lv + 1} → +${(lv + 1) * 30}% velocidad` },
  spycraft:         { category: 'Inteligencia',  name: 'Espionaje',         description: 'Arte de infiltrarse en reinos enemigos sin ser detectado.' },
  logistics:        { category: 'Inteligencia',  name: 'Logística',
    description: lv => `+1 misión activa/nivel · Nv.${lv + 1} → ${lv + 2} misiones (misiles no cuentan)` },
  exploration:      { category: 'Inteligencia',  name: 'Exploración',       description: 'Permite colonizar nuevos territorios y fundar reinos adicionales.' },
  diplomaticNetwork:{ category: 'Inteligencia',  name: 'Red Diplomática',   description: 'Conecta Academias para acelerar investigaciones.' },
  divineBlessing:   { category: 'Inteligencia',  name: 'Bendición Divina',  description: 'Favor de los dioses. La investigación definitiva.' },
}

export const CATEGORIES = ['Ciencia', 'Combate', 'Logística', 'Inteligencia'] as const
