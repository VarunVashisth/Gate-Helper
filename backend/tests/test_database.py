import sqlite3

from backend.db.database import initialize_database


EXPECTED_TABLES = {"papers", "questions", "attempts", "syllabus_topics", "progress"}


def test_initialize_database_creates_all_phase_zero_tables(tmp_path):
    database_path = tmp_path / "nested" / "test.db"

    initialize_database(database_path)

    with sqlite3.connect(database_path) as connection:
        rows = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    assert EXPECTED_TABLES.issubset({row[0] for row in rows})


def test_initialize_database_is_idempotent(tmp_path):
    database_path = tmp_path / "test.db"

    initialize_database(database_path)
    initialize_database(database_path)

    assert database_path.is_file()

