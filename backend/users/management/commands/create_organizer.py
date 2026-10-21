import getpass
import os
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction
from users.models import User


class Command(BaseCommand):
    help = "Crea un organizador autorizado sin contraseña predeterminada. No modifica usuarios existentes."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--name", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].lower()
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("El correo no es válido.") from exc
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(
                "La cuenta ya existe. Gestiona sus permisos desde Django Admin."
            )
        password = os.getenv("EVENTIA_ORGANIZER_PASSWORD")
        if not password:
            password = getpass.getpass("Contraseña del organizador: ")
            if password != getpass.getpass("Repite la contraseña: "):
                raise CommandError("Las contraseñas no coinciden.")
        try:
            validate_password(password, User(email=email, name=options["name"]))
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc
        group, _ = Group.objects.get_or_create(name="Organizadores")
        group.permissions.set(
            Permission.objects.filter(
                content_type__app_label="events",
                codename__in=[
                    "add_event",
                    "change_event",
                    "view_event",
                    "publish_event",
                ],
            )
        )
        user = User.objects.create_user(
            email=email, name=options["name"], password=password
        )
        user.groups.add(group)
        self.stdout.write(
            self.style.SUCCESS("Organizador creado. Puede iniciar sesión en Eventia.")
        )
