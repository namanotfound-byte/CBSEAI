#!/usr/bin/env python3
"""Create a conservative staging corpus from the supplied current syllabus/NCERT PDFs.

Nothing written here is live. Uncertain pages are reported and omitted. Historical
papers and marking schemes require question-level joins and are inventoried but
not silently added as current evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

from pypdf import PdfReader


HERE = Path(__file__).resolve().parents[1]
POLICY = json.loads((HERE / "data/corpus/syllabus_2026_27.json").read_text())
TOPICS = {(t["subject"], t["chapter"]): t for t in POLICY["topics"]}
CURRICULUM = {
    "science": ("Science_2026-27.pdf", "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Science_SecP1_2026-27.pdf"),
    "maths": ("Maths_2026-27.pdf", "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1X_2026-27.pdf"),
}
NCERT = {
    "science": ("Science_2026.zip", "jesc1", "https://ncert.nic.in/textbook.php?jesc1=0-13"),
    "maths": ("Maths_2026.zip", "jemh1", "https://ncert.nic.in/textbook.php?jemh1=0-14"),
}


def normalise(text: str) -> str:
    text = text.replace("\u00ad", "").replace("\u0000", "")
    text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def units(text: str) -> list[str]:
    """Split a page at NCERT section/question headings, then at sentences."""
    text = normalise(text)
    if not text:
        return []
    # Repeated PDF heading glyphs collapse to one section heading.
    text = re.sub(r"(\b\d{1,2}\.\d+(?:\.\d+)?\s+[A-Z][A-Z ]{4,}?)(?:\1){1,}", r"\1", text)
    sections = re.split(r"(?=\b\d{1,2}\.\d+(?:\.\d+)?\s+[A-Z][A-Z ]{3,})", text)
    result = []
    for section in sections:
        section = re.sub(r"\s+", " ", section).strip()
        if not section:
            continue
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z(\d])", section)
        buffer = ""
        for sentence in sentences:
            if len(buffer) + len(sentence) > 1100 and buffer:
                result.append(buffer.strip())
                buffer = ""
            buffer += (" " if buffer else "") + sentence
        if buffer:
            result.append(buffer.strip())
    return result


def excluded(text: str, topic: dict) -> str | None:
    lower = text.lower()
    for term in topic.get("excludedTerms", []):
        if term in lower:
            return f"excluded_term:{term}"
    for term in topic.get("formativeTerms", []):
        if term in lower:
            return f"formative_term:{term}"
    return None


def meta(kind: str, topic: dict, digest: str, url: str, page: int, **extra) -> dict:
    return {
        "kind": kind,
        "subject": topic["subject"],
        "chapter": topic["chapter"],
        "sourceYear": "2026" if kind == "syllabus" else "undated",
        "syllabusVersion": POLICY["version"],
        "syllabusTopicId": topic["id"],
        "chunkType": "syllabus_scope" if kind == "syllabus" else "ncert_section",
        "heading": topic["title"],
        "officialUrl": url,
        "inActiveSyllabus": True,
        "assessmentStatus": "summative",
        "reviewStatus": "staging",
        "contentSha256": digest,
        "language": "en",
        "page": page,
        "extractionVersion": "pypdf-6.10.0-section-v1",
        **extra,
    }


def build(root: Path) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    warnings: list[dict] = []
    for subject, (file, url) in CURRICULUM.items():
        payload = (root / "Curriculum-2026" / file).read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        reader = PdfReader(io.BytesIO(payload))
        for topic in (t for t in POLICY["topics"] if t["subject"] == subject):
            page = topic["curriculumPage"]
            if page > len(reader.pages):
                raise ValueError(f"Curriculum page missing: {file} page {page}")
            rows.append({
                "id": topic["id"],
                "text": f"{topic['title']}. Current CBSE 2026-27 scope: {topic['scope']}",
                "meta": meta("syllabus", topic, digest, url, page,
                             sourcePath=f"Curriculum-2026/{file}"),
            })
    for subject, (archive_name, prefix, url) in NCERT.items():
        with ZipFile(root / "NCERTs" / archive_name) as archive:
            for chapter in range(1, 15 if subject == "maths" else 14):
                topic = TOPICS[(subject, chapter)]
                member = f"{prefix}{chapter:02d}.pdf"
                payload = archive.read(member)
                digest = hashlib.sha256(payload).hexdigest()
                reader = PdfReader(io.BytesIO(payload), strict=False)
                for page_no, page in enumerate(reader.pages, 1):
                    try:
                        text = page.extract_text() or ""
                    except Exception as exc:
                        warnings.append({"source": member, "page": page_no, "reason": f"extract_failed:{type(exc).__name__}"})
                        continue
                    if len(text.strip()) < 120:
                        warnings.append({"source": member, "page": page_no, "reason": "low_text_needs_visual_review"})
                        continue
                    for unit_no, unit in enumerate(units(text), 1):
                        if len(unit) < 140:
                            continue
                        reason = excluded(unit, topic)
                        if reason:
                            warnings.append({"source": member, "page": page_no, "unit": unit_no, "reason": reason})
                            continue
                        if "\ufffd" in unit or len(re.findall(r"[^\w\s.,;:()!?+\-/=°%]", unit)) > len(unit) * 0.18:
                            warnings.append({"source": member, "page": page_no, "unit": unit_no, "reason": "noisy_text_needs_visual_review"})
                            continue
                        unit_id = f"ncert.{subject}.ch{chapter:02d}.p{page_no:03d}.u{unit_no:02d}"
                        rows.append({
                            "id": unit_id,
                            "text": unit,
                            "meta": meta("ncert", topic, digest, url, page_no,
                                         sourcePath=f"NCERTs/{archive_name}!/{member}",
                                         extractiveQuote=unit[:240]),
                        })
    report = {
        "syllabusVersion": POLICY["version"],
        "records": len(rows),
        "kinds": dict(Counter(row["meta"]["kind"] for row in rows)),
        "subjects": dict(Counter(row["meta"]["subject"] for row in rows)),
        "chaptersWithEvidence": sorted({row["meta"]["syllabusTopicId"] for row in rows if row["meta"]["kind"] == "ncert"}),
        "warningCounts": dict(Counter(item["reason"] for item in warnings)),
        "warnings": warnings,
        "status": "staging_only_no_live_index",
    }
    return rows, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=Path("../Data"))
    args = parser.parse_args()
    root = args.data_root.resolve()
    rows, report = build(root)
    processed = root / "processed" / "science-maths-2026-27"
    processed.mkdir(parents=True, exist_ok=True)
    (processed / "staging.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    report_path = root / "reports" / "science-maths-extraction.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"staging": str(processed / "staging.jsonl"), "report": str(report_path),
                      "records": report["records"], "kinds": report["kinds"],
                      "subjects": report["subjects"], "warningCounts": report["warningCounts"]}, indent=2))


if __name__ == "__main__":
    main()
