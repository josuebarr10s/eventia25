# Controles de seguridad implementados

Se implementaron dos mejoras preventivas en backend. Ninguna cambia el diseño del producto ni su modelo de datos.

## 1. Respuestas de API con `no-store`

| Elemento | Descripción |
|---|---|
| Problema identificado | La prueba de caracterización previa observó que un GET autenticado a `/api/registrations/` respondía 200 sin `Cache-Control: no-store`. Un navegador o intermediario mal configurado podría conservar información personalizada. No se demostró una fuga; se confirmó ausencia de una directiva preventiva. |
| Riesgo OWASP relacionado | A01:2021, confidencialidad y exposición de objetos privados; defensa en profundidad para datos personales. |
| Estado anterior | El endpoint privado no marcaba `private`/`no-store`. |
| Corrección aplicada | `ApiNoStoreMiddleware` aplica `add_never_cache_headers` a las respuestas cuyo path comienza por `/api/`; se registra tras `SecurityMiddleware`. |
| Archivos | `backend/config/middleware.py`, `backend/config/settings.py`. |
| Prueba realizada | Test de caracterización anterior, seguido de `test_api_responses_are_marked_no_store` con usuario autenticado. |
| Resultado | La respuesta posterior es 200 y contiene `no-store` y `private`. Funcionalidad de lectura conservada. |

El middleware incluye todos los endpoints API, también respuestas públicas, lo cual reduce la posibilidad de cache HTTP y aumenta las solicitudes al servidor. Si en el futuro se introduce cache de contenido público, se deberá definir una política explícita por endpoint que preserve las respuestas personalizadas.

## 2. Límite dedicado para altas públicas

| Elemento | Descripción |
|---|---|
| Problema identificado | El registro público estaba sujeto solo a la cuota anónima general de 120 peticiones/minuto. La prueba inicial envió 11 solicitudes inválidas desde una misma IP y no obtuvo 429. Esto no era una explotación de autorización, pero dejaba el alta pública sin una cuota específica. |
| Riesgo OWASP relacionado | A04:2021, abuso de recursos previsto de forma insuficiente; mitigación complementaria frente a automatización. |
| Estado anterior | No existía scope de throttle exclusivo para registro. |
| Corrección aplicada | `RegisterView` combina throttling anónimo con `ScopedRateThrottle` y el scope `registration`; settings fija `10/hour`. El throttle se ejecuta antes de validar y crear usuario. |
| Archivos | `backend/users/views.py`, `backend/config/settings.py`. |
| Prueba realizada | `test_public_registration_has_dedicated_rate_limit`: diez envíos inválidos desde IP fija consumen cuota; el intento 11 con una contraseña válida recibe 429, `Retry-After` y no crea usuario. |
| Resultado | El endpoint devuelve 400 en intentos inválidos dentro de cuota y 429 al excederla; no se creó la cuenta bloqueada. |

El scope identifica a usuarios anónimos por IP mediante DRF y usa el cache configurado. La configuración actual es local al proceso; antes de escalar horizontalmente debe migrarse a cache compartido y confirmarse el tratamiento de IP real detrás del proxy. El throttle estándar es una defensa de aplicación, no un firewall ni garantía contra clientes distribuidos.

## Controles preexistentes validados

No se atribuyen estos controles a los cambios de esta actividad:

- Los permisos de modificación/publicación se aplican en backend y verifican rol más propiedad del evento o permiso global.
- Inscripciones consultadas se filtran por el usuario autenticado; ID ajeno devuelve 404.
- La inscripción bloquea la fila del evento dentro de transacción, valida duplicado/capacidad y usa constraint único en base de datos.
- Los serializers rechazan propiedades privilegiadas y desconocidas.
- JWT de acceso breve, refresh HttpOnly, rotación, revocación al logout, CSRF en endpoints de cookie y hash de contraseñas son previos.

Los resultados reproducibles están en [pruebas de seguridad](05-PRUEBAS-SEGURIDAD.md); el código detallado, en [archivos modificados](06-ARCHIVOS-MODIFICADOS.md).
