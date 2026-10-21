# 03 · Dependencias

| Dependencia | Información o servicio necesario | Control de integridad |
| --- | --- | --- |
| Inscripciones → Eventos | Identificador, publicación, fecha futura, capacidad y conteo de inscripciones | Bloqueo de la fila del evento; validación dentro de la transacción |
| Inscripciones → PostgreSQL | Transacciones, `SELECT FOR UPDATE`, claves foráneas y unicidad usuario/evento | Una sola inscripción por usuario; serialización al último cupo |
| Notificaciones → Correo | Remitente, destinatario, nombre, evento, fecha y lugar; backend Django SMTP o consola | Envío después del commit; fallo registrado sin revertir la inscripción |
| Eventos → Usuarios | Organizador y permisos `add_event`, `change_event`, `publish_event`, `manage_all_events` | Propietario asignado por servidor; autorización de función y objeto |
| Frontend → API | JSON paginado, errores, usuario autenticado y permisos calculados | JWT breve en memoria; renovación por cookie HttpOnly protegida con CSRF |

Las dependencias externas configurables son PostgreSQL y, opcionalmente, SMTP. La consola sustituye solamente el transporte de correo en desarrollo; no se presenta como entrega externa. Las fuentes Plus Jakarta Sans se sirven desde el propio frontend, sin depender de una CDN.

Si el proceso se interrumpe después del commit y antes del envío, la confirmación puede quedar pendiente. No hay reintento automático en este MVP. El registro persistido permite identificar ese caso sin perder la inscripción.
