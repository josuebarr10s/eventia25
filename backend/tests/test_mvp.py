from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
from threading import Barrier, Event as ThreadEvent, Lock
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import (
    SimpleTestCase,
    TestCase,
    TransactionTestCase,
    override_settings,
    skipUnlessDBFeature,
)
from django.utils import timezone
from rest_framework.test import APIClient

from events.models import Event
from notifications.models import Confirmation
from registrations.models import Registration
from registrations.services import RegistrationConflict, register_for_event
from registrations.views import EventRegistrationThrottle
from users.models import User

PASSWORD = "Solo-pruebas!294-Secreto"


def user(email="participant@example.test", organizer=False):
    account = User.objects.create_user(
        email=email, name="Persona de prueba", password=PASSWORD
    )
    if organizer:
        account.user_permissions.set(
            Permission.objects.filter(
                content_type__app_label="events",
                codename__in=["add_event", "change_event", "publish_event"],
            )
        )
    return account


def event_data(**changes):
    data = {
        "title": "Encuentro de prueba",
        "description": "Un encuentro para compartir ideas.",
        "category": "culture",
        "starts_at": timezone.now() + timedelta(days=7),
        "city": "Guatemala",
        "location": "Centro cultural",
        "capacity": 2,
    }
    data.update(changes)
    return data


def event(owner, **changes):
    return Event.objects.create(organizer=owner, **event_data(**changes))


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class MVPTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = user("organizer@example.test", organizer=True)
        self.participant = user()
        self.other = user("other@example.test", organizer=True)
        self.published = event(self.owner, status="published")
        self.draft = event(self.owner)

    def auth(self, account):
        self.client.force_authenticate(account)

    def test_public_only_discovers_upcoming_published_events_and_search(self):
        event(
            self.owner, status="published", starts_at=timezone.now() - timedelta(days=1)
        )
        result = self.client.get("/api/events/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["count"], 1)
        self.assertEqual(result.data["results"][0]["id"], self.published.pk)
        self.assertEqual(
            self.client.get("/api/events/?search=inexistente").data["count"], 0
        )
        self.assertEqual(
            self.client.get("/api/events/?category=music").data["count"], 0
        )
        self.assertEqual(
            self.client.get("/api/events/?search=Encuentro&category=culture").data[
                "count"
            ],
            1,
        )

    def test_draft_is_private_even_for_other_organizer(self):
        self.assertEqual(
            self.client.get(f"/api/events/{self.draft.pk}/").status_code, 404
        )
        self.auth(self.other)
        self.assertEqual(
            self.client.get(f"/api/events/{self.draft.pk}/").status_code, 404
        )
        self.auth(self.owner)
        self.assertEqual(
            self.client.get(f"/api/events/{self.draft.pk}/").status_code, 200
        )

    def test_pagination_keeps_search_and_category(self):
        for index in range(13):
            event(self.owner, title=f"Taller {index}", status="published")
        response = self.client.get("/api/events/?search=Taller&category=culture")
        self.assertEqual(len(response.data["results"]), 12)
        self.assertIn("search=Taller", response.data["next"])
        self.assertIn("category=culture", response.data["next"])

    def test_registration_hashes_password_and_defaults_to_participant(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "NEW@example.test",
                "name": "Nueva persona",
                "password": PASSWORD,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        account = User.objects.get(email="new@example.test")
        self.assertTrue(account.check_password(PASSWORD))
        self.assertNotEqual(account.password, PASSWORD)
        self.assertFalse(account.is_staff)
        self.assertFalse(account.is_superuser)
        self.assertFalse(account.has_perm("events.add_event"))
        self.assertNotIn("password", response.data["user"])
        self.assertNotIn("refresh", response.data)
        cookie = response.cookies["eventia_refresh"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")
        self.assertEqual(cookie["path"], "/api/auth/")

    def test_duplicate_email_case_insensitive(self):
        result = self.client.post(
            "/api/auth/register/",
            {"email": "PARTICIPANT@example.test", "name": "Otra", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(result.status_code, 400)
        self.assertIn("email", result.data["fields"])
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create(email="PARTICIPANT@example.test", name="Duplicada")

    def test_registration_rejects_privileged_fields(self):
        for field, value in [
            ("role", "admin"),
            ("is_staff", True),
            ("is_superuser", True),
            ("groups", [1]),
            ("user_permissions", [1]),
        ]:
            with self.subTest(field=field):
                result = self.client.post(
                    "/api/auth/register/",
                    {
                        "email": "bad@example.test",
                        "name": "Ataque",
                        "password": PASSWORD,
                        field: value,
                    },
                    format="json",
                )
                self.assertEqual(result.status_code, 400)
                self.assertIn(field, result.data["fields"])
        self.assertFalse(User.objects.filter(email="bad@example.test").exists())

    def test_weak_password_and_empty_fields_rejected(self):
        result = self.client.post(
            "/api/auth/register/",
            {"email": "weak@example.test", "name": "", "password": "123"},
            format="json",
        )
        self.assertEqual(result.status_code, 400)
        result = self.client.post(
            "/api/auth/register/",
            {"email": "weak@example.test", "name": "Persona", "password": "1234567890"},
            format="json",
        )
        self.assertEqual(result.status_code, 400)
        self.assertIn("password", result.data["fields"])

    def test_login_and_wrong_credentials_generic_response(self):
        for email in [self.participant.email, "unknown@example.test"]:
            result = self.client.post(
                "/api/auth/login/", {"email": email, "password": "wrong"}, format="json"
            )
            self.assertEqual(result.status_code, 401)
            self.assertEqual(
                str(result.data["detail"]), "Correo o contraseña incorrectos."
            )
        result = self.client.post(
            "/api/auth/login/",
            {"email": self.participant.email, "password": PASSWORD},
            format="json",
        )
        self.assertEqual(result.status_code, 200)
        bearer = result.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {bearer}")
        self.assertEqual(
            self.client.get("/api/users/me/").data["id"], self.participant.pk
        )

    def test_login_five_failures_block_for_fifteen_minutes(self):
        for _ in range(5):
            self.assertEqual(
                self.client.post(
                    "/api/auth/login/",
                    {"email": self.participant.email, "password": "wrong"},
                ).status_code,
                401,
            )
        result = self.client.post(
            "/api/auth/login/", {"email": self.participant.email, "password": PASSWORD}
        )
        self.assertEqual(result.status_code, 429)
        self.assertEqual(result["Retry-After"], "900")

    def test_refresh_rotation_replay_and_logout(self):
        login = self.client.post(
            "/api/auth/login/", {"email": self.participant.email, "password": PASSWORD}
        )
        old = login.cookies["eventia_refresh"].value
        result = self.client.post("/api/auth/refresh/")
        self.assertEqual(result.status_code, 200)
        current = result.cookies["eventia_refresh"].value
        self.assertNotEqual(old, current)
        self.client.cookies["eventia_refresh"] = old
        self.assertEqual(self.client.post("/api/auth/refresh/").status_code, 401)
        self.client.cookies["eventia_refresh"] = current
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.client.cookies["eventia_refresh"] = current
        self.assertEqual(self.client.post("/api/auth/refresh/").status_code, 401)

    def test_csrf_required_on_cookie_auth_endpoints(self):
        browser = APIClient(enforce_csrf_checks=True)
        for endpoint in ["register", "login", "refresh", "logout"]:
            self.assertEqual(
                browser.post(f"/api/auth/{endpoint}/", {}).status_code, 403
            )
        token = browser.get("/api/auth/csrf/").data["csrfToken"]
        result = browser.post(
            "/api/auth/login/",
            {"email": self.participant.email, "password": PASSWORD},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            browser.post("/api/auth/refresh/", HTTP_X_CSRFTOKEN=token).status_code, 200
        )
        self.assertEqual(
            browser.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code, 204
        )

    def test_private_routes_require_authentication(self):
        for path in ["/api/users/me/", "/api/registrations/", "/api/events/mine/"]:
            self.assertEqual(self.client.get(path).status_code, 401)

    def test_profile_api_exposes_only_current_user_allowlisted_fields(self):
        self.auth(self.participant)
        response = self.client.get("/api/users/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data),
            {
                "id",
                "name",
                "email",
                "can_create_events",
                "can_edit_events",
                "can_publish_events",
            },
        )
        for forbidden in ["password", "password_hash", "is_staff", "is_superuser"]:
            self.assertNotIn(forbidden, response.data)
        self.assertEqual(self.client.get(f"/api/users/{self.other.pk}/").status_code, 404)

    def test_public_registration_has_dedicated_rate_limit(self):
        for _ in range(10):
            result = self.client.post(
                "/api/auth/register/",
                {
                    "email": "rate-limit@example.test",
                    "name": "Persona de prueba",
                    "password": "short",
                },
                format="json",
                REMOTE_ADDR="198.51.100.42",
            )
            self.assertEqual(result.status_code, 400)
        blocked = self.client.post(
            "/api/auth/register/",
            {
                "email": "blocked-register@example.test",
                "name": "Nueva persona",
                "password": PASSWORD,
            },
            format="json",
            REMOTE_ADDR="198.51.100.42",
        )
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked)
        self.assertFalse(User.objects.filter(email="blocked-register@example.test").exists())

    def test_event_registration_has_dedicated_per_user_limit(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.auth(self.participant)
        target_events = [self.published]
        target_events.extend(
            event(self.owner, status="published", capacity=1) for _ in range(19)
        )

        for target in target_events:
            result = self.client.post("/api/registrations/", {"event_id": target.pk})
            self.assertEqual(result.status_code, 201)

        blocked_event = event(self.owner, status="published", capacity=1)
        blocked = self.client.post(
            "/api/registrations/", {"event_id": blocked_event.pk}
        )
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked)
        self.assertEqual(Registration.objects.filter(user=self.participant).count(), 20)
        self.assertFalse(
            Registration.objects.filter(user=self.participant, event=blocked_event).exists()
        )

    def test_api_responses_are_marked_no_store(self):
        self.auth(self.participant)
        result = self.client.get("/api/registrations/")
        self.assertEqual(result.status_code, 200)
        self.assertIn("no-store", result["Cache-Control"])
        self.assertIn("private", result["Cache-Control"])

    def test_search_treats_sql_syntax_as_literal_input(self):
        result = self.client.get("/api/events/?search=%27%20OR%201%3D1%20--")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["count"], 0)

    def test_registration_rejects_unexpected_zero_or_negative_quantity(self):
        self.auth(self.participant)
        for quantity in [0, -1]:
            with self.subTest(quantity=quantity):
                result = self.client.post(
                    "/api/registrations/",
                    {"event_id": self.published.pk, "quantity": quantity},
                )
                self.assertEqual(result.status_code, 400)
        self.assertFalse(Registration.objects.exists())
        self.assertFalse(Confirmation.objects.exists())

    def test_only_authorized_organizer_creates_draft_with_server_owner(self):
        self.auth(self.participant)
        self.assertEqual(
            self.client.post("/api/events/", event_data()).status_code, 403
        )
        self.auth(self.owner)
        result = self.client.post("/api/events/", event_data())
        self.assertEqual(result.status_code, 201)
        saved = Event.objects.get(pk=result.data["id"])
        self.assertEqual(saved.organizer_id, self.owner.pk)
        self.assertEqual(saved.status, "draft")

    def test_staff_label_alone_does_not_grant_creation(self):
        self.participant.is_staff = True
        self.participant.save()
        self.auth(self.participant)
        self.assertEqual(
            self.client.post("/api/events/", event_data()).status_code, 403
        )

    def test_event_rejects_owner_status_and_other_unknown_fields(self):
        self.auth(self.owner)
        for field, value in [
            ("organizer", self.other.pk),
            ("owner", self.other.pk),
            ("status", "published"),
        ]:
            result = self.client.post("/api/events/", event_data(**{field: value}))
            self.assertEqual(result.status_code, 400)

    def test_capacity_future_date_and_category_validation(self):
        self.auth(self.owner)
        for changes in [
            {"capacity": 0},
            {"capacity": -1},
            {"capacity": 1.5},
            {"starts_at": timezone.now() - timedelta(days=1)},
            {"category": "invalid"},
        ]:
            self.assertEqual(
                self.client.post("/api/events/", event_data(**changes)).status_code, 400
            )
        with self.assertRaises(IntegrityError), transaction.atomic():
            event(self.owner, capacity=0)

    def test_owner_edits_other_organizer_denied(self):
        self.auth(self.other)
        self.assertEqual(
            self.client.patch(
                f"/api/events/{self.published.pk}/", {"title": "Manipulado"}
            ).status_code,
            403,
        )
        self.auth(self.owner)
        result = self.client.patch(
            f"/api/events/{self.published.pk}/", {"title": "Actualizado"}
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["title"], "Actualizado")

    def test_explicit_manage_all_permission_allows_other_event_edit(self):
        self.other.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="events", codename="manage_all_events"
            )
        )
        self.auth(self.other)
        self.assertEqual(
            self.client.patch(
                f"/api/events/{self.published.pk}/", {"title": "Autorizado"}
            ).status_code,
            200,
        )

    def test_publish_requires_permission_and_ownership(self):
        self.auth(self.other)
        self.assertEqual(
            self.client.post(f"/api/events/{self.draft.pk}/publish/").status_code, 403
        )
        self.auth(self.owner)
        self.assertEqual(
            self.client.post(
                f"/api/events/{self.draft.pk}/publish/", {"owner": self.other.pk}
            ).status_code,
            400,
        )
        result = self.client.post(f"/api/events/{self.draft.pk}/publish/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["status"], "published")

    def test_owner_without_publish_permission_cannot_publish(self):
        self.owner.user_permissions.remove(
            Permission.objects.get(
                content_type__app_label="events", codename="publish_event"
            )
        )
        self.auth(self.owner)
        self.assertEqual(
            self.client.post(f"/api/events/{self.draft.pk}/publish/").status_code, 403
        )

    def test_successful_registration_updates_availability_and_sends_after_commit(self):
        self.auth(self.participant)
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            result = self.client.post(
                "/api/registrations/", {"event_id": self.published.pk}
            )
            self.assertEqual(result.status_code, 201)
            self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.published.title, mail.outbox[0].body)
        self.assertIn("America/Guatemala", mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, [self.participant.email])
        self.assertEqual(
            self.client.get(f"/api/events/{self.published.pk}/").data[
                "available_spots"
            ],
            1,
        )
        self.assertTrue(
            self.client.get(f"/api/events/{self.published.pk}/").data["is_registered"]
        )

    def test_duplicate_registration_and_database_uniqueness(self):
        Registration.objects.create(user=self.participant, event=self.published)
        self.auth(self.participant)
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            result = self.client.post(
                "/api/registrations/", {"event_id": self.published.pk}
            )
        self.assertEqual(result.status_code, 409)
        self.assertEqual(callbacks, [])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Registration.objects.create(user=self.participant, event=self.published)

    def test_full_event_does_not_register_or_notify(self):
        self.published.capacity = 1
        self.published.save()
        Registration.objects.create(user=self.other, event=self.published)
        self.auth(self.participant)
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            result = self.client.post(
                "/api/registrations/", {"event_id": self.published.pk}
            )
        self.assertEqual(result.status_code, 409)
        self.assertEqual(callbacks, [])
        self.assertEqual(Registration.objects.count(), 1)
        self.assertEqual(Confirmation.objects.count(), 0)

    def test_draft_and_past_events_do_not_allow_registration(self):
        self.auth(self.participant)
        self.assertEqual(
            self.client.post(
                "/api/registrations/", {"event_id": self.draft.pk}
            ).status_code,
            404,
        )
        self.published.starts_at = timezone.now() - timedelta(days=1)
        self.published.save()
        self.assertEqual(
            self.client.post(
                "/api/registrations/", {"event_id": self.published.pk}
            ).status_code,
            400,
        )

    def test_registration_identity_cannot_be_supplied_by_client(self):
        self.auth(self.participant)
        result = self.client.post(
            "/api/registrations/",
            {"event_id": self.published.pk, "user_id": self.other.pk},
        )
        self.assertEqual(result.status_code, 400)
        self.assertFalse(Registration.objects.exists())

    def test_only_own_registrations_are_listed_and_others_return_404(self):
        self.auth(self.participant)
        own = register_for_event(user=self.participant, event_id=self.published.pk)
        other = register_for_event(user=self.other, event_id=self.published.pk)
        result = self.client.get(f"/api/registrations/?user_id={self.other.pk}")
        self.assertEqual(result.status_code, 200)
        self.assertEqual([item["id"] for item in result.data["results"]], [own.pk])
        self.assertEqual(
            self.client.get(f"/api/registrations/{other.pk}/").status_code, 404
        )

    def test_capacity_cannot_shrink_below_confirmed_registrations(self):
        Registration.objects.create(user=self.participant, event=self.published)
        Registration.objects.create(user=self.other, event=self.published)
        self.auth(self.owner)
        result = self.client.patch(f"/api/events/{self.published.pk}/", {"capacity": 1})
        self.assertEqual(result.status_code, 400)
        self.published.refresh_from_db()
        self.assertEqual(self.published.capacity, 2)

    def test_started_event_cannot_be_edited(self):
        self.published.starts_at = timezone.now() - timedelta(days=1)
        self.published.save()
        self.auth(self.owner)
        self.assertEqual(
            self.client.patch(
                f"/api/events/{self.published.pk}/", {"title": "Cambio"}
            ).status_code,
            400,
        )

    def test_email_failure_preserves_registration_and_records_failure(self):
        self.auth(self.participant)
        with patch(
            "notifications.services.send_mail",
            side_effect=RuntimeError("provider unavailable"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                result = self.client.post(
                    "/api/registrations/", {"event_id": self.published.pk}
                )
        self.assertEqual(result.status_code, 201)
        self.assertEqual(Registration.objects.count(), 1)
        self.assertEqual(Confirmation.objects.get().status, "failed")

    def test_rollback_does_not_send_confirmation(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            try:
                with transaction.atomic():
                    register_for_event(
                        user=self.participant, event_id=self.published.pk
                    )
                    raise RuntimeError("Rollback")
            except RuntimeError:
                pass
        self.assertEqual(callbacks, [])
        self.assertFalse(Registration.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_invalid_identifiers_return_404(self):
        self.assertEqual(self.client.get("/api/events/not-an-id/").status_code, 404)

    def test_non_object_json_is_rejected_without_server_error(self):
        for path in ["/api/auth/register/", "/api/auth/login/"]:
            self.assertEqual(
                self.client.post(path, [{"role": "admin"}], format="json").status_code,
                400,
            )
        self.auth(self.owner)
        for path in ["/api/events/", "/api/registrations/"]:
            self.assertEqual(
                self.client.post(
                    path, [{"event_id": self.published.pk}], format="json"
                ).status_code,
                400,
            )

    def test_login_uses_case_insensitive_email_for_admin_created_accounts(self):
        User.objects.create(
            email="UPPERCASE@example.test",
            name="Cuenta de administración",
            password=self.participant.password,
        )
        response = self.client.post(
            "/api/auth/login/",
            {"email": "uppercase@example.test", "password": PASSWORD},
        )
        self.assertEqual(response.status_code, 200)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ConcurrentRegistrationTests(TransactionTestCase):
    @skipUnlessDBFeature("has_select_for_update")
    def test_two_connections_compete_for_last_spot(self):
        self.assertEqual(connection.vendor, "postgresql")
        owner = user("concurrent-organizer@example.test", organizer=True)
        first = user("concurrent-first@example.test")
        second = user("concurrent-second@example.test")
        target = event(owner, capacity=1, status="published")
        barrier = Barrier(2)

        def attempt(user_id):
            close_old_connections()
            try:
                account = User.objects.get(pk=user_id)
                barrier.wait(timeout=10)
                try:
                    register_for_event(user=account, event_id=target.pk)
                    return 201
                except RegistrationConflict:
                    return 409
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, [first.pk, second.pk]))
        self.assertEqual(sorted(results), [201, 409])
        self.assertEqual(Registration.objects.filter(event=target).count(), 1)
        self.assertEqual(Confirmation.objects.count(), 1)


class ConcurrentLoginTests(TransactionTestCase):
    def test_parallel_failures_cannot_bypass_login_attempt_limit(self):
        cache.clear()
        self.addCleanup(cache.clear)
        authenticate_started = ThreadEvent()
        counter_lock = Lock()
        authenticated_attempts = 0

        def reject_credentials(*args, **kwargs):
            nonlocal authenticated_attempts
            with counter_lock:
                authenticated_attempts += 1
                if authenticated_attempts >= 5:
                    authenticate_started.set()
            authenticate_started.wait(timeout=5)
            return None

        def attempt_login(_):
            close_old_connections()
            try:
                client = APIClient()
                response = client.post(
                    "/api/auth/login/",
                    {"email": "parallel@example.test", "password": "incorrect"},
                    format="json",
                    REMOTE_ADDR="198.51.100.74",
                )
                return response.status_code
            finally:
                close_old_connections()

        with patch("users.views.authenticate", side_effect=reject_credentials):
            with ThreadPoolExecutor(max_workers=8) as pool:
                statuses = list(pool.map(attempt_login, range(8)))

        self.assertEqual(authenticated_attempts, 5)
        self.assertEqual(statuses.count(401), 5)
        self.assertEqual(statuses.count(429), 3)

    def test_successful_login_resets_reserved_attempt_window(self):
        account = user("login-reset@example.test")
        client = APIClient()
        for _ in range(4):
            response = client.post(
                "/api/auth/login/",
                {"email": account.email, "password": "incorrect"},
                format="json",
                REMOTE_ADDR="198.51.100.75",
            )
            self.assertEqual(response.status_code, 401)

        success = client.post(
            "/api/auth/login/",
            {"email": account.email, "password": PASSWORD},
            format="json",
            REMOTE_ADDR="198.51.100.75",
        )
        self.assertEqual(success.status_code, 200)

        next_attempt = client.post(
            "/api/auth/login/",
            {"email": account.email, "password": "incorrect"},
            format="json",
            REMOTE_ADDR="198.51.100.75",
        )
        self.assertEqual(next_attempt.status_code, 401)


class ConcurrentRegistrationThrottleTests(SimpleTestCase):
    def test_parallel_registration_attempts_are_atomically_capped(self):
        cache.clear()
        self.addCleanup(cache.clear)
        request = SimpleNamespace(
            user=SimpleNamespace(is_authenticated=True, pk=82001)
        )
        barrier = Barrier(40)

        def attempt(_):
            barrier.wait(timeout=5)
            return EventRegistrationThrottle().allow_request(request, None)

        with ThreadPoolExecutor(max_workers=40) as pool:
            accepted = list(pool.map(attempt, range(40)))

        self.assertEqual(accepted.count(True), 20)
        self.assertEqual(accepted.count(False), 20)
