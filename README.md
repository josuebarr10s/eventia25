# Eventia

Plataforma para descubrir, publicar y reservar un lugar en eventos. MVP real de la fase 1: Django + API REST + React + PostgreSQL. La identidad visual proviene exclusivamente de [Eventia_Design_System.md](Eventia_Design_System.md).

## Requisitos

- Python 3.13 recomendado (Django 5.2).
- Node.js 22.12 o posterior; se utilizó Node 24.
- PostgreSQL 18, instalado localmente o mediante Docker Compose.
- Chrome para las pruebas de navegador.

## Instalación

Desde esta carpeta:

```sh
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Pega el resultado en `DJANGO_SECRET_KEY` de `.env`. Define una contraseña propia en `POSTGRES_PASSWORD`. `.env`, `.venv`, los datos de PostgreSQL y los artefactos de ejecución están excluidos del control de versiones. No hay contraseñas predeterminadas.

```sh
cd frontend
npm ci
cd ..
```

### PostgreSQL con Docker

Con Docker iniciado y `.env` configurado:

```sh
docker compose up -d db
python backend/manage.py migrate
```

El servicio escucha solo en `127.0.0.1` y utiliza un volumen persistente. No borres el volumen para reiniciar la aplicación.

### PostgreSQL ya instalado

Crea una base `eventia` y un usuario con contraseña mediante las herramientas de PostgreSQL. Para desarrollo y pruebas, el usuario necesita poder crear bases de prueba (`CREATEDB`). Completa `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST` y `POSTGRES_PORT` en `.env`, y ejecuta las migraciones. No se utiliza SQLite como sustituto: la integridad concurrente se valida con PostgreSQL real.

En el entorno de entrega se preparó una instancia de desarrollo aislada en `.runtime/postgres`, puerto **55439**, configurada en el `.env` local. No modifica otras bases. En macOS con la instalación utilizada, se puede volver a iniciar así si está detenida:

```sh
/opt/homebrew/opt/postgresql@18/bin/pg_ctl -D .runtime/postgres -l .runtime/postgres.log -o '-h 127.0.0.1 -p 55439 -k /private/tmp' start
```

Esta instancia utiliza confianza local y es exclusivamente de desarrollo. No se debe exponer a la red ni reutilizar en producción. Para otra máquina, prepara PostgreSQL con las opciones anteriores.

## Organizador y datos opcionales

```sh
python backend/manage.py create_organizer --email tu-correo@example.com --name "Tu nombre"
```

Solicita y confirma la contraseña sin mostrarla; aplica los validadores de Django. El comando crea una cuenta nueva y el grupo `Organizadores`, con permisos `events.add_event`, `events.change_event`, `events.view_event` y `events.publish_event`. No convierte silenciosamente cuentas existentes ni concede acceso al administrador. Para automatización puedes proporcionar `EVENTIA_ORGANIZER_PASSWORD` en el entorno, nunca como argumento ni en el código.

La aplicación comienza sin eventos. Para cargar ejemplos persistidos, claramente marcados como **Demostración**:

```sh
python backend/manage.py seed_demo --organizer tu-correo@example.com
```

El seed es idempotente, solo funciona con `DJANGO_DEBUG=true` y no modifica eventos existentes. Los datos se crean únicamente mediante este comando, nunca desde un arreglo del frontend.

En esta entrega se ejecutó explícitamente el seed local. Las credenciales aleatorias de la cuenta organizadora de demostración están en `.runtime/ACCESO_DEMO.txt`, un archivo local privado, excluido del control de versiones. No existe una contraseña predeterminada en el código. Puedes crear cuentas participantes desde la interfaz o tu propio organizador con el comando anterior.

Para gestionar cuentas y asignar permisos explícitos:

```sh
python backend/manage.py createsuperuser
```

El administrador está en [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/). Los eventos e inscripciones son de lectura en Admin para preservar las invariantes; se gestionan desde la interfaz y los servicios de negocio. `is_staff` por sí solo no autoriza la creación ni la edición de eventos. Un administrador puede gestionar eventos ajenos por sus permisos explícitos/superusuario; los organizadores solo los propios.

## Ejecutar

Dos terminales desde la raíz, con el entorno Python activado y PostgreSQL iniciado:

```sh
python backend/manage.py runserver 127.0.0.1:8000
```

```sh
cd frontend
npm run dev
```

Abre [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite redirige `/api/` al backend; se mantiene el mismo origen para las cookies y CSRF. Usa consistentemente `127.0.0.1` o `localhost`, sin alternarlos durante una sesión.

### Flujo de uso

1. El organizador inicia sesión, entra a **Mis eventos** y guarda un borrador.
2. Revisa el detalle y confirma **Publicar** en Mis eventos.
3. Un visitante encuentra el evento por nombre o categoría.
4. Crea una cuenta participante, vuelve al evento y pulsa **Inscribirme**.
5. El lugar queda reservado y aparece en **Mis inscripciones**.

La fecha de los eventos se introduce y muestra en `America/Guatemala` (UTC−6); se persiste con zona horaria. Cada inscripción ocupa un cupo. No hay pagos, cancelaciones ni listas de espera en este MVP.

## Correo

Por defecto se usa `django.core.mail.backends.console.EmailBackend`: el mensaje se imprime en la terminal del backend. La interfaz indica este hecho; **no significa entrega externa**.

Para SMTP, configura en `.env`:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.tu-proveedor.example
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=Eventia <tu-remitente@example.com>
```

El envío sucede después del commit. El estado queda en `notifications.Confirmation`: pendiente, consola, aceptado por el servicio o fallido. Un fallo de SMTP conserva la inscripción. No se implementó una cola ni un reintento automático; el estado es consultable en Admin. La aceptación por SMTP tampoco acredita recepción en el buzón.

## Pruebas y compilación

```sh
cd backend
../.venv/bin/python manage.py test tests --verbosity 2
../.venv/bin/python manage.py makemigrations --check --dry-run
../.venv/bin/python manage.py check
cd ../frontend
npm run build
cd ..
.venv/bin/python scripts/test_e2e.py
```

El último comando prepara una **base PostgreSQL temporal independiente**, crea credenciales aleatorias en memoria, carga el seed, inicia servidores de prueba en 8001/5174 y ejecuta Playwright en Chrome a 1440, 768 y 390 px. Al terminar cierra sus servidores y elimina únicamente su base temporal. Necesita permiso para iniciar Chrome y crear bases en PostgreSQL. No usa ni borra los eventos de la base habitual.

Las capturas y resultados JSON se guardan en `docs/evidencias/`, los informes HTML por tamaño en `frontend/playwright-report/` y las trazas de fallos en `frontend/test-results/`. Cada tamaño comienza con una caché de servidor nueva para respetar sus límites reales de solicitudes. Los logs temporales están en `.runtime/e2e/`. Consulta [docs/05-PRUEBAS.md](docs/05-PRUEBAS.md) para resultados y alcance.

## Autenticación y configuración

- Access JWT de 5 minutos en memoria de React; ningún token se escribe a localStorage/sessionStorage.
- Refresh de 1 día en cookie HttpOnly, SameSite=Lax y restringida a `/api/auth/`.
- Renovación con rotación y lista de revocación. Login, registro, refresh y logout exigen CSRF.
- Las mutaciones de negocio utilizan el JWT en `Authorization: Bearer`, nunca la cookie de refresh como credencial de API.
- Logout revoca el refresh y elimina el acceso en memoria. Un access token previamente copiado puede seguir válido hasta su expiración de 5 minutos.
- Cinco fallos de login por IP directa bloquean nuevos intentos durante 15 minutos desde el último fallo. El contador usa caché local al proceso, apropiada para este entorno de desarrollo; requiere almacenamiento compartido y revisión del proxy antes de un despliegue multiproceso.
- El servidor rechaza campos desconocidos/privilegiados en registro y escritura de eventos.

`DJANGO_DEBUG=false` es el valor predeterminado: activa cookies Secure, redirección HTTPS y HSTS. El `.env.example` habilita explícitamente desarrollo HTTP local. Nunca utilices `runserver` ni Vite de desarrollo como servidores de producción. Esta fase no incluye despliegue. El contrato HTTP y la integración de servidor estático/HTTPS están documentados en `docs/07-API.md` y `docs/06-PREPARACION-FASE-2.md`.

## Estructura

```text
backend/
  config/          Configuración, rutas y errores comunes
  users/           Usuarios, JWT, administración y organizadores
  events/          Modelos, validación, permisos, publicación y seed
  registrations/   Inscripciones y transacción de cupos
  notifications/   Confirmaciones por correo después del commit
  tests/           Pruebas funcionales y de concurrencia
frontend/
  src/             Pantallas, componentes, autenticación y tokens CSS
  e2e/             Pruebas de navegador en tres tamaños
scripts/           Infraestructura aislada para pruebas E2E
docs/              MVP, arquitectura, dependencias, flujo y evidencias
```
