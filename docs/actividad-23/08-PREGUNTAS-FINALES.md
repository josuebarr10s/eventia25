# Respuestas a las preguntas finales

## 1. ¿Qué API representa el mayor riesgo para Eventia?

En el escenario académico elegiría **API 2, el registro que permite asignar `rol: administrador`**, por combinar exposición pública, precondiciones mínimas y posible escalada persistente de privilegios. Un atacante podría crear una cuenta privilegiada sin autenticarse antes y luego actuar sobre funciones administrativas. La API 1 también puede exponer datos personales y permitir lectura horizontal inmediata, pero su impacto depende de qué datos incluye cada inscripción. Por eso priorizo API 2 por el control amplio que puede perderse. En el Eventia real se probó el campo falsificado y se rechazó; no afirmo que esta vulnerabilidad académica exista en el código.

## 2. ¿Por qué JWT no garantiza que la API esté protegida?

JWT puede identificar una cuenta si el servidor valida firma, algoritmo, expiración y, si el diseño los define, emisor/audiencia y tipo de token. Esa autenticación responde “quién presenta esta credencial”. No decide qué evento puede editar, qué función puede invocar ni qué propiedad puede cambiar. Después de autenticar, Eventia debe aplicar permiso funcional (`events.change_event`), propiedad (`organizer_id == request.user.id`, salvo permiso global explícito), allowlist de campos y filtros de consulta por titular. El access JWT tampoco elimina CSRF del flujo de refresh por cookie; ese flujo conserva su protección CSRF.

## 3. ¿Qué diferencia hay entre validar y autorizar?

Validar comprueba que `capacity` sea entero positivo, que `starts_at` esté en el futuro y que el cuerpo no incluya `status` ni `organizer`. Autorizar comprueba si esta cuenta puede crear o editar ese evento. Un organizador puede enviar un título válido y una capacidad válida para el evento de otra persona; la entrada es correcta, pero la operación se debe denegar por propiedad y permiso. Se requieren ambos controles, antes de persistir.

## 4. ¿Por qué OpenAPI no significa que la seguridad ya esté implementada?

OpenAPI describe un contrato para lectores, clientes y herramientas. `security: Bearer` documenta que el cliente debe enviar un access JWT, pero no instala el middleware, no valida la firma ni filtra una inscripción por titular. Esos controles viven en Django/DRF y se comprueban con pruebas de comportamiento. Por eso el YAML de esta entrega señala rutas que ya existen y no crea endpoints nuevos.

## 5. ¿Qué conservar al evolucionar hacia servicios independientes?

La evolución a cinco años trabajada en la Fase 2 de la Actividad 21 recomienda avanzar primero a un **monolito modular con workers y servicios auxiliares**, y extraer capacidades solo cuando métricas y equipos justifiquen un límite de servicio. Usuarios debe seguir siendo la autoridad de identidad; cada servicio valida la identidad recibida y aplica autorización sobre sus objetos. La comunicación de servicio a servicio requiere TLS, credenciales de servicio limitadas y secretos fuera del código. Cada servicio debe validar respuestas externas, mantener logs sin tokens/contraseñas y exponer métricas/alertas.

Para cupos, la reserva sigue teniendo una autoridad transaccional: PostgreSQL actual, bloqueo del evento y unicidad `(user,event)`. No se debe confirmar una reserva solo porque una caché diga que hay espacio ni escribir directamente en dos bases. Si se separa una capacidad, el outbox y mensajes con idempotencia/deduplicación permiten reintentos con consistencia eventual. Las notificaciones y reportes sí pueden ejecutarse en workers separados y fallar sin deshacer una inscripción confirmada. Una caché compartida distribuye límites de login e inscripción; no sustituye el control de cupo en la base. Deben mantenerse límites por identidad/IP, protección contra reintentos abusivos, minimización de datos personales y trazabilidad operativa.

La separación de servicios es una posibilidad futura descrita en la Actividad 21, no un estado ya desplegado en este repo. La prioridad es medir carga, preservar la integridad del flujo de inscripción y agregar complejidad solo con necesidad demostrada.
