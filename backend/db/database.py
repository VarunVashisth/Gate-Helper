import sqlite3
from pathlib import Path


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('pyq', 'mock')),
    year INTEGER,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    question_type TEXT NOT NULL CHECK (question_type IN ('MCQ', 'MSQ', 'NAT')),
    text_html TEXT NOT NULL,
    images_json TEXT NOT NULL DEFAULT '[]',
    options_json TEXT NOT NULL DEFAULT '[]',
    correct_answer_json TEXT NOT NULL,
    marks REAL NOT NULL CHECK (marks >= 0),
    negative_marks REAL NOT NULL DEFAULT 0 CHECK (negative_marks >= 0),
    position INTEGER NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE (paper_id, position)
);

CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    score REAL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TEXT,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS syllabus_topics (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    UNIQUE (parent_id, position)
);

CREATE TABLE IF NOT EXISTS progress (
    topic_id TEXT PRIMARY KEY,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES syllabus_topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_attempts_paper_id ON attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_parent_id ON syllabus_topics(parent_id);
"""


def connect(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def initialize_database(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with connect(database_path) as connection:
        connection.executescript(SCHEMA)

