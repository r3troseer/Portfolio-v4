from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response


@api_view(["GET"])
@throttle_classes([])  # health checks are exempt from the global throttle
def health(request):
    """Liveness probe. Served at both /health/ and /api/health/."""
    return Response({"status": "ok", "service": "portfolio-api"})
