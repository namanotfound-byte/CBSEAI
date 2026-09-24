#!/usr/bin/env python3
"""Dry-run a corpus update by comparing two virtual inventory manifests."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


def load(path: Path) -> dict[str, dict]:
    rows = (json.loads(line) for line in path.read_text().splitlines() if line.strip())
    return {f"{row['relativePath']}!/{row['archiveMember'] or ''}": row for row in rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("previous", type=Path)
    parser.add_argument("current", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    old = load(args.previous)
    new = load(args.current)
    old_hashes = defaultdict(list)
    new_hashes = defaultdict(list)
    for name, row in old.items():
        old_hashes[row.get("contentSha256")].append(name)
    for name, row in new.items():
        new_hashes[row.get("contentSha256")].append(name)
    unchanged = sorted(name for name in old.keys() & new.keys()
                       if old[name].get("contentSha256") == new[name].get("contentSha256"))
    changed = sorted(name for name in old.keys() & new.keys()
                     if old[name].get("contentSha256") != new[name].get("contentSha256"))
    added = sorted(new.keys() - old.keys())
    removed = sorted(old.keys() - new.keys())
    renamed = []
    for name in added[:]:
        digest = new[name].get("contentSha256")
        matches = [old_name for old_name in old_hashes[digest] if old_name in removed]
        if matches:
            previous = matches[0]
            renamed.append({"from": previous, "to": name, "contentSha256": digest})
            added.remove(name)
            removed.remove(previous)
    duplicates = [names for digest, names in new_hashes.items() if digest and len(names) > 1]
    report = {
        "previous": str(args.previous), "current": str(args.current),
        "counts": {"unchanged": len(unchanged), "changed": len(changed),
                   "added": len(added), "removed": len(removed),
                   "renamed": len(renamed), "duplicateGroups": len(duplicates)},
        "changed": changed, "added": added, "removed": removed,
        "renamed": renamed, "duplicateGroups": duplicates,
        "action": "dry_run_only_review_and_reindex_affected_sources_before_promotion",
    }
    output = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output)
    print(output)


if __name__ == "__main__":
    main()
