#!/usr/bin/env python3
"""Check extraction provenance and prioritise manual review of staged rows.

This is a triage report, not an approval mechanism. It never edits the corpus.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "Data"
STAGING = DATA / "processed/science-maths-2026-27/staging.jsonl"
REPORT = DATA / "reports/science-maths-qa.json"


def source_bytes(source: str) -> bytes:
    archive, marker, member = source.partition("!/")
    path = DATA / archive
    if marker:
        with ZipFile(path) as zipped:
            return zipped.read(member)
    return path.read_bytes()


def flags(row: dict) -> list[str]:
    text = row["text"]
    meta = row["meta"]
    found: list[str] = []
    if len(text) < 200 or len(text) > 1400:
        found.append("unusual_length")
    if re.search(r"/(?:square|circle|triangle|bullet)\d*", text, re.I):
        found.append("unresolved_pdf_glyph")
    if "\ufffd" in text or re.search(r"[\ue000-\uf8ff]", text):
        found.append("invalid_or_private_glyph")
    if re.search(r"\b(?:figure|fig\.|table|activity|exercise|example)\b", text, re.I):
        found.append("visual_or_question_context")
    if re.search(r"[=<>√∑∫²³°]|\b(?:formula|equation|prove|graph|diagram)\b", text, re.I):
        found.append("math_or_science_notation")
    if re.search(r"(?:\b\w+\b[ \t]*){3,}", text[:100]) is None:
        found.append("sparse_reading_order")
    if text.count("?") >= 3:
        found.append("question_heavy")
    if not text.startswith(meta.get("extractiveQuote", "")) and meta["kind"] == "ncert":
        found.append("quote_mismatch")
    return found


def main() -> None:
    rows = [json.loads(line) for line in STAGING.read_text().splitlines() if line]
    digests: dict[str, str] = {}
    by_chapter: dict[str, Counter] = defaultdict(Counter)
    row_flags: Counter = Counter()
    flagged = []
    for row in rows:
        meta = row["meta"]
        source = meta["sourcePath"]
        if source not in digests:
            digests[source] = hashlib.sha256(source_bytes(source)).hexdigest()
        checks = flags(row)
        if digests[source] != meta["contentSha256"]:
            checks.append("source_checksum_mismatch")
        if meta["reviewStatus"] != "staging":
            checks.append("unexpected_review_status")
        chapter = meta["syllabusTopicId"]
        by_chapter[chapter]["rows"] += 1
        if checks:
            by_chapter[chapter]["flagged_rows"] += 1
            row_flags.update(checks)
            for check in checks:
                by_chapter[chapter][check] += 1
            flagged.append({"id": row["id"], "flags": checks})

    report = {
        "status": "triage_only_no_automatic_approval",
        "rows": len(rows),
        "sourceFilesVerified": len(digests),
        "flaggedRows": len(flagged),
        "flagCounts": dict(row_flags),
        "chapters": {key: dict(value) for key, value in sorted(by_chapter.items())},
        "flagged": flagged,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("status", "rows", "sourceFilesVerified", "flaggedRows", "flagCounts")}, indent=2))


if __name__ == "__main__":
    main()
