"""Account for every Maths/Science source and page in the supplied Data folder.

This report deliberately distinguishes page extraction from publication approval.
An extracted PDF page is never treated as a verified answer source by itself.
"""

from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path


APP = Path(__file__).resolve().parents[1]
DATA = APP.parent / "Data"
STAGED = DATA / "processed" / "science-maths-2026-27"


def jsonl(path):
    if not path.exists():
        return
    with path.open() as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def key(path, member=None):
    return f"{path}!/{member}" if member else path


manifest = list(jsonl(DATA / "manifests" / "science-maths-inventory.jsonl"))
assert manifest, "Maths/Science source inventory is missing"
source = {key(row["relativePath"], row.get("archiveMember")): row for row in manifest}

staged_pages = defaultdict(set)
staging_errors = defaultdict(list)
for filename in ("science-textbook-page-staging.jsonl", "maths-source-pages-staging.jsonl"):
    for row in jsonl(STAGED / filename):
        meta = row["meta"]
        staged_pages[meta["sourcePath"]].add(meta["page"])
for row in jsonl(STAGED / "practice-page-extraction.jsonl"):
    name = key(row["relativePath"], row.get("archiveMember"))
    if row.get("pdfPage"):
        staged_pages[name].add(row["pdfPage"])
    elif row.get("status") == "extraction_error":
        staging_errors[name].append(row.get("error", "unknown extraction error"))

reviewed_pages = defaultdict(set)
reviewed_ids = set()
for path in (APP / "data" / "corpus").glob("*reviewed*.json"):
    for row in json.loads(path.read_text()):
        if row["id"] in reviewed_ids:
            continue
        reviewed_ids.add(row["id"])
        meta = row["meta"]
        if meta.get("sourcePath") and meta.get("page"):
            reviewed_pages[meta["sourcePath"]].add(meta["page"])
for row in jsonl(STAGED / "pilot-reviewed-batch.jsonl"):
    if row["id"] in reviewed_ids:
        continue
    reviewed_ids.add(row["id"])
    meta = row["meta"]
    if meta.get("sourcePath") and meta.get("page"):
        reviewed_pages[meta["sourcePath"]].add(meta["page"])

rows = []
for name, item in source.items():
    expected = item["pages"]
    staged = staged_pages[name]
    reviewed = reviewed_pages[name]
    rows.append({
        "source": name,
        "subject": item["subjectCandidate"],
        "family": item["sourceTypeCandidate"],
        "roleCandidate": item.get("documentRoleCandidate"),
        "sourceSha256": item["contentSha256"],
        "expectedPages": expected,
        "stagedPages": len(staged),
        "reviewedPages": len(reviewed),
        "missingPageNumbers": sorted(set(range(1, expected + 1)) - staged),
        "status": (
            "not_staged" if not staged else
            "partially_staged" if len(staged) < expected else
            "fully_staged_some_pages_reviewed" if reviewed else
            "fully_staged_review_pending"
        ),
        "warnings": item.get("warnings", []),
        "extractionErrors": staging_errors[name],
    })

rows.sort(key=lambda row: row["source"])
status = Counter(row["status"] for row in rows)
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "meaning": "Staged means extracted for audit. Reviewed means at least one page has a reviewed passage. Neither implies that all questions/answers in a source are live.",
    "sourceCount": len(rows),
    "expectedPages": sum(row["expectedPages"] for row in rows),
    "stagedPages": sum(row["stagedPages"] for row in rows),
    "reviewedSourceCount": sum(bool(row["reviewedPages"]) for row in rows),
    "statusCounts": dict(status),
    "sources": rows,
}
output = DATA / "reports" / "all-maths-science-source-coverage.json"
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({key: report[key] for key in ("sourceCount", "expectedPages", "stagedPages", "reviewedSourceCount", "statusCounts")}, indent=2))
print(output)
