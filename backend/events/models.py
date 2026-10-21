from django.conf import settings
from django.db import models


class Event(models.Model):
    class Category(models.TextChoices):
        CULTURE = "culture", "Arte y cultura"
        MUSIC = "music", "Música"
        TECHNOLOGY = "technology", "Tecnología"
        WELLNESS = "wellness", "Bienestar"
        COMMUNITY = "community", "Comunidad"

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        PUBLISHED = "published", "Publicado"

    title = models.CharField(max_length=180)
    description = models.TextField(max_length=10000)
    category = models.CharField(max_length=20, choices=Category.choices)
    starts_at = models.DateTimeField(db_index=True)
    city = models.CharField(max_length=120)
    location = models.CharField(max_length=255)
    capacity = models.PositiveIntegerField()
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="events"
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    demo_key = models.CharField(max_length=40, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["starts_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(capacity__gte=1), name="event_positive_capacity"
            )
        ]
        indexes = [
            models.Index(fields=["status", "starts_at"]),
            models.Index(fields=["category", "status"]),
        ]
        permissions = [
            ("publish_event", "Puede publicar sus eventos"),
            ("manage_all_events", "Puede gestionar eventos de otros organizadores"),
        ]

    def __str__(self):
        return self.title
