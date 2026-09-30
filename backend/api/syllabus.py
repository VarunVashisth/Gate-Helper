from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from backend.config import settings
from backend.services.pdf_import.syllabus_parser import PdfSyllabusParser, ParsedTopic
from backend.services.syllabus_service import SyllabusService, TopicRecord

router = APIRouter(prefix="/syllabus", tags=["syllabus"])
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


class TopicPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: UUID
    name: str = Field(min_length=1, max_length=300)
    completed: bool = False
    subtopics: list["TopicPayload"] = Field(default_factory=list)


class ProgressPayload(BaseModel):
    completed: int
    total: int
    percentage: float


class SyllabusPayload(BaseModel):
    topics: list[TopicPayload]
    progress: ProgressPayload


class SaveSyllabusRequest(BaseModel):
    topics: list[TopicPayload] = Field(min_length=1, max_length=SyllabusService.MAX_TOPICS)


class UpdateProgressRequest(BaseModel):
    completed: bool


class ImportPreview(BaseModel):
    title: str
    topics: list[TopicPayload]
    warnings: list[str]
    page_count: int


def get_syllabus_service() -> SyllabusService:
    return SyllabusService(settings.database_path)


ServiceDependency = Annotated[SyllabusService, Depends(get_syllabus_service)]


def _to_record(topic: TopicPayload) -> TopicRecord:
    return TopicRecord(
        id=str(topic.id),
        name=topic.name,
        completed=topic.completed,
        subtopics=[_to_record(child) for child in topic.subtopics],
    )


def _to_payload(topic: TopicRecord | ParsedTopic) -> TopicPayload:
    return TopicPayload(
        id=topic.id,
        name=topic.name,
        completed=getattr(topic, "completed", False),
        subtopics=[_to_payload(child) for child in topic.subtopics],
    )


def _document_response(service_result) -> SyllabusPayload:
    topics, summary = service_result
    return SyllabusPayload(
        topics=[_to_payload(topic) for topic in topics],
        progress=ProgressPayload(
            completed=summary.completed,
            total=summary.total,
            percentage=summary.percentage,
        ),
    )


@router.get("", response_model=SyllabusPayload)
def get_syllabus(service: ServiceDependency) -> SyllabusPayload:
    return _document_response(service.get_tree())


@router.post("/import", response_model=ImportPreview)
async def import_syllabus_pdf(file: Annotated[UploadFile, File()]) -> ImportPreview:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "PDF files are limited to 20 MB.")
    try:
        result = await run_in_threadpool(PdfSyllabusParser().parse, content, file.filename or "syllabus.pdf")
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(error)) from error
    return ImportPreview(
        title=result.title,
        topics=[_to_payload(topic) for topic in result.topics],
        warnings=list(result.warnings),
        page_count=result.page_count,
    )


@router.put("", response_model=SyllabusPayload)
def save_syllabus(request: SaveSyllabusRequest, service: ServiceDependency) -> SyllabusPayload:
    try:
        return _document_response(service.replace_tree([_to_record(topic) for topic in request.topics]))
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(error)) from error


@router.patch("/topics/{topic_id}", response_model=SyllabusPayload)
def update_topic_progress(
    topic_id: UUID, request: UpdateProgressRequest, service: ServiceDependency
) -> SyllabusPayload:
    try:
        return _document_response(service.set_completed(str(topic_id), request.completed))
    except KeyError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found.") from error

