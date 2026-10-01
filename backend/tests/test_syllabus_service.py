from uuid import uuid4

from backend.db.database import initialize_database
from backend.services.syllabus_service import SyllabusService, TopicRecord


def topic(name: str, children: list[TopicRecord] | None = None) -> TopicRecord:
    return TopicRecord(id=str(uuid4()), name=name, subtopics=children or [])


def test_replace_tree_and_leaf_progress(tmp_path):
    database_path = tmp_path / "syllabus.db"
    initialize_database(database_path)
    service = SyllabusService(database_path)
    child_a = topic("Matrices")
    child_b = topic("Calculus")
    root = topic("Engineering Mathematics", [child_a, child_b])

    saved, summary = service.replace_tree([root])

    assert saved[0].name == "Engineering Mathematics"
    assert [item.name for item in saved[0].subtopics] == ["Matrices", "Calculus"]
    assert summary.total == 2
    assert summary.completed == 0


def test_progress_cascades_down_and_recomputes_parents(tmp_path):
    database_path = tmp_path / "syllabus.db"
    initialize_database(database_path)
    service = SyllabusService(database_path)
    child_a = topic("Matrices")
    child_b = topic("Calculus")
    root = topic("Engineering Mathematics", [child_a, child_b])
    service.replace_tree([root])

    tree, summary = service.set_completed(child_a.id, True)
    assert tree[0].completed is False
    assert summary.completed == 1

    tree, summary = service.set_completed(child_b.id, True)
    assert tree[0].completed is True
    assert summary.completed == 2
    assert summary.percentage == 100.0

    tree, summary = service.set_completed(root.id, False)
    assert all(not child.completed for child in tree[0].subtopics)
    assert summary.completed == 0


def test_replace_tree_rejects_duplicate_ids(tmp_path):
    database_path = tmp_path / "syllabus.db"
    initialize_database(database_path)
    service = SyllabusService(database_path)
    duplicate_id = str(uuid4())

    try:
        service.replace_tree([
            TopicRecord(id=duplicate_id, name="One"),
            TopicRecord(id=duplicate_id, name="Two"),
        ])
    except ValueError as error:
        assert "unique ID" in str(error)
    else:
        raise AssertionError("Duplicate topic IDs should be rejected")


def test_multiple_syllabi_keep_topics_and_progress_isolated(tmp_path):
    database_path = tmp_path / "multiple.db"
    initialize_database(database_path)
    service = SyllabusService(database_path)
    source = [topic("Subject", [topic("Topic", [topic("Checklist item")])])]

    first_id, first_tree, _ = service.create_syllabus("GATE CS 2027", source)
    second_id, second_tree, _ = service.create_syllabus("GATE DA 2027", source)
    first_leaf = first_tree[0].subtopics[0].subtopics[0]
    second_leaf = second_tree[0].subtopics[0].subtopics[0]
    service.set_completed(first_leaf.id, True, first_id)

    summaries = {item.id: item for item in service.list_syllabi()}
    assert first_leaf.id != second_leaf.id
    assert summaries[first_id].progress.completed == 1
    assert summaries[second_id].progress.completed == 0
