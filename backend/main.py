from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.responses import Response

from backend.api.platform import router as platform_router
from backend.api.syllabus import router as syllabus_router
from backend.config import settings
from backend.db.database import initialize_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create persistent application state before accepting requests."""
    initialize_database(settings.database_path)
    yield


app = FastAPI(
    title="GATE 2027 Helper API",
    version="0.1.0",
    description="Local-first API shared by the web and Electron clients.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(platform_router, prefix="/api")
app.include_router(syllabus_router, prefix="/api")

assets_path = Path(settings.data_directory) / "papers"
assets_path.mkdir(parents=True, exist_ok=True)
app.mount("/assets/papers", StaticFiles(directory=assets_path), name="paper-assets")


@app.get("/api/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


class SinglePageApplication(StaticFiles):
    """Serve index.html for client-side routes while preserving real asset 404s."""

    async def get_response(self, path: str, scope: dict) -> Response:
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or "." in Path(path).name:
                raise
            return await super().get_response("index.html", scope)
        if response.status_code == 404 and "." not in Path(path).name:
            return await super().get_response("index.html", scope)
        return response


if settings.frontend_directory and settings.frontend_directory.is_dir():
    app.mount(
        "/",
        SinglePageApplication(directory=settings.frontend_directory, html=True),
        name="frontend",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

