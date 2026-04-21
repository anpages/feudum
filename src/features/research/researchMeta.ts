export const RESEARCH_META: Record<string, { name: string; description: string; category: string }> = {
  alchemy:          { category: 'Ciencia',       name: 'Alquimia',          description: 'Dominio de las energías primordiales. Desbloquea toda la rama mística.' },
  pyromancy:        { category: 'Ciencia',       name: 'Piromagia',         description: 'Control del fuego para armas y defensas. Requiere Alquimia 2.' },
  runemastery:      { category: 'Ciencia',       name: 'Maestría Rúnica',   description: 'Inscripciones de poder en armaduras y muros. Requiere Piromagia 5.' },
  mysticism:        { category: 'Ciencia',       name: 'Misticismo',        description: 'Conocimiento del espacio entre mundos. Requiere Alquimia 5.' },
  dragonlore:       { category: 'Ciencia',       name: 'Lore de Dragones',  description: 'Los secretos más oscuros de las criaturas antiguas.' },
  swordsmanship:    { category: 'Combate',       name: 'Espadachín',        description: '+10% de ataque a todas las unidades por nivel. Nv.1 → ×1.1, Nv.5 → ×1.5, Nv.10 → ×2.0.' },
  armoury:          { category: 'Combate',       name: 'Armería',           description: '+10% de escudo a todas las unidades por nivel. Nv.1 → ×1.1, Nv.5 → ×1.5, Nv.10 → ×2.0.' },
  fortification:    { category: 'Combate',       name: 'Fortificación',     description: '+10% de vida (casco) a todas las unidades y defensas por nivel.' },
  horsemanship:     { category: 'Logística',     name: 'Equitación',        description: '+10% velocidad/nivel a Escuderos, Exploradores y Caravanas (combustión).' },
  cartography:      { category: 'Logística',     name: 'Cartografía',       description: '+20% velocidad/nivel a Caballeros, Paladines, Colonistas y Maestros de Asedio (impulso).' },
  tradeRoutes:      { category: 'Logística',     name: 'Rutas Comerciales', description: '+30% velocidad/nivel a Señores, Grandes Caballeros, Máquinas de Guerra y Dragones (hiperespacio).' },
  spycraft:         { category: 'Inteligencia',  name: 'Espionaje',         description: 'Arte de infiltrarse en reinos enemigos sin ser detectado.' },
  logistics:        { category: 'Inteligencia',  name: 'Logística',         description: 'Coordinación de ejércitos que aumenta el número máximo de misiones simultáneas.' },
  exploration:      { category: 'Inteligencia',  name: 'Exploración',       description: 'Permite colonizar nuevos territorios y fundar reinos adicionales.' },
  diplomaticNetwork:{ category: 'Inteligencia',  name: 'Red Diplomática',   description: 'Conecta Academias de todo el reino para acelerar investigaciones.' },
  divineBlessing:   { category: 'Inteligencia',  name: 'Bendición Divina',  description: 'Favor de los dioses. La investigación definitiva.' },
}

export const CATEGORIES = ['Ciencia', 'Combate', 'Logística', 'Inteligencia'] as const
