# Actividad 22 — Auditoría, controles y seguridad web de Eventia

**Fecha de trabajo:** 21 de octubre de 2026  
**Alcance:** revisión del código local, medidas preventivas y pruebas aisladas. Este informe no es una certificación de seguridad ni afirma que Eventia esté libre de vulnerabilidades.

## 1. Introducción

Se revisó Eventia, la aplicación existente para descubrir/publicar eventos y reservar cupos. Se mantuvo la arquitectura Django REST Framework, PostgreSQL y React; no se reconstruyó el producto ni se alteró su Design System. Se identificaron controles ya operativos, dos mejoras verificables y limitaciones que requieren seguimiento.

## 2. Investigación HTTPS

El 21 de octubre de 2026 a las 22:42 UTC se inspeccionaron, mediante navegador integrado, curl y cliente TLS Python con verificación de certificado:

| Aspecto | INTECAP | Walmart Guatemala |
|---|---|---|
| Dirección final | `https://intecap.edu.gt/` | `https://www.walmart.com.gt/` |
| HTTPS/certificado | HTTPS, verificación correcta; TLS 1.3 | HTTPS, verificación correcta; TLS 1.3 |
| SAN | `intecap.edu.gt`, `*.intecap.edu.gt` | Certificado de `www`: `www.walmart.com.gt`, `walmart.com.gt`; se observó otro certificado en la raíz |
| Emisor directo / vencimiento | Let's Encrypt `YR1`; 1-dic-2026 06:09:39 GMT | GlobalSign `GlobalSign GCC R46 OV TLS CA 2025`; certificado `www` vence 20-mar-2027 16:53:22 GMT |
| Redirección | HTTP devuelve 301 a HTTPS, final 200 | `https://walmart.com.gt/` redirige a `https://www.walmart.com.gt/`; `http://www...` devuelve 301 y final 200. La raíz HTTP respondió 404 desde el punto observado |
| HTTP de destino | HTTP/2, observado con `curl --http2` | HTTP/2, observado con `curl --http2` |

Se distingue el emisor directo del certificado de hoja de una CA raíz. No se guardaron capturas ni HAR de Network; el protocolo HTTP/2 se atribuye a curl, no al navegador. La respuesta HTTP 404 de la raíz Walmart puede variar por CDN o punto de presencia y no se generaliza. La [investigación HTTPS completa](01-INVESTIGACION-HTTPS.md) incluye las dos fechas de vencimiento y comandos de reproducción.

## 3. Riesgos OWASP

- **A01 Broken Access Control.** Puede permitir la edición de evento ajeno o la consulta de inscripción de otra cuenta. El servidor debe comprobar permiso y propiedad en cada acción y aislar recursos por el usuario autenticado. Los controles de Eventia se comprobaron en pruebas de objeto y función.
- **A03 Injection.** La inyección SQL altera la consulta; XSS ejecuta contenido en el navegador. Eventia usa el ORM en búsqueda y React JSX para mostrar descripciones. No se encontraron sumideros HTML inseguros en `frontend/src`; la prueba con sintaxis SQL devolvió cero filas.
- **A04 Insecure Design.** Las carreras, duplicados y sobrecupo pueden romper reglas aunque las solicitudes individuales parezcan válidas. Eventia usa transacción, bloqueo de fila y constraint único; la prueba concurrente PostgreSQL dejó una sola inscripción para el último cupo.

Fuentes oficiales: [OWASP A01](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/), [OWASP A03](https://top10.owasp.org/2021/A03_2021-Injection/) y [OWASP A04 en español](https://top10.owasp.org/2021/es/A04_2021-Insecure_Design/). La explicación desarrollada está en [investigación OWASP](02-INVESTIGACION-OWASP.md).

## 4. Auditoría real

El stack detectado es Python 3.13, Django 5.2.18, DRF 3.16.1, SimpleJWT 5.5.1, PostgreSQL/psycopg 3.3.6, React 19.3.1, TypeScript y Vite 7.3.7.

La autorización del backend requiere permisos explícitos y propiedad del recurso; las inscripciones se consultan por la identidad autenticada. Serializadores rechazan campos privilegiados y desconocidos, y validan fecha, capacidad y datos de alta. El modelo de contraseña usa los mecanismos de Django y sus validadores. El refresh token está en cookie HttpOnly de un día con rotación, revocación y CSRF; el access JWT vive cinco minutos. El buscador usa ORM y el frontend codifica el texto por renderizado React. Las cuotas de login y API usan el cache local del proceso. La auditoría npm reportó cero vulnerabilidades; `pip check` pasó, pero faltó `pip-audit`, por lo que no se afirma análisis CVE de Python.

Hallazgos confirmados: API sin `no-store` antes de esta actividad, límite demasiado amplio para altas públicas y ausencia de verificación del dominio de correo al crear una cuenta, con respuesta que permite distinguir correo ya registrado. No se halló bypass de autorización, inyección SQL/XSS reproducible ni sobrecupo en los escenarios probados. Quedan como pendientes operativos el cache compartido previo a escalar y la revisión de secretos en Git, porque no hay repositorio Git disponible.

La matriz solicitada, severidades, ocho aspectos y límites se documentan en [auditoría](03-AUDITORIA-EVENTIA.md).

## 5. Controles incorporados

1. **No cachear API:** middleware agrega `Cache-Control` preventivo (incluidos `private` y `no-store`) a respuestas bajo `/api/`. La prueba previa vio ausencia de la directiva; la posterior la confirma en GET autenticado. Se aplica también a API pública, lo cual evita el cache de contenido público hasta que se defina una política por endpoint.
2. **Throttle de registro:** scope `registration` con límite `10/hour` para altas anónimas. La prueba caracteriza primero que se aceptaban más de diez intentos inválidos por debajo de la cuota general; tras el cambio, el intento 11 válido devuelve 429 y no crea cuenta.

Se conservaron los flujos legítimos y no se añadieron dependencias ni migraciones. La cuota usa cache de proceso local y debe pasar a cache compartido al desplegar varias instancias.

## 6. Pruebas y evidencia

- Backend: 38/38 pruebas pasan contra base PostgreSQL de pruebas aislada y eliminada al final; incluye permisos, cookies/CSRF, alta, SQL literal, cantidad inválida y carrera concurrente.
- Django: `check` sin problemas; no se detectaron migraciones pendientes; `pip check` sin dependencias rotas.
- Frontend: `npm run build` pasa; `npm audit` informa 0 vulnerabilidades en el lock consultado.
- E2E: 18 tests de Playwright (desktop/tablet/mobile) no pudieron abrir Chrome, que finalizó con `SIGABRT` al iniciar. Resultado BLOQUEADO por runner; no se presentan como pruebas funcionales fallidas de la aplicación. El script usó una base aleatoria y su bloque de limpieza.
- HTTPS: certificados y respuestas observados en una sola fecha/ruta de red; no se conserva HAR ni imagen de DevTools.

Los comandos exactos y condiciones están en [pruebas de seguridad](05-PRUEBAS-SEGURIDAD.md).

## 7. Archivos modificados

Código: `backend/config/middleware.py`, `backend/config/settings.py`, `backend/users/views.py` y `backend/tests/test_mvp.py`. Documentación: los siete archivos de `docs/actividad-22/`. No se modificaron modelos, migraciones, dependencias, frontend ni Design System. El detalle y la prueba correspondiente por archivo están en [trazabilidad](06-ARCHIVOS-MODIFICADOS.md).

## 8. Conclusiones y pendientes

Las defensas de autorización y cupos ya existentes se sostienen en pruebas de servidor y PostgreSQL. Las nuevas cabeceras reducen el riesgo de retención HTTP de datos privados y el límite específico reduce abuso sencillo del endpoint de registro. Los riesgos residuales más claros son crear cuentas sin verificar control del correo, permitir enumeración de una dirección ya registrada, y usar cache local para cuotas. Hay que centralizar el cache antes de escalar, agregar verificación del correo con un flujo seguro, instalar y ejecutar un auditor Python de dependencias, repetir E2E en un host donde Chromium arranque y revisar el repositorio/historial cuando Git esté disponible.

No se encontraron los documentos fuente académicos `Actividad 22 P Web` y `Actividad 22 - Eventia y Seguridad Web`; el primero pegado en esta conversación sí se usó. La carpeta no es un repositorio Git (`git status` y `git remote -v` informaron “not a git repository”), así que no hay estado de cambios ni remoto verificable. No se inventó URL ni se hizo push.
