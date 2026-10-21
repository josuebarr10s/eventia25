# 04 · Flujo principal

Consultar evento → ver disponibilidad → inscribirse → actualizar disponibilidad → confirmar registro.

```mermaid
sequenceDiagram
    actor P as Participante
    participant UI as React
    participant API as API Django
    participant DB as PostgreSQL
    participant Mail as Correo / consola
    P->>UI: Consultar evento
    UI->>API: GET /api/events/{id}/
    API->>DB: Evento y conteo de inscripciones
    API-->>UI: Capacidad, cupos y estado del usuario
    P->>UI: Inscribirme
    UI->>API: POST /api/registrations/ + JWT
    API->>DB: BEGIN; SELECT evento FOR UPDATE
    API->>API: Comprobar publicación, fecha, duplicado y cupos
    alt Evento disponible
        API->>DB: INSERT inscripción + confirmación pendiente
        API->>DB: COMMIT
        API->>Mail: on_commit: generar confirmación
        Mail-->>API: Aceptado / consola / error
        API->>DB: Registrar estado de notificación
        API-->>UI: 201 · inscripción confirmada
        UI->>API: Volver a consultar disponibilidad
        UI-->>P: Tu lugar está reservado
    else Sin cupos o inscripción duplicada
        API->>DB: ROLLBACK
        API-->>UI: 409 · explicación
    else Borrador o recurso inexistente
        API->>DB: ROLLBACK
        API-->>UI: 404
    end
```

La identidad se obtiene exclusivamente del JWT autenticado. La solicitud solo acepta `event_id`; enviar `user_id` u otros campos se rechaza. Cada inscripción ocupa un cupo.

La transacción bloquea el evento antes de contar y crear. Dos conexiones que intentan el último cupo esperan sobre la misma fila: después del commit de la primera, la segunda vuelve a contar y obtiene un conflicto. La edición de capacidad adquiere el mismo bloqueo y no permite reducirla por debajo de las inscripciones existentes. La unicidad usuario/evento protege además la persistencia.

No se envía correo por una inscripción fallida o revertida. El envío usa `transaction.on_commit`; un fallo del proveedor deja `Confirmation.status=failed` y conserva la inscripción. La respuesta y Mis inscripciones no presentan la consola como una entrega externa.
