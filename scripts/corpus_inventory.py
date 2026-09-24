#!/usr/bin/env python3
"""Inventory the supplied Class X corpus without changing original files.

Run with the bundled Python or any Python with pypdf 6.10.0 installed:
  python scripts/corpus_inventory.py --data-root ../Data

This is deliberately conservative: a path suggests a label, but a PDF cover
can override it. Uncertain records stay review_pending and cannot be indexed.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from zipfile import BadZipFile, ZipFile

from pypdf import PdfReader


SUBJECT_TOKENS = {
    "science": ("science", "sci_", "sci-", "_086", "086_"),
    "maths": ("math", "mathematics", "_041", "041_", "_241", "241_"),
}


def guess_subject(name: str, cover: str) -> tuple[str | None, str, list[str]]:
    lower = name.lower().replace("\\", "/")
    warnings: list[str] = []
    path_subject = next(
        (subject for subject, tokens in SUBJECT_TOKENS.items() if any(t in lower for t in tokens)),
        None,
    )
    first = re.sub(r"\s+", " ", cover[:3500]).lower()
    cover_subject = None
    if re.search(r"(?:subject\s*code|code\s*no\.?|code)\s*[:\-–]?\s*0?86\b", first):
        cover_subject = "science"
    elif re.search(r"(?:subject\s*code|code\s*no\.?|code)\s*[:\-–]?\s*(?:0?41|241)\b", first):
        cover_subject = "maths"
    elif "social science" in first[:450]:
        cover_subject = "social"
    elif "mathematics" in first[:450]:
        cover_subject = "maths"
    elif "science" in first[:250] and "social" not in first[:250]:
        cover_subject = "science"
    if cover_subject and path_subject and cover_subject != path_subject:
        warnings.append(f"path_says_{path_subject}_cover_says_{cover_subject}")
    return cover_subject or path_subject, "cover" if cover_subject else "path" if path_subject else "unknown", warnings


def source_type(path: str) -> str:
    top = path.split("/")[0]
    return {
        "Curriculum-2026": "syllabus",
        "NCERTs": "ncert",
        "SQP": "sqp_or_ms",
        "PYQs": "pyqp_or_ms",
        "Exemplars": "exemplar",
        "CFPQ": "cfpq",
        "Model Paper": "model",
        "Additional Practice Questions": "apq",
        "CBSE Question Bank": "question_bank",
        "Item Bank": "item_bank",
        "Competency Based Test Items CBSE": "competency_test",
    }.get(top, "unknown")


def source_year(path: str) -> str | None:
    years = re.findall(r"20\d{2}", path)
    return years[-1] if years else None


def cover_year(cover: str) -> str | None:
    match = re.search(r"\b(20\d{2})\s*[-–]\s*(?:20)?(\d{2})\b", cover[:5000])
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    match = re.search(r"\b(?:year|session|examination|exam)\s*[:\-–]?\s*(20\d{2})\b", cover[:5000], re.I)
    return match.group(1) if match else None


def publication_year(cover: str) -> str | None:
    match = re.search(
        r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b",
        cover[:6000], re.I,
    )
    if match:
        return match.group(1)
    match = re.search(r"\b(?:published|publication|copyright|©)\s*[:\-–]?\s*(20\d{2})\b", cover[:6000], re.I)
    return match.group(1) if match else None


def maths_track(cover: str) -> str | None:
    first = re.sub(r"\s+", " ", cover[:2500]).lower()
    if re.search(r"mathematics\s*[-–()]?\s*basic|\bcode\s*[:\-–]?\s*241\b", first):
        return "basic"
    if re.search(r"mathematics\s*[-–()]?\s*standard|\bcode\s*[:\-–]?\s*0?41\b", first):
        return "standard"
    return None


def document_role(path: str, cover: str) -> str | None:
    first = re.sub(r"\s+", " ", cover[:3000]).lower()
    name = path.lower()
    if re.search(r"marking scheme|marking schemes|answer key|solutions?", first[:1200]):
        return "marking_scheme"
    if re.search(r"sample question paper|question paper|question booklet", first[:1200]):
        return "question_paper"
    if re.search(r"(?:_ms_|/ms/|marking)", name):
        return "marking_scheme_candidate"
    if re.search(r"(?:_qp_|/qp/|question)", name):
        return "question_paper_candidate"
    return None


def inspect_pdf(payload: bytes) -> tuple[int | None, str, list[str]]:
    warnings: list[str] = []
    try:
        reader = PdfReader(io.BytesIO(payload), strict=False)
        if reader.is_encrypted:
            return len(reader.pages), "", ["encrypted_pdf"]
        texts = [(page.extract_text() or "") for page in reader.pages[:2]]
        if any(len(text.strip()) < 80 for text in texts):
            warnings.append("low_text_first_pages_needs_ocr_review")
        return len(reader.pages), "\n".join(texts), warnings
    except Exception as exc:
        return None, "", [f"pdf_parse_failed:{type(exc).__name__}"]


def row_for(payload: bytes, path: str, member: str | None) -> dict:
    display = f"{path}!/{member}" if member else path
    pages, cover, warnings = inspect_pdf(payload)
    subject, confidence, more = guess_subject(display, cover)
    warnings.extend(more)
    named_year = source_year(display)
    published_year = publication_year(cover)
    if named_year and published_year and named_year != published_year:
        warnings.append("filename_year_differs_from_internal_publication_year")
    kind = source_type(path)
    if kind == "unknown":
        warnings.append("unknown_source_type")
    if not subject:
        warnings.append("subject_unresolved")
    if kind in {"sqp_or_ms", "pyqp_or_ms"}:
        warnings.append("question_paper_vs_marking_scheme_needs_review")
    if subject == "maths" and kind in {"sqp_or_ms", "pyqp_or_ms"}:
        warnings.append("maths_standard_vs_basic_needs_cover_review")
    return {
        "sourceId": hashlib.sha256(display.encode()).hexdigest()[:20],
        "relativePath": path,
        "archiveMember": member,
        "contentSha256": hashlib.sha256(payload).hexdigest(),
        "bytes": len(payload),
        "pages": pages,
        "sourceTypeCandidate": kind,
        "subjectCandidate": subject,
        "subjectEvidence": confidence,
        "sourceYearCandidate": named_year,
        "internalSessionCandidate": cover_year(cover),
        "internalPublicationYearCandidate": published_year,
        "mathsTrackCandidate": maths_track(cover) if subject == "maths" else None,
        "documentRoleCandidate": document_role(display, cover),
        "coverExcerpt": re.sub(r"\s+", " ", cover[:500]).strip(),
        "syllabusVersion": None,
        "officialUrl": None,
        "processingStatus": "review_pending",
        "warnings": warnings,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=Path("../Data"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = args.data_root.resolve()
    output = args.output or root / "manifests" / "science-maths-inventory.jsonl"
    if not root.is_dir():
        parser.error(f"Data root does not exist: {root}")
    rows: list[dict] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".pdf", ".zip"}:
            continue
        relative = path.relative_to(root).as_posix()
        if path.suffix.lower() == ".pdf":
            rows.append(row_for(path.read_bytes(), relative, None))
            continue
        try:
            with ZipFile(path) as archive:
                for member in sorted(archive.namelist()):
                    if member.lower().endswith(".pdf"):
                        rows.append(row_for(archive.read(member), relative, member))
        except BadZipFile:
            rows.append({"relativePath": relative, "processingStatus": "rejected", "warnings": ["bad_zip"]})
    # A path like Social_Science is not sufficient evidence for a Science label.
    # Keep uncertain subject rows out of this Maths/Science manifest.
    rows = [row for row in rows if row.get("subjectCandidate") in {"science", "maths"}]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    report = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "dataRoot": str(root),
        "records": len(rows),
        "subjects": dict(Counter(row.get("subjectCandidate") for row in rows)),
        "sourceTypes": dict(Counter(row.get("sourceTypeCandidate") for row in rows)),
        "warnings": dict(Counter(w for row in rows for w in row["warnings"])),
        "indexableWithoutReview": 0,
        "note": "Inventory candidates are not approved syllabus mappings or retrievable content.",
    }
    report_path = root / "reports" / "science-maths-inventory.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"manifest": str(output), "report": str(report_path), **report}, indent=2))


if __name__ == "__main__":
    main()
