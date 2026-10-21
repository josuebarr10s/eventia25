from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        data = response.data
        if isinstance(data, dict) and "detail" in data:
            response.data = {"detail": data["detail"]}
        elif isinstance(data, list):
            response.data = {"detail": " ".join(str(message) for message in data)}
        else:
            response.data = {
                "detail": " ".join(
                    str(message) for message in data.get("non_field_errors", [])
                )
                or "Revisa los datos del formulario.",
                "fields": data,
            }
    return response
