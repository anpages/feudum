# Feudum — Lista de tareas pendientes

> Actualizado: 2026-04-18.
> **Prioridad actual:** llegar al estado jugable en solitario lo antes posible.
> Tras alcanzar ese hito se hará reset de DB y se empieza la progresión real.
> El servidor puede correr a x4/x8 para acelerar el crecimiento de NPCs y testear.

---

## 🔴 Bugs activos (rompen funcionalidad)

_(ninguno conocido actualmente)_

---

## 🎯 HITO: Juego jugable en solitario (Fases 12–13)

> Estas tareas son la prioridad absoluta. Cuando estén completas:
> reset de DB → empezar desde cero → comprobar progresión real.

### Correctivo inmediato

1. [x] **Slot de reino aleatorio** — al registrarse, asignar posición aleatoria entre todos los slots libres del universo en vez del primero secuencial; evita que todos los jugadores se aglomeren en realm 1 región 1

### Fase 12 — Misión de Despliegue

2. [x] **Backend** — `POST /api/armies/send` con `missionType: deploy`; destino solo propio reino distinto; unidades llegan y se suman, sin viaje de vuelta
3. [x] **Frontend** — botón "Desplegar" en MapPage al seleccionar reino propio; resultado en MissionRow

### Fase 13 — NPCs Activos

> NPCs son reinos reales en DB que empiezan vacíos y crecen orgánicamente igual que
> un jugador humano. El cron corre cada hora; con ECONOMY_SPEED x4/x8 crecen
> proporcionalmente más rápido. Los ataques ocurren mientras el jugador duerme.

4. [x] **DB — schema** — añadir `isNpc boolean` y `npcLevel int` (1=débil, 2=medio, 3=fuerte — define umbral de ataque y ejército objetivo) a tabla `kingdoms`; crear usuario sistema NPC (`id = -1`)
5. [x] **DB — seeder** — `POST /api/admin/seed-npcs` con botón en panel admin; pobla universo con reinos NPC vacíos distribuidos por Wang hash (~30% ocupación)
6. [x] **Backend — recursos NPC** — el tick de recursos aplica igual a reinos NPC via `api/lib/tick.js`; respeta `ECONOMY_SPEED`
7. [x] **Backend — espionaje NPC** — con datos reales en DB, el endpoint devuelve tropas y recursos reales (ruta `if (target)` existente); notificación de detección no se envía a usuario NPC
8. [x] **Backend — ataque/pillaje contra NPC** — loot deducido de recursos reales del NPC; unidades destruidas permanentemente; pillaje usa recursos reales del NPC en DB
9. [x] **Vercel Cron — `/api/cron/npc-tick`** — añadido en `vercel.json` (`schedule: "0 * * * *"`); protegido con `CRON_SECRET`; corre cada hora
10. [x] **Backend — IA de crecimiento (cron)** — por cada NPC: construye edificio siguiente (sawmill→quarry→grainFarm→windmill→barracks→workshop según npcLevel); entrena unidades hacia ejército objetivo
11. [x] **Backend — IA de ataque (cron)** — si ejército supera umbral según `npcLevel` y no hay misión activa: selecciona reino jugador más rico en la misma región (o ±1 región); deduces 60-80% de tropas; inserta `army_missions` con `arrivalTime` real
12. [x] **Backend — resolución lazy** — en `GET /api/armies` y `GET /api/messages`: `resolveIncomingNpcAttacks()` procesa misiones NPC llegadas con battle engine; guarda informe en mensajes del jugador
13. [x] **Backend — retorno NPC** — si NPC gana, misión pasa a `returning`; cron procesa retorno y suma loot al reino NPC; si pierde, misión eliminada
14. [x] **Backend — config** — `NPC_AGGRESSION` (0=off, 1=bajo/24h, 2=medio/12h, 3=alto/6h) en `api/lib/config.js`
15. [x] **Frontend — mapa** — reinos NPC en DB aparecen en `realKingdoms` query; Wang hash mantiene como fallback para slots sin fila DB; `isNpc`/`npcLevel` propagados al frontend
16. [x] **Frontend — misiones entrantes** — misiones NPC visibles en ArmiesPage igual que ataques reales; informe de batalla llega a mensajes del jugador con nombre del NPC agresor

---

## 🔄 Reset de DB y validación (hito entre fase 13 y 14)

> Una vez completadas las tareas 1–16, hacer reset completo de la DB,
> ajustar ECONOMY_SPEED a x4 o x8, y jugar desde cero para validar la progresión.
> A partir de aquí se implementan las fases siguientes en orden.

---

## Fase 14 — Expediciones

17. [x] **Backend** — misión de expedición: destino slot especial (pos. 16); 9 outcomes ponderados (recursos, unidades, vacío, agujero negro, retraso, aceleración, merodeadores, bestias oscuras, éter)
18. [x] **NPCFleetGenerator** — generar flota NPC aleatoria para encuentros de merodeadores/bestias; resolver con battle engine
19. [ ] **Merchant mechanic** — propuesta de intercambio de recursos; jugador acepta/rechaza (pendiente, requiere async multi-step)
20. [x] **DB** — campo `ether` en tabla `users`; tabla `ether_transactions`
21. [x] **Frontend** — entrada "Tierras Ignotas" en MapPage; tipo expedición en ArmiesPage; resultado en MissionRow

---

## Fase 15 — Misiles

22. [ ] **DB + units.js** — nueva unidad `ballistic` (misil, one-way, no retorna); almacenada en armoury
23. [ ] **Backend** — `POST /api/armies/send` con `missionType: missile`; sin retorno; solo daña defensas; rango = nivel de cartografía × 5 − 1 regiones; trebuchet como interceptor
24. [ ] **Frontend** — tab o sección "Misiles" en BarracksPage; botón en MapPage; resultado en MissionRow

---

## Fase 16 — Alianzas

25. [ ] **DB** — tablas `alliances`, `alliance_members`, `alliance_ranks`, `alliance_applications`, `alliance_highscores`
26. [ ] **Backend** — CRUD alianza: crear, disolver, editar (tag, nombre, textos, logo, homepage)
27. [ ] **Backend** — solicitudes: aplicar a alianza, aceptar/rechazar, expulsar miembro
28. [ ] **Backend** — sistema de rangos con permisos granulares; transferir liderazgo
29. [ ] **Backend** — `GET /api/rankings/alliances` — suma de puntos de miembros
30. [ ] **Backend** — chat de alianza (hilo de mensajes por alianza)
31. [ ] **Backend** — alliance depot: pool de recursos compartidos con permisos por rango
32. [ ] **Frontend** — página de alianza completa (info, miembros, rangos, aplicaciones, chat, depot)
33. [ ] **Frontend** — tag de alianza visible en rankings y en panel de mapa

---

## Fase 17 — ACS (Sistema de Combate Coordinado)

34. [ ] **DB** — tablas `fleet_unions`, `fleet_union_invites`; columna `union_id` en `army_missions`
35. [ ] **Backend** — crear unión de flota (define destino, max flotas, max jugadores); invitar; unirse
36. [ ] **Backend** — ACS Defend mission: ejército va a reino aliado con hold time configurable; participa en batalla si es atacado; regresa al expirar
37. [ ] **Frontend** — UI para crear/unirse a unión desde ArmiesPage/MapPage; misión ACS visible en lista

---

## Fase 18 — Sistema de Lunas

38. [ ] **DB** — diferenciar `kingdoms` por tipo (reino | luna); campos de luna (probabilidad spawn, campos disponibles)
39. [ ] **Backend** — spawn de luna tras batallas grandes (probabilidad proporcional a flota destruida, configurable)
40. [ ] **Backend** — edificios exclusivos de luna: Jump Gate, Sensor Phalanx (flag `moonOnly`)
41. [ ] **Backend** — Jump Gate: teletransporte de ejército entre lunas propias; cooldown configurable
42. [ ] **Backend** — Sensor Phalanx: escanear misiones en tránsito hacia/desde una coordenada; rango por nivel
43. [ ] **Backend** — Moon Destruction mission: Dragon Knights destruyen luna enemiga; probabilidad + fallo catastrófico
44. [ ] **Backend** — Planet Move: mover reino a nueva coordenada (requiere Jump Gate, cooldown, transacción atómica)
45. [ ] **Frontend** — indicador de luna en MapPage; construcción y misiones específicas para lunas

---

## Fase 19 — Dark Matter y Aceleradores

46. [ ] **Backend** — sistema Dark Matter completo: obtención via expediciones, historial de transacciones
47. [ ] **Backend** — aceleradores (halvings): gastar Dark Matter para reducir a la mitad tiempos de cola
48. [ ] **Frontend** — saldo de Dark Matter en ResourceBar; botón de acelerar en colas activas

---

## Fase 20 — Clases de Personaje

49. [ ] **DB** — columna `character_class` en `users` (none | collector | general | discoverer)
50. [ ] **Backend** — clase Collector: +25% producción, +100% velocidad transportes
51. [ ] **Backend** — clase General: +100% velocidad combate, −50% consumo grano, +2 slots misión
52. [ ] **Backend** — clase Discoverer: −25% tiempo investigación, +2 slots expedición, −50% enemigos expedición
53. [ ] **Backend** — unidades exclusivas por clase; cambio de clase con coste Dark Matter
54. [ ] **Frontend** — selector de clase en ProfilePage; bonificaciones activas visibles

---

## Fase 21 — Social

55. [ ] **DB** — tabla `buddy_requests`, tabla `chat_messages`
56. [ ] **Backend + Frontend** — sistema de amigos: añadir/aceptar/rechazar/bloquear
57. [ ] **Backend + Frontend** — búsqueda de jugadores por nombre o coordenada
58. [ ] **Backend + Frontend** — notas privadas por coordenada (desde MapPage)
59. [ ] **Backend + Frontend** — plantillas de ejército para reutilizar en ArmiesPage
60. [ ] **Backend + Frontend** — modo vacaciones: protección anti-ataque temporal
61. [ ] **Backend + Frontend** — chat global en tiempo real
62. [ ] **Backend** — notificaciones en tiempo real (SSE) para mensajes y llegada de ejércitos

---

## Fase 22 — Rankings y Automatización

63. [ ] **DB** — tabla `highscores` con categoría (general, edificios, investigación, unidades, economía)
64. [ ] **Backend** — rankings multi-categoría + ranking de alianzas
65. [ ] **Backend** — cron jobs: recalcular rankings cada hora; limpiar debris expirados diariamente
66. [ ] **Backend** — debris fields mejorados: expiración por tiempo, metadata JSON
67. [ ] **Frontend** — rankings con tabs por categoría + tab de alianzas

---

## Fase 23 — Opciones y Pulido Final

68. [ ] **Backend + Frontend** — página de opciones de usuario: privacidad, notificaciones, tema
69. [ ] **Backend + Frontend** — sistema de logros / rewards con recompensas
70. [ ] **Backend** — sistema de bans (admin): temporales/permanentes con razón e historial
71. [ ] **Admin** — herramientas avanzadas: ajuste de timers de misiones, editor de reglas
72. [ ] **Backend** — localización / multi-idioma

---

## ✅ Completado (referencia rápida)

- Fases 1–11 del roadmap completas (ver CLAUDE.md para detalle)
- Auth (login/registro/logout con JWT propio)
- **Slot aleatorio al registrarse** (tarea #1 completada)
- 15 edificios con colas, costes, requisitos y efectos
- Investigación completa (16 techs, árbol de requisitos, efectos de producción y combate)
- 13 unidades + 11 defensas con stats OGame (rapid-fire, escudos, loot, escombros)
- Mapa con NPCs deterministas, escombros por slot, panel de detalle con acciones
- Misiones: ataque, transporte, espionaje, colonización, recolección, pillaje, retirada
- Motor de batalla (rapid-fire, escudos, loot, escombros, reparación defensas)
- Sistema de mensajes (informes de batalla, espionaje, mensajes manuales)
- Rankings con puntos reales
- Gestión de colonias (selector de reino activo)
- Perfil de usuario (edición de username)
- Toasts de finalización de cola, página 404, ajustes de servidor via env vars
- Arquitectura feature-based con service layer (src/shared/, services/, types.ts por feature)
