#!/usr/bin/env python3
"""Create a page-level QA queue for current SQPs and marking schemes.

PDF reading order corrupts some Maths questions, equations and tables. These
records are deliberately not Chunk rows and cannot be ingested as answers.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from pypdf import PdfReader


SOURCES = (
    ("maths", "standard", "question_paper", "SQP/Maths/Maths_QP_2026.pdf"),
    ("maths", "standard", "marking_scheme", "SQP/Maths/Maths_MS_2026.pdf"),
    ("science", None, "question_paper", "SQP/Science/Science_SQP_2026.pdf"),
    ("science", None, "marking_scheme", "SQP/Science/Science_MS_2026.pdf"),
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=Path("../Data"))
    args = parser.parse_args()
    root = args.data_root.resolve()
    rows = []
    for subject, track, role, relative in SOURCES:
        path = root / relative
        payload = path.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        reader = PdfReader(path, strict=False)
        for page_no, page in enumerate(reader.pages, 1):
            warnings = []
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                text = ""
                warnings.append(f"extract_failed:{type(exc).__name__}")
            compact = re.sub(r"[ \t]+", " ", text).strip()
            if len(compact) < 120:
                warnings.append("low_text_needs_ocr")
            if re.search(r"\b(?:fig(?:ure)?|diagram|graph|given below|shown below)\b", compact, re.I):
                warnings.append("visual_content_needs_review")
            if subject == "maths":
                warnings.append("formula_and_reading_order_needs_review")
            if role == "marking_scheme":
                warnings.append("mark_split_needs_question_part_review")
            question_candidates = sorted({int(n) for n in re.findall(r"(?m)^\s*(\d{1,2})\s*[.)]?\s+(?=[A-Z(√(])", text)
                                          if 1 <= int(n) <= (38 if subject == "maths" else 39)})
            rows.append({
                "id": f"paper.{subject}.{track or 'core'}.{role}.p{page_no:03d}",
                "subject": subject,
                "subjectCode": "041" if subject == "maths" else "086",
                "mathsTrack": track,
                "academicSession": "2026-27",
                "documentRole": role,
                "sourcePath": relative,
                "contentSha256": digest,
                "pdfPage": page_no,
                "questionNumberCandidates": question_candidates,
                "text": compact,
                "warnings": warnings,
                "processingStatus": "review_pending",
            })
    out = root / "processed" / "science-maths-2026-27" / "paper-review-queue.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    report = {
        "pages": len(rows),
        "roles": dict(Counter(row["documentRole"] for row in rows)),
        "warnings": dict(Counter(w for row in rows for w in row["warnings"])),
        "status": "review_pending_no_question_or_marking_scheme_chunks_indexed",
    }
    report_path = root / "reports" / "science-maths-paper-review.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"queue": str(out), "report": str(report_path), **report}, indent=2))


if __name__ == "__main__":
    main()
