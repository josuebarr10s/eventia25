# 05 · Plan de evolución gradual

No se asignan fechas ni umbrales numéricos porque no hay mediciones de producción o carga. Cada etapa inicia con objetivos de servicio acordados por el equipo y una muestra de tráfico representativa; los indicadores siguientes son señales a instrumentar, no resultados actuales.

| Etapa | Problema | Cambio propuesto | Beneficio esperado | Riesgo/costo | Evidencia para decidir |
|---|---|---|---|---|---|
| **1. Optimizar la arquitectura existente** | No hay observabilidad de producción ni perfil de carga; el catálogo agrega inscripciones, `icontains` puede ser caro y SMTP ocupa el proceso request. | Instrumentar endpoint/DB/correo; acordar SLO; construir carga representativa; revisar planes e índices; probar contención; establecer respaldos y restauración; corregir consultas/conexiones antes de añadir topología. | Baseline verificable, fallos visibles y menos trabajo innecesario; se conserva la lógica y límites actuales. | Instrumentación y pruebas consumen tiempo; datos sintéticos incorrectos pueden llevar a optimizaciones inútiles; respaldos agregan costo operativo. | p50/p95/p99 y errores por ruta; duración/espera del bloqueo; consultas más costosas/filas examinadas; CPU, I/O y conexiones; crecimiento de datos; éxito y duración de restore; tiempos y fallos de correo. |
| **2. Escalar componentes críticos** | Si la instancia web o el proveedor externo no satisface los SLO, lecturas y correo compiten con peticiones; caché local no se comparte. | Desplegar varias instancias web detrás de balanceador; mover throttling a caché central; evaluar pool de conexiones; servir estáticos desde CDN; introducir outbox y worker asíncrono para correo. Optimizar catálogo y habilitar caché pública con invalidación. | Más capacidad web, límites comunes, menor dependencia de SMTP durante la respuesta y menos solicitudes repetidas al catálogo. | Broker/worker/cache/balanceador implican costo, operación y nuevas fallas parciales; correo eventual y caché posiblemente antigua. | Saturación repetida bajo una carga acordada; latencias/error fuera de objetivo; backlog/reintentos de correo; conexiones cercanas al límite; alto volumen de lecturas repetidas y plan que demuestra beneficio de caché. |
| **3. Independencia selectiva** | Una carga o equipo puede necesitar despliegue, recursos y disponibilidad distintos incluso tras aislar workers. | Extraer solo capacidad con límite estable: notificaciones o pipeline de reportes. Contrato versionado, propietario de datos, eventos/outbox, identidad entre servicios, trazas, alertas y procedimiento de reversión. Considerar réplica/almacén analítico si los reportes perjudican el primario. | Cambios y escala independientes en una capacidad que ya mostró una necesidad distinta; aislamiento más claro de fallas. | Redes, consistencia eventual, duplicación de datos, coordinación, guardias y costo de plataforma; las fallas parciales son más difíciles de diagnosticar. | Saturación y objetivos independientes sostenidos; cambio frecuente que bloquea otros despliegues; responsable operativo identificado; datos de propiedad claros; contrato compatible y costo aprobado. |

## Dependencias y orden de ejecución

1. Acordar qué significa servicio aceptable para navegación, inscripción y correo; definir paneles, trazas y retención de métricas sin datos personales innecesarios.
2. Generar carga reproducible con mezcla de catálogo, autenticación, creación y eventos calientes; partir de los datos y restricciones PostgreSQL reales. No extrapolar el test de dos solicitudes a capacidad masiva.
3. Corregir consultas y bloqueos que muestren costo; preparar operación de base, pool y restauración.
4. Si una instancia queda limitada, hacer la aplicación web sin estado compartido local, centralizar throttling, desplegar balanceador y probar renovación de token/CSRF desde varias instancias.
5. Separar correo mediante outbox antes de confiar en entrega reintentable. Validar comportamiento de duplicado y recuperar mensajes pendientes; instrumentar tamaño/antigüedad de cola y cuotas del proveedor.
6. Añadir caché de catálogo y CDN como optimizaciones medibles, con invalidación y versiones de activos.
7. Construir reportes con consultas acotadas/materialización. Solo mover lectura a réplica/almacén separado si se ve interferencia y se acepta su retraso.
8. Revisar límites de equipos y despliegue; extraer servicio únicamente tras definir propiedad, compatibilidad, observabilidad y reversión.

## Controles comunes y reversión

- Cambios de esquema con despliegue expandir → migrar datos → cambiar lectura/escritura → contraer en una versión posterior; no exigir que todos los procesos cambien en el mismo instante.
- Mantener la restricción única y la decisión de cupo en PostgreSQL durante el cambio de infraestructura. No conmutar a caché como fuente autoritativa.
- Para outbox, incluir identificador estable de mensaje y estado/contador de intentos. Activar en modo limitado, confirmar que los pendientes se procesan y que los fallidos pueden reintentarse; pausar worker sin perder inscripción.
- Configurar límites/backpressure para no agotar DB ni cuota de correo. Si la cola crece, posponer avisos/reportes, no la transacción de inscripción.
- Versionar API y mensajes con periodo de compatibilidad. Registrar cambio, propietario y alerta; tener bandera de activación y ruta para volver al procesamiento anterior mientras el modo anterior siga siendo seguro.
- Definir RPO/RTO con responsables y probar restauración; el repositorio Fase 1 no documenta una política de backup productiva.

Los costos relativos dependen del proveedor y volumen, no se cotizan en esta fase. A añade telemetría y pruebas; B suma caché compartida, balanceo y workers/broker; C agrega despliegues, datos y observabilidad por servicio. El orden recomendado evita pagar C antes de conocer el problema.
