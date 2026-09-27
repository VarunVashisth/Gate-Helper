from dataclasses import dataclass, field
from typing import Literal

QuestionType = Literal["MCQ", "MSQ", "NAT"]
PaperSource = Literal["pyq", "mock"]


@dataclass(frozen=True)
class Option:
    id: str
    text_html: str
    image: str | None = None


@dataclass(frozen=True)
class Question:
    id: str
    subject: str
    question_type: QuestionType
    text_html: str
    images: tuple[str, ...] = ()
    options: tuple[Option, ...] = ()
    correct_answer: str | tuple[str, ...] | float = ""
    marks: float = 1.0
    negative_marks: float = 0.0


@dataclass(frozen=True)
class Paper:
    id: str
    title: str
    source: PaperSource
    duration_minutes: int
    questions: tuple[Question, ...] = ()
    year: int | None = None


@dataclass
class Topic:
    id: str
    name: str
    subtopics: list["Topic"] = field(default_factory=list)

