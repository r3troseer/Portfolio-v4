"""Root URL configuration for the portfolio-api skeleton."""

from django.urls import include, path

from core.views import health

urlpatterns = [
    path("health/", health),
    path("api/", include("core.urls")),
]
