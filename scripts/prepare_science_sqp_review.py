#!/usr/bin/env python3
"""Rebuild the page-reviewed 2026-27 Science SQP question/answer pairs.

Only the five diagram-free questions verified against the rendered question
paper and marking scheme are admitted. Source hashes stop a changed PDF from
silently inheriting this approval.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


APP = Path(__file__).resolve().parents[1]
DATA = APP.parent / "Data"
QP = DATA / "SQP/Science/Science_SQP_2026.pdf"
MS = DATA / "SQP/Science/Science_MS_2026.pdf"
QP_SHA = "09bf85a26357d9b3c44976e722a4532c383a99ccbd97e8fc9a0fb06c8ac64eff"
MS_SHA = "195e5b399354e5334af15e8e42688923272d430876b18e5f1e609e1c6709ce5e"
QP_URL = "https://cbseacademic.nic.in/web_material/SQP/ClassX_2026_27/Science-SQP.pdf"
MS_URL = "https://cbseacademic.nic.in/web_material/SQP/ClassX_2026_27/Science-MS.pdf"

# Question and answer text was read from the rendered PDF tables, including
# every option letter and the exact one-mark marking-scheme row.
REVIEWED = [
    (1, 1, 1, 5, "photosynthesis",
     "During photosynthesis, what happens to carbon dioxide and water as glucose is formed?\n"
     "A. Carbon dioxide gains hydrogen, while water loses electrons.\n"
     "B. Carbon dioxide loses oxygen, while water gains oxygen.\n"
     "C. Carbon dioxide is oxidised, while water is reduced.\n"
     "D. Both carbon dioxide and water undergo reduction.",
     "A. Carbon dioxide gains hydrogen, while water loses electrons. (1 mark)"),
    (3, 2, 1, 5, "kidney reabsorption",
     "During urine formation, tubular reabsorption and secretion take place in the kidneys. Which of the following sets correctly indicates both the substances that are reabsorbed in the kidneys?\n"
     "A. Glucose and salts\nB. Glucose and starch\nC. Glycogen and salts\nD. Glycogen and starch",
     "A. Glucose and salts. (1 mark)"),
    (4, 2, 1, 7, "pollination",
     "In a controlled experiment, the anthers of a mustard plant's flowers were carefully removed in the bud stage before they matured. The bud was covered with a paper bag. What will be the most likely result for these flowers?\n"
     "A. They will still produce seeds and fruit through self-pollination.\n"
     "B. They will attract more insects and produce larger flowers but no fruit.\n"
     "C. They will not produce any seeds or fruits.\n"
     "D. They will produce seeds and fruits that are genetically identical to the parent.",
     "C. They will not produce any seeds or fruits. (1 mark)"),
    (5, 2, 1, 7, "contraception",
     "The Vas deferens and the Oviduct are both targets for surgical contraception (Vasectomy and Tubectomy respectively). Analysing the process of reproduction, what common biological event is prevented by blocking both these structures?\n"
     "A. The production of gametes (sperm and egg).\n"
     "B. The implantation of the fertilized egg into the uterine wall.\n"
     "C. The successful meeting and fusion of the male and the female gametes.\n"
     "D. The release of hormones - testosterone and estrogen.",
     "C. The successful meeting and fusion of the male and female gametes. (1 mark)"),
    (7, 2, 1, 13, "food chain trophic level",
     "A fish living in a pond ecosystem feeds on small aquatic insects (larvae). These insect larvae, in turn, feed on green algae and small photosynthetic bacteria. In this specific food chain, what is the trophic level classification of fish?\n"
     "A. Producer\nB. Primary Consumer\nC. Secondary Consumer\nD. Tertiary Consumer",
     "C. Secondary Consumer. (1 mark)"),
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> list[dict]:
    if digest(QP) != QP_SHA or digest(MS) != MS_SHA:
        raise ValueError("Science SQP or marking scheme changed; re-review rendered pages")
    rows = []
    for number, qp_page, ms_page, chapter, tag, question, answer in REVIEWED:
        prefix = f"2026-27|086|Science-SQP|Q{number}"
        shared = {
            "subject": "science", "chapter": chapter,
            "sourceYear": "2026", "syllabusVersion": "2026-27",
            "syllabusTopicId": f"science.ch{chapter:02d}",
            "inActiveSyllabus": True, "assessmentStatus": "summative",
            "reviewStatus": "approved", "language": "en",
            "reviewBatch": "science-sqp-20260926-v1",
            "reviewEvidence": "reports/science-sqp-2026-27-source-review.md",
            "sourceTransform": "visual-table-transcription-v1",
            "joinPrefix": prefix, "conceptTags": [tag],
        }
        rows.extend([
            {
                "id": f"sqp.science.2026-27.q{number:02d}",
                "text": question,
                "meta": {
                    **shared, "kind": "sqp", "chunkType": "question_block",
                    "page": qp_page, "sourcePath": str(QP.relative_to(DATA)),
                    "contentSha256": QP_SHA, "officialUrl": QP_URL,
                    "heading": f"Science 086 Sample Question Paper 2026-27 · Q{number}",
                    "extractiveQuote": question.split("\n", 1)[0][:240],
                },
            },
            {
                "id": f"ms.science.2026-27.q{number:02d}",
                "text": answer,
                "meta": {
                    **shared, "kind": "ms", "chunkType": "marking_scheme",
                    "page": ms_page, "sourcePath": str(MS.relative_to(DATA)),
                    "contentSha256": MS_SHA, "officialUrl": MS_URL,
                    "heading": f"Science 086 Marking Scheme 2026-27 · Q{number}",
                    "joinKey": f"{prefix}|answer",
                    "extractiveQuote": answer,
                },
            },
        ])
    return rows


if __name__ == "__main__":
    rows = build()
    output = DATA / "processed/science-maths-2026-27/science-sqp-reviewed-addendum.jsonl"
    output.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    (APP / "data/corpus/science-sqp-reviewed-addendum.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({"approvedRows": len(rows), "questionPairs": len(rows) // 2}))
