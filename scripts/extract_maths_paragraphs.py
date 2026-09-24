#!/usr/bin/env python3
"""Stage layout-aware Maths prose for page-by-page human review only.

Formulae, worked examples, diagrams and questions are deliberately withheld.
This file never marks a passage approved or writes to the live index.
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
TOPICS = {item["chapter"]: item for item in POLICY["topics"] if item["subject"] == "maths"}
ARCHIVE = "Maths_2026.zip"
OFFICIAL_URL = "https://ncert.nic.in/textbook.php?jemh1=0-14"
OUTPUT = DATA / "processed/science-maths-2026-27/maths-paragraph-staging.jsonl"
REPORT = DATA / "reports/maths-paragraph-extraction.json"
VISUAL = re.compile(r"\b(?:fig(?:ure)?\.?|diagram|graph|table|activity|exercise|example|proof|"
                    r"construction|draw|sketch|shown|above|below|see|look at)\b", re.I)
NOTATION = re.compile(r"[=<>√∑∫²³⁴⁵⁶⁷⁸⁹×÷±∠∆△πθ]|[\ue000-\uf8ff\ufffd]")


def page_lines(page: pdfplumber.page.Page) -> list[dict]:
    words = [word for word in page.extract_words(x_tolerance=1.4, y_tolerance=2)
             if 108 <= word["top"] < 678 and 63 <= word["x0"] and word["x1"] <= 448]
    groups: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not groups or abs(word["top"] - groups[-1][0]["top"]) > 2:
            groups.append([word])
        else:
            groups[-1].append(word)
    return [{"top": group[0]["top"], "x0": min(item["x0"] for item in group),
             "text": " ".join(item["text"] for item in sorted(group, key=lambda item: item["x0"]))}
            for group in groups]


def paragraphs(page: pdfplumber.page.Page) -> list[str]:
    groups: list[list[str]] = []
    previous_top: float | None = None
    for line in page_lines(page):
        text = line["text"].strip()
        if not text:
            continue
        new = (not groups or line["x0"] >= 83 or
               (previous_top is not None and line["top"] - previous_top > 20))
        if new:
            groups.append([text])
        else:
            groups[-1].append(text)
        previous_top = line["top"]
    return [re.sub(r"(?<=\w)-\s+(?=\w)", "", " ".join(group)).strip() for group in groups]


def reject(text: str, topic: dict) -> str | None:
    if len(text) < 110 or len(text) > 1000:
        return "length"
    if not text[0].isupper() or text[-1] not in ".!?":
        return "boundary"
    if NOTATION.search(text) or re.search(r"\b\w+\d+\b|\d+\w+\b", text):
        return "notation"
    if VISUAL.search(text):
        return "visual_or_example"
    lower = text.lower()
    if any(term in lower for term in topic.get("formativeTerms", [])):
        return "formative"
    if any(term in lower for term in topic.get("excludedTerms", [])):
        return "excluded"
    return None


def main() -> None:
    rows = []
    reasons = Counter()
    with ZipFile(DATA / "NCERTs" / ARCHIVE) as archive:
        for chapter, topic in TOPICS.items():
            member = f"jemh1{chapter:02d}.pdf"
            payload = archive.read(member)
            digest = hashlib.sha256(payload).hexdigest()
            with pdfplumber.open(io.BytesIO(payload)) as pdf:
                for page_number, page in enumerate(pdf.pages, 1):
                    try:
                        candidates = paragraphs(page)
                    except Exception as error:
                        reasons[type(error).__name__] += 1
                        continue
                    for number, text in enumerate(candidates, 1):
                        reason = reject(text, topic)
                        if reason:
                            reasons[reason] += 1
                            continue
                        rows.append({
                            "id": f"ncert.maths.ch{chapter:02d}.p{page_number:03d}.para{number:02d}",
                            "text": text,
                            "meta": {
                                "kind": "ncert", "subject": "maths", "chapter": chapter,
                                "sourceYear": "undated", "syllabusVersion": POLICY["version"],
                                "syllabusTopicId": topic["id"], "chunkType": "ncert_paragraph",
                                "heading": topic["title"], "officialUrl": OFFICIAL_URL,
                                "inActiveSyllabus": True, "assessmentStatus": "summative",
                                "reviewStatus": "staging", "contentSha256": digest,
                                "language": "en", "page": page_number,
                                "extractionVersion": "pdfplumber-maths-prose-v1",
                                "sourcePath": f"NCERTs/{ARCHIVE}!/{member}",
                                "extractiveQuote": text[:240],
                            },
                        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = {"status": "staging_only_manual_visual_review_required", "rows": len(rows),
              "chapters": dict(Counter(row["meta"]["chapter"] for row in rows)),
              "rejections": dict(reasons)}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
