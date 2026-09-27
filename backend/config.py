import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


PlatformMode = Literal["web", "desktop"]


def _mode_from_environment() -> PlatformMode:
    value = os.getenv("GATE_HELPER_MODE", "web").strip().lower()
    return "desktop" if value == "desktop" else "web"


def _origins_from_environment() -> tuple[str, ...]:
    configured = os.getenv("GATE_HELPER_ALLOWED_ORIGINS")
    if configured:
        return tuple(origin.strip() for origin in configured.split(",") if origin.strip())
    return ("http://localhost:5173", "http://127.0.0.1:5173")


@dataclass(frozen=True)
class Settings:
    mode: PlatformMode
    data_directory: Path
    database_path: Path
    allowed_origins: tuple[str, ...]
    ollama_host: str
    ollama_port: int
    frontend_directory: Path | None


_default_data_directory = Path(__file__).resolve().parent / "data"
_data_directory = Path(os.getenv("GATE_HELPER_DATA_DIR", _default_data_directory))

settings = Settings(
    mode=_mode_from_environment(),
    data_directory=_data_directory,
    database_path=_data_directory / "gate_helper.db",
    allowed_origins=_origins_from_environment(),
    ollama_host=os.getenv("OLLAMA_HOST", "127.0.0.1"),
    ollama_port=int(os.getenv("OLLAMA_PORT", "11434")),
    frontend_directory=(
        Path(os.environ["GATE_HELPER_FRONTEND_DIR"])
        if os.getenv("GATE_HELPER_FRONTEND_DIR")
        else None
    ),
)

