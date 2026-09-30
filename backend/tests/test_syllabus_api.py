from uuid import uuid4

from fastapi.testclient import TestClient

from backend.api.syllabus import get_syllabus_service
from backend.db.database import initialize_database
from backend.main import app
from backend.services.syllabus_service import SyllabusService
from backend.tests.test_syllabus_parser import make_syllabus_pdf


def test_syllabus_save_read_and_progress_api(tmp_path):
    database_path = tmp_path / "api.db"
    initialize_database(database_path)
    service = SyllabusService(database_path)
    app.dependency_overrides[get_syllabus_service] = lambda: service
    root_id = str(uuid4())
    child_id = str(uuid4())
    payload = {
        "topics": [{
            "id": root_id,
            "name": "Algorithms",
            "completed": False,
            "subtopics": [{
                "id": child_id,
                "name": "Graph traversal",
                "completed": False,
                "subtopics": [],
            }],
        }]
    }

    try:
        with TestClient(app) as client:
            saved = client.put("/api/syllabus", json=payload)
            loaded = client.get("/api/syllabus")
            updated = client.patch(
                f"/api/syllabus/topics/{child_id}", json={"completed": True}
            )
    finally:
        app.dependency_overrides.clear()

    assert saved.status_code == 200
    assert loaded.json()["topics"][0]["name"] == "Algorithms"
    assert updated.status_code == 200
    assert updated.json()["topics"][0]["completed"] is True
    assert updated.json()["progress"] == {"completed": 1, "total": 1, "percentage": 100.0}


def test_import_rejects_non_pdf_file():
    with TestClient(app) as client:
        response = client.post(
            "/api/syllabus/import",
            files={"file": ("syllabus.txt", b"plain text", "text/plain")},
        )

    assert response.status_code == 415


def test_import_returns_editable_preview_for_valid_pdf():
    with TestClient(app) as client:
        response = client.post(
            "/api/syllabus/import",
            files={"file": ("gate-syllabus.pdf", make_syllabus_pdf(), "application/pdf")},
        )

    assert response.status_code == 200
    preview = response.json()
    assert preview["page_count"] == 1
    assert preview["topics"][0]["name"] == "Section 1: Engineering Mathematics"
    assert preview["topics"][0]["subtopics"][0]["name"] == "Linear Algebra"
