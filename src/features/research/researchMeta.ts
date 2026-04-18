export const RESEARCH_META: Record<string, { name: string; description: string; category: string }> = {
  alchemy:          { category: 'Ciencia',       name: 'Alquimia',          description: 'Dominio de las energías primordiales. Desbloquea toda la rama mística.' },
  pyromancy:        { category: 'Ciencia',       name: 'Piromagia',         description: 'Control del fuego para armas y defensas. Requiere Alquimia 2.' },
  runemastery:      { category: 'Ciencia',       name: 'Maestría Rúnica',   description: 'Inscripciones de poder en armaduras y muros. Requiere Piromagia 5.' },
  mysticism:        { category: 'Ciencia',       name: 'Misticismo',        description: 'Conocimiento del espacio entre mundos. Requiere Alquimia 5.' },
  dragonlore:       { category: 'Ciencia',       name: 'Lore de Dragones',  description: 'Los secretos más oscuros de las criaturas antiguas.' },
  swordsmanship:    { category: 'Combate',       name: 'Espadachín',        description: 'Técnicas de combate que aumentan el ataque de todas las unidades.' },
  armoury:          { category: 'Combate',       name: 'Armería',           description: 'Escudos y blindajes que reducen el daño recibido en batalla.' },
  fortification:    { category: 'Combate',       name: 'Fortificación',     description: 'Integridad estructural mejorada para todas las defensas.' },
  horsemanship:     { category: 'Logística',     name: 'Equitación',        description: 'Caballos más rápidos y resistentes para tus ejércitos.' },
  cartography:      { category: 'Logística',     name: 'Cartografía',       description: 'Mapas más precisos que aumentan la velocidad de desplazamiento.' },
  tradeRoutes:      { category: 'Logística',     name: 'Rutas Comerciales', description: 'Redes de comercio que permiten el hiperdesplazamiento de flotas.' },
  spycraft:         { category: 'Inteligencia',  name: 'Espionaje',         description: 'Arte de infiltrarse en reinos enemigos sin ser detectado.' },
  logistics:        { category: 'Inteligencia',  name: 'Logística',         description: 'Gestión de flotas que aumenta el número máximo de misiones.' },
  exploration:      { category: 'Inteligencia',  name: 'Exploración',       description: 'Permite colonizar nuevos territorios y fundar reinos adicionales.' },
  diplomaticNetwork:{ category: 'Inteligencia',  name: 'Red Diplomática',   description: 'Conecta Academias de todo el reino para acelerar investigaciones.' },
  divineBlessing:   { category: 'Inteligencia',  name: 'Bendición Divina',  description: 'Favor de los dioses. La investigación definitiva.' },
}

export const CATEGORIES = ['Ciencia', 'Combate', 'Logística', 'Inteligencia'] as const
