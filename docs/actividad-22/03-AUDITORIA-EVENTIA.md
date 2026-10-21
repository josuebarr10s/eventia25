# Auditoría de seguridad de Eventia

## Objetivo y alcance

Se revisó el flujo real de autenticación, eventos, permisos, inscripciones y persistencia para identificar controles presentes y riesgos demostrables. El análisis cubrió los módulos listados abajo, las pruebas del backend, configuración local no secreta, el frontend y las dependencias. Se añadieron dos mejoras pequeñas en backend y se caracterizó su comportamiento antes de aplicarlas. No se hicieron pruebas de intrusión contra sistemas externos ni se modificaron servicios o datos de producción.

No se encontraron en el espacio de trabajo los dos materiales académicos citados por la consigna: `Actividad 22 P Web` y `Actividad 22 - Eventia y Seguridad Web`. La actividad pegada en esta conversación sí estuvo disponible y se utilizó como contrato de entrega. Por ello, no se atribuyeron requisitos ni resultados al documento simulado ausente.

## Tecnologías detectadas

| Área | Evidencia en el proyecto |
|---|---|
| Backend | Python 3.13 del entorno del proyecto, Django 5.2.18 y Django REST Framework 3.16.1 |
| Autenticación | SimpleJWT 5.5.1, access token de cinco minutos y refresh token rotativo en cookie HttpOnly de un día |
| Persistencia | PostgreSQL, psycopg 3.3.6; constraints y transacciones del ORM |
| Frontend | React 19.3.1, TypeScript, Vite 7.3.7; Playwright 1.56.0 para E2E |
| Cache | Django LocMemCache predeterminado; no se encontró una configuración de cache compartido |

Las versiones de backend se leen de `backend/requirements.lock.txt`; las del cliente, del `frontend/package-lock.json`.

## Metodología

Se siguió el flujo de solicitud desde vistas y serializadores hasta permisos, servicios y constraints; se contrastó con las pruebas de rol/objeto y concurrencia. Se revisaron los formularios, transporte de sesión, errores y representación del contenido en React. Después se ejecutaron pruebas de caracterización previas a las dos mejoras, regresión del backend, comprobaciones de configuración, compilación web, auditoría de dependencias y el guion E2E aislado. Resultados concretos se encuentran en [pruebas](05-PRUEBAS-SEGURIDAD.md).

## Revisión de los ocho aspectos

| Aspecto | Resultado y evidencia |
|---|---|
| Autenticación | **Protegido con limitación operativa.** Django verifica contraseñas con su framework. El access JWT se conserva en memoria del cliente; refresh es HttpOnly, SameSite=Lax, se rota, se invalida al cerrar sesión y exige CSRF. Fallos de login muestran una respuesta genérica y bloquean cinco intentos desde la IP directa durante 15 minutos. El access token ya emitido puede seguir vigente hasta cinco minutos tras logout. Cache de login es local al proceso. |
| Autorización | **Protegido.** Crear requiere `events.add_event`; editar requiere permiso de cambio más propiedad del evento o `manage_all_events`; publicar requiere permiso explícito y propiedad o permiso global. Las inscripciones se filtran por el usuario autenticado, no por un ID enviado. Roles y propietario no son editables mediante serializadores de escritura. |
| Validación | **Protegido.** Serializadores rechazan campos desconocidos; eventos validan fechas futuras, categoría y capacidad de 1 a 1.000.000; no se permite bajar capacidad bajo inscripciones existentes. Inscripción admite solo un `event_id` positivo, sin cantidad ni `user_id` del cliente. |
| Cupos | **Protegido y probado con PostgreSQL.** La inscripción es atómica, bloquea primero la fila del evento, comprueba estado/fecha/duplicado/cupos y crea inscripción y confirmación dentro de la transacción. Constraint unique por usuario y evento; prueba concurrente por último cupo da un 201 y un 409. |
| Contraseñas | **Protegido.** `create_user` usa hash de Django; contraseña es write-only y no forma parte del serializer de usuario. Hay longitud mínima 10 y validadores de similitud, contraseña común y numérica. No se imprime ni documenta valor alguno de credencial. |
| Secretos | **Parcialmente verificado.** `DJANGO_SECRET_KEY` es obligatorio desde entorno; `.env`, `.venv` y `.runtime` están en `.gitignore`; la inspección de patrones excluyó esos archivos y no publicó valores. No hay repositorio Git accesible, así que no se pudo confirmar qué está trackeado ni revisar historial remoto. |
| Manejo de errores | **Protegido en rutas verificadas; producción no validada.** Login no distingue si el correo existe cuando las credenciales fallan. La validación devuelve errores JSON controlados. `check --deploy` con `DJANGO_DEBUG=false` no emitió advertencias de despliegue. No hay servidor productivo disponible para probar páginas 500, proxy o política de logs. |
| Dependencias | **Revisión parcial.** `npm audit` informó 0 vulnerabilidades en 129 dependencias del lockfile consultado. `pip check` no encontró dependencias rotas; `pip-audit` no está disponible, por tanto no se reporta un análisis CVE equivalente para Python. |

## Matriz de hallazgos

La columna de estado usa literalmente los cuatro estados solicitados. Un control ya presente se informa como **PROTEGIDO**; una limitación concreta demostrada se informa como **CONFIRMADO**, aunque no equivalga a una explotación del negocio.

| ID | Aspecto | Hallazgo | Severidad | Evidencia | Estado |
|---|---|---|---|---|---|
| A22-01 | A01 / autorización | No se reprodujo edición de evento ajeno, publicación sin permiso ni lectura de inscripción de terceros; los endpoints autorizan en backend. | — | `test_owner_edits_other_organizer_denied`, `test_only_own_registrations_are_listed_and_others_return_404`, `test_publish_requires_permission_and_ownership` | PROTEGIDO |
| A22-02 | A03 / inyección | El filtro de búsqueda usa ORM y el contenido de descripción se presenta como JSX. No se encontró sumidero HTML ejecutable en el frontend auditado. | — | `test_search_treats_sql_syntax_as_literal_input`; revisión de `EventDetail.tsx` | PROTEGIDO |
| A22-03 | A04 / cupos | Transacción, bloqueo de fila, constraint único y test concurrente impiden sobrecupo y duplicación en escenario probado. | — | `test_two_connections_compete_for_last_spot`; `test_duplicate_registration_and_database_uniqueness` | PROTEGIDO |
| A22-04 | Cache de API | Antes de la mejora, respuestas API no llevaban `no-store`; información personalizada podía permanecer en cache HTTP configurado aguas abajo. Se aplica no-cache a todas las rutas `/api/`. | Baja | Test de caracterización previo y `test_api_responses_are_marked_no_store` posterior | CONFIRMADO — corregido |
| A22-05 | Abuso de registro | Antes no había cuota propia de altas: las peticiones inválidas no alcanzaban el límite general de 120/minuto. Se incorpora 10/h por IP anónima; el cache es por proceso. | Baja | Test de 10 fallos y bloqueo del intento 11 | CONFIRMADO — mitigado |
| A22-06 | Identidad de correo | El registro crea una cuenta sin verificar que la persona controle el buzón, y una dirección ya registrada recibe un mensaje distinto. Es posible reservar el correo de otra persona y facilitar enumeración; no permite acceder a su cuenta existente. | Baja | `RegisterSerializer.validate_email` y flujo `RegisterView` | CONFIRMADO — pendiente de flujo de verificación |
| A22-07 | Escalamiento del throttle | LocMemCache no comparte cuotas entre procesos/instancias y se pierde al reiniciar. Un despliegue horizontal necesita cache central antes de depender de cuotas como control fuerte. | Media antes de escalar | `settings.py` no define `CACHES`; no existe entorno multiinstancia para validar | REQUIERE VALIDACIÓN |
| A22-08 | Vulnerabilidades de Python | No se ejecutó inventario CVE de Python; la comprobación de consistencia de paquetes no equivale a uno. | — | `pip-audit` ausente | REQUIERE VALIDACIÓN |
| A22-09 | Git y secretos | No se pudo comprobar estado, historial ni remoto porque la carpeta no contiene repositorio Git. El `.gitignore` y el escaneo local no sustituyen la revisión de secretos trackeados. | — | `git status`/`git remote -v`: “not a git repository” | REQUIERE VALIDACIÓN |
| A22-10 | E2E navegador | Los 18 tests E2E no llegaron a abrir Chromium: Chrome terminó con `SIGABRT` durante `browserType.launch`. El guion sí utilizó una base temporal propia y ejecutó su limpieza. | — | salida de `scripts/test_e2e.py` | REQUIERE VALIDACIÓN — limitación del runner |

## Limitaciones

- La auditoría cubre el código local y pruebas disponibles; no es certificación, pentest ni revisión de producción.
- La actividad no proporcionó sus dos referencias académicas adicionales.
- No hay Git inicializado: no se puede emitir un diff histórico, estado de cambios ni URL de remoto.
- Chrome/Playwright fue incompatible con este runner en la ejecución E2E de esta actividad. La suite de backend sí ejecutó 38 pruebas contra una base aislada PostgreSQL.
- Las cuotas usan cache local, la verificación de ownership de correo no existe, y Python no tuvo un análisis de CVE disponible.
- La observación HTTP de Walmart raíz produjo 404 desde una ruta de red; no se generaliza a todos los puntos de presencia.
