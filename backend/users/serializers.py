from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from config.serializers import StrictSerializerMixin
from .models import User


class UserSerializer(serializers.ModelSerializer):
    can_create_events = serializers.SerializerMethodField()
    can_edit_events = serializers.SerializerMethodField()
    can_publish_events = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "can_create_events",
            "can_edit_events",
            "can_publish_events",
        ]

    def get_can_create_events(self, obj):
        return obj.has_perm("events.add_event")

    def get_can_edit_events(self, obj):
        return obj.has_perm("events.change_event")

    def get_can_publish_events(self, obj):
        return obj.has_perm("events.publish_event")


class RegisterSerializer(StrictSerializerMixin, serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128
    )

    class Meta:
        model = User
        fields = ["name", "email", "password"]
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value

    def validate(self, attrs):
        try:
            validate_password(
                attrs["password"], User(email=attrs["email"], name=attrs["name"])
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return User.objects.create_user(**validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"email": "Ya existe una cuenta con este correo."}
            ) from exc


class LoginSerializer(StrictSerializerMixin, serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, max_length=128)
