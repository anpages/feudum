# Feudum — Lista de tareas pendientes

> Actualizado: 2026-04-18. Trabajar en orden de prioridad dentro de cada bloque.

---

## 🔴 Bugs activos (rompen funcionalidad)

- [x] **Resultado colonize/scavenge no se muestra en ArmiesPage** — añadidos casos en MissionRow
- [x] **Import innecesario en `api/armies/recall.js`** — eliminado import de `kingdoms`
- [x] **Selector de misión desbalanceado** — cambiado a grid de 5 columnas con texto compacto
- [x] **Rankings devolvía puntos incorrectos** — `calcPoints` ahora recibe todos los campos del reino (innerJoin con `db.select()`)

---

## 🟠 Mecánicas incompletas (afectan gameplay)

- [x] **Sistema de puntos** — `calcPoints` incluye los 15 edificios + coste de grano
- [x] **Bonificaciones de investigación en combate** — swordsmanship/armoury/fortification en battle.js
- [x] **Investigación afectando producción** — dragonlore +1%/+0.66%/+0.33% por nivel
- [x] **Gestión de colonias** — selector en ResourceBar, `kingdoms/me?id=X`, `GET /api/kingdoms`
- [x] **Pillaje contra NPCs** — misión rápida sin motor de batalla completo, loot por capacidad de carga
- [x] **Velocidad de viaje por investigación** — horsemanship +10%/lv, cartography +20%/lv aplicados en `calcDuration`; fleet_speed_war/peaceful desde settings
- [x] **Reparación de defensas post-batalla** — ya se llama en ambos casos (victoria y derrota)

---

## 🟡 UX / Pulido

- [x] **Mensajes manuales entre jugadores** — ComposePanel + useSendMessage; botón Responder pre-rellena "Para"
- [x] **Revisión layout móvil** — MapPage, SlotRow, ArmiesPage responsivos
- [x] **Ajustes de servidor** — `api/lib/config.js` expone ECONOMY_SPEED y UNIVERSE.* via env vars
- [ ] **Confirmar icono Tent en producción** — verificar que el icono de colonize se ve bien

---

## 🔵 Features nuevas — Misiones

- [x] **Pillaje** — misión NPC-only, saqueo rápido sin batalla (fase 11)
- [x] **Despliegue** — mover tropas a colonia propia sin retorno; solo válido contra reino propio (fácil)
- [ ] **Expedición** — exploración con encuentros aleatorios (recursos, tropas, piratas, mercader); escala con `exploration`
- [ ] **Misiles** — ataque de un solo sentido contra defensas; rango basado en nivel de investigación; requiere nuevo tipo de unidad

---

## 🔵 Features nuevas — Alianzas

- [ ] **Tablas DB** — `alliances`, `alliance_members`
- [ ] **API** — crear/unirse/salir/disolver alianza; listar miembros; ranking de alianzas
- [ ] **Chat de alianza** — hilo de mensajes por alianza
- [ ] **ACS Defend** — misión de defensa coordinada: enviar ejército a defender reino aliado
- [ ] **UI** — página de alianza, tag visible en rankings y mapa

---

## 🔵 Features nuevas — Social

- [ ] **Notificaciones en tiempo real** — Server-Sent Events para mensajes nuevos / llegada de ejércitos
- [ ] **Sistema de amigos** — añadir/eliminar amigos, ver estado
- [ ] **Notas privadas** — notas por jugador (como en OGame)
- [ ] **Espionaje NPC mejorado** — datos variados por seed (tropas distintas, eventos de detección)

---

## 🔵 Features nuevas — Endgame

- [ ] **Sistema de luna** — probabilidad de spawn al ganar batallas grandes; jump gates entre lunas (complejidad alta)

---

## ✅ Completado (referencia rápida)

- Fases 1–11 del roadmap completas (ver CLAUDE.md para detalle)
- Auth (login/registro/logout con JWT propio)
- 15 edificios con colas, costes, requisitos y efectos
- Investigación completa (16 techs, árbol de requisitos, efectos de producción y combate)
- 13 unidades + 11 defensas con stats OGame (rapid-fire, escudos, loot, escombros corregidos)
- Mapa con NPCs deterministas, escombros por slot, panel de detalle con acciones
- Misiones: ataque, transporte, espionaje, colonización, recolección, pillaje, retirada
- Motor de batalla (rapid-fire, escudos, loot, escombros, reparación defensas)
- Sistema de mensajes (informes de batalla, espionaje, mensajes manuales)
- Rankings con puntos reales
- Gestión de colonias (selector de reino activo)
- Perfil de usuario (edición de username)
- Toasts de finalización de cola
- Página 404
- Ajustes de servidor via env vars
