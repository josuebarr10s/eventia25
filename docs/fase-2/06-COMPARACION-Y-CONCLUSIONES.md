# 06 · Comparación y conclusiones

La columna “hoy” describe el artefacto local de Fase 1 y sus pruebas, no un servicio público en producción. La columna “cinco años” refleja el escenario académico. Donde no hay dato, se indica expresamente.

| Aspecto | Hoy: Fase 1 comprobable | Cinco años: escenario y evolución propuesta |
|---|---|---|
| Usuarios | Cuenta y flujo de autenticación implementados; población productiva desconocida. | 750,000 registrados según el enunciado. Activos y concurrentes desconocidos; instrumentar y probar por perfil. |
| Tráfico | API JSON paginada; sin mediciones reales de carga. | Picos en aperturas, especialmente por evento. No equivale a que todas las cuentas estén conectadas a la vez. |
| Arquitectura | Monolito Django por módulos, frontend React independiente como build estático, una configuración PostgreSQL. | Mantener el monolito de dominio; escalar instancias y ejecutar workers auxiliares según evidencia. C solo para límites estables. |
| Despliegue | No hay despliegue productivo ni CI/CD descritos. Ejecución de desarrollo documentada. | Balanceo, estrategia gradual, observabilidad, recuperación y CDN por definir si se aprueban. |
| Base de datos | PostgreSQL, FK, unicidad usuario/evento, check de capacidad, índices selectos; sin réplica ni pool externo configurados. | Afinar recursos/conexiones y consultas; backups comprobables. Réplica tolerante a retraso si las lecturas lo justifican. Partición/sharding no son predeterminados. |
| Eventos | Publicación y consulta con filtros, anotación de inscritos y página de 12 elementos. | Más eventos/ciudades; optimizar filtros e índices medidos. Caché solo pública y no autoritativa. Buscador especializado condicional. |
| Inscripciones | Bloqueo transaccional por evento, regla de unicidad y test concurrente de capacidad 1. | Más contención en eventos populares. Mantener DB como autoridad, probar carga realista, recortar sección crítica, añadir idempotencia persistida si existen reintentos. |
| Notificaciones | Confirmación en DB y envío `on_commit` síncrono; consola por defecto; no retry ni worker. | Outbox, procesamiento asíncrono, límites, backoff, deduplicación y cola de fallidos. Proveedor y cuotas desconocidos. |
| Estadísticas | No hay módulo ni contrato de reporte. | Consultas acotadas y agregados programados al inicio; separar lectura/almacenamiento solo si afecta operación. |
| Disponibilidad | No se documentan balanceo, réplica, backup/restore productivos ni objetivos. | Objetivos y recuperación por definir; varios procesos, redundancia y restauración probada según necesidad. No prometer “alta disponibilidad” hasta operarla. |
| Escalabilidad | Una aplicación lógica, sin prueba de carga sostenida. | Horizontal para procesos sin estado compartido local; escala vertical y pool según perfil; separar solo cargas divergentes. Capacidad aún sin dimensionar. |
| Costos operativos | Stack local acotado; no hay costo productivo conocido. | Aumenta por balanceo, almacenamiento, métricas, caché, broker y guardias. Se agrega progresivamente; sin cotización disponible. |
| Complejidad | Una API y una base simplifican transacciones y depuración. | Más procesos y estados operacionales; adopción de microservicios eleva observabilidad, red y coordinación. |
| Equipos | Número de equipos actual desconocido; módulos en una base de código. | Varios equipos en el escenario. Acordar propiedad modular y compatibilidad; despliegues separados solo donde reduzcan bloqueos netos. |

## ¿Fue un error no construir desde el inicio para cinco años?

No, con la información disponible. La Fase 1 debía validar el flujo de Eventia —publicar, descubrir e inscribirse— con reglas de cupo correctas y alcance controlado. Construir desde el comienzo balanceadores, cachés distribuidas, broker, workers, réplicas y varios servicios habría añadido costo inicial, más piezas que operar y riesgo de fallas de red antes de conocer volumen, equipo o requisitos de disponibilidad.

La decisión de usar módulos Django separados, PostgreSQL y una transacción explícita para la plaza fue una base evolutiva adecuada. No hace falta reemplazarla para adaptar el producto. Sí hay trabajo preventivo que conviene cubrir antes de una operación pública amplia: observabilidad, carga representativa, límites compartidos al multiplicar instancias, recuperación de base y envío robusto de notificaciones. Son cambios graduales que conservan API y reglas del dominio.

La omisión sería problemática si Eventia creciera sin medir, si se tratara el contador de prueba como garantía de alta capacidad o si se desplegaran varias instancias con contadores locales sin revisar. El riesgo no es “haber empezado como monolito”; es no agregar controles cuando las condiciones que los requieren aparecen. El correo es la separación más evidente porque ya realiza I/O externo dentro del ciclo web. La alta concurrencia de un único evento es un riesgo de contención confirmado por el diseño, pero su impacto debe medirse; el test de última plaza valida seguridad de datos, no el throughput.

La ruta recomendada es alternativa B: optimizar y medir, ampliar procesos con límites compartidos y mover tareas de correo/reportes a workers; considerar C únicamente si la carga, despliegues o propiedad del equipo muestran una frontera independiente. Esta conclusión y sus riesgos están desarrollados en [03 · Evolución arquitectónica](03-EVOLUCION-ARQUITECTONICA.md).

## Conclusión

La cifra de cuentas no dicta la arquitectura. El trabajo urgente es obtener mediciones y operar la integridad que ya existe: PostgreSQL conserva la decisión final del cupo; correo debe poder salir del request; catálogo y reportes deben aislarse solo en proporción al costo que causen. El monolito modular puede evolucionar sin reescritura; servicios independientes son una respuesta selectiva a equipos y cargas con necesidad demostrada.
