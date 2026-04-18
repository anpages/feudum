# Feudum — Lista de tareas pendientes

> Actualizado: 2026-04-18. Ordenado por prioridad según roadmap (fases 12–23).

---

## 🔴 Bugs activos (rompen funcionalidad)

_(ninguno conocido actualmente)_

---

## 🟡 UX / Pulido menor

1. [ ] **Confirmar icono Tent en producción** — verificar que el icono de colonize se ve bien en dispositivos reales

---

## Fase 12 — Misión de Despliegue

2. [ ] **Backend** — `POST /api/armies/send` con `missionType: deploy`; destino solo propio reino distinto; unidades llegan y se suman, sin viaje de vuelta
3. [ ] **Frontend** — botón "Desplegar" en MapPage al seleccionar reino propio; resultado en MissionRow

---

## Fase 13 — NPCs Activos ⚠️ desbloquea loop defensivo completo y juego en solitario

> Los NPCs son reinos reales en DB: acumulan recursos, tienen unidades persistentes,
> se pueden espiar, atacar, saquear y destruir exactamente igual que un jugador humano.

4. [ ] **DB — schema** — añadir `isNpc boolean` y `npcLevel int` a tabla `kingdoms`; crear usuario sistema NPC (`id = -1`) como propietario de todos los reinos NPC
5. [ ] **DB — migración / seeder** — generar filas reales de reinos NPC en la DB al inicializar el universo; edificios pre-configurados según `npcLevel` (1=débil, 2=medio, 3=fuerte); reemplazar generación por Wang hash del mapa
6. [ ] **Backend — recursos NPC** — verificar que el tick de recursos aplica igual a reinos NPC; el loot reduce sus recursos reales
7. [ ] **Backend — espionaje NPC** — con datos reales en DB, el endpoint de espionaje devuelve tropas y recursos reales sin ningún caso especial
8. [ ] **Backend — ataque/pillaje NPC** — loot deducido de recursos reales del NPC; unidades destruidas deducidas permanentemente de sus columnas en DB; escombros del coste real
9. [ ] **Backend — IA de reconstrucción (lazy)** — en `GET /api/kingdoms/me`, si el NPC tiene recursos suficientes y ha pasado `NPC_REBUILD_INTERVAL_HOURS`, entrenar unidades hasta alcanzar ejército objetivo según `npcLevel`
10. [ ] **Backend — IA de ataque (lazy)** — en `GET /api/kingdoms/me`, si ejército NPC supera umbral y ha pasado `NPC_ATTACK_INTERVAL_HOURS`, lanzar misión `attack` real contra reino de jugador más cercano; unidades deducidas del NPC al partir; NPC regresa con loot si gana
11. [ ] **Backend — informe de batalla NPC** — defensor recibe informe completo con composición real de la flota NPC; mismo formato que ataque de jugador
12. [ ] **Backend — config** — añadir `NPC_AGGRESSION` (0=off, 1=bajo, 2=medio, 3=alto), `NPC_ATTACK_INTERVAL_HOURS`, `NPC_REBUILD_INTERVAL_HOURS` a `api/lib/config.js` y al panel de admin
13. [ ] **Frontend — mapa** — leer reinos NPC desde DB en vez de Wang hash; layout de slots se mantiene igual
14. [ ] **Frontend — misiones entrantes** — misiones NPC visibles en ArmiesPage igual que ataques de jugador real (atacante: "NPC — Nivel X")

---

## Fase 14 — Expediciones

15. [ ] **Backend** — misión de expedición: destino slot especial (pos. 16); 10 outcomes ponderados (recursos, unidades, vacío, agujero negro, retraso, aceleración, piratas, aliens, mercader, dark matter)
16. [ ] **NPCFleetGenerator** — generar flota NPC aleatoria para encuentros de piratas/aliens; resolver con battle engine
17. [ ] **Merchant mechanic** — propuesta de intercambio de recursos; jugador acepta/rechaza
18. [ ] **DB** — campo `dark_matter` en tabla `users`; tabla `dark_matter_transactions`
19. [ ] **Frontend** — botón "Expedición" en MapPage; resultado de expedición en MissionRow con detalle del outcome

---

## Fase 15 — Misiles

20. [ ] **DB + units.js** — nueva unidad `ballistic` (misil, one-way, no retorna); almacenada en armoury
21. [ ] **Backend** — `POST /api/armies/send` con `missionType: missile`; sin retorno; solo daña defensas; rango = nivel de cartografía × 5 − 1 regiones; trebuchet como interceptor
22. [ ] **Frontend** — tab o sección "Misiles" en BarracksPage; botón en MapPage; resultado en MissionRow

---

## Fase 16 — Alianzas

23. [ ] **DB** — tablas `alliances`, `alliance_members`, `alliance_ranks`, `alliance_applications`, `alliance_highscores`
24. [ ] **Backend** — CRUD alianza: crear, disolver, editar (tag, nombre, textos, logo, homepage)
25. [ ] **Backend** — solicitudes: aplicar a alianza, aceptar/rechazar, expulsar miembro
26. [ ] **Backend** — sistema de rangos con permisos granulares; transferir liderazgo
27. [ ] **Backend** — `GET /api/rankings/alliances` — suma de puntos de miembros
28. [ ] **Backend** — chat de alianza (hilo de mensajes por alianza)
29. [ ] **Backend** — alliance depot: pool de recursos compartidos con permisos por rango
30. [ ] **Frontend** — página de alianza completa (info, miembros, rangos, aplicaciones, chat, depot)
31. [ ] **Frontend** — tag de alianza visible en rankings y en panel de mapa

---

## Fase 17 — ACS (Sistema de Combate Coordinado)

32. [ ] **DB** — tablas `fleet_unions`, `fleet_union_invites`; columna `union_id` en `army_missions`
33. [ ] **Backend** — crear unión de flota (define destino, max flotas, max jugadores); invitar; unirse
34. [ ] **Backend** — ACS Defend mission: ejército va a reino aliado con hold time configurable; participa en batalla si es atacado; regresa al expirar
35. [ ] **Frontend** — UI para crear/unirse a unión desde ArmiesPage/MapPage; misión ACS visible en lista

---

## Fase 18 — Sistema de Lunas

36. [ ] **DB** — diferenciar `kingdoms` por tipo (reino | luna); campos de luna (probabilidad spawn, campos disponibles)
37. [ ] **Backend** — spawn de luna tras batallas grandes (probabilidad proporcional a flota destruida, configurable)
38. [ ] **Backend** — edificios exclusivos de luna: Jump Gate, Sensor Phalanx (añadir a buildings.js con flag `moonOnly`)
39. [ ] **Backend** — Jump Gate: teletransporte de ejército entre lunas propias; cooldown configurable; sin tiempo de viaje
40. [ ] **Backend** — Sensor Phalanx: escanear misiones en tránsito hacia/desde una coordenada; rango por nivel de edificio
41. [ ] **Backend** — Moon Destruction mission: Dragon Knights destruyen luna enemiga; fórmula de probabilidad; fallo catastrófico posible
42. [ ] **Backend** — Planet Move: mover reino a nueva coordenada (requiere Jump Gate, cooldown, transacción atómica)
43. [ ] **Frontend** — indicador de luna en MapPage; páginas de construcción y misiones específicas para lunas

---

## Fase 19 — Dark Matter y Aceleradores

44. [ ] **Backend** — sistema Dark Matter completo: obtención via expediciones, historial de transacciones
45. [ ] **Backend** — aceleradores (halvings): gastar Dark Matter para reducir a la mitad tiempo de construcción / investigación / entrenamiento; uno por slot de cola
46. [ ] **Frontend** — saldo de Dark Matter en ResourceBar; botón de acelerar en colas activas

---

## Fase 20 — Clases de Personaje

47. [ ] **DB** — columna `character_class` en `users` (none | collector | general | discoverer)
48. [ ] **Backend** — clase Collector: +25% producción de recursos, +100% velocidad transportes, +50% bonus Crawler
49. [ ] **Backend** — clase General: +100% velocidad unidades de combate, −50% consumo de grano, +2 slots de misión, +2 niveles de combate efectivos
50. [ ] **Backend** — clase Discoverer: −25% tiempo de investigación, +2 slots de expedición, −50% probabilidad de enemigos en expedición, +20% rango de Phalanx, 75% loot de jugadores inactivos
51. [ ] **Backend** — unidades exclusivas por clase (una por clase; disponibles solo si tienes esa clase)
52. [ ] **Backend** — cambio de clase: coste en Dark Matter; cooldown
53. [ ] **Frontend** — selector de clase en ProfilePage; bonificaciones activas visibles

---

## Fase 21 — Social

54. [ ] **DB** — tabla `buddy_requests` (user_id, buddy_id, status); tabla `chat_messages`
55. [ ] **Backend + Frontend** — sistema de amigos: enviar/aceptar/rechazar solicitud, ver estado online, bloquear jugador
56. [ ] **Backend + Frontend** — búsqueda de jugadores por nombre o coordenada
57. [ ] **Backend + Frontend** — notas privadas por coordenada (guardar/editar/borrar desde MapPage)
58. [ ] **Backend + Frontend** — plantillas de ejército: guardar composición para reutilizar en ArmiesPage
59. [ ] **Backend + Frontend** — modo vacaciones: activar protección anti-ataque temporal; bloquea misiones salientes; duración mínima
60. [ ] **Backend + Frontend** — chat global en tiempo real
61. [ ] **Backend** — notificaciones en tiempo real (Server-Sent Events) para mensajes nuevos y llegada de ejércitos

---

## Fase 22 — Rankings y Automatización

62. [ ] **DB** — tabla `highscores` con categoría (general, edificios, investigación, unidades, economía)
63. [ ] **Backend** — rankings multi-categoría: endpoints separados o parámetro `category`
64. [ ] **Backend** — ranking de alianzas: suma de puntos de todos los miembros
65. [ ] **Backend** — scheduler / cron jobs: recalcular rankings cada hora; limpiar debris expirados diariamente; limpieza de wreck fields antiguos
66. [ ] **Backend** — debris fields mejorados: expiración por tiempo, metadata JSON, auto-cleanup
67. [ ] **Frontend** — rankings con tabs por categoría + tab de alianzas

---

## Fase 23 — Opciones y Pulido Final

68. [ ] **Backend + Frontend** — página de opciones de usuario: privacidad, preferencias de notificaciones, tema visual
69. [ ] **Backend + Frontend** — sistema de logros / rewards: hitos con recompensas (recursos, Dark Matter)
70. [ ] **Backend** — bonus de velocidad de `horsemanship`/`cartography` correctamente aplicados en `calcDuration`
71. [ ] **Backend** — espionaje NPC mejorado: datos de tropas variados por seed, eventos de detección aleatorios (ya cubierto por tarea #7 si NPCs tienen datos reales)
72. [ ] **Backend** — sistema de bans (admin): bans temporales/permanentes con razón e historial; `bans` tabla DB
73. [ ] **Admin** — herramientas avanzadas: ajuste de timers de misiones, editor de reglas de juego
74. [ ] **Backend** — localización / multi-idioma (base para internacionalización futura)

---

## ✅ Completado (referencia rápida)

- Fases 1–11 del roadmap completas (ver CLAUDE.md para detalle)
- Auth (login/registro/logout con JWT propio)
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
- Toasts de finalización de cola
- Página 404
- Ajustes de servidor via env vars
- Arquitectura feature-based con service layer (src/shared/, services/, types.ts por feature)
