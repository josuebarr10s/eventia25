from django.conf import settings
from django.db import models


class Registration(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="registrations"
    )
    event = models.ForeignKey(
        "events.Event", on_delete=models.PROTECT, related_name="registrations"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "event"], name="unique_user_event_registration"
            )
        ]

    def __str__(self):
        return f"Inscripción {self.pk} · evento {self.event_id}"
