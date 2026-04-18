# Feudum — Lista de tareas pendientes

> Actualizado: 2026-04-18. Ordenado por prioridad según roadmap (fases 12–22).

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

## Fase 13 — Expediciones

4. [ ] **Backend** — misión de expedición: destino slot especial (pos. 16); 10 outcomes ponderados (recursos, unidades, vacío, agujero negro, retraso, aceleración, piratas, aliens, mercader, dark matter)
5. [ ] **NPCFleetGenerator** — generar flota NPC aleatoria para encuentros de piratas/aliens; resolver con battle engine
6. [ ] **Merchant mechanic** — propuesta de intercambio de recursos; jugador acepta/rechaza
7. [ ] **DB** — campo `dark_matter` en tabla `users`; tabla `dark_matter_transactions`
8. [ ] **Frontend** — botón "Expedición" en MapPage; resultado de expedición en MissionRow con detalle del outcome

---

## Fase 14 — Misiles

9. [ ] **DB + units.js** — nueva unidad `ballistic` (misil, one-way, no retorna); almacenada en armoury
10. [ ] **Backend** — `POST /api/armies/send` con `missionType: missile`; sin retorno; solo daña defensas; rango = nivel de cartografía × 5 − 1 regiones; trebuchet como interceptor
11. [ ] **Frontend** — tab o sección "Misiles" en BarracksPage; botón en MapPage; resultado en MissionRow

---

## Fase 15 — Alianzas

12. [ ] **DB** — tablas `alliances`, `alliance_members`, `alliance_ranks`, `alliance_applications`, `alliance_highscores`
13. [ ] **Backend** — CRUD alianza: crear, disolver, editar (tag, nombre, textos, logo, homepage)
14. [ ] **Backend** — solicitudes: aplicar a alianza, aceptar/rechazar, expulsar miembro
15. [ ] **Backend** — sistema de rangos con permisos granulares; transferir liderazgo
16. [ ] **Backend** — `GET /api/rankings/alliances` — suma de puntos de miembros
17. [ ] **Backend** — chat de alianza (hilo de mensajes por alianza)
18. [ ] **Backend** — alliance depot: pool de recursos compartidos con permisos por rango
19. [ ] **Frontend** — página de alianza completa (info, miembros, rangos, aplicaciones, chat, depot)
20. [ ] **Frontend** — tag de alianza visible en rankings y en panel de mapa

---

## Fase 16 — ACS (Sistema de Combate Coordinado)

21. [ ] **DB** — tablas `fleet_unions`, `fleet_union_invites`; columna `union_id` en `army_missions`
22. [ ] **Backend** — crear unión de flota (define destino, max flotas, max jugadores); invitar; unirse
23. [ ] **Backend** — ACS Defend mission: ejército va a reino aliado con hold time configurable; participa en batalla si es atacado; regresa al expirar
24. [ ] **Frontend** — UI para crear/unirse a unión desde ArmiesPage/MapPage; misión ACS visible en lista

---

## Fase 17 — Sistema de Lunas

25. [ ] **DB** — diferenciar `kingdoms` por tipo (reino | luna); campos de luna (probabilidad spawn, campos disponibles)
26. [ ] **Backend** — spawn de luna tras batallas grandes (probabilidad proporcional a flota destruida, configurable)
27. [ ] **Backend** — edificios exclusivos de luna: Jump Gate, Sensor Phalanx (añadir a buildings.js con flag `moonOnly`)
28. [ ] **Backend** — Jump Gate: teletransporte de ejército entre lunas propias; cooldown configurable; sin tiempo de viaje
29. [ ] **Backend** — Sensor Phalanx: escanear misiones en tránsito hacia/desde una coordenada; rango por nivel de edificio
30. [ ] **Backend** — Moon Destruction mission: Dragon Knights destruyen luna enemiga; fórmula de probabilidad; fallo catastrófico posible
31. [ ] **Backend** — Planet Move: mover reino a nueva coordenada (requiere Jump Gate, cooldown, transacción atómica)
32. [ ] **Frontend** — indicador de luna en MapPage; páginas de construcción y misiones específicas para lunas

---

## Fase 18 — Dark Matter y Aceleradores

33. [ ] **Backend** — sistema Dark Matter completo: obtención via expediciones, historial de transacciones
34. [ ] **Backend** — aceleradores (halvings): gastar Dark Matter para reducir a la mitad tiempo de construcción / investigación / entrenamiento; uno por slot de cola
35. [ ] **Frontend** — saldo de Dark Matter en ResourceBar; botón de acelerar en colas activas

---

## Fase 19 — Clases de Personaje

36. [ ] **DB** — columna `character_class` en `users` (none | collector | general | discoverer)
37. [ ] **Backend** — clase Collector: +25% producción de recursos, +100% velocidad transportes, +50% bonus Crawler
38. [ ] **Backend** — clase General: +100% velocidad unidades de combate, −50% consumo de grano, +2 slots de misión, +2 niveles de combate efectivos
39. [ ] **Backend** — clase Discoverer: −25% tiempo de investigación, +2 slots de expedición, −50% probabilidad de enemigos en expedición, +20% rango de Phalanx, 75% loot de jugadores inactivos
40. [ ] **Backend** — unidades exclusivas por clase (una por clase; disponibles solo si tienes esa clase)
41. [ ] **Backend** — cambio de clase: coste en Dark Matter; cooldown
42. [ ] **Frontend** — selector de clase en ProfilePage; bonificaciones activas visibles

---

## Fase 20 — Social

43. [ ] **DB** — tabla `buddy_requests` (user_id, buddy_id, status); tabla `chat_messages`
44. [ ] **Backend + Frontend** — sistema de amigos: enviar/aceptar/rechazar solicitud, ver estado online, bloquear jugador
45. [ ] **Backend + Frontend** — búsqueda de jugadores por nombre o coordenada
46. [ ] **Backend + Frontend** — notas privadas por coordenada (guardar/editar/borrar desde MapPage)
47. [ ] **Backend + Frontend** — plantillas de ejército: guardar composición para reutilizar en ArmiesPage
48. [ ] **Backend + Frontend** — modo vacaciones: activar protección anti-ataque temporal; bloquea misiones salientes; duración mínima
49. [ ] **Backend + Frontend** — chat global en tiempo real
50. [ ] **Backend** — notificaciones en tiempo real (Server-Sent Events) para mensajes nuevos y llegada de ejércitos

---

## Fase 21 — Rankings y Automatización

51. [ ] **DB** — tabla `highscores` con categoría (general, edificios, investigación, unidades, economía)
52. [ ] **Backend** — rankings multi-categoría: endpoints separados o parámetro `category`
53. [ ] **Backend** — ranking de alianzas: suma de puntos de todos los miembros
54. [ ] **Backend** — scheduler / cron jobs: recalcular rankings cada hora; limpiar debris expirados diariamente; limpieza de wreck fields antiguos
55. [ ] **Backend** — debris fields mejorados: expiración por tiempo, metadata JSON, auto-cleanup
56. [ ] **Frontend** — rankings con tabs por categoría + tab de alianzas

---

## Fase 22 — Opciones y Pulido Final

57. [ ] **Backend + Frontend** — página de opciones de usuario: privacidad, preferencias de notificaciones, tema visual
58. [ ] **Backend + Frontend** — sistema de logros / rewards: hitos con recompensas (recursos, Dark Matter)
59. [ ] **Backend** — bonus de velocidad de `horsemanship`/`cartography` correctamente aplicados en `calcDuration`
60. [ ] **Backend** — espionaje NPC mejorado: datos de tropas variados por seed, eventos de detección aleatorios
61. [ ] **Backend** — sistema de bans (admin): bans temporales/permanentes con razón e historial; `bans` tabla DB
62. [ ] **Admin** — herramientas avanzadas: ajuste de timers de misiones, editor de reglas de juego
63. [ ] **Backend** — localización / multi-idioma (base para internacionalización futura)

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
