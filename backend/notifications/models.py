from django.db import models


class Confirmation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        SENT = "sent", "Aceptado por el servicio de correo"
        CONSOLE = "console", "Generado en consola de desarrollo"
        FAILED = "failed", "Error de envío"

    registration = models.OneToOneField(
        "registrations.Registration",
        on_delete=models.CASCADE,
        related_name="confirmation",
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )
    updated_at = models.DateTimeField(auto_now=True)
