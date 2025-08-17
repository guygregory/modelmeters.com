#!/usr/bin/env python3
"""
Generate a JSON manifest of Markdown summaries.

Creates monthly/aisummary/index.json listing all .md files sorted newest-first.

Usage:
  python monthly/generate-index.py [array|object]

If 'object' is passed, writes {"files": [...]} instead of a bare array.
"""

from pathlib import Path
import json
import sys


def main(out_format: str = "array") -> int:
    base_dir = Path(__file__).resolve().parent
    aisummary = base_dir / "aisummary"
    if not aisummary.is_dir():
        print(f"ERROR: Directory not found: {aisummary}", file=sys.stderr)
        return 1

    files = sorted((p.name for p in aisummary.glob("*.md")), reverse=True)

    out_path = aisummary / "index.json"
    data = {"files": files} if out_format == "object" else list(files)
    out_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} with {len(files)} entries.")
    return 0


if __name__ == "__main__":
    fmt = "array"
    if len(sys.argv) > 1 and sys.argv[1] in ("array", "object"):
        fmt = sys.argv[1]
    raise SystemExit(main(fmt))
