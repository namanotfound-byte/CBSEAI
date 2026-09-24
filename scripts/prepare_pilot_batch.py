#!/usr/bin/env python3
"""Prepare the individually reviewed pilot rows for a versioned staging index.

This explicit allowlist is deliberately small. It is not a full Science or Maths
release and must never be promoted to the live Qdrant alias as-is.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from zipfile import ZipFile

import pdfplumber


APP = Path(__file__).resolve().parents[1]
DATA = APP.parent / "Data"
POLICY = APP / "data/corpus/syllabus_2026_27.json"
POLICY_SHA256 = "96d78294b1e8c51deff2d0fa25f235cee6fff397ddd4811e6a3df3e50f475ce6"
APPROVED_TEXT = {
    "ncert.science.ch01.p002.para01": "796fe235616e959c85e02fc92203164a490bba47aeba323c87880978d818a2c4",
    "ncert.science.ch02.p010.para16": "f780caf51c82959b1e1b1c008d7da7fdc62084a3a08c55f528cc6347ec33ea73",
    "ncert.science.ch03.p002.para11": "1c7f5204c49e34ed9559e72997d4456cdc8769c037e3ce74ba5c4254100ff853",
    "ncert.science.ch04.p019.para15": "19489542bfe92b4a6bf3d267c9f52d3fa3496135a150ad9f694f411ea9aa11a8",
    "ncert.science.ch05.p008.para04": "01f1dcd071411cd4e3be18a321b143fc395e12f5ae76f840f4b39afdd8e01fc3",
    "ncert.science.ch06.p009.para04": "809cd0b649f2a7568ee7de8e8f4f3ae4d02c1dc09a27ab1937bb755bc5758fcc",
    "ncert.science.ch07.p012.para03": "520ee0102b6f3bf49a1a428549c3764cdcec0e59dc0cd7849b0a2f922bf5419a",
    "ncert.science.ch09.p007.para10": "828f84912f3419a040e0cd3d1cfa13d4ac39c93d6fb9ca6cf67ac4a83aa00a77",
    "ncert.science.ch10.p002.para04": "d9fbe2daaf73df23005ca7a73ab119c9d9d9dadbfc9567a565a5242edeac4994",
    "ncert.science.ch11.p020.para04": "b27473eb0ba6759899bc286ae4381c6666bf0da443c8a29b07a9e9f2586b977c",
    "ncert.science.ch12.p002.para02": "084b2f0303358ef6ac480965267e7926c510c86cc94feafeaa689b417a3dfdb2",
    "ncert.science.ch13.p001.para08": "9d4e8778f89c7b5c3cac39daf66326bd4d50b69f9de3b49a417f98fdb83eb9d8",
}
APPROVED_MATHS_TEXT = {
    "ncert.maths.ch01.p003.para02": "395c8d4a733c005644d17ddc2934be425cb8600286a89758ce1640452bcc713a",
    "ncert.maths.ch05.p003.para12": "bf7a4b47cc98af30f86f0d5a2c414fbe3e0514cadd4b139430e37839fea8b91a",
    "ncert.maths.ch05.p003.para13": "ec539a41492eb4c13b8185e29725e6e9ebf7d172f6a0608691f88e7f2abd4807",
    "ncert.maths.ch06.p016.para01": "ba0e92fccbc8786669694dc29367bd97d831d14733dadffcf86d582df666d57e",
    "ncert.maths.ch08.p003.para31": "21ef663e92dbabb456401f11e4bc6c1c42d9158e160627b726b26fd1ff9898e0",
    "ncert.maths.ch10.p002.para14": "c6e4e24f5dbf4b2a37757ba4a97ab411e540ea6b312894e955f6298ecb3227d8",
    "ncert.maths.ch13.p027.para04": "42ed0fcb45fb1dbe0beb8d15e65d5c84b09f6d93bd56ed91ca88d63cce21fc1e",
    "ncert.maths.ch14.p004.para06": "1d3272a9e5668565251cc24ff4b3153a8d02d5c168127932e301090b887bf1cd",
}
OUTPUT = DATA / "processed/science-maths-2026-27/pilot-reviewed-batch.jsonl"
DEPLOYMENT_COPY = APP / "data/corpus/pilot-reviewed-batch.jsonl"


def sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deployment-copy", action="store_true")
    args = parser.parse_args()
    if sha(POLICY.read_bytes()) != POLICY_SHA256:
        raise ValueError("The syllabus map changed after review; re-audit before approval")

    syllabus = [json.loads(line) for line in
                (DATA / "processed/science-maths-2026-27/staging.jsonl").read_text().splitlines()
                if line and json.loads(line)["meta"]["kind"] == "syllabus"]
    if len(syllabus) != 27:
        raise ValueError("Expected all 27 reviewed year-end chapter scope rows")
    science = {row["id"]: row for row in
               map(json.loads, (DATA / "processed/science-maths-2026-27/science-paragraph-staging.jsonl").read_text().splitlines())}

    rows = []
    for row in syllabus:
        meta = row["meta"]
        path = DATA / meta["sourcePath"]
        if sha(path.read_bytes()) != meta["contentSha256"]:
            raise ValueError(f"Curriculum source changed: {row['id']}")
        topic = next(t for t in json.loads(POLICY.read_text())["topics"] if t["id"] == row["id"])
        if row["text"] != f"{topic['title']}. Current CBSE 2026-27 scope: {topic['scope']}":
            raise ValueError(f"Curriculum summary changed: {row['id']}")
        meta["reviewStatus"] = "approved"
        meta["reviewBatch"] = "pilot-20260924-v2"
        meta["sourceTransform"] = "curated_curriculum_scope"
        rows.append(row)

    with ZipFile(DATA / "NCERTs/Science_2026.zip") as archive:
        for id, text_digest in APPROVED_TEXT.items():
            row = science[id]
            meta = row["meta"]
            payload = archive.read(meta["sourcePath"].split("!/")[-1])
            if sha(payload) != meta["contentSha256"] or sha(row["text"].encode()) != text_digest:
                raise ValueError(f"Source or approved text changed: {id}")
            with pdfplumber.open(io.BytesIO(payload)) as pdf:
                page_text = pdf.pages[meta["page"] - 1].extract_text() or ""
            if normalise(row["text"]) not in normalise(page_text):
                raise ValueError(f"Approved text no longer matches its PDF page: {id}")
            meta["reviewStatus"] = "approved"
            meta["reviewBatch"] = "pilot-20260924-v2"
            meta["reviewEvidence"] = "science-paragraph-visual-review.md"
            rows.append(row)

    maths = {row["id"]: row for row in
             map(json.loads, (DATA / "processed/science-maths-2026-27/maths-paragraph-staging.jsonl").read_text().splitlines())}
    with ZipFile(DATA / "NCERTs/Maths_2026.zip") as archive:
        for id, text_digest in APPROVED_MATHS_TEXT.items():
            row = maths[id]
            meta = row["meta"]
            payload = archive.read(meta["sourcePath"].split("!/")[-1])
            if sha(payload) != meta["contentSha256"] or sha(row["text"].encode()) != text_digest:
                raise ValueError(f"Maths source or approved text changed: {id}")
            with pdfplumber.open(io.BytesIO(payload)) as pdf:
                page_text = pdf.pages[meta["page"] - 1].extract_text() or ""
            if normalise(row["text"]) not in normalise(page_text):
                raise ValueError(f"Maths text no longer matches its PDF page: {id}")
            meta["reviewStatus"] = "approved"
            meta["reviewBatch"] = "pilot-20260924-v2"
            meta["reviewEvidence"] = "maths-paragraph-visual-review.md"
            rows.append(row)

    content = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    OUTPUT.write_text(content)
    if args.deployment_copy:
        DEPLOYMENT_COPY.write_text(content)
    print(json.dumps({"status": "approved_for_staging_only", "syllabus": 27,
                      "scienceNcert": 12, "mathsNcert": 8, "rows": len(rows),
                      "deploymentCopy": args.deployment_copy}))


if __name__ == "__main__":
    main()
