from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from events.views import EventViewSet
from registrations.views import RegistrationViewSet
from users.views import (
    CsrfView,
    RegisterView,
    LoginView,
    RefreshView,
    LogoutView,
    MeView,
)

router = DefaultRouter()
router.register("events", EventViewSet, basename="event")
router.register("registrations", RegistrationViewSet, basename="registration")
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/csrf/", CsrfView.as_view()),
    path("api/auth/register/", RegisterView.as_view()),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/refresh/", RefreshView.as_view()),
    path("api/auth/logout/", LogoutView.as_view()),
    path("api/users/me/", MeView.as_view()),
    path("api/", include(router.urls)),
]
