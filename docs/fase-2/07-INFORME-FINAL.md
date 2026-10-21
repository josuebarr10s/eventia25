# Eventia · Informe final de Fase 2

**Actividad:** Programación Web · «Cinco años después»  
**Fecha:** 21 de octubre de 2026  
**Propósito:** analizar la evolución de la arquitectura de Eventia para un escenario académico de crecimiento, sin desplegarla ni afirmar que fue probada a esa escala.

## 1. Base del análisis y límites de las fuentes

Se inspeccionó la implementación disponible y su documentación: [MVP](../01-MVP.md), [arquitectura](../02-ARQUITECTURA.md), [dependencias](../03-DEPENDENCIAS.md), [flujo](../04-FLUJO-PRINCIPAL.md), [pruebas](../05-PRUEBAS.md), [preparación de Fase 2](../06-PREPARACION-FASE-2.md), [contrato API](../07-API.md), modelos, servicios, vistas, configuración y cliente React.

La consigna sitúa `Actividad 21 P Web` y `Fase 1 - MVP Eventia` por encima del código como fuentes, pero los documentos originales no se encontraron entre los archivos del proyecto ni los adjuntos disponibles. El informe no inventa su contenido. Está fundamentado en el repositorio y la consigna de Fase 2 recibida; por ello puede comprobarse contra todos los puntos explícitos de esta consigna, pero no certificarse contra una rúbrica académica externa que no fue proporcionada.

El escenario de cinco años —750,000 usuarios registrados, miles de eventos mensuales, picos de solicitudes, varias ciudades, más correo y reportes, y varios equipos— es un supuesto del enunciado. No son métricas medidas. Usuarios registrados no significa usuarios activos ni concurrentes. No se atribuyen a Eventia valores de CPU, peticiones/segundo, latencia, memoria, conexiones o almacenamiento.

## 2. Resumen de Fase 1: MVP realmente construido

Eventia permite registro e inicio de sesión, descubrir eventos futuros publicados por nombre/categoría/ciudad, consultar disponibilidad, publicar y gestionar eventos propios, inscribirse y consultar inscripciones propias. La interfaz es React y TypeScript; la API usa Django REST Framework; los datos persisten en PostgreSQL. La compilación Vite genera activos estáticos. No hay pagos, cancelaciones, lista de espera, analítica avanzada ni despliegue productivo descrito.

El backend organiza `users`, `events`, `registrations` y `notifications`. El acceso usa JWT: access breve en memoria del cliente, refresh en cookie HttpOnly con rotación/revocación y CSRF en los endpoints mutables de autenticación. Los permisos para crear, editar y publicar se verifican en servidor y por propietario. Los listados son paginados, con 12 filas por página.

El cupo se protege en PostgreSQL, no en una caché: el servicio bloquea la fila del evento, verifica que siga publicado y futuro, comprueba duplicado y capacidad y crea inscripción más confirmación dentro de una transacción. La base además impone unicidad por usuario/evento y capacidad positiva. Una prueba PostgreSQL con dos conexiones para el último cupo produjo 201 y 409 y una sola inscripción persistida. Esto demuestra el comportamiento de integridad probado; no demuestra capacidad para miles de solicitudes por minuto.

La confirmación se crea como `pending` dentro de esa transacción. Después del commit, `on_commit` llama sincrónicamente al servicio de correo en el proceso web. Consola es el backend predeterminado; SMTP es opcional y no se validó con un proveedor externo. Existe estado de resultado, pero no worker ni reintento automático; una interrupción puede dejar la confirmación pendiente. La Fase 1 tampoco documenta cache compartida, balanceador, réplica, backup productivo, observabilidad externa ni pruebas de carga sostenida.

La [documentación de pruebas](../05-PRUEBAS.md) registra 34/34 pruebas backend, 18/18 escenarios de navegador en Chrome (escritorio/tableta/móvil), compilación correcta, `manage.py check`, ausencia de migraciones pendientes y Ruff sin errores. Estas comprobaciones son locales; no equivalen a una prueba de escala ni a un despliegue. No se probaron SMTP externo, Safari/Firefox ni recuperación de producción.

## 3. Qué cambia con el crecimiento y dónde medir

El aumento de cuentas por sí mismo no determina cuántos procesos o bases hacen falta. La actividad simultánea por ruta, el patrón temporal y los eventos calientes determinan la capacidad. Los riesgos concretos son:

- **Inscripciones:** el bloqueo de fila serializa solicitudes de un evento para impedir que dos personas ocupen la última plaza. La espera puede crecer en picos; falta medir duración y contención bajo carga representativa.
- **Correo:** el callback posterior al commit aún retiene el proceso web y puede esperar hasta el timeout SMTP configurado de 10 segundos. El proveedor real, sus cuotas y latencia no se probaron.
- **Catálogo:** las consultas agregan el conteo de inscripciones, permiten `icontains` y filtran por categoría/ciudad. Con datos crecientes podrían requerir índices o búsqueda distinta, pero no existe plan o latencia que demuestre un cuello de botella actual.
- **Caché y autenticación:** los throttles usan el backend local predeterminado. Si se ejecutan varias instancias, los contadores no son comunes. El refresh y su lista de revocación involucran PostgreSQL.
- **Base de datos:** hay una base configurada, `CONN_MAX_AGE=0`, sin pool externo ni réplica. El efecto de conexiones, agregaciones e I/O no se ha medido.
- **Reportes y distribución:** no existe módulo analítico ni CDN configurado. Añadir reportes amplios al primario puede competir con inscripciones; servir el build estático por CDN podría reducir transferencia, según el despliegue.
- **Equipos:** varios equipos son parte del escenario, pero su tamaño y autonomía no se conocen. Los límites modulares y contratos/versiones son el primer paso antes de multiplicar despliegues.

Los indicadores previos a dimensionar son latencias por endpoint, solicitudes/concurrencia, errores, espera del bloqueo por evento, uso de DB/conexiones, planes de consulta, crecimiento de datos, tasa/antigüedad de trabajos y aceptación/rechazo del correo, rendimiento de reportes, junto con objetivos de disponibilidad y recuperación acordados. La lista detallada y clasificación de riesgos están en [01 · Análisis](01-ANALISIS-CRECIMIENTO.md).

## 4. Componentes que escalar y prioridad

| Componente | Acción basada en el código | Prioridad/condición |
|---|---|---|
| Usuarios | Conservar JWT y permisos; usar caché compartida para throttling si hay varias instancias y revisar IP confiable y tokens. | Alta para despliegue multiproceso; reemplazar identidad no se justifica. |
| Eventos | Medir planes de agregación y búsqueda; añadir índices selectivos y caché pública con TTL/invalidez si ayuda. | Media; buscador externo solo tras perfil de uso. |
| Inscripciones | Conservar transacción, bloqueo y unicidad; medir evento caliente e incorporar idempotencia persistida para reintentos. | Alta para prueba previa a picos; no usar caché como autoridad. |
| Notificaciones | Outbox transaccional, despachador/worker, reintentos, backoff, deduplicación, cuota y métricas. | Alta al crecer el volumen o exigirse entrega robusta; el request actual queda acoplado. |
| PostgreSQL | Perfilar consultas y conexiones, pool según topología, ajustes, backup/restauración; réplica solo para lectura tolerante a retraso. | Alta para observabilidad y recuperación; réplicas/particiones condicionales. |
| Reportes | Iniciar con consultas acotadas y agregación programada; separar lecturas si interfieren con la operación. | Media; la función es nueva y el volumen desconocido. |
| Frontend | CDN para activos versionados y optimización por medición; conservar API paginada. | Media para distribución amplia, sujeta a tamaño/transferencia medidos. |

## 5. Arquitectura recomendada y alternativas

Se recomienda **B: monolito modular con servicios auxiliares**, como destino gradual. El núcleo de usuarios, eventos y cupos sigue en Django y PostgreSQL, donde las reglas de autorización y la transacción de inscripción ya están implementadas. La aplicación web podría escalar horizontalmente cuando las métricas indiquen saturación, con almacenamiento compartido para límites. Correo y reportes se ejecutarían en pools de trabajadores independientes, usando una outbox transaccional para no perder el trabajo confirmado. Los activos estáticos podrían servirse desde CDN. Caché y reportes nunca deciden el cupo.

**A — monolito modular:** menor operación y transacciones sencillas; suficiente mientras optimización y procesos actuales satisfagan los objetivos. Límite: todas las funciones web comparten ciclo de despliegue y recursos.

**B — monolito y trabajadores:** aislamiento de SMTP y carga analítica sin extraer los dominios de negocio; coincide con las diferencias concretas de Eventia. Agrega estado de cola, reintentos y operación de procesos.

**C — separación selectiva:** permite independencia real de despliegue/escala cuando una responsabilidad, equipo y propiedad de datos lo demuestren. Agrega comunicación de red, consistencia eventual, contratos y guardias. Notificaciones o reportes serían candidatos antes que inscripciones; separar cupos prematuramente amenaza la atomicidad.

Por tanto, se inicia con A y observabilidad; se evoluciona a B cuando correo, reportes o tráfico requieran procesos aislados; C queda como decisión condicionada. El diagrama actual y el propuesto, con leyenda **CONSERVAR / MODIFICAR / SEPARAR / ESCALAR**, están en [04 · Diagramas](04-DIAGRAMAS.md). Allí se explican también el outbox, el broker opcional y los componentes que aún no existen.

## 6. Plan de evolución

**Etapa 1 — optimizar lo existente.** Instrumentar rutas y base, acordar SLO, probar carga representativa, verificar planes, contención, conexiones y recuperación. Beneficio: conocer límites antes de gastar; riesgo: requiere esfuerzo y perfiles realistas.

**Etapa 2 — escalar componentes críticos.** Si se confirma saturación, distribuir instancias web, compartir límites, evaluar pool, cachear solo lecturas públicas y servir estáticos por CDN. Implementar outbox y workers para correo; reportes programados y acotados. Beneficio: desacoplar tareas lentas; costo: más infraestructura, estados pendientes y operación de colas.

**Etapa 3 — independencia selectiva.** Si el aislamiento no basta y hay equipo/propiedad clara, extraer notificaciones o reportes con contratos versionados, trazas, datos definidos y camino de retorno. Beneficio: despliegue/escala independiente; costo: red, consistencia eventual, guardias y duplicación operativa.

No se fijan fechas o umbrales numéricos. Cada decisión se activa mediante las métricas observadas y los objetivos que Eventia acuerde. Los pasos, riesgos y mecanismo expandir/verificar/contraer se detallan en [05 · Plan](05-PLAN-EVOLUCION.md).

## 7. Hoy frente a cinco años y pregunta principal

Hoy existe una aplicación local probada, no una plataforma de producción con capacidad medida. En cinco años el enunciado exige cuentas, eventos, picos, reportes y equipos mayores, pero deja desconocidos usuarios activos, concurrencia, objetivos, presupuesto y proveedor. Cambia la escala y la operación; no cambia automáticamente la necesidad de un modelo relacional, permisos centralizados ni de mantener una única autoridad transaccional para cupos. La comparación amplia está en [06 · Comparación y conclusiones](06-COMPARACION-Y-CONCLUSIONES.md).

**¿Fue un error no construir desde el principio la arquitectura futura? No, con la evidencia disponible.** El MVP priorizó validar el flujo y demostrar integridad de inscripción sin operar broker, caché, réplica ni servicios distribuidos antes de conocer demanda o equipos. Esa decisión reduce costo, tiempo y complejidad prematura. La arquitectura modular y las reglas relacionales facilitan la evolución. Sí sería un error no medir ni adaptar el sistema cuando la carga, calidad de servicio o forma de trabajo cambien. El correo síncrono y el límite local son señales concretas para abordar antes de un despliegue horizontal/volumen alto; no evidencian una falla de producción ya sufrida.

## 8. Trade-offs de la recomendación

- **Consistencia/disponibilidad:** para la última plaza, gana la transacción fuerte de PostgreSQL. Si la base no está disponible, se informa que la inscripción no se confirmó. El correo y reportes pueden quedar pendientes sin revertirla.
- **Simplicidad/independencia:** módulos internos minimizan red y coordinación; workers separan recursos de correo/reportes; servicios C solo pagan su complejidad cuando la independencia aporta valor observado.
- **Rendimiento/complejidad:** caché y broker pueden reducir trabajo repetido o síncrono, a cambio de invalidación, reintentos, duplicados y backpressure. Se miden antes de adoptarse.
- **Costo/capacidad:** balanceo, caché, monitoreo y workers agregan costo y responsabilidades; no se dimensionan hasta conocer perfiles y objetivos.
- **Equipos/velocidad:** límites modulares, propiedad y contratos pueden reducir conflictos; microservicios prematuros requieren coordinación distribuida mayor.
- **Continuidad:** esquema compatible, outbox, versionado, banderas y reversión hacen el cambio gradual. No se debe hacer doble escritura directa a bases distintas.

## 9. Verificación de la consigna entregada

Los archivos de Fase 2 cubren los requisitos explícitos recibidos: análisis de crecimiento y datos desconocidos, identificación de riesgos con evidencia y clasificación potencial/confirmado, siete componentes evaluados, tabla obligatoria de prioridad, alternativas A/B/C y selección justificada, dos diagramas Mermaid, hoja de ruta en tres etapas con señales de decisión, comparación hoy/futuro y respuesta a la pregunta principal, trade-offs, resumen de Fase 1 y límites de pruebas. Los enlaces Markdown relativos entre documentos fueron revisados. No se encontró un renderizador Mermaid local para validación automatizada o exportación, por lo que no se adjuntan SVG/PNG.

**Conclusión sobre cumplimiento:** la consigna de Fase 2 suministrada está cubierta documentalmente. La totalidad de la Actividad 21 oficial no se puede certificar sin el documento oficial y la propuesta original de Fase 1; se deja esa limitación explícita y no se inventa su rúbrica. La arquitectura B es una propuesta fundamentada, no una implementación o despliegue realizado.
