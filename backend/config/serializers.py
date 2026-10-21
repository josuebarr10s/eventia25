from collections.abc import Mapping

from rest_framework import serializers


class StrictSerializerMixin:
    """Reject mass assignment instead of silently ignoring unrecognized fields."""

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            return super().to_internal_value(data)
        allowed = {name for name, field in self.fields.items() if not field.read_only}
        extra = set(data) - allowed
        if extra:
            raise serializers.ValidationError(
                {key: "Este campo no está permitido." for key in sorted(extra)}
            )
        return super().to_internal_value(data)
