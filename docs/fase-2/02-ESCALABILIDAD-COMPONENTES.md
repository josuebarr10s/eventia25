# 02 · Escalabilidad por componente

Este documento prioriza cambios según la forma en que Eventia trabaja hoy y el escenario planteado. **Prioridad alta** identifica un riesgo directo en los picos descritos o una mejora operativa previa a escalar; **media** depende de medir; **baja** no se justifica sin evidencia adicional. La prioridad no afirma que exista una falla de producción.

## Usuarios y autenticación

La aplicación usa JWT de acceso con vida de cinco minutos en memoria del cliente, refresh de un día en cookie HttpOnly con rotación, y revocación de refresh en la tabla de tokens de SimpleJWT. Las rutas mutables de autenticación requieren CSRF. El navegador renueva el access una vez ante 401. El límite de fallos de login es cinco por IP directa durante 15 minutos; DRF aplica límites anónimos y por usuario.

La tabla de usuario y su restricción de correo insensible a mayúsculas conservan integridad con crecimiento. Lo que cambia al ejecutar varios procesos es que el backend de caché local no comparte contadores. Antes de balancear varias instancias, usar una caché centralizada o un almacenamiento común para throttling y validar la IP cliente detrás del proxy. Los encabezados reenviados no deben aceptarse hasta configurar una cadena de proxies de confianza. Medir también lecturas/escrituras de `OutstandingToken`, rotaciones simultáneas y conexiones; los registros de tokens pueden crecer y requieren una política de limpieza compatible con expiración y revocación.

No se justifica migrar a un proveedor de identidad externo ni separar `users` por el número de cuentas. Hacerlo solo ante requisitos de federación, organización operativa independiente o límites medidos que no se resuelvan con la aplicación y la base actual.

## Eventos, búsqueda y lecturas

El catálogo consulta PostgreSQL y pagina 12 eventos, filtra por título con `icontains`, categoría y ciudad, y anota el total de inscripciones. Los índices actuales cubren `(status, starts_at)`, `(category, status)` y `starts_at`; no prueban que todas las combinaciones futuras sean eficientes.

Secuencia recomendada: capturar planes `EXPLAIN (ANALYZE, BUFFERS)` en una copia con datos representativos; medir filtros usados y costo del conteo; añadir índices compuestos solo donde el plan y la selectividad los justifiquen; revisar si el conteo exacto debe mostrarse en toda vista. Para búsqueda parcial, comparar el comportamiento real con índice trigram (extensión PostgreSQL) o búsqueda de texto completo antes de operar un servicio dedicado. No crear ambos por anticipado.

Una caché compartida de TTL corto puede almacenar páginas del catálogo público. Debe definirse la clave con filtros, página y versión; invalidar o versionar al publicar/editar un evento; y limitar la antigüedad aceptable. No cachear respuestas privadas por URL genérica. En una pantalla pública, el cupo disponible puede ser aproximado; la operación de inscripción siempre consulta la transacción actual de PostgreSQL y puede responder 409 aunque la caché mostrara un espacio.

## Inscripciones: cupo, concurrencia e idempotencia

La ruta `POST /api/registrations/` recibe `event_id`. El servicio bloquea la fila del evento, verifica estado/fecha, duplicado y capacidad, e inserta inscripción más confirmación en una transacción. La restricción única `(user,event)` es una segunda defensa persistente. El test PostgreSQL cubre dos conexiones que compiten por el último cupo. Esta combinación debe mantenerse cuando se escalen los procesos web.

El bloqueo hace que las altas de un mismo evento pasen por una decisión serializada. Para eventos no calientes el costo puede ser aceptable; en un evento popular, la espera por esa fila es un punto que debe medir una prueba de carga con contención real. Si el problema aparece, primero reducir trabajo dentro de la transacción y eliminar consultas redundantes; no enviar correo ni generar reportes dentro del bloqueo. Como siguientes opciones, limitar admisión con respuesta de reintento controlada o poner solicitudes de un evento caliente en una cola particionada por `event_id`. Una cola cambia el contrato a aceptación pendiente y no reemplaza la comprobación transaccional de cupo: cada trabajador aún debe reservar de forma atómica, y la interfaz debe explicar espera y resultado.

El diseño actual no implementa `Idempotency-Key`: un reintento de red después de un commit podría recibir 409 de duplicado, aunque no genere una segunda inscripción. Si el cliente o un intermediario reintenta automáticamente, conviene persistir una clave única por usuario y operación junto al resultado de la transacción; devolver el resultado previo en reintentos con el mismo cuerpo y rechazar el uso de la misma clave con un cuerpo distinto. La unicidad usuario/evento continúa protegiendo el dominio. La política de reintentos debe distinguir timeout de respuesta perdida frente a conflicto real y no repetir ciegamente operaciones no idempotentes.

La base principal sigue siendo la autoridad del cupo. Caché, réplica retrasada o una cuenta de disponibilidad eventual sirven para mostrar información, nunca para confirmar la última plaza.

## Notificaciones

Hoy se crea una confirmación `pending` dentro de la transacción y `on_commit` ejecuta el envío en el mismo proceso web. El correo por defecto se escribe en consola; SMTP es configurable, tiene timeout de 10 segundos y no fue validado contra un proveedor real. Se registra `sent` (aceptado por el backend), `console` o `failed`; no hay reintento automático. Si el proceso cae entre commit y callback, la inscripción persiste y puede quedar `pending`.

La evolución propuesta usa un **outbox transaccional**: escribir una fila de trabajo en la misma transacción que crea la inscripción; un despachador la publica de forma repetible; trabajadores independientes envían correo con límites de concurrencia y reintentos exponenciales con jitter; registrar intentos, siguiente ejecución, resultado y cola de fallidos. La entrega es al menos una vez: si el proveedor acepta un correo y el trabajador cae antes de persistir el éxito, puede haber duplicado. Usar identificador de mensaje, deduplicación y clave idempotente del proveedor cuando exista; no prometer “exactamente una vez” sobre SMTP. Celery puede coordinar trabajos, pero Celery no sustituye el outbox ni es requisito previo. Elegir un solo broker durable tras evaluar operación, disponibilidad, cuotas y experiencia del equipo.

## PostgreSQL y almacenamiento

1. Optimizar consultas e índices con planes y cardinalidad representativa; perfilar, por ejemplo, la lista de inscripciones que filtra por usuario y ordena por fecha antes de decidir si requiere índice compuesto.
2. Ajustar CPU, memoria, almacenamiento, `max_connections`, vaciado/estadísticas y mantenimiento en un servicio administrado o servidor operado conscientemente.
3. Medir la conexión por proceso; `CONN_MAX_AGE=0` abre/cierra conexiones por ciclo. Evaluar pool del driver/servidor o PgBouncer según conexiones y carga, evitando combinar pools sin conocer el límite efectivo.
4. Añadir réplicas de lectura solo para consultas tolerantes a retraso y cuando la carga de lectura interfiera con escritura. No enviar a réplica la decisión de cupos, autorizaciones sensibles o confirmación inmediatamente consistente.
5. Definir respaldos, restauraciones verificadas, recuperación ante desastre y retención antes de producción. La Fase 1 no configura respaldo automático ni objetivo RPO/RTO.
6. Evaluar particionado cuando tamaño, retención o mantenimiento de tablas lo justifiquen y exista una clave/consulta compatible. No se recomienda sharding para 750,000 cuentas por sí solo: la fragmentación complica transacciones, unicidad global, reportes y operaciones.

## Reportes y frontend

Los reportes de organizadores no están implementados. Empezar con consultas acotadas por organizador, índices, límites de fechas y una tarea programada que actualice vistas materializadas o agregados si la frescura requerida lo permite. Mover lecturas a réplica o a almacenamiento analítico separado solo si la carga medida perjudica a inscripciones o excede el tiempo aceptado. Los datos agregados deben reconciliarse con PostgreSQL; no crear otra fuente de verdad para cupos.

El build de React ya produce activos estáticos separados del backend. En producción, servirlos por CDN/origen estático con cacheo por hash, compresión y expiración larga de archivos versionados; mantener `index.html` con política de actualización corta para permitir versiones nuevas. Revisar división de código por rutas y tamaño de carga antes de optimizar a ciegas. La paginación existente limita resultados, aunque no hay carga incremental ni caché de servidor cliente persistente.

## Tabla de escalabilidad

| Componente | Problema potencial | Por qué escalar | Cómo escalar | Prioridad |
|---|---|---|---|---|
| Usuarios | Caché local de intentos/throttling no se comparte; refresh escribe/lee tokens en PostgreSQL. | Varias instancias pueden aplicar límites distintos y el crecimiento puede elevar consultas de rotación. | Antes de escalar: caché compartida para límites, política confiable de IP, monitorear tokens y depurar expirados con seguridad. Conservar JWT y permisos mientras cumplan el flujo. | **Alta** para consistencia del límite al habilitar varias instancias; cambio de identidad **bajo/no justificado**. |
| Eventos | `Count(registrations)`, filtros y búsqueda parcial pueden encarecer el listado. | Aumentan eventos y consultas públicas. | Planes con datos realistas; índices selectivos; caché compartida con invalidación/TTL para catálogo público; explorar trigram/texto completo si la búsqueda lo requiere. Motor externo solo tras evidencia. | **Media**; optimizar la consulta medida antes de añadir servicio. |
| Inscripciones | Solicitudes del mismo evento esperan el bloqueo de una fila; reintentos no tienen clave idempotente. | El escenario concentra muchas solicitudes en una apertura y exige no sobrepasar capacidad. | Mantener transacción, `select_for_update` y unicidad; medir espera; recortar trabajo bloqueado; incorporar idempotencia persistida; admitir cola por evento solamente si la espera medida lo justifica. | **Alta** para prueba de contención e idempotencia; no cambiar autoridad de cupo. |
| Notificaciones | Envío síncrono en callback del request; sin reintento y posible estado pendiente tras caída. | Más mensajes aumenta el tiempo de ocupación del servidor y la exposición al proveedor externo. | Outbox en transacción, despachador y worker separado, retry/backoff, deduplicación, límites, métricas y cola de fallidos. | **Alta** al acercarse al pico; es el aislamiento más directo. |
| Base de datos | Conexión por ciclo, conteos y escrituras comparten instancia; no hay réplica/backup documentados. | Usuarios/eventos/inscripciones crecen; muchos procesos también elevan conexiones. | Medir consultas/conexiones; pool y recursos; índices por evidencia; backup+restore; réplica de lectura tolerante a retraso si hace falta. Partición/sharding solo con razón de volumen/retención probada. | **Alta** para observabilidad y recuperación; réplicas/fragmentación **condicionales**. |
| Reportes | No existe capacidad analítica; agregados futuros pueden escanear tablas operativas. | Se requieren estadísticas para organizadores sin bloquear altas. | Límites y consultas optimizadas; tareas programadas/vistas materializadas; réplica o almacén analítico cuando la interferencia y frescura lo justifiquen. | **Media**; nueva función del escenario, aislamiento según costo observado. |
| Frontend | Sin CDN/configuración productiva ni caché de datos; consultas al API al montar. | Distribución geográfica y campañas pueden aumentar descargas y lecturas. | CDN para activos estáticos hasheados; compresión; división por rutas; conservar paginación y añadir carga/caché de datos solo con perfil de uso. | **Media** antes de una distribución amplia; medir peso y transferencia. |

La tabla ordena trabajo de análisis y diseño. No implica que todos esos servicios estén construidos o deban incorporarse en la primera entrega de evolución. La hoja de ruta establece las puertas de decisión en [05 · Plan](05-PLAN-EVOLUCION.md).
