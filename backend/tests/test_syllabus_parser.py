import pymupdf
from pathlib import Path

from backend.services.pdf_import.syllabus_parser import PdfSyllabusParser


def make_syllabus_pdf() -> bytes:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 72), "GATE 2027 Syllabus", fontsize=18)
    page.insert_text((72, 110), "Section 1: Engineering Mathematics", fontsize=14)
    page.insert_text((82, 140), "Linear Algebra: matrices; determinants; eigenvalues", fontsize=11)
    page.insert_text((82, 165), "Calculus: limits; continuity; differentiation", fontsize=11)
    content = document.tobytes()
    document.close()
    return content


def test_parser_builds_reviewable_hierarchy():
    result = PdfSyllabusParser().parse(make_syllabus_pdf(), "official-syllabus.pdf")

    assert result.page_count == 1
    assert result.title == "official syllabus"
    assert result.topics[0].name == "Engineering Mathematics"
    assert [topic.name for topic in result.topics[0].subtopics] == ["Linear Algebra", "Calculus"]
    assert result.topics[0].subtopics[0].subtopics[0].name == "matrices"


def test_parser_rejects_non_pdf_content():
    try:
        PdfSyllabusParser().parse(b"not a pdf", "notes.txt")
    except ValueError as error:
        assert "valid PDF" in str(error)
    else:
        raise AssertionError("Non-PDF content should be rejected")


def test_parser_understands_official_cs_syllabus_sample():
    sample = Path(__file__).parents[2] / "assets" / "CS_GATE2027_Syllabus.pdf"
    result = PdfSyllabusParser().parse(sample.read_bytes(), sample.name)

    assert result.title == "Computer Science and Information Technology"
    assert len(result.topics) == 10
    assert result.topics[0].name == "Engineering Mathematics"
    assert result.topics[-1].name == "Computer Networks"
    mathematics = result.topics[0]
    assert [topic.name for topic in mathematics.subtopics] == [
        "Logic", "Sets, Relations and Algebraic Structures", "Graphs", "Combinatorics",
        "Linear Algebra", "Calculus", "Probability and Statistics",
    ]
    linear_algebra = mathematics.subtopics[4]
    assert "LU Decomposition" in [topic.name for topic in linear_algebra.subtopics]
    assert all(not subject.name.lower().startswith("section") for subject in result.topics)


def test_official_cs_profile_has_stable_ids_and_complete_three_level_shape():
    sample = Path(__file__).parents[2] / "assets" / "CS_GATE2027_Syllabus.pdf"
    parser = PdfSyllabusParser()
    first = parser.parse(sample.read_bytes(), sample.name)
    second = parser.parse(sample.read_bytes(), sample.name)

    assert [subject.id for subject in first.topics] == [subject.id for subject in second.topics]
    assert all(subject.subtopics for subject in first.topics)
    assert all(topic.subtopics for subject in first.topics for topic in subject.subtopics)
    assert all(not item.subtopics for subject in first.topics for topic in subject.subtopics for item in topic.subtopics)
    assert sum(len(topic.subtopics) for subject in first.topics for topic in subject.subtopics) == 141

    networks = first.topics[-1]
    assert [topic.name for topic in networks.subtopics] == [
        "Network Fundamentals", "Data Link Layer", "Routing", "IPv4", "TCP", "Application Layer",
    ]


def test_parser_understands_official_da_syllabus_sample():
    sample = Path(__file__).parents[2] / "assets" / "DA_GATE2027_Syllabus.pdf"
    result = PdfSyllabusParser().parse(sample.read_bytes(), sample.name)

    assert result.title == "Data Science and Artificial Intelligence"
    assert len(result.topics) == 7
    machine_learning = result.topics[5]
    assert machine_learning.name == "Machine Learning"
    assert [topic.name for topic in machine_learning.subtopics] == [
        "Supervised Learning",
        "Unsupervised Learning",
    ]
    assert all(
        len(topic.name) <= 300
        for section in result.topics
        for topic in section.subtopics
    )
