from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.main import SinglePageApplication


def test_spa_route_falls_back_to_index_without_hiding_missing_assets(tmp_path):
    (tmp_path / "index.html").write_text("<h1>GATE Helper</h1>", encoding="utf-8")
    application = FastAPI()
    application.mount("/", SinglePageApplication(directory=tmp_path, html=True))

    with TestClient(application) as client:
        route_response = client.get("/ai-tutor")
        asset_response = client.get("/missing.js")

    assert route_response.status_code == 200
    assert "GATE Helper" in route_response.text
    assert asset_response.status_code == 404
