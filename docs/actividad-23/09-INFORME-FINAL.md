# Eventia — Actividad 23
## De una API insegura a un diseño seguro

**Programación Web · Informe académico**  
**Fecha:** 21 de octubre de 2026  
**Proyecto:** Eventia, monolito modular Django REST Framework + PostgreSQL y frontend React/TypeScript.

## 1. Introducción y alcance

La actividad distingue los siete escenarios inseguros presentados por el enunciado del comportamiento real de Eventia. La guía oficial “Actividad 23 P Web” define los requisitos. “Actividad 23” se utilizó solamente como referencia académica: describe otra implementación y sus rutas/resultados no se atribuyeron a este proyecto.

Se inspeccionaron rutas, serializers, permisos, modelos, servicio transaccional de inscripción, middleware, configuración, dependencias y pruebas. El inventario estático registra 63 unidades Python. Las pruebas escribieron únicamente en bases de datos de test o temporales. No se leyó ni incluyó ningún secreto.

## 2. Auditoría de los siete escenarios

| API | Defecto y consecuencia | OWASP API Security 2023 principal | Control correcto |
|---|---|---|---|
| 1. Consultar inscripción | ID sin titular; lectura horizontal y datos personales expuestos. | API1 BOLA; API3 si las propiedades exceden lo necesario. | Filtrar por dueño/permiso de objeto y usar serializer allowlist; 404 para objeto ajeno. |
| 2. Registrar usuario | Rol de administrador asignable por cliente y contraseña débil; escalada pública/toma de cuenta. | API3 BOPLA; API2 como riesgo de credenciales. | Rechazar campos extra, rol básico del servidor, validadores de contraseña, hash seguro y control de altas. |
| 3. Crear evento | Usuario común crea evento; capacidad/precio negativos dañan dominio. | API5 BFLA por falta de permiso de función. | Permiso `add_event`, organizador derivado del actor y validación de capacidad/fecha. El precio es ficticio: Eventia no lo modela. |
| 4. Editar evento | Valida rol, pero no pertenencia del evento; sobrescritura ajena. | API1 BOLA. | Comprobar permiso y `organizer_id` en cada modificación; administración global explícita. |
| 5. Inscribirse | Cantidad excesiva y reserva vulnerable a automatización/carrera. | API6 Sensitive Business Flows; API4 si consume recursos. La carrera también se describe como CWE-362. | Una plaza por cuenta, límite de flujo, bloqueo transaccional y unicidad de base de datos. |
| 6. Consultar usuarios | Respuesta incluye hash/propiedades privadas. | API3 BOPLA; API1 si permite perfil ajeno por ID. | Ruta `/me`, allowlist de salida y permisos administrativos explícitos. |
| 7. Login | Intentos ilimitados y mensajes diferenciados; fuerza bruta y enumeración. | API2 Broken Authentication; API4 puede aplicar al consumo. | Respuesta uniforme, contadores temporales atómicos, 429/Retry-After y observabilidad. |

API1, API2, API3, API4, API5 y API6 corresponden al **OWASP API Security Top 10 2023**, no al Top 10 web de 2021. La asignación evita llamar “API4” a toda validación de negocio o “API6” a toda carrera. El análisis, los siete contratos y la explicación de las categorías están desarrollados en [auditoría](01-AUDITORIA-SIETE-APIS.md) y [rediseño](02-REDISENO-SEGURO.md).

## 3. Rediseño y autorización

El diseño detallado cubre las siete operaciones con método/ruta real, actor, entrada, reglas, autorización, errores, ejemplos válidos/inválidos y pruebas. Las rutas reales usan `/api/`, idioma inglés y barra final. El proyecto expone JWT Bearer para access token, refresh cookie HttpOnly, CSRF para operaciones basadas en cookie, permisos Django y serializer estricto. No se migró autenticación ni se agregaron endpoints ficticios.

La matriz de ocho operaciones concede lectura pública de eventos; reserva a cuentas autenticadas; edición únicamente a propietario con permiso, salvo permiso administrativo global; e inscripciones propias al titular. La consulta de asistentes para organizador y administración REST de usuarios se marcan como capacidades propuestas, todavía no implementadas. “Visitante/registrado/organizador/administrador” es una abstracción didáctica: el código usa permisos Django, ausencia de autenticación y superusuario, no un enum de cuatro roles.

## 4. Contrato OpenAPI

`openapi/eventia-security.yaml` documenta tres operaciones existentes y verificadas:

1. `GET /api/registrations/{id}/` — lectura propia con 404 para objeto ajeno.
2. `POST /api/events/` — creación por `events.add_event`, con dueño y borrador definidos por servidor.
3. `POST /api/registrations/` — una inscripción por cuenta, transacción y límite adicional.

El contrato declara OpenAPI 3.1.1, esquemas, errores, Bearer JWT, límites y ejemplos negativos. `openapi-spec-validator 0.9.0` lo validó con tres operaciones y referencias internas correctas. El host YAML es `127.0.0.1`, solo desarrollo; no se infirió URL productiva.

## 5. Auditoría de Eventia real

| Escenario | Resultado comprobado en el código real |
|---|---|
| Inscripciones ajenas | **PROTEGIDO:** queryset restringido al titular; detalle ajeno 404. |
| Rol falsificado al registrar | **PROTEGIDO:** serializer permite solo nombre/correo/contraseña; campos adicionales se rechazan. |
| Crear evento sin permiso | **PROTEGIDO:** `events.add_event`; actor del servidor; borrador; capacidad 1–1,000,000 y fecha futura. |
| Editar evento ajeno | **PROTEGIDO:** permiso y propietario o `manage_all_events`; solo PATCH. |
| Acaparar cupos | **PROTEGIDO con límites:** transacción y unicidad ya existentes; se agregó límite por cuenta. |
| Leer perfil/hash | **PROTEGIDO:** solo `/api/users/me/`, serializer allowlist; sin endpoint de perfil por ID. |
| Login automatizado | **PARCIALMENTE PROTEGIDO:** ventana atómica reparada; queda dependencia de cache local e IP directa. Login usa mensajes uniformes; alta pública todavía revela que un correo ya existe. |

El SCA también encontró la dependencia DRF 3.16.1 dentro del rango afectado por dos avisos oficiales: tamaño de `request.data` y `AdminRenderer`. Se actualizó a 3.17.2, versión parcheada, y el nuevo `pip-audit` no detectó vulnerabilidades en el lock. `AdminRenderer` no estaba configurado; el tamaño de cuerpo sí correspondía a parsers de entrada JSON. El detalle de pruebas, estados y límites está en [auditoría real](05-AUDITORIA-CODIGO-REAL.md).

## 6. Mejoras y pruebas

**SEC-001 — Login atómico:** se detectó y reprodujo antes del cambio una carrera: 8 peticiones paralelas llegaban a `authenticate`. La reserva del contador ahora ocurre antes de validar la contraseña. Después pasan cinco (401) y tres reciben 429; un login correcto limpia la ventana.

**SEC-002 — Inscripciones limitadas por cuenta:** se agregó un throttle atómico de 20 intentos por hora UTC al POST de inscripción. Veinte solicitudes legítimas terminan en 201; la 21.ª recibe 429 sin insertar; la prueba concurrente concede 20 de 40.

**SEC-003 — Dependencia parcheada:** DRF 3.16.1 se actualizó a 3.17.2 en requisito y lock. No cuenta como uno de los dos controles de flujo; es una corrección adicional de cadena de suministro.

La suite completa reportó **43 pruebas aprobadas**. Pasaron `check --deploy`, comprobación de migraciones, `pip check`, Ruff focalizado, `npm run build`, `npm audit` (cero advisories), `pip-audit` (ninguna vulnerabilidad conocida después del upgrade) y validación OpenAPI. El E2E Playwright quedó bloqueado: 18 casos no iniciaron Chrome (`SIGABRT`) antes de abrir la aplicación; no se atribuye a una falla de Eventia.

## 7. Respuestas académicas

1. API2 de registro con rol administrador sería el mayor riesgo académico: es pública y puede entregar privilegio persistente; API1 también causa exposición horizontal. En Eventia no se reproduce el campo de rol.
2. JWT autentica una identidad tras validar token; la API todavía debe autorizar función, objeto y propiedades.
3. Validar capacidad/fecha/campos demuestra que la entrada es coherente; autorizar demuestra que el actor puede hacer ese cambio sobre ese evento.
4. OpenAPI describe el contrato. Solo middleware, permisos, filtros y pruebas del servidor hacen cumplir la seguridad.
5. La evolución a cinco años de la Actividad 21 recomienda primero un monolito modular con workers, caché compartida y outbox; extracción selectiva después de medir. PostgreSQL conserva autoridad sobre cupos; reintentos necesitan idempotencia y datos transaccionales, mientras notificaciones/reportes pueden ser asíncronos.

## 8. Conclusiones, riesgos y pendientes

Las fallas académicas de autorización, mass assignment, cupos y exposición de perfiles no se encontraron en los endpoints equivalentes del proyecto. Sí se confirmó una carrera en el contador de login y una dependencia vulnerable; ambas quedaron corregidas y cubiertas con validación posterior. La cuota específica de inscripción es preventiva, no una explotación previa inventada.

Persisten tres límites relevantes: caché local no comparte cuotas entre réplicas; el registro público puede enumerar correos existentes; no se verificaron proxy/TLS/Redis/infraestructura productiva. Playwright requiere corregir el Chrome del ejecutor para completar la comprobación visual. El directorio no contiene `.git`, por lo que no existen rama, commit, remoto o URL verificables; no se inicializó ni publicó repositorio.

## 9. Referencias

- `Actividad 23 P Web (1).pdf` — consigna oficial adjunta a la actividad. `Actividad 23 (1).pdf` — informe anterior utilizado solo como referencia de análisis, no como evidencia del código.
- [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/), [API1](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/), [API2](https://api-security.owasp.org/editions/2023/en/0xa2-broken-authentication/), [API3](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/), [API4](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), [API5](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/) y [API6](https://api-security.owasp.org/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/).
- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html).
- Django REST Framework: [aviso de límite de cuerpo GHSA-2m8g-3cmr-wg3w](https://github.com/encode/django-rest-framework/security/advisories/GHSA-2m8g-3cmr-wg3w), [aviso AdminRenderer GHSA-g47c-3xmw-q6m2](https://github.com/encode/django-rest-framework/security/advisories/GHSA-g47c-3xmw-q6m2) y [notas de versión](https://www.django-rest-framework.org/community/release-notes/).
- Documentación interna de evolución: [docs/fase-2/03-EVOLUCION-ARQUITECTONICA.md](../fase-2/03-EVOLUCION-ARQUITECTONICA.md) y [docs/06-PREPARACION-FASE-2.md](../06-PREPARACION-FASE-2.md).
