from rest_framework import serializers
from config.serializers import StrictSerializerMixin
from events.serializers import EventSerializer
from .models import Registration


class RegistrationCreateSerializer(StrictSerializerMixin, serializers.Serializer):
    event_id = serializers.IntegerField(min_value=1)


class RegistrationSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    status = serializers.SerializerMethodField()
    notification_status = serializers.CharField(
        source="confirmation.status", read_only=True
    )

    class Meta:
        model = Registration
        fields = ["id", "event", "created_at", "status", "notification_status"]

    def get_status(self, obj):
        return "confirmed"
