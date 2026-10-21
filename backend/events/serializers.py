from django.utils import timezone
from rest_framework import serializers
from config.serializers import StrictSerializerMixin
from .models import Event
from .permissions import can_manage


class EventSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(
        source="get_category_display", read_only=True
    )
    organizer_name = serializers.CharField(source="organizer.name", read_only=True)
    registered_count = serializers.IntegerField(read_only=True)
    available_spots = serializers.SerializerMethodField()
    is_registered = serializers.BooleanField(read_only=True, default=False)
    can_edit = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()
    is_demo = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "category",
            "category_label",
            "starts_at",
            "city",
            "location",
            "capacity",
            "organizer_name",
            "status",
            "created_at",
            "registered_count",
            "available_spots",
            "is_registered",
            "can_edit",
            "can_publish",
            "is_demo",
        ]

    def get_available_spots(self, obj):
        return max(0, obj.capacity - obj.registered_count)

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(request and can_manage(request.user, obj))

    def get_can_publish(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user.has_perm("events.publish_event")
            and (
                obj.organizer_id == request.user.pk
                or request.user.has_perm("events.manage_all_events")
            )
        )

    def get_is_demo(self, obj):
        return obj.demo_key is not None


class EventWriteSerializer(StrictSerializerMixin, serializers.ModelSerializer):
    capacity = serializers.IntegerField(min_value=1, max_value=1000000)

    class Meta:
        model = Event
        fields = [
            "title",
            "description",
            "category",
            "starts_at",
            "city",
            "location",
            "capacity",
        ]

    def validate_starts_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Selecciona una fecha y hora futuras.")
        return value

    def validate(self, attrs):
        if self.instance:
            if self.instance.starts_at <= timezone.now():
                raise serializers.ValidationError(
                    "Los eventos que ya comenzaron no se pueden editar."
                )
            count = self.instance.registrations.count()
            if attrs.get("capacity", self.instance.capacity) < count:
                raise serializers.ValidationError(
                    {
                        "capacity": "La capacidad no puede ser menor que las inscripciones confirmadas."
                    }
                )
        return attrs
