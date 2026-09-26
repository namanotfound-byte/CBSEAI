#!/usr/bin/env python3
"""Convert visually reviewed Maths Standard Q/A pairs into safe RAG records.

The source QA file is produced by a page-by-page review of both official PDFs.
This step separates each question from its marking answer and refuses changed
source files, so a practice prompt cannot accidentally reveal the answer.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


APP = Path(__file__).resolve().parents[1]
DATA = APP.parent / "Data"
SOURCE = DATA / "processed/science-maths-2026-27/maths-standard-sqp-2026-27-reviewed-qa.jsonl"
QP_URL = "https://cbseacademic.nic.in/web_material/SQP/ClassX_2026_27/MathsStandard-SQP.pdf"
MS_URL = "https://cbseacademic.nic.in/web_material/SQP/ClassX_2026_27/MathsStandard-MS.pdf"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> list[dict]:
    reviewed = [json.loads(line) for line in SOURCE.read_text().splitlines() if line.strip()]
    if len(reviewed) != 8 or len({row["id"] for row in reviewed}) != 8:
        raise ValueError("Expected the eight uniquely reviewed Mathematics Standard questions")
    rows = []
    for row in reviewed:
        meta = row["meta"]
        if meta["kind"] != "practice_question" or meta["mathsTrack"] != "standard":
            raise ValueError(f"Wrong paper track or kind: {row['id']}")
        if meta["reviewStatus"] != "approved" or meta["academicSession"] != "2026-27":
            raise ValueError(f"Unapproved question: {row['id']}")
        if digest(DATA / meta["sourcePath"]) != meta["sourceSha256"]:
            raise ValueError(f"Question-paper PDF changed: {row['id']}")
        if digest(DATA / meta["answerSourcePath"]) != meta["answerSourceSha256"]:
            raise ValueError(f"Marking-scheme PDF changed: {row['id']}")
        if digest(DATA / meta["curriculumPath"]) != meta["curriculumSha256"]:
            raise ValueError(f"Maths curriculum PDF changed: {row['id']}")
        question_number = int(meta["questionNumber"])
        chapter = int(meta["syllabusTopicId"].split("ch")[-1])
        prefix = f"2026-27|041|MathsStandard-SQP|Q{question_number}"
        question = re.sub(r"\s+(?=\([ABCD]\)\s)", "\n", row["questionText"].strip())
        answer = row["markingSchemeText"].strip()
        if not question or not answer or not answer.startswith(f"({meta['correctOption']})"):
            raise ValueError(f"Missing question or wrong marking option: {row['id']}")
        shared = {
            "subject": "maths", "chapter": chapter, "sourceYear": "2026",
            "syllabusVersion": "2026-27", "syllabusTopicId": meta["syllabusTopicId"],
            "inActiveSyllabus": True, "assessmentStatus": "summative",
            "reviewStatus": "approved", "language": "en", "mathsTrack": "standard",
            "reviewBatch": "maths-standard-sqp-20260926-v1",
            "reviewEvidence": "reports/maths-standard-sqp-2026-27-reviewed-qa.md",
            "sourceTransform": "visual-question-answer-split-v1",
            "joinPrefix": prefix,
        }
        rows.extend([
            {
                "id": f"sqp.maths.standard.2026-27.q{question_number:02d}",
                "text": question,
                "meta": {
                    **shared, "kind": "sqp", "chunkType": "question_block",
                    "page": meta["questionPdfPage"], "sourcePath": meta["sourcePath"],
                    "contentSha256": meta["sourceSha256"], "officialUrl": QP_URL,
                    "heading": f"Mathematics Standard (041) Sample Question Paper 2026-27 · Q{question_number}",
                    "extractiveQuote": question[:240],
                },
            },
            {
                "id": f"ms.maths.standard.2026-27.q{question_number:02d}",
                "text": answer,
                "meta": {
                    **shared, "kind": "ms", "chunkType": "marking_scheme",
                    "page": meta["markingSchemePdfPage"],
                    "sourcePath": meta["answerSourcePath"],
                    "contentSha256": meta["answerSourceSha256"], "officialUrl": MS_URL,
                    "heading": f"Mathematics Standard (041) Marking Scheme 2026-27 · Q{question_number}",
                    "joinKey": f"{prefix}|answer", "extractiveQuote": answer[:240],
                },
            },
        ])
    return rows


if __name__ == "__main__":
    chunks = build()
    output = DATA / "processed/science-maths-2026-27/maths-standard-sqp-reviewed-addendum.jsonl"
    output.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in chunks))
    (APP / "data/corpus/maths-standard-sqp-reviewed-addendum.json").write_text(
        json.dumps(chunks, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({"approvedRows": len(chunks), "questionPairs": len(chunks) // 2}))
