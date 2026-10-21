# 03 · Evolución arquitectónica

## Alternativas consideradas

### A. Conservar el monolito modular

Se mantiene un único artefacto de Django y PostgreSQL; se optimizan consultas, recursos, conexiones y disponibilidad, y se escala horizontalmente la aplicación detrás de balanceo cuando las métricas lo pidan. Puede añadirse caché compartida sin extraer dominios.

**Ventajas para Eventia:** conserva transacciones sencillas entre evento, inscripción y confirmación; aprovecha módulos existentes; menor costo de despliegue, monitoreo y guardias; cambios fáciles de validar para un equipo pequeño.

**Límites:** todos los módulos comparten ciclo de despliegue y recursos de proceso. Si el correo sigue síncrono o los reportes hacen lecturas extensas, una carga lenta afecta las peticiones web. El monolito no resuelve por sí solo los límites locales de caché al usar varias instancias.

Adecuada mientras una aplicación bien dimensionada, consulta optimizada y trabajos separados dentro del mismo runtime operativo atiendan los objetivos acordados.

### B. Monolito modular con trabajadores y servicios auxiliares

El núcleo de usuarios, eventos y transacciones de inscripción se queda en Django/PostgreSQL. Se agregan un sistema compartido de caché/límites, balanceo y tipos de proceso separados para despachar trabajos, enviar notificaciones y ejecutar reportes. Los trabajadores pueden compartir repositorio, modelos y lógica de dominio con el monolito sin convertirse por eso en microservicios. Un CDN sirve el frontend estático.

**Ventajas para Eventia:** aísla SMTP y reportes de la respuesta web; escala cada pool de procesos según su carga; preserva el control transaccional del último cupo; permite empezar con pocos componentes y contratos internos.

**Costos y límites:** requiere outbox, broker si se decide usarlo, caché central, colas, métricas, alertas, reintentos y operación de procesos adicionales. La consistencia del correo pasa a ser eventual; habrá estados pendientes y duplicados posibles. Los reportes no deben monopolizar la base principal.

Es adecuada cuando los ritmos de notificación y análisis difieren del tráfico HTTP, pero los límites de dominio todavía se benefician de una sola base transaccional.

### C. Separación selectiva de servicios

Se extrae una capacidad de negocio con propietario y contrato estables —por ejemplo, notificaciones si requiere ciclo de despliegue, equipo y escala propios; después, reportes si mantiene una canalización de lectura independiente—. El servicio define su interfaz, propiedad de datos, política de reintentos, observabilidad y compatibilidad de versiones. Los eventos de dominio/outbox evitan escribir de forma directa en dos bases desde una misma transacción.

**Ventajas:** despliegues y recursos independientes; fallas de un proveedor o de analítica pueden aislarse; los equipos pueden tener responsabilidad clara.

**Costos y límites:** red y fallas parciales, autenticación entre servicios, trazas distribuidas, contratos versionados, duplicación de infraestructura, guardias y consistencia eventual. Extraer inscripciones es especialmente costoso porque cupo, evento y unicidad forman una regla transaccional hoy protegida por PostgreSQL; trasladarla sin diseñar autoridad, idempotencia y reconciliación podría admitir sobreinscripciones.

Adecuada solo si una capacidad tiene necesidades de despliegue/escala independientes demostradas y hay equipo para operar el nuevo límite. Separar por cada aplicación Django no basta como motivo.

## Recomendación: alternativa B como destino gradual

Se recomienda **B**, desplegada por etapas desde el monolito actual. La primera extracción operacional sería el envío de notificaciones a trabajadores, no la división del dominio en servicios remotos. Los reportes se iniciarían con consultas acotadas y materialización programada. Si datos posteriores muestran interferencia, se separaría su carga de lectura; si existe equipo y necesidad de ciclo independiente, podría evolucionar a C de manera selectiva.

La base de autoridad de la inscripción permanece PostgreSQL: `select_for_update`, unicidad `(user,event)` y escritura atómica. Una caché distribuida ayuda a compartir límites y respuestas públicas, pero no decide el cupo. Una réplica (si se incorpora) atiende solo lecturas que acepten retraso. Las operaciones de correo y reporte se comunican mediante trabajos durables; el outbox se escribe en la misma transacción que el evento de negocio y un despachador puede volver a publicarlo con seguridad.

Esta recomendación no afirma que B esté desplegada. En Fase 1 hay una aplicación monolítica, un solo motor configurado, caché local predeterminada y callback de correo síncrono; el [Diagrama A](04-DIAGRAMAS.md#diagrama-a--arquitectura-real-de-fase-1) representa ese estado. El [Diagrama B](04-DIAGRAMAS.md#diagrama-b--arquitectura-recomendada-a-cinco-años) muestra el destino propuesto.

## Límites y propiedad de datos

| Capacidad | Dueño recomendado | Comunicación futura |
|---|---|---|
| Usuarios y autorización | Módulo Django `users`; PostgreSQL principal | API actual; caché compartida para throttling, no un servicio de identidad por defecto. |
| Eventos | Módulo `events`; PostgreSQL principal | API HTTP paginada y eventos de dominio para publicación/edición si otra carga necesita reaccionar. |
| Inscripciones y cupos | Módulo/servicio de aplicación `registrations`; misma transacción con PostgreSQL de autoridad | Llamada HTTP síncrona al núcleo; resultado confirmado solo tras commit. Idempotencia persistida si hay reintentos de cliente. |
| Notificaciones | Módulo Django inicialmente; pool de worker independiente | Outbox → despachador/broker → worker. Estado e intentos trazables; entrega eventual. |
| Reportes | Módulo de consultas/tareas del mismo repositorio al inicio | Trabajo programado y resultado agregado. Separar datos/cómputo solo si se mide interferencia. |
| Archivos estáticos | Build React existente | Origen/CDN en despliegue futuro, sin sesión ni lógica de cupo. |

## Riesgos y compromisos de la opción

**Consistencia y disponibilidad.** Confirmar una inscripción requiere decidir una única plaza concurrente; se prioriza el commit consistente en PostgreSQL sobre responder éxito desde una caché o una réplica retrasada. Si la base no está disponible, la aplicación debe fallar la inscripción de forma explícita, no aceptar una reserva no confirmada. Correo y reportes pueden degradarse en segundo plano sin revertir la plaza.

**Simplicidad e independencia.** Los módulos internos conservan transacciones simples, pero comparten releases. Workers de notificación/reportes aíslan CPU y esperas de proveedor con menos costo de red que microservicios. C exige equipos, contratos, trazabilidad y guardia para cada servicio.

**Rendimiento y complejidad.** Caché reduce lecturas repetidas solo si la invalidación y antigüedad son aceptables. El broker desacopla productores de correo, pero añade cola atrasada, reentrega, mensajes fallidos y límites de proveedor que deben observarse. La prioridad es medir y operar lo añadido.

**Costo y capacidad.** Dos o más tipos de proceso, almacenamiento compartido y posible broker elevan costos de infraestructura, alertas y soporte. El crecimiento de usuarios no determina cuántos workers ni qué tamaño de base hacen falta; eso requiere perfil de tráfico y objetivos.

**Equipos y despliegues.** Una guía de propiedad por módulo, revisión de contratos y compatibilidad de migraciones puede reducir conflictos sin repartir toda la aplicación. Si un equipo necesita despliegue independiente persistente, primero aislar su proceso y contrato; convertirlo en servicio es un paso posterior.

## Evolución y reversión

Migrar de forma expandir → verificar → contraer: agregar campos/tablas compatibles; desplegar lectores capaces de ambas formas; rellenar estado; comparar conteos; cambiar la escritura/lectura detrás de una bandera; observar; retirar campos viejos en una entrega posterior. Para el outbox, mantener la transacción actual y activar primero un worker en modo controlado, con deduplicación y procedimiento para reintentar pendientes. Para separar cualquier servicio, versionar contratos, definir propietario de datos y dejar camino de retorno antes de cortar el flujo anterior. Evitar doble escritura directa a dos bases porque no comparte atomicidad.
