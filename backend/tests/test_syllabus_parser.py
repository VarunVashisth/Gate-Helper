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
    assert result.topics[0].name == "Section 1: Engineering Mathematics"
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
    assert result.topics[0].name == "Section 1: Engineering Mathematics"
    assert result.topics[-1].name == "Section 10: Computer Networks"
    mathematics = result.topics[0]
    assert [topic.name for topic in mathematics.subtopics] == [
        "Discrete Mathematics",
        "Linear Algebra",
        "Calculus",
        "Probability and Statistics",
    ]
    linear_algebra = mathematics.subtopics[1]
    assert "LU decomposition" in [topic.name for topic in linear_algebra.subtopics]


def test_parser_understands_official_da_syllabus_sample():
    sample = Path(__file__).parents[2] / "assets" / "DA_GATE2027_Syllabus.pdf"
    result = PdfSyllabusParser().parse(sample.read_bytes(), sample.name)

    assert result.title == "Data Science and Artificial Intelligence"
    assert len(result.topics) == 7
    machine_learning = result.topics[5]
    assert machine_learning.name == "Section 6: Machine Learning"
    assert [topic.name for topic in machine_learning.subtopics] == [
        "Supervised Learning",
        "Unsupervised Learning",
    ]
    assert all(
        len(topic.name) <= 300
        for section in result.topics
        for topic in section.subtopics
    )

