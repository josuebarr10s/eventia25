# Investigación OWASP Top 10:2021

La investigación se limita a tres categorías pedidas en la actividad. Las definiciones siguientes están resumidas con palabras propias y vinculadas a la documentación oficial.

## A01:2021 — Broken Access Control

El control de acceso falla cuando el servidor no confirma que la persona autenticada tiene el permiso y la relación con el objeto solicitados. Ocultar una acción en la interfaz no protege el endpoint: cada solicitud debe autorizarse en el backend, de forma predeterminada restrictiva y para el objeto concreto.

**Escenario en Eventia.** Un organizador intenta editar el ID de un evento ajeno, una persona intenta publicar eventos sin permiso, o un participante sustituye el identificador de inscripción para consultar la reserva de otra persona. La respuesta debe denegar la operación o no revelar la existencia del recurso privado.

**Consecuencias.** Modificaciones o publicaciones no autorizadas, exposición de información de inscripción y suplantación de capacidades. Las consecuencias concretas dependen del tipo de recurso y los datos expuestos.

**Prevención y evidencia en el proyecto.** Validar permisos y propiedad en cada endpoint; obtener identidad del token, no de campos enviados; filtrar listados por usuario y devolver 404 para registros de terceros. Eventia aplica esas reglas en [permisos de eventos](../../backend/events/permissions.py), [vistas de eventos](../../backend/events/views.py) y [vistas de inscripciones](../../backend/registrations/views.py). Las pruebas relevantes cubren edición entre organizadores y aislamiento de inscripciones.

Fuente oficial: [OWASP Top 10:2021 A01 — Broken Access Control](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/).

## A03:2021 — Injection

La inyección ocurre cuando datos no confiables se interpretan como parte de una instrucción o lenguaje ejecutable. La inyección SQL altera la consulta a la base de datos; XSS hace que el navegador interprete contenido controlado por el usuario como código o marcado activo. Están relacionadas por el tratamiento de entradas, pero requieren defensas específicas y no son la misma vulnerabilidad.

**Escenario en Eventia.** Un atacante prueba una cadena SQL en el buscador para alterar filtros, o guarda una descripción con etiquetas o scripts para que se ejecuten al abrir el evento. Un patrón con comillas no demuestra por sí mismo una inyección: importa cómo los datos entran en el ORM y cómo se representan en el DOM.

**Consecuencias.** La inyección SQL puede ampliar resultados o alterar datos si la consulta se construye de forma insegura. El XSS puede ejecutar acciones dentro de la sesión de la víctima o mostrar contenido falso si una vista inserta HTML no confiable.

**Prevención y evidencia en el proyecto.** Se usa el ORM de Django para el filtro `title__icontains` en vez de concatenar SQL; React representa la descripción como texto JSX (`<p>{event.description}</p>`). La auditoría no encontró `dangerouslySetInnerHTML`, `innerHTML` ni `eval` en `frontend/src`. Una prueba envió una cadena con sintaxis SQL al buscador y obtuvo cero resultados sin error. Mantener consultas ORM, validar longitud y usar la codificación de salida del framework; no insertar HTML aportado por usuarios sin una sanitización deliberada.

Fuentes oficiales: [OWASP Top 10:2021 A03 — Injection](https://top10.owasp.org/2021/A03_2021-Injection/) y [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

## A04:2021 — Insecure Design

Un diseño inseguro carece de controles suficientes para una regla de negocio o un escenario de abuso, aunque cada componente aislado funcione como se programó. Deben definirse invariantes del negocio y probarse también bajo concurrencia y entradas inesperadas.

**Escenario en Eventia.** Dos personas intentan ocupar simultáneamente el último cupo; una cuenta repite su inscripción; alguien intenta inscribirse en un evento borrador, ya iniciado o lleno; o un cliente envía una cantidad que no forma parte del modelo real.

**Consecuencias.** Sobreventa, inscripciones duplicadas, confirmaciones contradictorias y cupos incorrectos.

**Prevención y evidencia en el proyecto.** Ejecutar la inscripción en una transacción, bloquear la fila del evento con `select_for_update`, verificar estado, fecha, duplicado y cupo en el servidor; respaldar reglas con unicidad y restricciones de base de datos. Eventia sigue ese flujo en [el servicio de inscripción](../../backend/registrations/services.py), y una prueba con dos conexiones PostgreSQL compitió por capacidad 1: una inscripción obtuvo 201, la otra 409 y quedó un solo registro y una sola confirmación.

Fuente oficial: [OWASP Top 10:2021 A04 — Insecure Design (español)](https://top10.owasp.org/2021/es/A04_2021-Insecure_Design/).

## Referencias de framework

- [Django REST Framework — ScopedRateThrottle](https://www.django-rest-framework.org/api-guide/throttling/#scopedratethrottle).
- [Django 5.2 — `add_never_cache_headers`](https://docs.djangoproject.com/en/5.2/ref/utils/#django.utils.cache.add_never_cache_headers).
