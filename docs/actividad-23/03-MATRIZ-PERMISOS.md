# Matriz de roles y permisos

La columna describe la **política propuesta** para las ocho operaciones pedidas. “Condicionado” significa que el servidor evalúa los permisos y el objeto concreto; el nombre del rol por sí solo no concede la acción. La última columna de observaciones compara esa política con las rutas realmente existentes.

| Operación | Visitante | Usuario registrado | Organizador | Administrador |
|---|---|---|---|---|
| Consultar eventos públicos | Permitido | Permitido | Permitido | Permitido |
| Crear eventos | Denegado | Denegado | Condicionado: `events.add_event` | Condicionado: permiso explícito `events.add_event` o superuser |
| Modificar eventos propios | Denegado | Denegado | Condicionado: `events.change_event` y `organizer_id == user.id` | Condicionado: permiso explícito y propiedad, o `manage_all_events` |
| Modificar eventos ajenos | Denegado | Denegado | Denegado | Condicionado: `events.change_event` y `events.manage_all_events` (superuser lo satisface) |
| Inscribirse en eventos | Denegado | Condicionado: sesión válida, evento publicado/futuro/con cupo, no inscrito ya y límite por cuenta | Condicionado: mismas reglas de cuenta registrada | Condicionado: mismas reglas; privilegio admin no reserva por otras personas |
| Consultar inscripciones propias | Denegado | Permitido: solo `request.user` | Permitido: solo `request.user` | Permitido: solo `request.user` mediante API actual |
| Consultar inscripciones de un evento como organizador | Denegado | Denegado | Condicionado: solo dueño del evento y permiso de consulta; la API actual no implementa esta lectura | Condicionado: permiso de lectura administrativa explícito; no implementado en API actual |
| Administrar usuarios | Denegado | Denegado | Denegado | Condicionado: Django Admin, `is_staff` y permiso específico sobre el modelo/acción |

## Política de autorización

- **Autenticación:** access JWT Bearer identifica al actor en las rutas privadas. El refresh token solo va en cookie HttpOnly para renovar sesión; las operaciones protegidas no interpretan el token como permiso universal.
- **Función:** verificar permisos de Django como `events.add_event`, `events.change_event`, `events.publish_event`.
- **Objeto:** edición exige que el evento pertenezca al actor, salvo el permiso específico `events.manage_all_events`. Lecturas de inscripción filtran por el titular autenticado.
- **Propiedad:** aceptar una lista de campos permitidos. El cliente no asigna rol, propietario, estado ni `user_id` al crear eventos/inscripciones.
- **Mínimo privilegio y denegación por defecto:** `IsAuthenticated` es el permiso general de DRF; vistas públicas son explícitas. Un visitante puede leer el catálogo, no crear/editar ni inscribirse.
- **IDs:** numéricos y fáciles de adivinar; aleatorizarlos no sustituye verificación de autorización.

## Diferencia con Eventia actual

Eventia no almacena un enum fijo `visitante/usuario/organizador/administrador`. Visitante es ausencia de autenticación; cuenta común carece de permisos de evento; organizadores reciben permisos Django; superusuario satisface permisos administrativos. El backend protege crear/editar/publicar y las inscripciones propias. No hay endpoint REST para ver todas las inscripciones de un evento como organizador ni para administrar perfiles ajenos; la matriz marca ambas filas como política futura condicionada, no capacidad ya implementada. Los detalles por ruta están en [auditoría de código real](05-AUDITORIA-CODIGO-REAL.md).
