from dataclasses import replace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_web_platform_never_exposes_ollama():
    with TestClient(app) as client, patch(
        "backend.api.platform.is_ollama_reachable", new=AsyncMock(return_value=True)
    ):
        response = client.get("/api/platform")

    assert response.status_code == 200
    assert response.json() == {"mode": "web", "ollama_available": False}


def test_desktop_platform_reports_ollama_probe():
    desktop_settings = replace(settings, mode="desktop")
    with TestClient(app) as client, patch(
        "backend.api.platform.settings", desktop_settings
    ), patch(
        "backend.api.platform.is_ollama_reachable", new=AsyncMock(return_value=True)
    ):
        response = client.get("/api/platform")

    assert response.status_code == 200
    assert response.json() == {"mode": "desktop", "ollama_available": True}

