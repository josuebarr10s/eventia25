from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from events.models import Event
from users.models import User


class Command(BaseCommand):
    help = "Carga tres eventos de demostración identificados. Solo para desarrollo; es idempotente."

    def add_arguments(self, parser):
        parser.add_argument("--organizer", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        from django.conf import settings

        if not settings.DEBUG:
            raise CommandError("El seed de demostración requiere DJANGO_DEBUG=true.")
        try:
            organizer = User.objects.get(email__iexact=options["organizer"])
        except User.DoesNotExist as exc:
            raise CommandError("Crea primero el organizador.") from exc
        if not organizer.has_perm("events.add_event"):
            raise CommandError("La cuenta no tiene permisos para crear eventos.")
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
        self.stdout.write(
            self.style.SUCCESS(
                "Eventos de demostración disponibles; no se modificaron eventos existentes."
            )
        )
