import hashlib
from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from config.throttles import reserve_fixed_window
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

COOKIE_NAME = "eventia_refresh"


def set_refresh_cookie(response, token):
    response.set_cookie(
        COOKIE_NAME,
        str(token),
        max_age=86400,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="Lax",
        path="/api/auth/",
    )
    response["Cache-Control"] = "no-store"


def token_response(user, code=200):
    refresh = RefreshToken.for_user(user)
    response = Response(
        {"access": str(refresh.access_token), "user": UserSerializer(user).data},
        status=code,
    )
    set_refresh_cookie(response, refresh)
    return response


def reserve_login_attempt(key):
    """Count an attempt before credential verification, including concurrent calls."""
    return reserve_fixed_window(key, timeout=900)


class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


@method_decorator(csrf_protect, name="dispatch")
class CookieAuthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]


class RegisterView(CookieAuthView):
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "registration"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return token_response(user, status.HTTP_201_CREATED)


class LoginView(CookieAuthView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Keyed by direct client IP; do not trust arbitrary forwarded headers.
        digest = hashlib.sha256(
            request.META.get("REMOTE_ADDR", "").encode()
        ).hexdigest()
        key = f"login-failures:{digest}"
        attempts = reserve_login_attempt(key)
        if attempts > 5:
            response = Response(
                {"detail": "Demasiados intentos. Intenta nuevamente en 15 minutos."},
                status=429,
            )
            response["Retry-After"] = "900"
            return response
        user = authenticate(
            request,
            email=serializer.validated_data["email"].lower(),
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response({"detail": "Correo o contraseña incorrectos."}, status=401)
        cache.delete(key)
        return token_response(user)


class RefreshView(CookieAuthView):
    def post(self, request):
        raw = request.COOKIES.get(COOKIE_NAME)
        if not raw:
            return Response({"detail": "Inicia sesión para continuar."}, status=401)
        try:
            token = RefreshToken(raw)
            # Serialize rotation of this token, including blacklist validation.
            with transaction.atomic():
                OutstandingToken.objects.select_for_update().get(jti=token["jti"])
                serializer = TokenRefreshSerializer(data={"refresh": raw})
                serializer.is_valid(raise_exception=True)
                data = serializer.validated_data
            response = Response({"access": data["access"]})
            set_refresh_cookie(response, data["refresh"])
            return response
        except (TokenError, OutstandingToken.DoesNotExist):
            response = Response(
                {"detail": "Tu sesión terminó. Vuelve a iniciar sesión."}, status=401
            )
            response.delete_cookie(COOKIE_NAME, path="/api/auth/", samesite="Lax")
            return response


class LogoutView(CookieAuthView):
    def post(self, request):
        raw = request.COOKIES.get(COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=204)
        response.delete_cookie(COOKIE_NAME, path="/api/auth/", samesite="Lax")
        response["Cache-Control"] = "no-store"
        return response


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)
