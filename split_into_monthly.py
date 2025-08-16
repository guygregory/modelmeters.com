#!/usr/bin/env python3
"""
Read a local NDJSON file (`prices.ndjson`) containing Azure retail pricing data
and split it into separate NDJSON files, grouped by the day component of
`effectiveStartDate` (YYYY-MM-DD).

The grouped files are saved into the specified output directory. By default,
files are written into `monthly/full` with filenames like `YYYY-MM-DD.ndjson`.

After writing the full files, a second pass creates filtered NDJSON files in
the sibling `monthly/partial` directory. These partial files contain only the
following keys per record:

- productName
- meterName
- unitPrice
- currencyCode
- unitOfMeasure
- armRegionName
"""

import argparse
import json
import os
from collections import defaultdict
from typing import Dict, List


def load_local_prices(path: str) -> List[Dict]:
    """Read items from a local NDJSON file."""
    items: List[Dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                items.append(json.loads(line))
    return items


def _date_only(date_str: str | None) -> str:
    """Extract YYYY-MM-DD from an ISO8601 timestamp. Fallback to 'unknown'."""
    if not date_str:
        return "unknown"
    # Trim trailing Z if present and split off time if present
    ds = date_str.rstrip("Z")
    if "T" in ds:
        ds = ds.split("T", 1)[0]
    # If still longer than 10, take first 10 when it looks like a date
    if len(ds) >= 10 and ds[4] == "-" and ds[7] == "-":
        return ds[:10]
    # If already looks like YYYY-MM-DD, return as-is
    if len(ds) == 10 and ds[4] == "-" and ds[7] == "-":
        return ds
    return "unknown"


def group_by_effective_date(items: List[Dict]) -> Dict[str, List[Dict]]:
    """Group items by YYYY-MM-DD derived from effectiveStartDate (or 'unknown')."""
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for item in items:
        date_key = _date_only(item.get("effectiveStartDate"))
        groups[date_key].append(item)
    return groups


def safe_filename_from_date(date_str: str) -> str:
    """Create a filename from a timestamp using only the date: YYYY-MM-DD.ndjson."""
    date_only = _date_only(date_str)
    return f"{date_only}.ndjson"


def write_ndjson(groups: Dict[str, List[Dict]], output_dir: str) -> None:
    """Write each group to a separate NDJSON file in output_dir."""
    os.makedirs(output_dir, exist_ok=True)

    for date_str, records in groups.items():
        filename = safe_filename_from_date(date_str)
        path = os.path.join(output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            for record in records:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")


FILTER_KEYS = (
    "productName",
    "meterName",
    "unitPrice",
    "unitOfMeasure",
)


def filter_ndjson_directory(src_dir: str, dest_dir: str, keys: tuple[str, ...] = FILTER_KEYS) -> None:
    """Read each .ndjson in src_dir, keep only selected keys, dedupe, write to dest_dir.

    - Operates in a streaming fashion (line-by-line) for memory efficiency.
    - Skips lines that are not valid JSON objects.
    - Removes duplicate JSON lines after the filtered content has been read.
    - Writes files with the same filenames into dest_dir.
    """
    if not os.path.isdir(src_dir):
        print(f"Source directory does not exist or is not a directory: {src_dir}")
        return

    os.makedirs(dest_dir, exist_ok=True)

    files = [f for f in os.listdir(src_dir) if f.endswith(".ndjson")]
    files.sort()
    print(f"Filtering {len(files)} files from '{src_dir}' to '{dest_dir}'")

    for filename in files:
        src_path = os.path.join(src_dir, filename)
        dest_path = os.path.join(dest_dir, filename)

        total_count = 0
        seen: set[str] = set()
        unique_lines: list[str] = []

        # Read and filter
        with open(src_path, "r", encoding="utf-8") as r:
            for line in r:
                line = line.strip()
                if not line:
                    continue
                total_count += 1
                try:
                    obj = json.loads(line)
                    # Keep only requested keys that exist in the record
                    filtered = {k: obj.get(k) for k in keys if k in obj}
                    # Serialize exactly as we'll write, to allow direct dedupe by string
                    s = json.dumps(filtered, ensure_ascii=False)
                    if s not in seen:
                        seen.add(s)
                        unique_lines.append(s)
                except json.JSONDecodeError:
                    continue

        # Write unique filtered lines
        with open(dest_path, "w", encoding="utf-8") as w:
            for s in unique_lines:
                w.write(s + "\n")

        print(f"  Wrote {len(unique_lines)}/{total_count} unique records -> {dest_path}")



def main() -> None:
    parser = argparse.ArgumentParser(
        description="Split a local prices.ndjson file by effectiveStartDate"
    )
    parser.add_argument(
        "--input", default="prices.ndjson",
        help="Path to the local NDJSON file (default: prices.ndjson)"
    )
    parser.add_argument(
        "--out-dir", default="monthly/full",
        help="Directory for NDJSON files (default: ./monthly/full)"
    )
    args = parser.parse_args()

    print(f"Loading local NDJSON file: {args.input}")
    items = load_local_prices(args.input)
    print(f"Loaded {len(items)} items")

    groups = group_by_effective_date(items)
    print(f"Grouping into {len(groups)} files based on effectiveStartDate")

    write_ndjson(groups, args.out_dir)
    print(f"NDJSON files written to '{args.out_dir}'")

    # After writing full files, emit partial files with only selected keys
    partial_dir = os.path.join(os.path.dirname(args.out_dir.rstrip(os.sep)), "partial")
    filter_ndjson_directory(args.out_dir, partial_dir, FILTER_KEYS)


if __name__ == "__main__":
    main()
