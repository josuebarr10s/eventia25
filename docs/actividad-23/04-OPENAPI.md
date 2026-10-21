# Contrato OpenAPI

## Alcance

El archivo [openapi/eventia-security.yaml](openapi/eventia-security.yaml) documenta tres operaciones que sí existen hoy, con los nombres reales de ruta:

| Operación documentada | Correspondencia con el ejemplo de la consigna | Estado |
|---|---|---|
| `GET /api/registrations/{id}/` | Consulta segura de inscripción | Implementada; filtra por dueño |
| `POST /api/events/` | Crear evento | Implementada; requiere permiso de función y crea borrador |
| `POST /api/registrations/` | Inscripción con control de cupos | Implementada; acepta `event_id`, una plaza por cuenta, transacción y límite por usuario |

No se inventaron rutas `/api/inscripciones`, `/api/eventos` ni `/api/usuarios/{id}`. Las rutas del PDF son ejemplos académicos; el servidor local y las rutas inglesas se contrastaron con `backend/config/urls.py` y el router DRF.

## Seguridad del esquema

Las tres operaciones usan HTTP Bearer JWT para el **access token**, no el refresh. Un JWT válido aún debe satisfacer el permiso de función y de objeto. Los endpoints `/api/auth/*` continúan usando CSRF con cookie y se describen por separado en el rediseño; no se sustituyó la autenticación del producto por sesiones.

El servidor `http://127.0.0.1:8000` en YAML es de desarrollo local, no una URL publicada. No se conoce host productivo ni remoto Git. El YAML especifica campos permitidos, límites, enum de categorías, respuestas esperadas y muestras negativas.

## Validación y límites

Se verificaron sintaxis YAML, estructura OpenAPI 3.1.1, referencias internas y rutas/campos frente al código. Los resultados concretos y versión de validador están en [pruebas](07-PRUEBAS-Y-EVIDENCIAS.md). El contrato describe, no instala ni activa controles en el servidor. Rate limits usan cache local en este entorno y necesitan cache central para varias instancias.

Referencia: [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html).
