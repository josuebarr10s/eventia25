# Rediseño seguro de las siete operaciones

## Convenciones comunes

Las siete propuestas respetan los nombres y capacidades de la API que realmente existe. Las rutas en español del PDF son ejemplos académicos; no se añadieron al router. Los equivalentes existentes usan el prefijo `/api/` y barras finales. La documentación OpenAPI de tres operaciones está en [04-OPENAPI.md](04-OPENAPI.md) y [openapi/eventia-security.yaml](openapi/eventia-security.yaml).

En endpoints privados, el cliente presenta `Authorization: Bearer <access JWT>` de corta duración. El access token se mantiene en memoria del frontend; el refresh JWT está en cookie `HttpOnly`, `SameSite=Lax`, y se rota/revoca en el servidor. Login/registro/refresh/logout usan CSRF por cookie. La interfaz no constituye autorización: el backend vuelve a comprobar actor, función, objeto y campos. `401` identifica falta de autenticación; `403` una función no permitida; `404` un recurso inexistente/no visible; `409` un conflicto del estado del negocio; `429` el límite temporal.

Los ejemplos de error de credenciales y cadenas están fabricados para documentación; no son datos reales.

## API 1 — Consultar inscripción

**Método/ruta real:** `GET /api/registrations/{id}/` (equivale al `GET /api/inscripciones/125` académico). **Función:** leer una inscripción propia. **Acceso:** usuario autenticado y dueño; no se implementó lectura de la lista de asistentes por organizador ni administrador en esta ruta.

**Entrada válida:** `GET /api/registrations/125/`, sin cuerpo. `id` debe ser entero positivo. **Intento no autorizado:** consultar el ID de otra persona debe producir `404`, no el objeto ni sus datos; un id no es una credencial. **Respuesta positiva:** `200` con la inscripción propia, el evento relacionado y el estado de confirmación; no incluye email/teléfono del participante ni credenciales. **Errores:** `401`, `404`, `429`.

**Pruebas recomendadas:** dueño recibe `200`; otra cuenta y un ID inexistente reciben `404`; ningún resultado incluye propiedades de usuario ajeno. Para añadir acceso de organizador se requiere una decisión explícita de privacidad y comprobación de propiedad de ese evento; hoy no existe tal endpoint.

## API 2 — Registrar usuario

**Método/ruta real:** `POST /api/auth/register/`. **Función:** crear una cuenta participante. **Acceso:** público; requiere CSRF porque está bajo el flujo de autenticación por cookie.

**Cuerpo válido:**

```json
{"name":"Ana","email":"ana@example.test","password":"<clave de prueba larga>"}
```

Nombre, email y contraseña son los únicos campos. Email se normaliza y es único; la contraseña pasa los validadores Django (mínimo 10, similitud, comunes, numéricas); contraseña se almacena con hash. Se rechazan `role`, `is_staff`, `is_superuser`, `groups`, `user_permissions` y cualquier propiedad desconocida. El rol inicial es participante, derivado del hecho de no tener permisos de organizador.

**Intento inválido:** agregar `"role":"admin"`, una contraseña débil o campos no reconocidos resulta en `400`; la cuenta privilegiada no se crea. **Respuesta:** `201` con access token, perfil allowlist y refresh cookie HttpOnly; nunca contraseña/hash. Errores: `400`, `429`; duplicado hoy también es `400` y su texto revela que el correo existe (riesgo residual, véase auditoría real). Limitar la frecuencia de altas.

**Pruebas recomendadas:** cuenta válida obtiene perfil básico y hash distinto del secreto de prueba; cada propiedad privilegiada es rechazada; contraseña débil no crea cuenta; CSRF ausente da `403`; exceso de cuota da `429`.

## API 3 — Crear evento

**Método/ruta real:** `POST /api/events/` (no se añadió precio). **Función:** crear borrador. **Acceso:** cuenta autenticada con `events.add_event`; el propietario siempre es `request.user`, nunca un campo del cuerpo.

**Cuerpo válido:**

```json
{"title":"Concierto","description":"Música en vivo","category":"music","starts_at":"2027-02-10T18:00:00-06:00","city":"Quetzaltenango","location":"Centro cultural","capacity":150}
```

El serializer solo acepta esos campos; título ≤180, descripción ≤10.000, ciudad ≤120, lugar ≤255, categoría de catálogo, fecha futura y capacidad entera entre 1 y 1.000.000. Estado inicial `draft`; publicar es operación separada con `events.publish_event`.

**Intento inválido:** `capacity:-5`, fecha pasada, `status:"published"` u `organizer_id` adicional se rechazan con `400`. Sin permiso el endpoint devuelve `403` (la vista actual usa `AllowAny` para descubrimiento público y verifica el permiso dentro de `create`; una credencial inválida produce `401`). Éxito `201`; otros errores `400`, `401`, `403`, `429`.

**Pruebas recomendadas:** organizador autorizado crea un borrador cuyo dueño proviene del token; participante/visitante no crean; capacidad no positiva ni campo privilegiado se persisten.

## API 4 — Editar evento

**Método/ruta real:** `PATCH /api/events/{id}/`. El PDF propone `PUT`; el router no tiene actualización completa `PUT`, solo `PATCH`. **Función:** modificar campos de evento que todavía no comenzó.

**Acceso:** permiso `events.change_event` **y** propietario, o además permiso explícito `events.manage_all_events`. Ser `is_staff` o pertenecer al rol organizador sin relación de propiedad no basta.

**Cuerpo válido:** `{"title":"Título nuevo"}`. Se validan los mismos límites y fecha; capacidad nunca puede bajar del número de inscripciones confirmadas. **Intento inválido:** `{"organizer_id":2,"status":"published"}` es `400`; un organizador ajeno recibe `403`; ID inexistente `404`. Éxito `200`; otros `401`, `400`, `403`, `404`, `429`.

**Pruebas recomendadas:** propietario y usuario con permiso global explícito pueden según política; organizador distinto y participante reciben denegación; los campos privilegiados no cambian.

## API 5 — Inscribirse

**Método/ruta real:** `POST /api/registrations/` con `{"event_id":25}`. La API actual reserva exactamente una plaza por cuenta; no admite `quantity`. **Acceso:** usuario autenticado; visitante bloqueado. Evento debe estar publicado, futuro y tener espacio disponible.

El serializer acepta solo un entero positivo `event_id`; titular se toma de JWT. Una transacción bloquea la fila del evento, valida duplicado/fecha/cupo y escribe inscripción y confirmación. Hay unicidad por `(user,event)`. Ahora aplica además un límite atómico de **20 solicitudes por cuenta y ventana horaria UTC**; el límite cuenta intentos de este flujo, incluidos los repetidos/incorrectos.

**Solicitud válida:** `{"event_id":25}` → `201`. **Intento abusivo:** `{"event_id":25,"quantity":500}` → `400`; repetir inscripción o evento lleno → `409`; evento no publicado/no existente → `404`; más de 20 intentos dentro de la ventana → `429` con `Retry-After`. También puede haber `401` y `429` por los límites generales.

**Pruebas recomendadas:** una reserva legítima crea un registro y una confirmación; repeticiones no duplican; dos cuentas compiten por último cupo y solo una gana; límite paralelo solo permite 20 solicitudes. La ventana es por hora UTC fija y el cache actual es local por proceso: el límite no debe venderse como distribución global.

## API 6 — Consultar perfil

**Ruta real:** `GET /api/users/me/`; la ruta académica `GET /api/usuarios/35` no existe. **Función:** devolver el perfil del actor autenticado, sin aceptar ID. **Entrada:** sin cuerpo. **Acceso:** solo dueño autenticado; administración se gestiona en Django Admin con permisos, no mediante endpoint REST de perfiles.

**Respuesta:** `200` con `id`, `name`, `email` y tres indicadores de capacidades de eventos. No se serializa `password`, `password_hash`, `is_staff`, `is_superuser` ni teléfono. `/api/users/{id}/` no está implementado (`404`). Errores de `/me`: `401`; `429` límite general. **Pruebas:** comprobar allowlist y que la ruta arbitraria no devuelva cuentas.

## API 7 — Iniciar sesión

**Ruta real:** `POST /api/auth/login/`. **Función:** validar email y contraseña, emitir access JWT y cookie refresh. **Acceso:** público con CSRF. Cuerpo: `{"email":"ana@example.test","password":"<clave de prueba>"}`; email debe tener forma válida y ambos campos tienen límites de longitud.

Mensajes de credenciales incorrectas son iguales con correo existente o inexistente. Se reserva un intento de IP **antes** de comparar la contraseña; cinco solicitudes por ventana de 15 minutos llegan al verificador y las siguientes reciben `429`/`Retry-After:900`. Un login exitoso limpia el contador. Access token dura cinco minutos; refresh cookie de un día, HttpOnly, SameSite Lax, Secure cuando `DEBUG=false`, con rotación y revocación.

**Éxito:** `200`, access JWT y perfil allowlist; refresh via cookie. **Errores:** `400` entrada mal formada; `401` credenciales incorrectas o token inválido; `403` CSRF inválido; `429` temporal. No se conserva la contraseña en cache/logs. El contador depende del cache actual por proceso; centralizarlo antes de desplegar múltiples instancias.

**Pruebas recomendadas:** igualdad del detalle de error, intentos concurrentes no sobrepasan cinco, intento siguiente limitado, login válido limpia la ventana, cookie con atributos esperados.
