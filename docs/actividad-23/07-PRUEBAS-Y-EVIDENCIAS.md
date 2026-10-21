# Pruebas y evidencias

## Entorno seguro

La suite Django crea su propia base de datos de prueba y la destruye al terminar. El runner E2E crea un nombre de base temporal `eventia_e2e_*` y su bloque `finally` cierra procesos y ejecuta `DROP DATABASE ... WITH (FORCE)`, también si Playwright falla. No se enviaron solicitudes a un host externo ni se usaron credenciales reales. No se muestran secretos.

## Pruebas de API y regresión

| Prueba | Tipo | Resultado observado |
|---|---|---|
| `test_profile_api_exposes_only_current_user_allowlisted_fields` | Positiva y negativa, SEC-API6 | `GET /api/users/me/` devuelve allowlist; sin hashes/atributos administrativos; `/api/users/{id}/` no existe y responde 404. |
| `test_registration_rejects_privileged_fields` | Negativa, API2 | Campos `role`, `is_staff`, `is_superuser`, `groups`, `user_permissions` rechazados; no se crea cuenta privilegiada. |
| `test_only_authorized_organizer_creates_draft_with_server_owner`, `test_staff_label_alone_does_not_grant_creation`, `test_event_rejects_owner_status_and_other_unknown_fields`, `test_capacity_future_date_and_category_validation` | Positivas y negativas, API3 | Organizador habilitado crea borrador propio; participante/campos falsificados/capacidad o fecha inválidas se rechazan. |
| `test_owner_edits_other_organizer_denied`, `test_explicit_manage_all_permission_allows_other_event_edit` | Autorización de objeto | Dueño permitido; organizador ajeno denegado; solo permiso global explícito abre edición administrativa. |
| `test_only_own_registrations_are_listed_and_others_return_404` | BOLA A/B | La cuenta propia puede consultar; otra cuenta obtiene 404 y no recibe datos. |
| `test_duplicate_registration_and_database_uniqueness`, `test_two_connections_compete_for_last_spot`, `test_rollback_does_not_send_confirmation` | Integridad/concurrencia/rollback | Una inscripción por cuenta-evento; dos conexiones para el último cupo producen una reserva y un conflicto; rollback evita notificación. |
| `test_parallel_failures_cannot_bypass_login_attempt_limit` | Negativa concurrente, SEC-001 | 8 peticiones sincronizadas: 5 llegan a `authenticate` y reciben 401; 3 reciben 429. |
| `test_successful_login_resets_reserved_attempt_window` | Positiva, SEC-001 | 4 errores, login correcto y nuevo error: `401`, `200`, `401`; el éxito limpia el contador. |
| `test_event_registration_has_dedicated_per_user_limit` | Positiva/negativa, SEC-002 | 20 inscripciones legítimas devuelven 201; la 21.ª da 429 y no crea fila. |
| `test_parallel_registration_attempts_are_atomically_capped` | Negativa concurrente, SEC-002 | 40 reservas simultáneas: 20 permitidas, 20 rechazadas. |

La suite completa tras todas las modificaciones (incluida la actualización a DRF 3.17.2) terminó **43 pruebas, OK**. No se añade una suite independiente de navegador aprobada.

## Comprobaciones técnicas

| Comando/verificación | Resultado |
|---|---|
| Backend: `source ../.venv/bin/activate && python manage.py test` desde `backend/` | PASS, 43 tests. El mensaje de fallo de confirmación aparece en la prueba que simula error de correo; la suite termina OK. |
| `DJANGO_DEBUG=false python manage.py check --deploy` desde `backend/` | PASS, sin issues reportados. Es una comprobación local de Django, no certifica infraestructura real. |
| `python manage.py makemigrations --check --dry-run` | PASS, no migrations faltantes. |
| `python -m pip check` | PASS, dependencias sin conflictos. |
| Ruff focalizado `ruff check config/throttles.py users/views.py registrations/views.py tests/test_mvp.py --select F` | PASS. Se limita a errores de nombres/imports en archivos cambiados; no se afirma que todo el repo pase reglas estilísticas globales. |
| `npm run build` en `frontend/` | PASS, TypeScript + Vite; la interfaz no requirió cambios. |
| `npm audit --audit-level=low` en `frontend/` | PASS, cero vulnerabilidades reportadas en el lock frontend. |
| `pip-audit 2.10.1 -r backend/requirements.lock.txt` | PASS posterior al upgrade, “No known vulnerabilities found”. Anteriormente señaló dos advisories en DRF 3.16.1; tras 3.17.2 desaparecen. |
| OpenAPI con `openapi-spec-validator 0.9.0` | PASS, OpenAPI 3.1.1, tres operaciones y refs válidas. El validador se instaló solo en `/private/tmp`, sin añadir dependencia al proyecto. |

## Prueba de navegador bloqueada por entorno

`python scripts/test_e2e.py` terminó con error. Los **18 casos** de los perfiles desktop/tablet/mobile fallaron en `browserType.launch`: Chrome cerró con `SIGABRT` inmediatamente después del spawn (`kill EPERM` durante el cierre), antes de abrir una página o ejecutar una interacción de Eventia. El runner levantó su API/frontend local, y su `finally` detuvo procesos y eliminó la base temporal. Por eso se clasifica como **BLOCKED por el navegador**, no como regresión funcional confirmada. Para completar E2E, corregir/actualizar la instalación local de Chrome o la configuración del ejecutor Playwright y repetir.

## Límites de evidencia

- Las pruebas de concurrencia del throttle corren contra la caché local en el entorno actual; no prueban atomicidad distribuida entre procesos o hosts.
- La prueba del último cupo usa conexiones independientes contra PostgreSQL configurado para tests; pasa. No equivale a carga de producción.
- El `check --deploy` ejecutado desactiva DEBUG en configuración de Django, pero no observa proxy, DNS, TLS, Redis, WAF ni secretos de un despliegue.
- No se realizó prueba de carga ni pentest de infraestructura externa.
