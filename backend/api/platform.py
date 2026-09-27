import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from backend.config import PlatformMode, settings

router = APIRouter(tags=["platform"])


class PlatformResponse(BaseModel):
    mode: PlatformMode
    ollama_available: bool


async def is_ollama_reachable() -> bool:
    """Perform a short TCP probe without blocking API startup or the event loop."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(settings.ollama_host, settings.ollama_port),
            timeout=0.35,
        )
        writer.close()
        await writer.wait_closed()
        return True
    except (OSError, asyncio.TimeoutError):
        return False


@router.get("/platform", response_model=PlatformResponse)
async def get_platform() -> PlatformResponse:
    ollama_available = settings.mode == "desktop" and await is_ollama_reachable()
    return PlatformResponse(mode=settings.mode, ollama_available=ollama_available)

