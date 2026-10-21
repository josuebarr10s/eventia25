# Archivos modificados

## Código y pruebas

| Archivo | Módulo | Cambio realizado | Razón | Prueba que lo respalda |
|---|---|---|---|---|
| `backend/config/middleware.py` | Configuración / middleware | Añade `ApiNoStoreMiddleware`, que aplica encabezados de no-cache a respuestas `/api/`. | Evitar que navegadores o proxies HTTP conserven respuestas de API personalizadas. | `test_api_responses_are_marked_no_store` |
| `backend/config/settings.py` | Configuración Django/DRF | Registra el middleware y agrega el límite DRF `registration: 10/hour`. | Activar la política de cache segura y disponer de un scope específico de registro. | `manage.py check`, `makemigrations --check`; test de throttle |
| `backend/users/views.py` | Autenticación | Aplica `AnonRateThrottle` y `ScopedRateThrottle` al endpoint `RegisterView`, con scope `registration`. | Limitar el abuso automatizado de alta sin cambiar el flujo legítimo de creación. | `test_public_registration_has_dedicated_rate_limit` |
| `backend/tests/test_mvp.py` | Pruebas backend | Agrega pruebas para throttle de altas, cabeceras `no-store`, búsqueda con sintaxis SQL y campos `quantity` inválidos. | Mantener evidencia ejecutable de mejoras y controles preexistentes. | Suite completa, 38/38 PASS |

## Documentación nueva

| Archivo | Contenido |
|---|---|
| `docs/actividad-22/01-INVESTIGACION-HTTPS.md` | Verificación HTTPS, certificados, redirecciones, protocolos y límites de observación |
| `docs/actividad-22/02-INVESTIGACION-OWASP.md` | Riesgos A01, A03, A04 y referencias oficiales |
| `docs/actividad-22/03-AUDITORIA-EVENTIA.md` | Stack, método, ocho aspectos, matriz de hallazgos y límites |
| `docs/actividad-22/04-CONTROLES-IMPLEMENTADOS.md` | Estado anterior, dos mejoras y pruebas |
| `docs/actividad-22/05-PRUEBAS-SEGURIDAD.md` | Comandos, resultados, antes/después y limitaciones E2E |
| `docs/actividad-22/06-ARCHIVOS-MODIFICADOS.md` | Trazabilidad de código, tests y documentos |
| `docs/actividad-22/07-INFORME-FINAL.md` | Informe consolidado autocontenido |

No se cambiaron modelos, migraciones, librerías, archivos de diseño ni frontend. Los directorios de build, E2E y el entorno local están excluidos por `.gitignore`; no se presentan como archivos fuente modificados.
