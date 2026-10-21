# Pruebas de seguridad y regresión

## Entorno y privacidad

Backend ejecutado con el entorno virtual del proyecto y PostgreSQL local. Django creó `test_eventia` para la suite, pasó migraciones de prueba y eliminó esa base al terminar. La prueba de concurrencia usa dos conexiones PostgreSQL. El E2E se lanzó mediante `scripts/test_e2e.py`, que crea un nombre aleatorio de base temporal, levanta servidores locales y tiene una limpieza `DROP DATABASE ... WITH (FORCE)` en `finally`. No se apuntó a una base productiva ni se registraron secretos en este documento.

## Antes y después de las mejoras

| Prueba | Condiciones y objetivo | Antes | Después / resultado esperado | Estado y archivo |
|---|---|---|---|---|
| Cuota de registro | 11 POST desde `198.51.100.42`; primeros diez tienen contraseña débil; el último lleva contraseña válida. Verifica que un request bloqueado no cree usuario. | Caracterización: se enviaron 11 intentos inválidos desde la misma IP y los 11 respondieron 400; no se alcanzó el throttle general de 120/min. | Diez errores de validación siguen en 400; el undécimo, aun con datos válidos, responde 429, incluye `Retry-After` y no crea `blocked-register@example.test`. | PASS, posterior. `backend/tests/test_mvp.py::test_public_registration_has_dedicated_rate_limit` |
| Cache de respuesta privada | GET autenticado de `/api/registrations/`. Verifica no retener datos personalizados en cache HTTP. | Caracterización: respuesta 200 sin `Cache-Control: no-store`. | Respuesta 200 con `private` y `no-store`. | PASS, posterior. `test_api_responses_are_marked_no_store` |

Las caracterizaciones iniciales registran el comportamiento observado antes de modificar el código; no se insertó una vulnerabilidad ni se reportó una prueba negativa inventada.

## Otras pruebas ejecutadas

| Prueba | Objetivo | Resultado obtenido | Estado |
|---|---|---|---|
| `test_two_connections_compete_for_last_spot` | Dos usuarios compiten por el único cupo usando PostgreSQL concurrente. | Un registro 201, el otro conflicto 409; persiste un registro y una confirmación. | PASS |
| `test_only_own_registrations_are_listed_and_others_return_404` | Comprobar aislamiento por identidad del token. | Solo se lista el registro propio; acceso al ID ajeno da 404. | PASS |
| `test_owner_edits_other_organizer_denied`, `test_publish_requires_permission_and_ownership` | Comprobar autorización de objeto y función. | Organizador no edita/publica recurso ajeno; permiso global explícito sigue habilitado. | PASS |
| `test_search_treats_sql_syntax_as_literal_input` | Enviar `%27 OR 1=1 --` al buscador. | 200, cero coincidencias, sin cambio del filtro ni error SQL. | PASS |
| `test_registration_rejects_unexpected_zero_or_negative_quantity` | Enviar `quantity=0` y `quantity=-1` a la API que reserva una plaza por usuario. | Ambos 400; no se crea inscripción ni confirmación. | PASS |
| Suite completa `python manage.py test tests.test_mvp -v 2` | Regresión backend, auth, CSRF, validación, permisos, flujos y concurrencia. | 38 pruebas ejecutadas; “OK”; test DB destruida. | PASS |
| `python backend/manage.py check` | Verificar configuración Django normal. | “System check identified no issues (0 silenced).” | PASS |
| `python backend/manage.py makemigrations --check --dry-run` | Confirmar modelo y migraciones alineados. | “No changes detected”. | PASS |
| `python -m pip check` | Consistencia instalada del entorno Python. | “No broken requirements found.” | PASS; no es análisis CVE |
| `npm run build` | TypeScript y build de producción frontend. | Vite generó build exitoso. | PASS |
| `npm audit --json` | Riesgos conocidos en el árbol bloqueado npm. | 129 dependencias; 0 vulnerabilidades reportadas. | PASS al 21-oct-2026 |
| `python scripts/test_e2e.py` | Flujos de interfaz en desktop, tablet y mobile sobre DB aislada. | 18/18 pruebas no llegaron a arrancar: Google Chrome terminó `SIGABRT` en `browserType.launch` antes de abrir una página. El guion terminó con código 1 y ejecutó el bloque de limpieza de la DB temporal. | BLOQUEADO por entorno; requiere volver a ejecutar en runner con Chromium funcional |

## Comandos reproducibles

Desde la raíz del proyecto, con PostgreSQL del entorno local iniciado:

```sh
.venv/bin/python backend/manage.py test tests.test_mvp -v 2
.venv/bin/python backend/manage.py check
.venv/bin/python backend/manage.py makemigrations --check --dry-run
.venv/bin/python -m pip check
cd frontend && npm run build && npm audit --json
cd .. && source .venv/bin/activate && python scripts/test_e2e.py
```

En esta máquina, el primer intento de tests con Python global no pudo importar Django; se repitió correctamente con `.venv`. El intento E2E no se califica como defecto de Eventia porque el navegador no lanzó y ningún test pudo interactuar con la aplicación. `pip-audit` no estaba instalado, así que no se afirma cobertura de CVE de los paquetes Python. No se ejecutó prueba de penetración externa.
