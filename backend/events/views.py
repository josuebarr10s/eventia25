from django.db import transaction
from django.db.models import BooleanField, Count, Exists, OuterRef, Value
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from registrations.models import Registration
from .models import Event
from .permissions import can_manage, can_view_draft
from .serializers import EventSerializer, EventWriteSerializer


def event_queryset(user):
    qs = (
        Event.objects.select_related("organizer")
        .annotate(registered_count=Count("registrations"))
        .order_by("starts_at", "id")
    )
    if user.is_authenticated:
        return qs.annotate(
            is_registered=Exists(
                Registration.objects.filter(event=OuterRef("pk"), user=user)
            )
        )
    return qs.annotate(is_registered=Value(False, output_field=BooleanField()))


class EventViewSet(viewsets.GenericViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = EventSerializer
    permission_classes = [AllowAny]

    def list(self, request):
        qs = event_queryset(request.user).filter(
            status=Event.Status.PUBLISHED, starts_at__gt=timezone.now()
        )
        query = request.query_params.get("search", "").strip()[:180]
        if query:
            qs = qs.filter(title__icontains=query)
        for key in ["category", "city"]:
            value = request.query_params.get(key)
            if value:
                qs = qs.filter(**{key: value})
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        event = get_object_or_404(event_queryset(request.user), pk=pk)
        if event.status != Event.Status.PUBLISHED and not can_view_draft(
            request.user, event
        ):
            from rest_framework.exceptions import NotFound

            raise NotFound("Evento no encontrado.")
        return Response(self.get_serializer(event).data)

    def create(self, request):
        if not request.user.has_perm("events.add_event"):
            raise PermissionDenied("No tienes permiso para crear eventos.")
        serializer = EventWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save(organizer=request.user)
        return Response(
            self.get_serializer(event_queryset(request.user).get(pk=event.pk)).data,
            status=201,
        )

    def partial_update(self, request, pk=None):
        with transaction.atomic():
            event = get_object_or_404(Event.objects.select_for_update(), pk=pk)
            if not can_manage(request.user, event):
                raise PermissionDenied("No tienes permiso para editar este evento.")
            serializer = EventWriteSerializer(event, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(
            self.get_serializer(event_queryset(request.user).get(pk=pk)).data
        )

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        if not request.user.is_authenticated:
            self.permission_denied(request)
        if not any(
            request.user.has_perm(f"events.{perm}_event")
            for perm in ["add", "change", "publish"]
        ):
            raise PermissionDenied("Esta sección es para organizadores autorizados.")
        qs = event_queryset(request.user).filter(organizer=request.user)
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        if request.data:
            raise serializers.ValidationError(
                "Esta acción no admite campos adicionales."
            )
        with transaction.atomic():
            event = get_object_or_404(Event.objects.select_for_update(), pk=pk)
            if not request.user.has_perm("events.publish_event") or not (
                event.organizer_id == request.user.pk
                or request.user.has_perm("events.manage_all_events")
            ):
                raise PermissionDenied("No tienes permiso para publicar este evento.")
            if event.starts_at <= timezone.now():
                raise serializers.ValidationError(
                    "Un evento debe tener fecha futura para publicarse."
                )
            event.status = Event.Status.PUBLISHED
            event.save(update_fields=["status", "updated_at"])
        return Response(
            self.get_serializer(event_queryset(request.user).get(pk=pk)).data
        )

    @action(detail=False, methods=["get"])
    def categories(self, request):
        return Response(
            [
                {"value": value, "label": label}
                for value, label in Event.Category.choices
            ]
        )
