# 01 · Análisis del crecimiento

## Alcance y fuentes

Este análisis reconstruye la Fase 1 a partir del código y de sus documentos técnicos: [MVP](../01-MVP.md), [arquitectura](../02-ARQUITECTURA.md), [dependencias](../03-DEPENDENCIAS.md), [flujo](../04-FLUJO-PRINCIPAL.md), [pruebas](../05-PRUEBAS.md), [preparación para Fase 2](../06-PREPARACION-FASE-2.md) y [contrato API](../07-API.md). También se revisaron los modelos, servicios, vistas y configuración existentes.

La consigna menciona dos fuentes académicas de mayor prioridad —`Actividad 21 P Web` y `Fase 1 - MVP Eventia`—, pero esos documentos originales no están en los archivos disponibles del proyecto ni entre los adjuntos localizados. La [documentación de Fase 1](../01-MVP.md) registra esa misma limitación. Por tanto, este informe distingue el escenario descrito en la consigna de la arquitectura comprobable del repositorio; no atribuye requisitos desconocidos a los documentos ausentes.

## A. Qué creció

El escenario académico plantea cinco años de crecimiento: 750,000 cuentas registradas, miles de eventos publicados al mes, operación en varias ciudades, aperturas con picos de inscripción, más notificaciones, reportes y varios equipos. Son condiciones de diseño, no mediciones de un sistema desplegado.

| Dimensión | Fase 1 comprobable | Escenario a cinco años | Qué se sabe y qué falta medir |
|---|---|---|---|
| Usuarios | Registro/login y JWT; el repositorio no aporta una población real de producción. | 750,000 registrados. | Registrados no equivale a activos mensuales ni a concurrentes. Faltan actividad por periodo, concurrencia por ruta y frecuencia de autenticación. |
| Eventos | Modelo relacional con estado, categoría, fecha, ciudad y capacidad. Listado paginado de 12 filas. | Miles de publicaciones al mes y varias ciudades. | El enunciado no especifica total histórico, retención ni distribución por ciudad/categoría. |
| Inscripciones | Una fila por par usuario/evento, transacción y bloqueo del evento. | Picos de miles de solicitudes en pocos minutos para eventos populares. | No hay prueba de carga que mida solicitudes por segundo, esperas, duración o volumen total. |
| Lecturas y búsquedas | Listado de eventos con filtros por título, categoría y ciudad, orden y paginación. | Más consultas durante campañas y aperturas. | Faltan proporción lectura/escritura, términos más frecuentes, tamaños de respuesta y latencias. |
| Notificaciones | Una confirmación por inscripción; envío después del commit en el mismo proceso web. | Más correo y avisos, con fallas y límites externos posibles. | No se probó un proveedor SMTP real ni se conoce su capacidad, cuota o latencia. |
| Datos | PostgreSQL; FK, restricción única de inscripción, check de capacidad e índices seleccionados. | Crecimiento acumulativo de cuentas, eventos, inscripciones y tokens de renovación. | No se dispone de tamaño, crecimiento mensual, política de retención ni objetivo de recuperación. |
| Equipos | Estructura Django por aplicaciones y frontend React separado en el código. | Varios equipos y ritmos de entrega distintos. | No se conoce el número, estructura ni autonomía de los equipos. El escenario justifica evaluar límites de trabajo, no asumir microservicios. |

Una cuenta registrada apenas establece una identidad persistida. No describe si esa persona usa el sistema cada día, si mantiene una sesión abierta o si solicita una ruta simultáneamente con otros usuarios. La capacidad deberá dimensionarse con concurrencia, distribución temporal y comportamiento de cada flujo, no con el total de cuentas aislado.

## B. Cuellos de botella posibles y evidencia

Las etiquetas separan una propiedad comprobada del código de una degradación que aún no se ha medido.

| Área | Evidencia actual | Riesgo ante crecimiento | Clasificación |
|---|---|---|---|
| Procesos web | Vistas DRF sirven autenticación, catálogo, gestión e inscripciones en una sola aplicación Django. No hay topología de despliegue en el repositorio. | Lecturas, escrituras y envío de correo compiten por procesos y conexiones. Una instancia o un número insuficiente de procesos podría saturarse durante un pico. | Riesgo potencial; no hay medición de carga ni producción. |
| Cupos | `register_for_event` abre una transacción, bloquea la fila del evento con `select_for_update()`, verifica duplicados/cupo y escribe inscripción y confirmación. La prueba usa dos conexiones PostgreSQL y obtiene 201/409 para capacidad 1. | Las altas del mismo evento se serializan en esa fila. Es la protección correcta contra sobreinscripción, pero en un evento muy popular puede elevar la espera. La prueba acredita integridad en ese caso, no rendimiento a miles de solicitudes. | Serialización confirmada; impacto de latencia no medido. |
| Catálogo | `event_queryset` agrega `Count(registrations)` y, para una persona autenticada, anota `Exists` de su inscripción. La lista usa `title__icontains`, categoría, ciudad, fecha y paginación. | Conteos/agregaciones sobre un conjunto creciente y búsqueda parcial podrían encarecerse. Un índice B-tree común no suele resolver eficientemente un patrón con comodín al inicio; hay que confirmar planes con datos representativos antes de elegir trigramas, texto completo o un buscador aparte. | Consultas confirmadas; costo real no medido. |
| Correo | `transaction.on_commit` invoca `send_confirmation` sincrónicamente en el proceso que atiende la petición. SMTP tiene timeout configurado de 10 segundos; el valor predeterminado es consola. | Proveedor lento o con fallas puede prolongar respuestas y ocupar procesos web; no hay worker ni reintento automático. Una interrupción entre commit y callback puede dejar la confirmación pendiente. | Acoplamiento confirmado; falla bajo proveedor real no probada. |
| Caché y límites | DRF limita solicitudes y el login usa `django.core.cache`; no hay configuración de caché compartida, por lo que opera con el backend local predeterminado. | Cada proceso puede mantener contadores distintos. Al escalar horizontalmente, los límites de login y solicitudes dejarían de representar una cuota común. | Límite de diseño confirmado para multiproceso; abuso o efecto productivo no observado. |
| PostgreSQL | Una base lógica; `CONN_MAX_AGE=0`; sin pool externo ni réplicas configurados. Hay índices para estado/fecha y categoría/estado, FK y unicidad usuario/evento. | Abrir conexiones por ciclo de petición y crecer en lecturas, escrituras y conteos puede consumir recursos. También conviene perfilar la lista propia, que filtra por usuario y ordena por fecha de inscripción, antes de añadir un índice compuesto. El límite depende de consultas, conexiones, CPU, I/O y configuración del servidor. | Configuración confirmada; saturación no medida. |
| Reportes | No existe módulo ni API analítica. | Consultas agregadas amplias, si se añadieran a la base transaccional sin aislamiento, competirían con inscripciones. | Necesidad futura del escenario; componente aún no implementado. |
| Frontend | Vite compila React a archivos estáticos; `useResource` solicita al montar y no hay caché de servidor persistente. | Repetición de consultas, activos y cargas iniciales pueden aumentar con el público. No existe despliegue CDN configurado. | Comportamiento local confirmado; costo de distribución no medido. |
| Entregas | Backend modular, pero un único proyecto y proceso de aplicación; no hay pipeline ni despliegue de producción descrito. | Un cambio exige coordinar y validar el artefacto completo; varios equipos pueden chocar en contratos o migraciones. | Acoplamiento del artefacto confirmado; frecuencia y fallos de despliegue desconocidos. |

## C. Necesidades distintas por componente

- **Autenticación** necesita almacenamiento compartido para límites de intentos si hay varias instancias. El access JWT dura cinco minutos y el refresh se rota y revoca en PostgreSQL; no hay razón observada para reemplazar este modelo antes de medir el patrón de acceso y las consultas del token blacklist.
- **Catálogo** es de lectura pública en parte. Primero se deben revisar planes, cardinalidades e índices; una caché corta puede ayudar en páginas públicas. Los permisos, borradores, inscripción propia y disponibilidad autoritativa requieren tratarse aparte para no exponer datos ni mostrar un cupo obsoleto como garantía.
- **Inscripciones** requieren consistencia fuerte para decidir el último cupo. El bloqueo de fila y la unicidad son invariantes útiles que deben permanecer en la base de autoridad, aunque se aumente la capacidad de aplicación.
- **Correo** tiene un ritmo y un dominio de falla externos. Es el primer candidato para ejecutarse como trabajo asíncrono y fuera del proceso web, preservando la inscripción aun si el proveedor se degrada.
- **Reportes** se pueden calcular en tareas programadas o vistas precomputadas. Un almacén analítico separado tiene sentido solo si el volumen y la interferencia justifican el costo de sincronizar y operar otra copia de datos.
- **Equipos** pueden trabajar mejor con módulos y contratos internos claros antes de mantener redes, despliegues, alertas y datos de varios servicios independientes.

## D. Decisiones iniciales que siguen funcionando

La separación lógica `users`, `events`, `registrations` y `notifications`, el modelo relacional, las claves foráneas, la unicidad usuario/evento y el control transaccional de cupos responden a reglas del dominio, no a una escala pequeña. Mantenerlas reduce el riesgo de duplicados y sobreinscripción. La API paginada y el frontend estático ya distinguen responsabilidades de presentación y negocio. JWT y permisos de servidor tienen un contrato que puede conservarse mientras se refuerzan operación y límites.

Por eso, 750,000 cuentas no obligan a rehacer la aplicación. La evolución defendible parte de las cargas que difieren —correo y reportes—, escala horizontalmente instancias web sin estado de sesión local compartida, y añade almacenamiento compartido cuando las métricas lo pidan. El detalle de componentes está en [02 · Escalabilidad](02-ESCALABILIDAD-COMPONENTES.md); la decisión de arquitectura y sus condiciones, en [03 · Evolución](03-EVOLUCION-ARQUITECTONICA.md).

## Indicadores por obtener

Antes de dimensionar infraestructura deben registrarse, por endpoint y franja de demanda: volumen y concurrencia; latencias p50/p95/p99; tasa de errores y timeouts; duración y espera de transacciones de inscripción por evento; uso de CPU, memoria, I/O y conexiones en aplicación/PostgreSQL; planes de consulta y filas examinadas; tasa de aciertos y antigüedad de caché; antigüedad de la cola, reintentos y aceptación/rechazo del proveedor; tamaño y crecimiento de datos; duración de reportes y recuperación desde respaldos. El equipo debe acordar objetivos de servicio y un escenario de carga representativo antes de convertir esos indicadores en umbrales.
