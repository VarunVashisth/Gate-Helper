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
    id: str | None = None
    title: str | None = None
    topics: list[TopicPayload]
    progress: ProgressPayload


class SaveSyllabusRequest(BaseModel):
    title: str = Field(default="GATE Syllabus", min_length=1, max_length=160)
    topics: list[TopicPayload] = Field(min_length=1, max_length=SyllabusService.MAX_TOPICS)


class SyllabusSummaryPayload(BaseModel):
    id: str
    title: str
    subject_count: int
    progress: ProgressPayload
    updated_at: str


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


def _document_response(service_result, syllabus_id: str | None = None, title: str | None = None) -> SyllabusPayload:
    topics, summary = service_result
    return SyllabusPayload(
        id=syllabus_id,
        title=title,
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


@router.get("/workspaces", response_model=list[SyllabusSummaryPayload])
def list_syllabi(service: ServiceDependency) -> list[SyllabusSummaryPayload]:
    return [SyllabusSummaryPayload(
        id=item.id, title=item.title, subject_count=item.subject_count,
        progress=ProgressPayload(completed=item.progress.completed, total=item.progress.total, percentage=item.progress.percentage),
        updated_at=item.updated_at,
    ) for item in service.list_syllabi()]


@router.post("/workspaces", response_model=SyllabusPayload, status_code=status.HTTP_201_CREATED)
def create_syllabus(request: SaveSyllabusRequest, service: ServiceDependency) -> SyllabusPayload:
    try:
        syllabus_id, topics, progress = service.create_syllabus(request.title, [_to_record(topic) for topic in request.topics])
        return _document_response((topics, progress), syllabus_id, request.title)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(error)) from error


@router.get("/workspaces/{syllabus_id}", response_model=SyllabusPayload)
def get_syllabus_workspace(syllabus_id: str, service: ServiceDependency) -> SyllabusPayload:
    summaries = {item.id: item for item in service.list_syllabi()}
    item = summaries.get(str(syllabus_id))
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Syllabus not found.")
    return _document_response(service.get_tree(str(syllabus_id)), str(syllabus_id), item.title)


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
        return _document_response(service.replace_tree([_to_record(topic) for topic in request.topics], title=request.title))
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


@router.patch("/workspaces/{syllabus_id}/topics/{topic_id}", response_model=SyllabusPayload)
def update_workspace_progress(syllabus_id: str, topic_id: UUID, request: UpdateProgressRequest, service: ServiceDependency) -> SyllabusPayload:
    try:
        summaries = {item.id: item for item in service.list_syllabi()}
        item = summaries.get(str(syllabus_id))
        if not item:
            raise KeyError(syllabus_id)
        return _document_response(service.set_completed(str(topic_id), request.completed, str(syllabus_id)), str(syllabus_id), item.title)
    except KeyError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Syllabus or topic not found.") from error
