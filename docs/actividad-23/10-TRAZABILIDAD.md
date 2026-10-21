# Trazabilidad y aceptación — Actividad 23

## Archivos de código y configuración

| Archivo | Cambio |
|---|---|
| `backend/config/throttles.py` | Nuevo helper para reserva atómica en ventana temporal. |
| `backend/users/views.py` | Login reserva antes de autenticar, limita a cinco intentos por 15 minutos, responde 429/Retry-After y reinicia ante éxito. |
| `backend/registrations/views.py` | Nuevo throttle por cuenta y hora, aplicado solo a `POST` de inscripción. |
| `backend/config/settings.py` | Rate `event_registration=20/hour`; conserva los límites preexistentes. |
| `backend/requirements.txt` | Django REST Framework ahora requiere `>=3.17.2,<3.18`. |
| `backend/requirements.lock.txt` | Django REST Framework fijado en 3.17.2. |
| `backend/tests/test_mvp.py` | Cinco pruebas nuevas de perfil, login concurrente/reset y límite de inscripción secuencial/concurrente. |

## Matriz requisito → implementación → prueba

| ID | Requisito de la consigna | Evidencia de entrega | Verificación | Estado |
|---|---|---|---|---|
| R23-01 | Distinguir los siete escenarios académicos y aplicar OWASP API 2023 con justificación. | `01-AUDITORIA-SIETE-APIS.md` | Clasificación primaria/secundaria y refs OWASP; validada contra el enunciado. | CUBIERTO |
| R23-02 | Rediseñar las siete operaciones con contrato, autorización, validación, respuestas y casos de prueba. | `02-REDISENO-SEGURO.md` | Rutas reales contrastadas con `backend/config/urls.py`. | CUBIERTO |
| R23-03 | Cuatro roles y ocho operaciones, con condiciones y comparación al modelo real. | `03-MATRIZ-PERMISOS.md` | Matriz 4×8; capacidades no implementadas marcadas como futuras. | CUBIERTO |
| R23-04 | OpenAPI 3.1 de al menos tres operaciones reales. | `04-OPENAPI.md`, `openapi/eventia-security.yaml` | `openapi-spec-validator 0.9.0`: 3.1.1, 3 operaciones, refs válidas. | CUBIERTO |
| R23-05 | Auditoría del código real para las siete equivalencias, sin atribuirle defectos ficticios. | `05-AUDITORIA-CODIGO-REAL.md` | Código, inventario 63 unidades y tests; incluye estados, limitaciones y SCA. | CUBIERTO |
| R23-06 | Dos controles nuevos justificados, cada uno con caso positivo y negativo. | `06-CONTROLES-IMPLEMENTADOS.md`; `backend/config/throttles.py`, vistas y settings | Pre-fix login 8 verificaciones; post-fix 5/3. Inscripción 20/21 y carrera 20/20. | CUBIERTO |
| R23-07 | Suite, Django, migraciones y compatibilidad frontend tras modificaciones. | `07-PRUEBAS-Y-EVIDENCIAS.md` | 43 tests OK, `check --deploy`, migraciones, build y audit. E2E Chrome falla al iniciar. | PARCIAL |
| R23-08 | Cinco preguntas académicas con relación a Eventia y evolución de Actividad 21. | `08-PREGUNTAS-FINALES.md` | Respuestas vinculadas a rutas/modelos y arquitectura interna de Fase 2. | CUBIERTO |
| R23-09 | Informe final autónomo con análisis, solución, pruebas, referencias y limitaciones. | `09-INFORME-FINAL.md` | Incluye las secciones principales y conclusión. | CUBIERTO |
| R23-10 | Inspeccionar Git, remotos, archivos sensibles; no publicar sin permiso. | Este archivo, `.gitignore` | No hay `.git`; no fue posible obtener rama/remote/URL; no hubo push ni init. Pasos seguros al final. | CUBIERTO |

## Matriz final de aceptación

| Requisito de la Actividad 23 | Estado | Evidencia |
|---|---|---|
| Análisis de siete escenarios OWASP y consecuencias | CUMPLIDO | `01-AUDITORIA-SIETE-APIS.md` |
| Rediseño de siete operaciones y matriz 4×8 | CUMPLIDO | `02-REDISENO-SEGURO.md`, `03-MATRIZ-PERMISOS.md` |
| OpenAPI 3.1 con tres operaciones y validación real | CUMPLIDO | YAML validado por `openapi-spec-validator 0.9.0`; detalle en `07-PRUEBAS-Y-EVIDENCIAS.md`. |
| Auditoría diferenciada de Eventia real | CUMPLIDO | `05-AUDITORIA-CODIGO-REAL.md`; se distinguen escenarios ficticios, estados y riesgos residuales. |
| Dos controles de seguridad nuevos con pruebas positivas/negativas | CUMPLIDO | SEC-001 y SEC-002; suite completa 43/43 aprobada. |
| Integración de navegador y verificación visual | PARCIAL | El runner ejecutó 18 casos, pero Chrome terminó con `SIGABRT` antes de iniciar las páginas. Backend y build frontend sí pasan. |
| Informe autónomo y cinco respuestas académicas | CUMPLIDO | `09-INFORME-FINAL.md`, `08-PREGUNTAS-FINALES.md`. |
| Comprobación de Git/remoto y preparación de entrega | CUMPLIDO | Se verificó que no hay `.git`; se documentó la ausencia de rama/URL y un procedimiento seguro, sin inicializar ni publicar. |
| Validación de infraestructura de producción | PENDIENTE | No existe despliegue/proxy/Redis productivo accesible; revisar TLS, trusted proxy, cache central y monitoreo antes de producción. |

## Archivos de documentación entregados

- `01-AUDITORIA-SIETE-APIS.md`
- `02-REDISENO-SEGURO.md`
- `03-MATRIZ-PERMISOS.md`
- `04-OPENAPI.md`
- `openapi/eventia-security.yaml`
- `05-AUDITORIA-CODIGO-REAL.md`
- `06-CONTROLES-IMPLEMENTADOS.md`
- `07-PRUEBAS-Y-EVIDENCIAS.md`
- `08-PREGUNTAS-FINALES.md`
- `09-INFORME-FINAL.md`
- `10-TRAZABILIDAD.md`

## Estado de repositorio y entrega

La carpeta no contiene `.git`. Por eso no hay rama, historial, remote ni URL que puedan verificarse; no se inventó un enlace. `.gitignore` excluye `.env`, `.venv`, `frontend/node_modules/`, `frontend/dist/`, `.runtime/`, resultados de tests y logs. Como no hay metadatos Git, no puede comprobarse qué archivos se habían seguido anteriormente.

Pasos seguros para inicializarlo cuando se decida: (1) confirmar que esta carpeta es la raíz correcta; (2) revisar `.gitignore` y enumerar archivos candidatos sin leer valores del entorno; (3) inicializar Git solo cuando se decida y comprobar `git status --ignored`; (4) agregar de forma selectiva los archivos fuente/docs necesarios; (5) revisar `git diff --cached --name-only` y contenido antes de confirmar; (6) configurar un remote solo con la URL real del repositorio. No hacer push hasta contar con autorización explícita. Esta actividad no ejecutó ninguno de esos pasos de publicación.

## Pendiente concreto

Reparar o reemplazar Chrome del entorno Playwright y repetir el runner E2E (18 pruebas no pudieron iniciar navegador). Antes de despliegue con varias réplicas, migrar throttles a Redis compartido y validar proxy/IP confiable; decidir también si el alta debe ocultar existencia de correo según el flujo de producto.
