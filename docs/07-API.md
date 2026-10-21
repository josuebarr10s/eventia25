# 07 · Contrato HTTP implementado

Base `/api/`. JSON en solicitudes y respuestas. Fechas ISO 8601 con zona horaria. Los listados tienen `{count,next,previous,results}`, 12 resultados por página. Eventos públicos ordenados por fecha e identificador, más próximos primero; inscripciones propias más recientes primero.

| Método y ruta | Acceso | Resultado |
| --- | --- | --- |
| GET `/auth/csrf/` | Público | `csrfToken` y cookie CSRF; `Cache-Control: no-store` |
| POST `/auth/register/` | Público + CSRF | `name,email,password`; 201 con `access,user`, refresh HttpOnly |
| POST `/auth/login/` | Público + CSRF | `email,password`; 200 con `access,user`, refresh HttpOnly |
| POST `/auth/refresh/` | Cookie refresh + CSRF | 200 con `access`; rota refresh en cookie, revoca anterior |
| POST `/auth/logout/` | CSRF | 204; revoca refresh y borra cookie |
| GET `/users/me/` | JWT | Usuario y permisos calculados |
| GET `/events/` | Público | Próximos publicados; `search`, `category`, `city`, `page` |
| GET `/events/categories/` | Público | Opciones `{value,label}` persistidas como elección del modelo |
| GET `/events/{id}/` | Público / dueño autorizado | Detalle publicado; borrador solo para dueño autorizado o permiso global |
| POST `/events/` | `events.add_event` | 201; borrador propiedad del usuario autenticado |
| PATCH `/events/{id}/` | `events.change_event` + dueño o `manage_all_events` | 200; actualiza datos permitidos bajo bloqueo |
| POST `/events/{id}/publish/` | `events.publish_event` + dueño o `manage_all_events` | Sin campos; 200 con evento publicado |
| GET `/events/mine/` | Organizador autorizado | Paginación de eventos propios, incluidos borradores |
| POST `/registrations/` | JWT | Solo `event_id`; 201 con inscripción real |
| GET `/registrations/` | JWT | Solo inscripciones propias; `page` |
| GET `/registrations/{id}/` | JWT + dueño | Inscripción propia; 404 para objetos ajenos |

Usuario: `id,name,email,can_create_events,can_edit_events,can_publish_events`. Ningún campo sensible se serializa.

Evento: `id,title,description,category,category_label,starts_at,city,location,capacity,organizer_name,status,created_at,registered_count,available_spots,is_registered,can_edit,can_publish,is_demo`.

Escritura de eventos: `title,description,category,starts_at,city,location,capacity`. Estado y propietario no son entradas válidas; se rechazan campos adicionales. La capacidad debe ser un entero de 1 a 1 000 000 y no menor que el conteo confirmado. La fecha debe ser futura. No se pueden editar eventos que ya comenzaron. La publicación es una acción explícita; no se implementaron despublicación ni eliminación.

Inscripción: `id,event,created_at,status="confirmed",notification_status`. La notificación tiene estado `pending`, `console`, `sent` (aceptada por el transporte) o `failed`.

Errores DRF: `{detail}` y, para validación por campo, `{detail,fields:{campo:[mensajes]}}`. Los errores globales de validación pueden incluir `non_field_errors` o una lista. El frontend presenta un mensaje general y los errores de campo asociados. Los rechazos CSRF de middleware pueden devolver HTML 403; el cliente maneja este caso con un error genérico legible, sin mostrar HTML.

Códigos: 400 entrada inválida/fecha pasada; 401 autenticación ausente o inválida; 403 falta de permisos o CSRF; 404 recurso inexistente/no visible; 409 duplicado/sin cupos; 429 límite de intentos/solicitudes. Crear o editar eventos como visitante puede producir 403 por permiso de función; nunca realiza la operación. No se implementaron operaciones REST ajenas al flujo real.
