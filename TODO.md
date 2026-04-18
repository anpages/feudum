# Feudum — Lista de tareas pendientes

> Actualizado: 2026-04-18. Trabajar en orden de prioridad dentro de cada bloque.

---

## 🔴 Bugs activos (rompen funcionalidad)

- [x] **Resultado colonize/scavenge no se muestra en ArmiesPage** — añadidos casos colonize y scavenge en MissionRow; tipo `result` ampliado en useArmies.ts
- [x] **Import innecesario en `api/armies/recall.js`** — eliminado import de `kingdoms`
- [x] **Selector de misión desbalanceado** — cambiado a grid de 5 columnas con texto compacto

---

## 🟠 Mecánicas incompletas (afectan gameplay)

- [ ] **Sistema de puntos** — `kingdoms.points` nunca se actualiza; hay que incrementarlo al mejorar edificios, investigar y entrenar unidades. Fórmula: suma de recursos gastados. Actualizar en `buildings/upgrade.js`, `research/upgrade.js` y `barracks/train.js`
- [ ] **Bonificaciones de investigación en combate** — `api/lib/battle.js` recibe `research` pero no aplica `weapons`/`shielding`/`armor`. Fórmula OGame: ataque × (1 + weapons×0.1), escudo × (1 + shielding×0.1), casco × (1 + armor×0.1). Consultar `/home/anpages/ogame-ref/app/BattleEngine/`
- [ ] **Investigación afectando producción** — ninguna investigación afecta producción actualmente. Ver si alguna debe hacerlo según el diseño del juego
- [ ] **Gestión de colonias** — si un jugador coloniza, `kingdoms/me` siempre devuelve el primer reino. Necesita: selector de reino activo en ResourceBar, o soporte multi-reino en la API

---

## 🟡 UX / Pulido

- [ ] **Mensajes manuales entre jugadores** — MessagesPage solo muestra mensajes automáticos (batalla, espía). Añadir formulario "Nuevo mensaje" con selector de destinatario (username) y campo de texto
- [ ] **Revisión layout móvil** — probar en viewport < 768px; sidebar como drawer, header compacto
- [ ] **Ajustes de servidor** — velocidad de economía y tamaño del universo están hardcoded. Crear tabla `server_settings` o variables de entorno configurables
- [ ] **Importar `Tent` desde lucide vs disponibilidad** — ya verificado que existe, pero confirmar visualmente en producción que el icono de colonize se ve bien en todos los contextos

---

## 🔵 Features nuevas (post-fase 10)

- [ ] **Rankings con puntos reales** — depende de que el sistema de puntos esté implementado
- [ ] **Notificaciones en tiempo real** — actualmente todo es polling. Considerar Server-Sent Events para mensajes nuevos
- [ ] **Espionaje contra NPCs mejorado** — ahora es básico (datos fijos por seed); podría ser más variado
- [ ] **Pillar (pillage) misión** — tipo de misión que solo saquea sin batalla completa (para NPCs débiles)
- [ ] **Alianzas** — tabla `alliances`, miembros, chat de alianza

---

## ✅ Completado (referencia rápida)

- Fases 1–9 del roadmap completas (ver CLAUDE.md para detalle)
- Auth (login/registro/logout con JWT propio)
- 15 edificios con colas, costes, requisitos y efectos
- Investigación completa con árbol de requisitos
- 13 unidades + 11 defensas con stats OGame
- Mapa con NPCs deterministas, escombros por slot, panel de detalle con acciones
- Misiones: ataque, transporte, espionaje, colonización, recolección, retirada
- Motor de batalla (rapid-fire, escudos, loot, escombros)
- Sistema de mensajes (informes de batalla, espionaje)
- Rankings
- Perfil de usuario (edición de username)
- Toasts de finalización de cola
- Página 404
