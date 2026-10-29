import os
import sys
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()


def _bootstrap_vercel_if_needed():
    if not os.getenv("VERCEL"):
        return
    try:
        from django.contrib.auth.models import Group, Permission
        from django.core.management import call_command
        from django.db import connection
        from django.utils import timezone
        from events.models import Event
        from users.models import User

        existing_tables = set(connection.introspection.table_names())
        if "users_user" not in existing_tables or "events_event" not in existing_tables:
            call_command("migrate", interactive=False, verbosity=0)

        demo_email = "organizador@eventia.demo"
        organizer = User.objects.filter(email__iexact=demo_email).first()
        if not organizer:
            group, _ = Group.objects.get_or_create(name="Organizadores")
            group.permissions.set(
                Permission.objects.filter(
                    content_type__app_label="events",
                    codename__in=[
                        "add_event",
                        "change_event",
                        "view_event",
                        "publish_event",
                    ],
                )
            )
            organizer = User.objects.create_user(
                email=demo_email,
                name="Equipo Eventia",
                password=os.getenv("EVENTIA_ORGANIZER_PASSWORD", "EventiaDemo2026!"),
            )
            organizer.groups.add(group)

        if not Event.objects.exists():
            samples = [
                (
                    "creative",
                    "Ideas que nos conectan",
                    "culture",
                    "Un encuentro para explorar la creatividad, compartir ideas y conectar con personas de tu comunidad. Evento de demostración, sin convocatoria real.",
                    "Centro cultural · Zona 4",
                    40,
                ),
                (
                    "music",
                    "Una tarde, muchas canciones",
                    "music",
                    "Una sesión cercana de música y conversación para disfrutar de nuevos sonidos. Evento de demostración, sin convocatoria real.",
                    "Espacio abierto · Zona 10",
                    60,
                ),
                (
                    "tech",
                    "Construyamos algo juntos",
                    "technology",
                    "Un taller para intercambiar experiencias y descubrir nuevas formas de crear con tecnología. Evento de demostración, sin convocatoria real.",
                    "Laboratorio creativo · Zona 14",
                    24,
                ),
            ]
            for index, (key, title, category, description, location, capacity) in enumerate(
                samples
            ):
                Event.objects.get_or_create(
                    demo_key=key,
                    defaults={
                        "title": title,
                        "description": description,
                        "category": category,
                        "starts_at": timezone.now() + timedelta(days=7 + index * 3),
                        "city": "Ciudad de Guatemala",
                        "location": location,
                        "capacity": capacity,
                        "organizer": organizer,
                        "status": Event.Status.PUBLISHED,
                    },
                )
    except Exception:
        pass


_bootstrap_vercel_if_needed()
app = application
