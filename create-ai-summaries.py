#!/usr/bin/env python3
import os
import sys
import glob
import subprocess
from pathlib import Path
import argparse


def main() -> int:
	# Parse CLI args
	parser = argparse.ArgumentParser(add_help=True)
	parser.add_argument("--force", action="store_true", help="Overwrite existing summaries if present")
	args = parser.parse_args()

	base_dir = Path(__file__).resolve().parent

	ai_summary_script = base_dir / "ai-summary.py"
	if not ai_summary_script.exists():
		print(f"Error: ai-summary.py not found at {ai_summary_script}")
		return 2

	partial_dir = base_dir / "monthly" / "partial"
	pattern = str(partial_dir / "*.ndjson")
	files = sorted(glob.glob(pattern))

	if not files:
		print(f"No .ndjson files found in {partial_dir}")
		return 0

	# Precompute which dates to generate
	aisummary_dir = base_dir / "monthly" / "aisummary"
	stems_all = [Path(fp).stem for fp in files]

	if args.force:
		dates_to_generate = stems_all
	else:
		dates_to_generate = []
		for stem in stems_all:
			if not (aisummary_dir / f"{stem}.md").exists():
				dates_to_generate.append(stem)

	if not dates_to_generate:
		print("Nothing to generate; all summaries already exist.")
		return 0

	processed = 0
	for stem in dates_to_generate:
		print(f"Processing {stem}...")

		# Call the same Python interpreter to run ai-summary.py
		cmd = [sys.executable, str(ai_summary_script), "--date", stem]
		if args.force:
			cmd.append("--force")

		result = subprocess.run(cmd, cwd=str(base_dir))

		if result.returncode != 0:
			print(f"Error: ai-summary.py failed for {stem} with exit code {result.returncode}")
			return result.returncode

		processed += 1

	if args.force:
		skipped = 0
	else:
		skipped = len(files) - processed

	print(f"Done. Generated: {processed}, Skipped (already existed): {skipped}.")
	return 0


if __name__ == "__main__":
	sys.exit(main())

