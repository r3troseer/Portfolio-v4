from django.urls import path

from .views import answer, health, retrieve_evidence

urlpatterns = [
    path("health/", health, name="api-health"),
    path("retrieve/", retrieve_evidence, name="api-retrieve"),
    path("answer/", answer, name="api-answer"),
]
