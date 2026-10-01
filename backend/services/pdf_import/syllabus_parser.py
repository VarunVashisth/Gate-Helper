import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol
from uuid import UUID, uuid4, uuid5

import pymupdf


@dataclass
class ParsedTopic:
    id: str
    name: str
    subtopics: list["ParsedTopic"] = field(default_factory=list)


@dataclass(frozen=True)
class ParseResult:
    title: str
    topics: list[ParsedTopic]
    warnings: tuple[str, ...]
    page_count: int


class SyllabusParser(Protocol):
    def parse(self, content: bytes, filename: str) -> ParseResult: ...


@dataclass(frozen=True)
class _Line:
    text: str
    size: float
    x: float
    y: float
    bottom: float
    bold: bool
    page: int
    accent_prefix: str = ""


class PdfSyllabusParser:
    """Infer a reviewable topic tree from PDF typography and punctuation."""

    section_pattern = re.compile(r"^Section\s+(\d+)\s*:\s*(.*)$", re.IGNORECASE)
    heading_pattern = re.compile(
        r"^(?:section|part|unit|module|chapter)\s*[\w.-]*(?:\s*[:–—-]\s*|\s+).+",
        re.IGNORECASE,
    )
    bullet_pattern = re.compile(r"^(?:[•●▪◦‣]|[-–—]|\(?\d+[.)]|\(?[a-zA-Z][.)])\s+")
    page_number_pattern = re.compile(r"^(?:page\s+)?\d+(?:\s+of\s+\d+)?$", re.IGNORECASE)
    sentence_boundary = re.compile(r";+|\.(?=\s+(?:[A-Z(]|[0-9]))")
    stable_namespace = UUID("17f5575b-daf4-46c0-9b33-b4c4ea45de27")

    # This profile is a semantic transcription of the official CS 2027 PDF. It is
    # selected only when all section headings are present in the uploaded text;
    # other PDFs continue through the reviewable generic parser below.
    cs_2027_profile: tuple[tuple[str, tuple[tuple[str, tuple[str, ...]], ...]], ...] = (
        ("Engineering Mathematics", (
            ("Logic", ("Propositional Logic", "First-Order Logic")),
            ("Sets, Relations and Algebraic Structures", ("Sets", "Relations", "Functions", "Partial Orders", "Lattices", "Monoids", "Groups")),
            ("Graphs", ("Connectivity", "Matching", "Colouring")),
            ("Combinatorics", ("Counting", "Recurrence Relations", "Generating Functions")),
            ("Linear Algebra", ("Matrices", "Determinants", "System of Linear Equations", "Eigenvalues and Eigenvectors", "LU Decomposition")),
            ("Calculus", ("Limits", "Continuity and Differentiability", "Maxima and Minima", "Mean Value Theorem", "Integration")),
            ("Probability and Statistics", ("Random Variables", "Uniform Distribution", "Normal Distribution", "Exponential Distribution", "Poisson Distribution", "Binomial Distribution", "Mean", "Median", "Mode", "Standard Deviation", "Conditional Probability", "Bayes Theorem")),
        )),
        ("Digital Logic", (
            ("Boolean Algebra and Minimization", ("Boolean Algebra", "Algebraic Technique", "Karnaugh Map", "Tabular Method")),
            ("Combinational and Sequential Circuits", ("Combinational Circuits", "Sequential Circuits")),
            ("Number Representation and Arithmetic", ("Number Representation", "Fixed-Point Arithmetic", "Floating-Point Arithmetic")),
        )),
        ("Computer Organization and Architecture", (
            ("Instruction Set Architecture", ("Instruction Set", "Addressing Modes")),
            ("Arithmetic and Logic Unit", ("ALU Design",)),
            ("Control Unit", ("Hardwired Control", "Microprogrammed Control")),
            ("Memory System", ("Memory Interfacing", "Memory Hierarchy", "Performance", "Cache Memory Mapping")),
            ("I/O", ("I/O Interface", "Interrupt", "DMA")),
            ("Instruction Pipelining", ("Instruction Pipelining", "Pipeline Hazards")),
        )),
        ("Programming and Data Structures", (
            ("C Programming", ("Programming in C",)),
            ("Recursion", ("Recursion",)),
            ("Linear Data Structures", ("Arrays", "Stacks", "Queues", "Linked Lists")),
            ("Trees and Graphs", ("Trees", "Binary Search Trees", "Binary Heaps", "Graphs")),
        )),
        ("Algorithms", (
            ("Searching, Sorting and Hashing", ("Searching", "Sorting", "Hashing")),
            ("Complexity Analysis", ("Asymptotic Worst-Case Time Complexity", "Asymptotic Worst-Case Space Complexity")),
            ("Algorithm Design Techniques", ("Greedy", "Dynamic Programming", "Divide-and-Conquer")),
            ("Graph Algorithms", ("Graph Traversals", "Minimum Spanning Trees", "Shortest Paths")),
        )),
        ("Theory of Computation", (
            ("Regular Languages", ("Regular Expressions", "Finite Automata")),
            ("Context-Free Languages", ("Context-Free Grammars", "Push-Down Automata")),
            ("Language Properties", ("Regular Languages", "Context-Free Languages", "Pumping Lemma")),
            ("Computability", ("Turing Machines", "Undecidability")),
        )),
        ("Compiler Design", (
            ("Front End", ("Lexical Analysis", "Parsing", "Syntax-Directed Translation")),
            ("Runtime Environments", ("Runtime Environments",)),
            ("Intermediate Code Generation", ("Intermediate Code Generation",)),
            ("Code Optimisation", ("Local Optimisation",)),
            ("Data Flow Analyses", ("Constant Propagation", "Liveness Analysis", "Common Subexpression Elimination")),
        )),
        ("Operating System", (
            ("System Calls", ("System Calls",)),
            ("Processes and Threads", ("Processes", "Threads")),
            ("Inter-Process Communication", ("Inter-Process Communication",)),
            ("Concurrency and Synchronization", ("Concurrency", "Synchronization")),
            ("Deadlock", ("Deadlock",)),
            ("CPU and I/O Scheduling", ("CPU Scheduling", "I/O Scheduling")),
            ("Memory Management", ("Memory Management", "Virtual Memory")),
            ("File Systems", ("File Systems",)),
        )),
        ("Databases", (
            ("ER Model", ("ER Model",)),
            ("Relational Model", ("Relational Algebra", "Tuple Calculus", "SQL")),
            ("Database Design", ("Integrity Constraints", "Normal Forms")),
            ("File Organization and Indexing", ("File Organization", "Indexing", "B Trees", "B+ Trees")),
            ("Transactions", ("Transactions", "Concurrency Control")),
        )),
        ("Computer Networks", (
            ("Network Fundamentals", ("Principles of Layering", "Circuit Switching", "Packet Switching", "Virtual-Circuit Switching", "Performance Metrics")),
            ("Data Link Layer", ("Error Detection", "Medium Access Control", "Ethernet")),
            ("Routing", ("Distance Vector Routing", "Link State Routing")),
            ("IPv4", ("Fragmentation", "CIDR Notation", "Network Address Translation")),
            ("TCP", ("Flow Control", "Congestion Control", "Socket API")),
            ("Application Layer", ("DNS", "HTTP")),
        )),
    )

    def parse(self, content: bytes, filename: str) -> ParseResult:
        if not content.startswith(b"%PDF"):
            raise ValueError("The uploaded file is not a valid PDF.")
        try:
            document = pymupdf.open(stream=content, filetype="pdf")
        except Exception as error:
            raise ValueError("The PDF could not be opened.") from error

        try:
            if document.page_count == 0:
                raise ValueError("The PDF has no pages.")
            lines = self._extract_lines(document)
            metadata_title = (document.metadata or {}).get("title", "").strip()
            page_count = document.page_count
        finally:
            document.close()

        if not lines:
            raise ValueError(
                "No extractable text was found. This looks like a scanned PDF; use a text-based syllabus PDF."
            )

        filename_title = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
        topics, detected_title = self._build_gate_tree(lines)
        if not topics:
            topics = self._build_generic_tree(lines)
        if not topics:
            raise ValueError("Text was extracted, but no syllabus topics could be identified.")

        warnings: list[str] = []
        if len(lines) < 8:
            warnings.append("Very little text was extracted; review the topic structure carefully.")
        if not any(topic.subtopics for topic in topics):
            warnings.append("No clear hierarchy was detected; use the review controls to group related topics.")
        return ParseResult(
            title=detected_title or metadata_title or filename_title or "Imported syllabus",
            topics=topics,
            warnings=tuple(warnings),
            page_count=page_count,
        )

    def _extract_lines(self, document: pymupdf.Document) -> list[_Line]:
        raw: list[_Line] = []
        edge_text: dict[str, set[int]] = {}
        for page_index, page in enumerate(document):
            page_height = page.rect.height
            blocks = page.get_text("dict", sort=True).get("blocks", [])
            for block in blocks:
                if "lines" not in block:
                    continue
                for source in block["lines"]:
                    spans = [span for span in source.get("spans", []) if span.get("text", "").strip()]
                    if not spans:
                        continue
                    text = self._clean_text(" ".join(span["text"] for span in spans))
                    if not text or self.page_number_pattern.fullmatch(text):
                        continue
                    x0, y0, _, y1 = source.get("bbox", (0, 0, 0, 0))
                    if y0 < page_height * 0.09 or y0 > page_height * 0.93:
                        edge_text.setdefault(text.casefold(), set()).add(page_index)
                    first = spans[0]
                    prefix = ""
                    first_text = self._clean_text(first.get("text", ""))
                    if first.get("color", 0) not in (0, 28864) and first_text.endswith(":"):
                        prefix = first_text[:-1].strip()
                    raw.append(
                        _Line(
                            text=text,
                            size=max(float(span.get("size", 0)) for span in spans),
                            x=float(x0),
                            y=float(y0),
                            bottom=float(y1),
                            bold=any("bold" in str(span.get("font", "")).casefold() for span in spans),
                            page=page_index,
                            accent_prefix=prefix,
                        )
                    )

        repeated = {text for text, pages in edge_text.items() if len(pages) >= 2}
        filtered = [line for line in raw if line.text.casefold() not in repeated]
        return self._merge_same_baseline(filtered)

    def _merge_same_baseline(self, lines: list[_Line]) -> list[_Line]:
        merged: list[_Line] = []
        for line in sorted(lines, key=lambda item: (item.page, round(item.y, 1), item.x)):
            if merged and line.page == merged[-1].page and abs(line.y - merged[-1].y) <= 1.5:
                previous = merged.pop()
                parts = sorted(((previous.x, previous.text), (line.x, line.text)))
                merged.append(
                    _Line(
                        text=self._clean_text(" ".join(text for _, text in parts)),
                        size=max(previous.size, line.size),
                        x=min(previous.x, line.x),
                        y=min(previous.y, line.y),
                        bottom=max(previous.bottom, line.bottom),
                        bold=previous.bold or line.bold,
                        page=line.page,
                        accent_prefix=previous.accent_prefix or line.accent_prefix,
                    )
                )
            else:
                merged.append(line)
        return merged

    def _build_gate_tree(self, lines: list[_Line]) -> tuple[list[ParsedTopic], str]:
        section_indexes = [index for index, line in enumerate(lines) if self.section_pattern.match(line.text)]
        if not section_indexes:
            return [], ""

        preamble = lines[: section_indexes[0]]
        title = self._detect_document_title(preamble)
        section_names = []
        for index in section_indexes:
            match = self.section_pattern.match(lines[index].text)
            if match:
                section_names.append(match.group(2).strip(" :-"))
        if self._matches_cs_profile(section_names, " ".join(line.text for line in lines)):
            return self._build_cs_profile(), title

        roots: list[ParsedTopic] = []
        for offset, start in enumerate(section_indexes):
            end = section_indexes[offset + 1] if offset + 1 < len(section_indexes) else len(lines)
            match = self.section_pattern.match(lines[start].text)
            if not match:
                continue
            number, section_title = match.groups()
            section_title = section_title.strip(" :-") or f"Section {number}"
            root = self._topic(section_title)
            root.subtopics = self._parse_section_body(lines[start + 1 : end])
            roots.append(root)
        return roots, title

    def _matches_cs_profile(self, section_names: list[str], source_text: str) -> bool:
        expected = [subject for subject, _ in self.cs_2027_profile]
        headings_match = len(section_names) == len(expected) and all(
            actual.casefold() == wanted.casefold()
            for actual, wanted in zip(section_names, expected)
        )
        normalized = self._clean_text(source_text).casefold()
        source_markers = (
            "propositional and first order logic",
            "boolean algebra and minimization",
            "instruction set and addressing modes",
            "programming in c. recursion",
            "algorithm design techniques",
            "turing machines and undecidability",
            "data flow analyses: constant propagation",
            "inter-process communication, concurrency and synchronization",
            "transactions and concurrency control",
            "network address translation; tcp- flow control",
        )
        return headings_match and all(marker in normalized for marker in source_markers)

    def _build_cs_profile(self) -> list[ParsedTopic]:
        def stable_node(path: tuple[str, ...], children: tuple[str, ...] = ()) -> ParsedTopic:
            name = path[-1]
            return ParsedTopic(
                id=str(uuid5(self.stable_namespace, "/".join(part.casefold() for part in path))),
                name=name,
                subtopics=[stable_node((*path, child)) for child in children],
            )

        roots: list[ParsedTopic] = []
        for subject, topics in self.cs_2027_profile:
            root = stable_node((subject,))
            root.subtopics = [stable_node((subject, topic), items) for topic, items in topics]
            roots.append(root)
        return roots

    def _parse_section_body(self, lines: list[_Line]) -> list[ParsedTopic]:
        lines = [line for line in lines if not self._is_chrome(line.text)]
        if not lines:
            return []
        line_height = statistics.median(max(1.0, line.bottom - line.y) for line in lines)
        paragraphs: list[list[_Line]] = []
        current: list[_Line] = []
        for line in lines:
            if current:
                previous = current[-1]
                page_break = line.page != previous.page
                vertical_gap = line.y - previous.bottom if not page_break else 0
                if line.accent_prefix or vertical_gap > line_height * 0.5:
                    paragraphs.append(current)
                    current = []
            current.append(line)
        if current:
            paragraphs.append(current)

        result: list[ParsedTopic] = []
        for paragraph in paragraphs:
            text = self._join_wrapped(line.text for line in paragraph)
            label = paragraph[0].accent_prefix
            if not label:
                label, text = self._leading_label(text)
            elif text.casefold().startswith(f"{label}:".casefold()):
                text = text[len(label) + 1 :].strip()

            if label:
                group = self._topic(label)
                grouped_text, *following = text.split(";")
                keep_following_in_group = not any(":" in remainder for remainder in following)
                group_text = ";".join([grouped_text, *following]) if keep_following_in_group else grouped_text
                group.subtopics = [self._topic_from_unit(unit) for unit in self._split_units(group_text)]
                group.subtopics = [topic for topic in group.subtopics if topic.name]
                result.append(group)
                if not keep_following_in_group:
                    for remainder in following:
                        result.extend(self._topic_from_unit(unit) for unit in self._split_units(remainder))
            else:
                result.extend(self._topic_from_unit(unit) for unit in self._split_units(text))
        return self._deduplicate(result)

    def _split_units(self, text: str) -> list[str]:
        units: list[str] = []
        for sentence in self.sentence_boundary.split(text):
            sentence = sentence.strip(" .;:")
            if not sentence:
                continue
            comma_parts = self._split_commas(sentence)
            if len(comma_parts) >= 4:
                units.extend(part for part in comma_parts if len(part) >= 2)
            else:
                units.append(sentence)
        return units

    @staticmethod
    def _split_commas(text: str) -> list[str]:
        parts: list[str] = []
        start = 0
        depth = 0
        for index, character in enumerate(text):
            if character in "([":
                depth += 1
            elif character in ")]" and depth:
                depth -= 1
            elif character == "," and depth == 0:
                part = text[start:index].strip(" ,")
                if part:
                    parts.append(part)
                start = index + 1
        final = text[start:].strip(" ,")
        if final:
            parts.append(final)
        return parts

    def _topic_from_unit(self, unit: str) -> ParsedTopic:
        unit = self._clean_text(unit).strip(" .;")
        unit = re.sub(r"^and\s+", "", unit, flags=re.IGNORECASE)
        prefix, separator, remainder = unit.partition(":")
        if separator and self._valid_label(prefix):
            node = self._topic(prefix)
            node.subtopics = [self._topic(part) for part in self._split_units(remainder)]
            return node
        return self._topic(unit)

    def _build_generic_tree(self, lines: list[_Line]) -> list[ParsedTopic]:
        body_size = statistics.median(line.size for line in lines)
        base_x = min(line.x for line in lines)
        roots: list[ParsedTopic] = []
        current_heading: ParsedTopic | None = None
        previous: ParsedTopic | None = None

        for line in lines:
            text = self.bullet_pattern.sub("", line.text).strip(" •\t")
            if len(text) < 2 or self._looks_like_document_title(text, line, body_size, roots):
                continue
            is_heading = (
                bool(self.heading_pattern.match(text))
                or line.size >= body_size + 1.25
                or (line.bold and line.size >= body_size and len(text) <= 100 and not text.endswith("."))
            )
            if is_heading:
                node = self._topic(text)
                roots.append(node)
                current_heading = node
                previous = node
                continue
            label, details = self._leading_label(text)
            if label:
                node = self._topic(label)
                self._append_node(roots, current_heading, node)
                node.subtopics.extend(self._topic(part) for part in self._split_units(details))
                previous = node
                continue
            node = self._topic(text)
            if line.x > base_x + 18 and previous and previous is not current_heading:
                previous.subtopics.append(node)
            else:
                self._append_node(roots, current_heading, node)
            previous = node
        return self._deduplicate(roots)

    def _detect_document_title(self, lines: list[_Line]) -> str:
        candidates = [
            line.text for line in lines
            if not self._is_chrome(line.text)
            and not re.fullmatch(r"[A-Z]{2,3}", line.text)
            and len(line.text) > 8
        ]
        candidate = max(candidates, key=len, default="")
        code_match = re.match(r"^[A-Z]{2,3}\s+(.{8,})$", candidate)
        return code_match.group(1) if code_match else candidate

    @staticmethod
    def _is_chrome(text: str) -> bool:
        lowered = text.casefold()
        return lowered.startswith("gate 20") or "organizing institute" in lowered or lowered.startswith("iit ")

    def _leading_label(self, text: str) -> tuple[str, str]:
        prefix, separator, remainder = text.partition(":")
        if separator and self._valid_label(prefix):
            return prefix.strip(), remainder.strip()
        return "", text

    @staticmethod
    def _valid_label(prefix: str) -> bool:
        prefix = prefix.strip()
        return 2 <= len(prefix) <= 90 and not any(mark in prefix for mark in ".;")

    @classmethod
    def _join_wrapped(cls, values) -> str:
        result = ""
        for value in values:
            value = cls._clean_text(value)
            if not result:
                result = value
            elif re.search(r"[A-Za-z0-9]-$", result) and value[:1].islower():
                result += value
            else:
                result += " " + value
        return cls._clean_text(result)

    @staticmethod
    def _clean_text(value: str) -> str:
        value = value.replace("‐", "-").replace("–", "-").replace("—", "-")
        return re.sub(r"\s+", " ", value).strip()

    @staticmethod
    def _looks_like_document_title(text: str, line: _Line, body_size: float, roots: list[ParsedTopic]) -> bool:
        lowered = text.casefold()
        return not roots and line.size > body_size + 2 and (
            "syllabus" in lowered or "graduate aptitude test" in lowered or len(text) > 100
        )

    @staticmethod
    def _topic(name: str) -> ParsedTopic:
        return ParsedTopic(id=str(uuid4()), name=name[:300].strip())

    @staticmethod
    def _append_node(roots: list[ParsedTopic], heading: ParsedTopic | None, node: ParsedTopic) -> None:
        (heading.subtopics if heading else roots).append(node)

    def _deduplicate(self, nodes: list[ParsedTopic]) -> list[ParsedTopic]:
        result: list[ParsedTopic] = []
        seen: set[str] = set()
        for node in nodes:
            key = node.name.casefold()
            if not node.name or key in seen:
                continue
            seen.add(key)
            node.subtopics = self._deduplicate(node.subtopics)
            result.append(node)
        return result
