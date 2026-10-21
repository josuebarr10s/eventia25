# 05 · Pruebas ejecutadas

Fecha de ejecución: **21 de octubre de 2026**, entorno local, zona `America/Guatemala`.

## Resultado

| Comprobación | Resultado |
| --- | --- |
| Django: `manage.py test tests --verbosity 2` | **34/34 correctas**, PostgreSQL 18, ninguna omitida |
| Playwright / Chrome · escritorio 1440 × 1000 | **6/6 correctas** |
| Playwright / Chrome · tableta 768 × 1024 | **6/6 correctas** |
| Playwright / Chrome · móvil táctil 390 × 844 | **6/6 correctas** |
| TypeScript + Vite: `npm run build` | Correcto; artefactos generados en `frontend/dist/` |
| Django: `manage.py check` | Sin problemas |
| Django: `makemigrations --check --dry-run` | Sin cambios pendientes |
| Comprobación de referencias Python (`ruff check --select F`) | Correcta |

Los 18 escenarios de navegador utilizan la API real y una base PostgreSQL temporal, con credenciales aleatorias solo en memoria. El servidor se reinicia entre tamaños para que la caché de límites de una tanda no afecte a otra. No se desactivan CSRF, permisos ni el límite de fallos de login para hacer pasar pruebas.

## Cobertura funcional del backend

En `backend/tests/test_mvp.py` se comprobaron:

- Registro correcto, hash de contraseña, contraseñas débiles, campos vacíos, correo duplicado y unicidad sin distinguir mayúsculas.
- Rechazo explícito de `role`, `is_staff`, `is_superuser`, `groups` y `user_permissions` en registro público; JSON con estructura inválida devuelve 400.
- Credenciales válidas e inválidas, mensaje genérico, correo sin distinguir mayúsculas, cinco fallos y bloqueo de 15 minutos.
- Cookies HttpOnly, alcance de ruta, SameSite, rotación de refresh, rechazo de reutilización, revocación al cerrar sesión y CSRF en los cuatro endpoints que mutan autenticación.
- Rutas privadas, eventos futuros publicados, búsqueda por nombre/categoría, paginación y borradores ocultos a visitantes y otros organizadores.
- Creación autorizada/denegada, `is_staff` insuficiente, propietario asignado por servidor, campos privilegiados rechazados y capacidad/fecha/categoría validadas.
- Edición del dueño, denegación a otro organizador, permiso global explícito, publicación por permiso y dueño, fecha pasada y reducción de capacidad bajo el número de inscritos.
- Inscripción correcta, cálculo de cupos, evento lleno, duplicado, restricción única en la base, borradores/eventos pasados e identidad no manipulable desde el cliente.
- Listado y detalle de inscripciones propios; 404 para la inscripción ajena, incluso enviando otro `user_id` como filtro.
- Correo posterior al commit, contenido de confirmación, ausencia de envío en fallo o rollback y preservación de inscripción ante fallo simulado del proveedor.

### Concurrencia real

`ConcurrentRegistrationTests` usa `TransactionTestCase`, dos hilos con conexiones PostgreSQL independientes y una barrera de salida simultánea. Para un evento publicado con capacidad 1, los resultados fueron **201 y 409**, con exactamente **una inscripción y una confirmación** persistidas. Esta prueba se ejecutó con bloqueo de fila real, no con SQLite ni un reemplazo del ORM.

## Navegador y revisión visual

Se repitieron seis flujos por tamaño: descubrimiento/búsqueda/categorías/vacío; registro → inscripción → cupos → recarga con refresh → inscripción propia → logout; creación → confirmación de publicación → edición persistida; errores de credenciales/correo duplicado; carga/error de API/recuperación; confirmación de abandono, Escape y navegación de teclado al contenido.

La prueba de carga/error intercepta únicamente la consulta del listado para provocar un 503 controlado; después quita la interceptación y comprueba la recuperación contra la API real. El resto de los flujos usa el servidor sin datos simulados en el frontend.

Se verifica ausencia de desbordamiento horizontal del documento en las pantallas cubiertas, persistencia tras recarga, ausencia de tokens en localStorage y ausencia de errores JavaScript en los flujos de descubrimiento e inscripción. Las capturas de inicio, detalle y gestión de los tres tamaños se revisaron visualmente. La gestión móvil transforma la tabla en filas apiladas con acciones visibles.

Contraste calculado con luminancia relativa sRGB: blanco/primario **6.62:1**, texto/fondo general **11.26:1**, primario/menta **5.47:1**, peligro/blanco **6.57:1**, advertencia/fondo de aviso **5.71:1**. Son verificaciones de estas combinaciones, no una certificación global de accesibilidad.

## Evidencias

- [Resultados del backend](evidencias/backend-tests.txt).
- [Resultado de escritorio](evidencias/pruebas-desktop.json), [tableta](evidencias/pruebas-tablet.json), [móvil](evidencias/pruebas-mobile.json).
- Capturas `evidencias/inicio-{desktop,tablet,mobile}.png`, `detalle-…` y `gestion-…`. Son datos de prueba/seed, no convocatorias reales.
- Informes HTML completos locales en `frontend/playwright-report/{desktop,tablet,mobile}/`.

## Límites de la comprobación

No se probaron SMTP externo, entrega a buzón real, Safari/Firefox, lectores de pantalla reales, carga sostenida, recuperación ante caída del proceso ni un despliegue de producción. El transporte de consola y el backend de correo en memoria sí se verificaron; no se afirma entrega externa. No se recibió infraestructura ni credenciales SMTP para ello.

Los fallos observados durante el desarrollo se corrigieron antes de esta ejecución final: pérdida de búsqueda al cambiar filtros, destino al cerrar sesión, validación de correo duplicado, foco inicial y acciones de gestión móvil. La primera ejecución de Chrome requirió permiso del entorno para iniciar el navegador; las ejecuciones registradas aquí sí completaron los escenarios.
