#!/usr/bin/env python3
import os
import sys
import glob
import subprocess
from pathlib import Path


def main() -> int:
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

	# Precompute which dates actually need generation
	aisummary_dir = base_dir / "monthly" / "aisummary"
	dates_to_generate = []
	for file_path in files:
		stem = Path(file_path).stem
		if not (aisummary_dir / f"{stem}.md").exists():
			dates_to_generate.append(stem)

	if not dates_to_generate:
		print("Nothing to generate; all summaries already exist.")
		return 0

	# Token check only when we actually need to call ai-summary.py
	if not os.environ.get("GITHUB_TOKEN"):
		print("Error: GITHUB_TOKEN environment variable is not set. Set it before running.")
		return 3

	processed = 0
	for stem in dates_to_generate:
		print(f"Processing {stem}...")

		# Call the same Python interpreter to run ai-summary.py
		result = subprocess.run(
			[sys.executable, str(ai_summary_script), "--date", stem],
			cwd=str(base_dir),
		)

		if result.returncode != 0:
			print(f"Error: ai-summary.py failed for {stem} with exit code {result.returncode}")
			return result.returncode

		processed += 1

	skipped = len(files) - processed
	print(f"Done. Generated: {processed}, Skipped (already existed): {skipped}.")
	return 0


if __name__ == "__main__":
	sys.exit(main())

