from dataclasses import dataclass, field
from pathlib import Path
from uuid import UUID

from backend.db.database import connect


@dataclass
class TopicRecord:
    id: str
    name: str
    completed: bool = False
    subtopics: list["TopicRecord"] = field(default_factory=list)


@dataclass(frozen=True)
class ProgressSummary:
    completed: int
    total: int
    percentage: float


class SyllabusService:
    MAX_TOPICS = 2000
    MAX_DEPTH = 6

    def __init__(self, database_path: Path):
        self.database_path = database_path

    def get_tree(self) -> tuple[list[TopicRecord], ProgressSummary]:
        with connect(self.database_path) as connection:
            rows = connection.execute(
                """
                SELECT topic.id, topic.parent_id, topic.name, topic.position,
                       COALESCE(progress.completed, 0) AS completed
                FROM syllabus_topics AS topic
                LEFT JOIN progress ON progress.topic_id = topic.id
                ORDER BY topic.position, topic.rowid
                """
            ).fetchall()

        records = {
            row["id"]: TopicRecord(
                id=row["id"], name=row["name"], completed=bool(row["completed"])
            )
            for row in rows
        }
        roots: list[TopicRecord] = []
        for row in rows:
            record = records[row["id"]]
            parent = records.get(row["parent_id"])
            (parent.subtopics if parent else roots).append(record)
        return roots, self._summary(roots)

    def replace_tree(self, topics: list[TopicRecord]) -> tuple[list[TopicRecord], ProgressSummary]:
        self._validate_tree(topics)
        with connect(self.database_path) as connection:
            connection.execute("DELETE FROM syllabus_topics")
            self._insert_level(connection, topics, parent_id=None)
        return self.get_tree()

    def set_completed(self, topic_id: str, completed: bool) -> tuple[list[TopicRecord], ProgressSummary]:
        self._validate_id(topic_id)
        with connect(self.database_path) as connection:
            exists = connection.execute(
                "SELECT 1 FROM syllabus_topics WHERE id = ?", (topic_id,)
            ).fetchone()
            if not exists:
                raise KeyError(topic_id)

            affected = connection.execute(
                """
                WITH RECURSIVE descendants(id) AS (
                    SELECT id FROM syllabus_topics WHERE id = ?
                    UNION ALL
                    SELECT child.id FROM syllabus_topics AS child
                    JOIN descendants ON child.parent_id = descendants.id
                )
                SELECT id FROM descendants
                """,
                (topic_id,),
            ).fetchall()
            now_value = 1 if completed else 0
            connection.executemany(
                """
                INSERT INTO progress(topic_id, completed, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(topic_id) DO UPDATE SET
                    completed = excluded.completed,
                    updated_at = CURRENT_TIMESTAMP
                """,
                [(row["id"], now_value) for row in affected],
            )
            self._recompute_ancestors(connection, topic_id)
        return self.get_tree()

    def _insert_level(self, connection, topics: list[TopicRecord], parent_id: str | None) -> None:
        for position, topic in enumerate(topics):
            connection.execute(
                "INSERT INTO syllabus_topics(id, parent_id, name, position) VALUES (?, ?, ?, ?)",
                (topic.id, parent_id, topic.name.strip(), position),
            )
            connection.execute(
                "INSERT INTO progress(topic_id, completed) VALUES (?, ?)",
                (topic.id, int(topic.completed)),
            )
            self._insert_level(connection, topic.subtopics, topic.id)

    def _recompute_ancestors(self, connection, topic_id: str) -> None:
        parent_row = connection.execute(
            "SELECT parent_id FROM syllabus_topics WHERE id = ?", (topic_id,)
        ).fetchone()
        parent_id = parent_row["parent_id"] if parent_row else None
        while parent_id:
            child_states = connection.execute(
                """
                SELECT COALESCE(progress.completed, 0) AS completed
                FROM syllabus_topics AS child
                LEFT JOIN progress ON progress.topic_id = child.id
                WHERE child.parent_id = ?
                """,
                (parent_id,),
            ).fetchall()
            parent_completed = bool(child_states) and all(row["completed"] for row in child_states)
            connection.execute(
                """
                INSERT INTO progress(topic_id, completed, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(topic_id) DO UPDATE SET
                    completed = excluded.completed,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (parent_id, int(parent_completed)),
            )
            next_parent = connection.execute(
                "SELECT parent_id FROM syllabus_topics WHERE id = ?", (parent_id,)
            ).fetchone()
            parent_id = next_parent["parent_id"] if next_parent else None

    def _validate_tree(self, topics: list[TopicRecord]) -> None:
        if not topics:
            raise ValueError("A syllabus must contain at least one topic.")
        seen: set[str] = set()
        count = 0

        def visit(nodes: list[TopicRecord], depth: int) -> None:
            nonlocal count
            if depth > self.MAX_DEPTH:
                raise ValueError(f"Topic nesting cannot exceed {self.MAX_DEPTH} levels.")
            for topic in nodes:
                count += 1
                if count > self.MAX_TOPICS:
                    raise ValueError(f"A syllabus cannot exceed {self.MAX_TOPICS} topics.")
                self._validate_id(topic.id)
                if topic.id in seen:
                    raise ValueError("Every topic must have a unique ID.")
                seen.add(topic.id)
                if not topic.name.strip():
                    raise ValueError("Topic names cannot be empty.")
                if len(topic.name.strip()) > 300:
                    raise ValueError("Topic names cannot exceed 300 characters.")
                visit(topic.subtopics, depth + 1)

        visit(topics, 1)

    @staticmethod
    def _validate_id(value: str) -> None:
        try:
            UUID(value)
        except ValueError as error:
            raise ValueError("Topic IDs must be valid UUIDs.") from error

    @staticmethod
    def _summary(roots: list[TopicRecord]) -> ProgressSummary:
        leaves: list[TopicRecord] = []

        def collect(nodes: list[TopicRecord]) -> None:
            for node in nodes:
                if node.subtopics:
                    collect(node.subtopics)
                else:
                    leaves.append(node)

        collect(roots)
        completed = sum(topic.completed for topic in leaves)
        total = len(leaves)
        percentage = round((completed / total * 100) if total else 0, 1)
        return ProgressSummary(completed=completed, total=total, percentage=percentage)

