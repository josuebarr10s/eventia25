# Controles nuevos implementados

Estos dos controles son adiciones de la Actividad 23. La protección `Cache-Control: no-store` y el límite de alta pública de 10/h ya formaban parte del trabajo anterior y no cuentan aquí como nuevos.

## SEC-001 — Reserva atómica de intentos de login

**Riesgo.** Antes del ajuste, `LoginView` consultaba el contador y luego lo incrementaba al fallar la autenticación. Peticiones paralelas podían observar el mismo contador y todas llamar a `authenticate`, pasando el límite efectivo. El test `ConcurrentLoginTests.test_parallel_failures_cannot_bypass_login_attempt_limit` reprodujo el defecto: ocho peticiones concurrentes llegaron al verificador en la versión anterior.

**Cambio.** `backend/config/throttles.py::reserve_fixed_window` hace `cache.add` para el primer intento e `incr` atómico en los siguientes, reintentando si la clave expira entre operaciones. `LoginView` reserva antes de verificar credenciales; como máximo cinco intentos por ventana de 15 minutos alcanzan el verificador. Los adicionales reciben 429 y `Retry-After: 900`. Un login correcto elimina la ventana.

**Prueba positiva.** Cuatro errores, login correcto y un error posterior producen 401, 200, 401: el login exitoso reinicia el contador.

**Prueba negativa/concurrencia.** Ocho peticiones simultáneas producen cinco 401, tres 429 y cinco llamadas al verificador. La prueba anterior a la corrección falló como se esperaba (8 verificaciones); después de corregirla pasa.

**Referencias:** `backend/users/views.py:79-104`, `backend/config/throttles.py:4-13`, `backend/tests/test_mvp.py:659-724`.

## SEC-002 — Límite dedicado para inscripciones de eventos

**Riesgo.** El límite genérico de usuario protegía el consumo general, pero no expresaba la sensibilidad del flujo de reserva ni ofrecía presupuesto específico por cuenta para los POST de inscripción. No se detectó ni se afirma que el código previo permitiera sobrecupo: el servicio ya protegía cupo/unicidad mediante transacción. Este control preventivo reduce automatización rápida de una cuenta individual.

**Cambio.** `EventRegistrationThrottle` aplica únicamente a `POST /api/registrations/`, usa ventana UTC fija de una hora y clave con hash del ID autenticado; no confía en identidad del cuerpo. La configuración queda en `event_registration=20/hour`. Los demás métodos del viewset conservan los throttle classes generales. La transacción, el bloqueo de evento y la restricción única siguen siendo defensas independientes.

**Prueba positiva.** Veinte solicitudes legítimas sobre eventos disponibles responden 201 y guardan veinte inscripciones.

**Prueba negativa/concurrencia.** La solicitud 21 responde 429 con `Retry-After` y no crea fila. En 40 reservas de contador simultáneas, exactamente 20 son permitidas y 20 rechazadas.

**Referencias:** `backend/registrations/views.py:13-42`, `backend/config/settings.py:103-108`, `backend/tests/test_mvp.py:314-336` y `:727-744`.

## Limitaciones que requieren infraestructura

Ambos límites dependen del cache configurado. Con `LocMemCache`, cada proceso tiene contador separado; el límite no es global entre réplicas y se pierde al reiniciar. Antes del escalamiento debe conectarse Redis compartido, establecer expiraciones y alertas, probar concurrencia multiworker y documentar proxy/IP confiable. El bucket fijo permite ráfagas en el borde de dos ventanas. El presupuesto de 20/h es una decisión inicial del MVP, no un umbral de negocio demostrado con datos reales.

## Corrección adicional — SEC-003, dependencia Django REST Framework

La SCA del lock encontró DRF 3.16.1 en el rango afectado por dos avisos del mantenedor: `request.data` podía omitir el límite de tamaño de Django para JSON/form-urlencoded, y `AdminRenderer` podía revelar representación GET ante una escritura inválida bajo permisos distintos. Se actualizó a **3.17.2** (mínimo parcheado indicado por la revisión), ajustando tanto el rango como el lock. La segunda ruta no aplicaba a la configuración JSON actual; el límite de tamaño sí era relevante al parser REST. Después del cambio, `pip-audit -r backend/requirements.lock.txt` terminó con “No known vulnerabilities found”, `pip check` sin conflictos y las 43 pruebas pasaron. Esta actualización no se cuenta como uno de los dos controles de flujo SEC-001/SEC-002. Referencias del mantenedor: [aviso de límite de cuerpo](https://github.com/encode/django-rest-framework/security/advisories/GHSA-2m8g-3cmr-wg3w), [aviso de AdminRenderer](https://github.com/encode/django-rest-framework/security/advisories/GHSA-g47c-3xmw-q6m2), [notas de versión](https://www.django-rest-framework.org/community/release-notes/).
