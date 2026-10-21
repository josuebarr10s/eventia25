import hashlib
import time

from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from config.throttles import reserve_fixed_window
from .models import Registration
from .serializers import RegistrationCreateSerializer, RegistrationSerializer
from .services import register_for_event


class EventRegistrationThrottle(SimpleRateThrottle):
    scope = "event_registration"

    def allow_request(self, request, view):
        if not request.user.is_authenticated:
            return False
        now = time.time()
        bucket = int(now // self.duration)
        self.retry_after = self.duration - (now % self.duration)
        identity = hashlib.sha256(str(request.user.pk).encode()).hexdigest()
        key = f"throttle:{self.scope}:{bucket}:{identity}"
        attempts = reserve_fixed_window(key, timeout=self.duration * 2)
        return attempts <= self.num_requests

    def wait(self):
        return max(1, self.retry_after)


class RegistrationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    lookup_value_regex = r"\d+"
    serializer_class = RegistrationSerializer
    throttle_scope = "event_registration"

    def get_throttles(self):
        throttles = super().get_throttles()
        if self.action == "create":
            throttles.append(EventRegistrationThrottle())
        return throttles

    def get_queryset(self):
        # Identity always comes from the authenticated request, never a query parameter.
        return Registration.objects.filter(user=self.request.user).select_related(
            "event__organizer", "confirmation"
        )

    def annotate_events(self, registrations):
        from events.views import event_queryset

        items = list(registrations)
        events = {
            e.pk: e
            for e in event_queryset(self.request.user).filter(
                pk__in=[r.event_id for r in items]
            )
        }
        for item in items:
            item.event = events[item.event_id]
        return items

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(
            self.get_serializer(self.annotate_events(page), many=True).data
        )

    def retrieve(self, request, pk=None):
        obj = self.get_object()
        return Response(self.get_serializer(self.annotate_events([obj])[0]).data)

    def create(self, request):
        serializer = RegistrationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        registration = register_for_event(
            user=request.user, **serializer.validated_data
        )
        registration = self.get_queryset().get(pk=registration.pk)
        return Response(
            self.get_serializer(self.annotate_events([registration])[0]).data,
            status=201,
        )
