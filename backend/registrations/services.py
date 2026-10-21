from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from events.models import Event
from notifications.models import Confirmation
from notifications.services import send_confirmation
from .models import Registration


class RegistrationConflict(APIException):
    status_code = 409
    default_code = "registration_conflict"


@transaction.atomic
def register_for_event(*, user, event_id):
    # All capacity-changing operations acquire this same row lock first.
    event = get_object_or_404(
        Event.objects.select_for_update(), pk=event_id, status=Event.Status.PUBLISHED
    )
    if event.starts_at <= timezone.now():
        raise ValidationError("Este evento ya comenzó y no admite inscripciones.")
    if Registration.objects.filter(user=user, event=event).exists():
        raise RegistrationConflict(
            "Ya tienes una inscripción confirmada en este evento."
        )
    if event.registrations.count() >= event.capacity:
        raise RegistrationConflict("Este evento ya no tiene cupos disponibles.")
    registration = Registration.objects.create(user=user, event=event)
    confirmation = Confirmation.objects.create(registration=registration)
    transaction.on_commit(lambda: send_confirmation(confirmation.pk), robust=True)
    return registration
