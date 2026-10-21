# 01 · MVP de Eventia

Eventia permite descubrir encuentros publicados, reservar un lugar con una cuenta y organizar eventos propios. La fase 1 es una aplicación funcional con persistencia PostgreSQL, no una maqueta.

Incluye registro de participantes, login/logout JWT con renovación, búsqueda persistida por nombre y categoría, detalle con disponibilidad, gestión privada del organizador, creación/edición de borradores, publicación explícita, inscripciones atómicas sin duplicados, consulta privada de inscripciones y confirmación por correo configurable.

Las cuentas organizadoras se crean mediante un comando seguro o se autorizan en Django Admin. Los permisos se comprueban en el servidor y por objeto. No se permite editar el propietario ni publicar enviando campos ocultos al formulario.

Se posponen pagos, cancelaciones, reembolsos, lista de espera, recomendaciones con IA, reseñas, analíticas avanzadas, aplicaciones nativas y evolución para 750 000 usuarios. El alcance permite completar el flujo principal con pocas dependencias y una arquitectura comprensible.

La referencia visual es `Eventia_Design_System.md`, conservada sin modificaciones. No se proporcionaron los documentos académicos adicionales mencionados en la solicitud; no se inventaron requisitos ni contenido de ellos. Este alcance sigue el último prompt de desarrollo integral desde cero.

Los ejemplos solo se cargan mediante `seed_demo`, se persisten y se identifican como demostración. La aplicación normal no inventa eventos ni métricas.
