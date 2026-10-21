import logging
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import Confirmation

logger = logging.getLogger(__name__)


def send_confirmation(confirmation_id):
    confirmation = Confirmation.objects.select_related(
        "registration__user", "registration__event"
    ).get(pk=confirmation_id)
    registration = confirmation.registration
    event = registration.event
    date = timezone.localtime(event.starts_at).strftime("%d/%m/%Y a las %H:%M")
    body = (
        f"Hola, {registration.user.name}:\n\nTu inscripción está confirmada.\n\n"
        f"Evento: {event.title}\nFecha: {date} (America/Guatemala)\n"
        f"Lugar: {event.location}, {event.city}\nNúmero de inscripción: {registration.pk}\n\n"
        "Puedes consultar los detalles en Mis inscripciones.\n\nNos vemos pronto,\nEl equipo de Eventia"
    )
    try:
        delivered = send_mail(
            f"Inscripción confirmada · {event.title}",
            body,
            settings.DEFAULT_FROM_EMAIL,
            [registration.user.email],
            fail_silently=False,
        )
        if delivered != 1:
            raise RuntimeError("El servicio no aceptó el mensaje.")
        confirmation.status = (
            Confirmation.Status.CONSOLE
            if "console.EmailBackend" in settings.EMAIL_BACKEND
            else Confirmation.Status.SENT
        )
    except Exception as exc:
        confirmation.status = Confirmation.Status.FAILED
        # No credentials, addresses or provider exception bodies in logs.
        logger.error(
            "Fallo de confirmación %s: %s", confirmation.pk, type(exc).__name__
        )
    confirmation.save(update_fields=["status", "updated_at"])
