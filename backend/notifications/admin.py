from django.contrib import admin
from .models import Confirmation


@admin.register(Confirmation)
class ConfirmationAdmin(admin.ModelAdmin):
    list_display = ("id", "registration", "status", "updated_at")
    readonly_fields = [field.name for field in Confirmation._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
