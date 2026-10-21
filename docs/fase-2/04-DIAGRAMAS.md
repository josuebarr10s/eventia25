# 04 · Diagramas arquitectónicos

Los bloques Mermaid son la fuente editable. El primer diagrama refleja código y configuración de Fase 1; el segundo es una propuesta, no infraestructura existente. No se exportó SVG/PNG porque no se encontró un renderizador Mermaid local disponible (`mmdc` no está instalado).

## Diagrama A — Arquitectura real de Fase 1

```mermaid
flowchart LR
    Persona["Visitante, participante u organizador"]
    Navegador["Navegador · React + TypeScript\nBuild Vite estático"]
    Proxy["Proxy Vite /api\nsolo desarrollo"]
    Persona --> Navegador
    Navegador -->|"HTTP JSON · JWT Bearer"| Proxy

    subgraph Django["Aplicación Django modular · implementada"]
        API["Django REST Framework\nVistas, serializadores y rutas"]
        Usuarios["users\nCuenta, JWT y permisos"]
        Eventos["events\nCatálogo, publicación y gestión"]
        Inscripciones["registrations\nServicio transaccional de cupos"]
        Notificaciones["notifications\nConfirmación y estado"]
        API --> Usuarios
        API --> Eventos
        API --> Inscripciones
        Inscripciones -->|"crear confirmación"| Notificaciones
    end

    Proxy -->|"proxy local; en despliegue no definido"| API
    Usuarios -->|"usuarios y tokens"| DB[("PostgreSQL · única base configurada")]
    Eventos -->|"eventos y consultas"| DB
    Inscripciones -->|"transacción, bloqueo de evento y unicidad"| DB
    Notificaciones -->|"confirmación/estado"| DB
    Notificaciones -.->|"on_commit síncrono; SMTP configurable"| Correo["EmailBackend\nConsola por defecto"]
```

La aplicación React es cliente del API; Vite proxy está configurado para desarrollo, mientras la publicación productiva de los activos no se definió. `on_commit` retrasa el envío hasta confirmar la transacción, pero el callback ejecuta sincrónicamente en el proceso web. Correo por consola es el backend predeterminado; SMTP es una configuración opcional, no una entrega externa verificada. No existen balanceador, caché distribuida, broker, workers, réplica o CDN configurados en Fase 1.

## Diagrama B — Arquitectura recomendada a cinco años

```mermaid
flowchart LR
    Persona["Personas usuarias"] --> Browser["Navegador\nReact estático"]
    CDN["CDN · SEPARAR entrega de activos\npropuesta"] -->|"activos versionados"| Browser
    Browser -->|"HTTPS API"| LB["Balanceador · ESCALAR\ncuando las métricas lo justifiquen"]

    subgraph WebPool["Pool web · ESCALAR instancias del mismo monolito Django"]
        App1["Instancia web A"]
        AppN["Instancia web N"]
        Users["users · CONSERVAR · MODIFICAR límites compartidos"]
        Events["events · CONSERVAR · MODIFICAR consultas"]
        Registrations["registrations · CONSERVAR autoridad · MODIFICAR idempotencia"]
        Outbox["Outbox en la transacción de negocio · MODIFICAR"]
        App1 --> Users
        App1 --> Events
        App1 --> Registrations
        AppN --> Users
        AppN --> Events
        AppN --> Registrations
        Registrations -->|"misma transacción"| Outbox
    end

    LB --> App1
    LB --> AppN
    Users -.->|"throttling compartido"| Cache[("Caché compartida · MODIFICAR / ESCALAR\nno autoritativa")]
    Events -.->|"solo lecturas públicas con TTL"| Cache
    Users --> DB[("PostgreSQL primario · CONSERVAR / ESCALAR\nfuente de verdad")]
    Events --> DB
    Registrations -->|"bloqueo + unicidad + commit"| DB
    Outbox --> DB

    Dispatcher["Despachador de outbox\nproceso independiente"] -->|"publicación repetible"| Broker[("Broker durable\nsi se adopta Celery u otro")]
    Broker --> NotifyWorker["Worker de notificaciones\nSEPARAR / ESCALAR ejecución"]
    NotifyWorker -->|"correo con reintento y deduplicación"| Mail["Proveedor de correo"]
    NotifyWorker -->|"estado e intentos"| DB
    Broker --> ReportWorker["Worker de reportes\nSEPARAR carga de proceso si se mide"]
    ReportWorker -->|"consultas acotadas / agregados"| DB
    ReportWorker -->|"resultado para organizador"| Results[("Resultados agregados\nsi la función lo requiere")]
```

En el dibujo, el broker puede omitirse si un despachador/worker durable basado en PostgreSQL satisface el volumen y la operación; se seleccionaría una sola alternativa tras medir. Los workers pueden usar el mismo repositorio y reglas de negocio: separar su ejecución no crea por sí solo microservicios. El nodo de resultados agregados solo se incorpora para una necesidad comprobada de reportes. No representa una base adicional para cupos.

## Leyenda de evolución

| Marca | Aplicación a Eventia |
|---|---|
| **CONSERVAR** | Módulos de usuarios, eventos e inscripciones; API y modelo relacional; integridad transaccional del cupo. |
| **MODIFICAR** | Outbox y reintentos; límites de solicitud compartidos; telemetría, recuperación y ajustes de consultas/conexiones. |
| **SEPARAR** | Correo y reportes como pools de proceso/worker; CDN como distribución estática. Esto no implica extraer dominios a microservicios. |
| **ESCALAR** | Réplicas de proceso web y, según demanda, capacidad PostgreSQL, workers y caché. Las cantidades se definen con mediciones. |

Los dos diagramas se escribieron con sintaxis Mermaid estándar de `flowchart`. La herramienta local de renderizado/parser no está instalada, por lo que no se afirma una validación automatizada ni se generaron imágenes. La revisión de cercas, etiquetas y flujos se efectuó junto con la verificación documental.
