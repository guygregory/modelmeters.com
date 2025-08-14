"""Azure Retail Prices bulk downloader.

This script walks the paginated Azure Retail Prices API (https://prices.azure.com/api/retail/prices)
following the `NextPageLink` until exhausted, and writes the combined items to disk.

Key features:
 - Pure stdlib (urllib) HTTP requests (no external deps)
 - Resilient with retry + exponential backoff
 - Streams items to optional NDJSON file to avoid huge memory usage
 - Optionally also emits a single JSON array file (requires holding all items in memory)
 - Progress + basic metrics

Usage examples:
  python meter-download.py --output all-prices.json
  python meter-download.py --ndjson all-prices.ndjson
  python meter-download.py --output all.json --ndjson all.ndjson
  python meter-download.py --max-pages 3 --ndjson sample.ndjson  (quick test)
  python meter-download.py --cognitive-services-only --ndjson cognitive.ndjson

Notes:
Full dataset is large (hundreds of thousands of items). Writing a JSON array file may
consume substantial RAM. Prefer NDJSON for large-scale processing.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import typing as t
from dataclasses import dataclass
from urllib import request, error, parse

API_ROOT = "https://prices.azure.com/api/retail/prices"
USER_AGENT = "azure-retail-prices-downloader/1.0 (+https://learn.microsoft.com/)"
DEFAULT_PAGE_SIZE = 1000  # informational; API fixed at 1000 items per page currently


@dataclass
class PageResult:
	items: list[dict]
	next_link: str | None
	count: int


def fetch_url(url: str, *, timeout: int = 60, attempt: int = 1, max_attempts: int = 5) -> dict:
	"""Fetch a URL returning parsed JSON with retries.

	Implements exponential backoff on transient failures (HTTP >=500, URLError, timeout).
	Raises the last exception if all attempts fail.
	"""
	headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
	req = request.Request(url, headers=headers)
	try:
		with request.urlopen(req, timeout=timeout) as resp:
			charset = resp.headers.get_content_charset() or "utf-8"
			raw = resp.read().decode(charset)
			return json.loads(raw)
	except error.HTTPError as e:
		# 4xx are usually fatal; 429 or >=500 we retry
		if attempt < max_attempts and (e.code >= 500 or e.code == 429):
			backoff = 2 ** (attempt - 1)
			time.sleep(backoff)
			return fetch_url(url, timeout=timeout, attempt=attempt + 1, max_attempts=max_attempts)
		raise
	except error.URLError:
		if attempt < max_attempts:
			backoff = 2 ** (attempt - 1)
			time.sleep(backoff)
			return fetch_url(url, timeout=timeout, attempt=attempt + 1, max_attempts=max_attempts)
		raise


def get_page(url: str) -> PageResult:
	data = fetch_url(url)
	items = data.get("Items") or data.get("items") or []
	next_link = data.get("NextPageLink") or data.get("nextPageLink")
	count = data.get("Count") or data.get("count") or len(items)
	return PageResult(items=list(items), next_link=next_link, count=count)


def iter_all_items(start_url: str, max_pages: int | None = None) -> t.Iterator[dict]:
	"""Yield all items walking NextPageLink until exhausted.

	max_pages: for testing; limits number of pages.
	"""
	url = start_url
	page_index = 0
	while url:
		page_index += 1
		page = get_page(url)
		for item in page.items:
			yield item
		if max_pages is not None and page_index >= max_pages:
			break
		url = page.next_link


def parse_args(argv: list[str]) -> argparse.Namespace:
	p = argparse.ArgumentParser(description="Download Azure Retail Prices with pagination.")
	p.add_argument(
		"--output",
		help="Path to write a single JSON array containing all items (default: prices.json if you only specify --output with no value is NOT supported; omit flags to get prices.ndjson).",
	)
	p.add_argument(
		"--ndjson",
		help="Path to write newline-delimited JSON (streaming). If neither --output nor --ndjson is supplied, defaults to prices.ndjson.",
	)
	p.add_argument(
		"--filter",
		help="Optional OData style filter appended as $filter=... (do NOT include $filter= prefix).",
	)
	p.add_argument(
		"--cognitive-services-only",
		action="store_true",
		help="Convenience flag: restrict to serviceName eq 'Cognitive Services'. Can be combined with --filter (AND).",
	)
	p.add_argument(
		"--max-pages",
		type=int,
		help="For testing: maximum number of pages to retrieve (each page up to 1000 items).",
	)
	p.add_argument(
		"--delay",
		type=float,
		default=0.0,
		help="Optional delay (seconds) between page fetches to reduce load (default 0).",
	)
	p.add_argument(
		"--progress-every",
		type=int,
		default=5,
		help="Emit a progress line every N pages (default 5).",
	)
	return p.parse_args(argv)


def build_start_url(filter_expr: str | None) -> str:
	if not filter_expr:
		return API_ROOT
	# Encode filter expression; keep OData operators and parentheses, but encode spaces.
	return f"{API_ROOT}?$filter={parse.quote(filter_expr, safe="()=/,'")}" 


def main(argv: list[str]) -> int:
	args = parse_args(argv)
	# Provide a sensible default: if user supplies no output flags, create an NDJSON file.
	if not args.output and not args.ndjson:
		args.ndjson = "prices.ndjson"
		print("No --output/--ndjson specified; defaulting to NDJSON file 'prices.ndjson'.")

	# If user only provided --output but left it empty (shouldn't happen normally), set a default filename.
	if args.output == "":  # defensive; argparse typically won't produce empty string unless explicitly given
		args.output = "prices.json"

	# Build combined filter expression if cognitive services convenience flag used
	combined_filter: str | None = args.filter
	if getattr(args, "cognitive_services_only", False):
		cs_filter = "serviceName eq 'Cognitive Services'"
		if combined_filter:
			combined_filter = f"({cs_filter}) and ({combined_filter})"
		else:
			combined_filter = cs_filter

	start_url = build_start_url(combined_filter)
	all_items: list[dict] | None = [] if args.output else None
	ndjson_fp = open(args.ndjson, "w", encoding="utf-8") if args.ndjson else None
	t0 = time.time()
	page_count = 0
	item_count = 0
	next_url = start_url

	try:
		while next_url:
			page_count += 1
			page = get_page(next_url)
			if page_count == 1:
				# Provide some context header
				print(
					f"Starting download. Filter={'NONE' if not combined_filter else combined_filter}. First page count={page.count}")
			for it in page.items:
				item_count += 1
				if all_items is not None:
					all_items.append(it)
				if ndjson_fp is not None:
					ndjson_fp.write(json.dumps(it, separators=(",", ":"), ensure_ascii=False) + "\n")
			if page_count % args.progress_every == 0:
				elapsed = time.time() - t0
				rate = item_count / elapsed if elapsed > 0 else 0
				print(
					f"Pages={page_count} Items={item_count} LastPageCount={page.count} Rate={rate:,.0f} items/s"
				)
			if args.max_pages and page_count >= args.max_pages:
				print("Reached max pages limit (testing mode); stopping early.")
				break
			next_url = page.next_link
			if next_url and args.delay:
				time.sleep(args.delay)

		elapsed = time.time() - t0
		print(
			f"Finished. Pages={page_count} Items={item_count} Elapsed={elapsed:.1f}s AvgRate={(item_count/elapsed) if elapsed>0 else 0:,.0f} items/s"
		)

		if all_items is not None:
			print(f"Writing JSON array to {args.output} ...")
			with open(args.output, "w", encoding="utf-8") as fp:
				json.dump(all_items, fp, ensure_ascii=False)
			print("JSON array file complete.")
	finally:
		if ndjson_fp is not None:
			ndjson_fp.close()

	return 0


if __name__ == "__main__":  # pragma: no cover
	raise SystemExit(main(sys.argv[1:]))

