#!/usr/bin/env python3
"""Stage conservative NCERT Science main-column paragraphs for visual review.

This layout-aware pass complements, and never overwrites, staging.jsonl. It
rejects sidebars and ambiguous text rather than publishing them as evidence.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

import pdfplumber


APP = Path(__file__).resolve().parents[1]
DATA = APP.parent / "Data"
POLICY = json.loads((APP / "data/corpus/syllabus_2026_27.json").read_text())
TOPICS = {t["chapter"]: t for t in POLICY["topics"] if t["subject"] == "science"}
ARCHIVE = "Science_2026.zip"
OFFICIAL_URL = "https://ncert.nic.in/textbook.php?jesc1=0-13"
OUTPUT = DATA / "processed/science-maths-2026-27/science-paragraph-staging.jsonl"
REPORT = DATA / "reports/science-paragraph-extraction.json"
SKIP_PAGES = {(8, 3): "problematic_pdf_page"}
EXCLUDE_PATTERN = re.compile(
    r"\b(?:activity|exercise|figure|fig\.|table|more to know|think it over|questions?|"
    r"what you have learnt|reprint|introduction)\b", re.I,
)


def lines(page: pdfplumber.page.Page) -> list[dict]:
    words = [word for word in page.extract_words(x_tolerance=1.5, y_tolerance=2)
             if 45 <= word["top"] < 705]
    grouped: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not grouped or abs(word["top"] - grouped[-1][0]["top"]) > 2:
            grouped.append([word])
        else:
            grouped[-1].append(word)
    result = []
    for group in grouped:
        group.sort(key=lambda item: item["x0"])
        x0 = min(item["x0"] for item in group)
        x1 = max(item["x1"] for item in group)
        # NCERT Science's prose occupies a stable right-side text column;
        # sidebars, activity boxes and page furniture begin left of it.
        if x0 < 175 or x1 > 545:
            continue
        result.append({"top": group[0]["top"], "x0": x0,
                       "text": " ".join(item["text"] for item in group)})
    return result


def paragraphs(page: pdfplumber.page.Page) -> list[str]:
    body = lines(page)
    groups: list[list[str]] = []
    previous_top: float | None = None
    for line in body:
        text = line["text"].strip()
        if not text:
            continue
        new_paragraph = (
            not groups or line["x0"] >= 194 or
            (previous_top is not None and line["top"] - previous_top > 19)
        )
        if new_paragraph:
            groups.append([text])
        else:
            groups[-1].append(text)
        previous_top = line["top"]
    return [re.sub(r"(?<=\w)-\s+(?=\w)", "", " ".join(group)).strip()
            for group in groups]


def reject_reason(text: str, topic: dict) -> str | None:
    if len(text) < 150 or len(text) > 1200:
        return "length"
    if not text[0].isupper() or text[-1] not in ".!?":
        return "partial_sentence_boundary"
    if EXCLUDE_PATTERN.search(text):
        return "layout_sensitive_label"
    if re.search(r"[\ue000-\uf8ff\ufffd]|/(?:square|circle|triangle)\d*", text):
        return "pdf_glyph"
    if re.search(r"[=<>√∑∫²³]|\b(?:diagram|formula|graph|equation)\b", text, re.I):
        return "notation_or_visual"
    lower = text.lower()
    if any(term in lower for term in topic.get("formativeTerms", [])):
        return "formative"
    if any(term in lower for term in topic.get("excludedTerms", [])):
        return "excluded"
    return None


def main() -> None:
    rows = []
    warnings = []
    counts = Counter()
    with ZipFile(DATA / "NCERTs" / ARCHIVE) as archive:
        for chapter in range(1, 14):
            member = f"jesc1{chapter:02d}.pdf"
            payload = archive.read(member)
            digest = hashlib.sha256(payload).hexdigest()
            topic = TOPICS[chapter]
            with pdfplumber.open(io.BytesIO(payload)) as pdf:
                for page_number, page in enumerate(pdf.pages, 1):
                    if (chapter, page_number) in SKIP_PAGES:
                        warnings.append({"chapter": chapter, "page": page_number,
                                         "reason": SKIP_PAGES[(chapter, page_number)]})
                        continue
                    try:
                        candidates = paragraphs(page)
                    except Exception as error:
                        warnings.append({"chapter": chapter, "page": page_number,
                                         "reason": type(error).__name__})
                        continue
                    for number, text in enumerate(candidates, 1):
                        reason = reject_reason(text, topic)
                        if reason:
                            counts[reason] += 1
                            continue
                        rows.append({
                            "id": f"ncert.science.ch{chapter:02d}.p{page_number:03d}.para{number:02d}",
                            "text": text,
                            "meta": {
                                "kind": "ncert", "subject": "science", "chapter": chapter,
                                "sourceYear": "undated", "syllabusVersion": POLICY["version"],
                                "syllabusTopicId": topic["id"], "chunkType": "ncert_paragraph",
                                "heading": topic["title"], "officialUrl": OFFICIAL_URL,
                                "inActiveSyllabus": True, "assessmentStatus": "summative",
                                "reviewStatus": "staging", "contentSha256": digest,
                                "language": "en", "page": page_number,
                                "extractionVersion": "pdfplumber-main-column-v2",
                                "sourcePath": f"NCERTs/{ARCHIVE}!/{member}",
                                "extractiveQuote": text[:240],
                            },
                        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    report = {"status": "staging_only_manual_visual_review_required",
              "rows": len(rows), "chapters": dict(Counter(r["meta"]["chapter"] for r in rows)),
              "rejections": dict(counts), "warnings": warnings}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"rows": len(rows), "chapters": report["chapters"],
                      "rejections": report["rejections"], "warnings": len(warnings)}, indent=2))


if __name__ == "__main__":
    main()
