# Auditoría del código Eventia actual

## Alcance y método

Se inspeccionaron las rutas, viewsets, serializers, permisos, servicios, modelos, configuración y pruebas del checkout disponible. El proyecto real es Django REST Framework con PostgreSQL y React; no corresponde a las rutas de vistas HTML/sesión mostradas en el informe de referencia. Esta revisión valida el código y las pruebas locales; no constituye una prueba de penetración externa ni afirma que exista un despliegue productivo.

## Stack y superficie comprobada

| Área | Evidencia actual |
|---|---|
| Backend | Django 5.2.18, DRF 3.17.2, SimpleJWT 5.5.1, PostgreSQL/psycopg; Python 3.13 en el entorno revisado. DRF se actualizó tras SCA. |
| Frontend | React 19, TypeScript y Vite 7. El access token vive en memoria; el refresh usa cookie HttpOnly. |
| Auth | `backend/config/urls.py`: `/api/auth/register/`, `login/`, `refresh/`, `logout/`, `csrf/`; `/api/users/me/`. JWT Bearer para endpoints API; CSRF en operaciones de autenticación basadas en cookie. |
| Eventos | Router `/api/events/`: list/retrieve/create/PATCH, `mine/`, `publish/`, `categories/`. No hay `PUT` ni endpoint de edición arbitraria del dueño. |
| Inscripciones | Router `/api/registrations/`: list/retrieve/create. No se acepta identidad o cantidad desde el cliente. |
| Configuración de límites | `anon=120/min`, `user=240/min`, `registration=10/hour` (alta pública preexistente) y `event_registration=20/hour` (control nuevo de esta actividad). Cache configurado localmente. |

## Inventario y hallazgos de seguridad

El inventario estático de backend registra **63 unidades Python** (funciones, métodos y endpoints); la revisión detallada se enfocó en unidades críticas/altas de autenticación, autorización, eventos e inscripciones. El triage estático produjo cuatro candidatos y se resolvieron por contexto, no se tomaron como veredictos automáticos:

| Candidato del triage | Clasificación tras revisión |
|---|---|
| `.env` y `.env.example` presentes | No se leyó `.env`. `.gitignore` excluye `.env`, `.venv`, build y resultados E2E; al no existir `.git`, el estado de seguimiento Git no puede demostrarse. Revisar esto al inicializar repositorio. |
| Secreto en `backend/tests/test_mvp.py` | **FALSE_POSITIVE**: constante de fixture para tests, no credencial de servicio; no se copió ni expuso su valor. |
| `urlopen` en `scripts/test_e2e.py` | **FALSE_POSITIVE** para SSRF: la URL viene del propio harness y está fijada a `127.0.0.1`; no depende de entrada del usuario. |

La auditoría SCA detectó que DRF 3.16.1 estaba dentro del rango afectado por dos avisos oficiales hasta 3.17.1: bypass del límite de tamaño para `request.data` y filtración vía `AdminRenderer`. El segundo camino no se usa aquí (renderers de API solo JSON); el primero sí era relevante para entradas JSON. Se actualizó a 3.17.2, que incorpora ambas correcciones, y el nuevo `pip-audit` del lock no reporta vulnerabilidades. Véanse [GHSA-2m8g-3cmr-wg3w](https://github.com/encode/django-rest-framework/security/advisories/GHSA-2m8g-3cmr-wg3w), [GHSA-g47c-3xmw-q6m2](https://github.com/encode/django-rest-framework/security/advisories/GHSA-g47c-3xmw-q6m2) y [notas de versión DRF](https://www.django-rest-framework.org/community/release-notes/).

## Resultado frente a los siete escenarios

| Escenario | Estado en el sistema real | Evidencia de implementación y prueba |
|---|---|---|
| IDOR al leer inscripción ajena | **PROTEGIDO** | `RegistrationViewSet.get_queryset()` filtra por `request.user`; `retrieve` devuelve 404 al no encontrar objeto en ese queryset. Prueba de propiedad en `backend/tests/test_mvp.py`. |
| Alta de usuario con rol privilegiado | **PROTEGIDO** | `RegisterSerializer` acepta solo `name`, `email`, `password`; el mixin estricto rechaza campos adicionales; password validators y `create_user` aplican hash. Prueba rechaza `role`/propiedades no permitidas. |
| Crear evento sin permiso o con campos inválidos | **PROTEGIDO** | `EventViewSet.create` comprueba `events.add_event`, asigna organizador desde el token y usa serializer estricto con capacidad 1–1,000,000, categorías enumeradas y fecha futura. Comienza como borrador. No existe campo precio en `Event`. |
| Editar evento de otro organizador | **PROTEGIDO** | Solo `PATCH`; `can_manage` requiere `events.change_event` y ser propietario o tener `events.manage_all_events`; fila bloqueada durante escritura. Pruebas verifican ownership y administrador global. |
| Automatizar/acaparar inscripciones y alterar cupos | **PROTEGIDO con límites** | Serializer solo acepta `event_id`; identidad viene de JWT. El servicio serializa por fila del evento, comprueba fecha/publicación/cupo, unicidad DB `(user,event)` y crea confirmación transaccional. Control nuevo de 20 POST por cuenta/hora. Es una mitigación, no una defensa contra cuentas distribuidas o cache fragmentada. |
| Leer hash o perfil por ID | **PROTEGIDO** | Solo existe `/api/users/me/`; allowlist devuelve id/nombre/correo y capacidades. No se encontró ruta `/api/users/{id}/`; no expone `password`, `password_hash`, `is_staff` o `is_superuser`. |
| Fuerza bruta y enumeración en login | **PARCIALMENTE PROTEGIDO** | Se aplica límite por IP con respuesta 429 y `Retry-After`; el contador ahora reserva antes de verificar credenciales y resiste concurrencia. La respuesta de login erróneo es uniforme. El alta pública aún informa si un correo existe, así que queda enumeración en `/register/`. Cache por proceso limita efectividad multiinstancia. |

## Referencias de código y pruebas

| Escenario | Código revisado | Prueba reproducible |
|---|---|---|
| API1 | `backend/registrations/views.py:44-48` — queryset del titular. | `backend/tests/test_mvp.py:538` — `test_only_own_registrations_are_listed_and_others_return_404`. |
| API2 | `backend/config/serializers.py:9-17` — campos extra; `backend/users/serializers.py:35-67` — allowlist, validación y hash al guardar. | `backend/tests/test_mvp.py:154` y `:177` — propiedades privilegiadas y contraseña débil. |
| API3 | `backend/events/views.py:60-69`; `backend/events/serializers.py:66-93`. | `backend/tests/test_mvp.py:362-405` — permiso, dueño servidor, campos, capacidad/fecha/categoría. |
| API4 | `backend/events/permissions.py:1-6`; `backend/events/views.py:71-81`. | `backend/tests/test_mvp.py:407` y `:422` — propiedad y permiso global explícito. |
| API5 | `backend/registrations/views.py:13-42`; `backend/registrations/services.py:17-33`; `backend/registrations/models.py` — restricción única. | `backend/tests/test_mvp.py:314`, `:486`, `:631` y `:728` — cuota, duplicado, última plaza y límite paralelo. |
| API6 | `backend/users/views.py:146-148`; `backend/users/serializers.py:9-23`. | `backend/tests/test_mvp.py:268-285` — allowlist del perfil y 404 de ruta por ID. |
| API7 | `backend/users/views.py:79-104`; `backend/config/throttles.py:4-13`. | `backend/tests/test_mvp.py:192`, `:660` y `:698` — respuesta uniforme, concurrencia y reinicio al éxito. |

## Hallazgos priorizados

| ID | Severidad | Estado | Categoría | Resultado |
|---|---|---|---|---|
| SEC-001 | MEDIUM | **CONFIRMED, corregido** | OWASP API2 / CWE-362 (carrera del contador) | Ocho logins paralelos superaban el umbral previo y llamaban a `authenticate`. Se reserva el intento atómicamente antes de comprobar credenciales; el test de regresión ahora da 5×401 y 3×429. Código actual: `backend/users/views.py:88-104`, `backend/config/throttles.py:4-13`. |
| SEC-003 | MEDIUM | **CONFIRMED, corregido** | Dependencia vulnerable / resource consumption | DRF 3.16.1 estaba en el rango afectado por los dos avisos upstream. La configuración usa `request.data` JSON, relevante al bypass del límite de cuerpo. Se actualizó a 3.17.2 y el SCA posterior quedó limpio. El camino `AdminRenderer` sí es **NOT_APPLICABLE** aquí porque solo se habilita JSONRenderer. |
| RES-001 | LOW | **CONFIRMED, pendiente decisión de producto** | Enumeración de cuentas / API2 | `RegisterSerializer.validate_email` distingue correo duplicado (`backend/users/serializers.py:45-49,60-67`); el test `test_duplicate_email_case_insensitive` confirma el rechazo. Un actor puede comprobar existencia de correo. El login no presenta esa diferencia. |
| INF-001 | MEDIUM* | **NEEDS_VALIDATION** | API4 / throttling en despliegue | `LocMemCache` comparte el límite solo dentro de cada proceso. Si producción usa varias réplicas, una cuenta puede multiplicar su cuota por instancia. No hay infraestructura productiva disponible para validar; Redis compartido es pendiente antes de escalar. |
| SEC-002 | INFO | Mejora preventiva, no hallazgo de explotación | API6 / flujo sensible | Se añadió cuota específica de inscripción porque el flujo es susceptible a automatización, sin afirmar que el código anterior permitiera sobrecupo o una explotación observada. |

\* La severidad de INF-001 depende de que se despliegue en varios procesos con cache local; por eso el impacto productivo permanece por validar.

## Clasificación y límites de evidencia

- **VULNERABILIDAD CONFIRMADA (antes del cambio de Actividad 23):** la carrera permitía que varias peticiones concurrentes superaran el umbral de login. El test de regresión se ejecutó primero contra la implementación anterior y las ocho peticiones llegaron a `authenticate`; tras reservar atómicamente el intento, pasan solo cinco y tres reciben 429. Se conservó esa evidencia como control SEC-001.
- **RIESGO RESIDUAL CONFIRMADO:** cache local no comparte límites entre procesos; se requiere Redis u otro backend central antes de escalar horizontalmente.
- **LIMITACIÓN CONFIRMADA:** login agrupa por IP directa; no hay límite adicional por cuenta ni telemetría de seguridad dedicada. `REMOTE_ADDR` evita confiar en `X-Forwarded-For` arbitrario, pero detrás de proxy la IP real debe configurarse con un proxy confiable.
- **LIMITACIÓN CONFIRMADA:** el alta pública responde con mensaje distinto para correo ya registrado; no se afirma que todos los flujos de recuperación de cuenta estén auditados.
- **SEC-003, CONFIRMED y corregido:** vulnerabilidades de dependencia en DRF 3.16.1 según los avisos del proyecto upstream. La corrección de versión está en `backend/requirements.txt` y `backend/requirements.lock.txt`; validada con suite y `pip-audit` posterior. El problema específico de `AdminRenderer` no era alcanzable con los renderers configurados, aunque quedó corregido por el mismo upgrade.
- **NO IMPLEMENTADO:** no hay recurso/endpoint de precio en el modelo actual; no aplica validar el precio ficticio del escenario académico.
- **NO REPRODUCIDO:** no se encontró acceso por ID a perfil ajeno porque esa ruta no existe; esto se verifica por rutas y prueba 404.
- **REQUIERE VALIDACIÓN:** configuración real de proxy, Redis, HTTPS, cabeceras, WAF, logging, proveedores de correo, despliegue y configuración de producción. `check --deploy` es una comprobación local del framework, no certifica infraestructura.

## Repositorio y alcance operativo

El directorio disponible no contiene metadatos `.git`; `git status` y `git remote` no pudieron ejecutarse como operaciones de repositorio. Por eso no se atribuye branch, commit, PR ni remoto, y no se inicializó ni publicó repositorio. Se trabajó directamente en el workspace permitido. No se inspeccionaron archivos de entorno ni secretos.
