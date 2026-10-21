# 06 · Preparación de fase 2

La base real construida es un monolito Django modular, PostgreSQL único y cliente React estático. La inscripción se serializa por evento mediante bloqueo de fila. El conteo se deriva de las inscripciones, con índices y restricciones relacionales. El correo se ejecuta sincrónicamente después del commit y persiste su estado.

Limitaciones que sirven de entrada para el análisis futuro:

- Un evento muy concurrido concentra esperas en una fila; es correcto para integridad, pero debe medirse su latencia antes de cambiar el mecanismo.
- El correo puede prolongar la respuesta hasta el timeout de 10 segundos; no hay entrega garantizada, reintento automático ni worker. Una interrupción puede dejar mensajes pendientes.
- El bloqueo de login y los límites DRF usan caché local al proceso. Un despliegue multiproceso necesita almacenamiento compartido y una política de IP/proxy verificada.
- El refresh se rota y revoca, pero un access JWT copiado conserva validez máxima de 5 minutos después del logout. No hay revocación instantánea de accesos ni recuperación de contraseña/verificación de correo.
- No hay infraestructura de despliegue, observabilidad externa, pruebas de carga, copias de seguridad automáticas ni alta disponibilidad. Antes de producción se necesitan HTTPS, servidor WSGI/ASGI, servidor de estáticos con fallback SPA, secreto persistente, hosts/orígenes exactos y revisión de `check --deploy` en la configuración efectiva.
- La búsqueda usa `icontains`, la categoría tiene opciones predefinidas y la zona horaria del producto es Guatemala; medir y evaluar requisitos futuros antes de añadir índices de texto o internacionalización.
- Los correos y las descripciones se presentan como texto, sin HTML arbitrario. No hay subida de imágenes ni almacenamiento adicional.

Para el escenario académico de cinco años se deberán estimar carga y concurrencia, medir el flujo, revisar transporte de notificaciones, consultas, operaciones, seguridad e infraestructura. Aquí solo se documentan los puntos de evaluación: **no se implementó la evolución para 750 000 usuarios**.

No se incluyen pagos, recomendaciones, reseñas o analíticas avanzadas. No se creó un contrato hipotético atribuyéndolo a rutas existentes: `07-API.md` documenta únicamente las operaciones implementadas.
