#!/usr/bin/env python3
"""
Consolidate all Markdown summaries in monthly/aisummary into monthly/index.html.

Output HTML includes an H1 title: "Model Meter Monthly summaries" and a TOC.
Markdown is rendered client-side via marked.js to avoid Python deps.
"""

from __future__ import annotations

import html
from pathlib import Path
from datetime import datetime

TITLE = "Model Meter Monthly summaries - ✨ AI generated"


def read_markdown_files(aisummary_dir: Path) -> list[tuple[str, str]]:
	"""Return list of (id, markdown_text) sorted descending by id (YYYY-MM-DD)."""
	files = sorted(
		(p for p in aisummary_dir.glob("*.md") if p.is_file()),
		key=lambda p: p.stem,
		reverse=True,
	)
	result: list[tuple[str, str]] = []
	for p in files:
		try:
			text = p.read_text(encoding="utf-8")
		except UnicodeDecodeError:
			text = p.read_text(errors="replace")
		result.append((p.stem, text))
	return result
def build_html(sections: list[tuple[str, str]]) -> str:
	"""Build a single HTML document string styled like the main explorer page."""
	# Escape content for safe embedding inside <script type="text/markdown">.
	section_html: list[str] = []
	toc_items: list[str] = []
	for sid, md in sections:
		# Build human-friendly date label from YYYY-MM-DD, safe on Windows (no %-d)
		try:
			dt = datetime.strptime(sid, "%Y-%m-%d")
			label = f"{dt.day} {dt.strftime('%B %Y')}"  # e.g., 15 March 2016
		except Exception:
			label = sid
		toc_items.append(
			f'<li><a href="#{html.escape(sid)}">{html.escape(label)}</a></li>'
		)
		# Use textContent via script tag to keep raw markdown; minimal escaping
		escaped_md = md.replace("</script>", "</scr" + "ipt>")
		section_html.append(
			f"""
			<article id="{html.escape(sid)}">
				<div class=\"markdown-body\">
					<script type=\"text/markdown\">{escaped_md}</script>
				</div>
			</article>
			"""
		)

	# HTML template using the same tokens and overall look as index.html
	html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>{html.escape(TITLE)}</title>
	<style>
		/* Light theme (default) */
		:root {{
			--bg:#f5f7fa; --bg-alt:#e9eef2; --panel:#ffffff; --panel-2:#f0f3f7; --text:#1b242b; --muted:#5d6b76; --accent:#2563eb; --border:#d0d7de; --ring:#3b82f680; --shadow:0 6px 18px rgba(0,0,0,.08);
			--topbar-offset: 0px; /* header not sticky on monthly page */
		}}
		/* Dark theme */
		:root[data-theme="dark"] {{
			--bg:#0b0c10; --bg-alt:#0e1116; --panel:#14161a; --panel-2:#1b1f24; --text:#e8eef3; --muted:#a8b3bd; --accent:#3da9fc; --border:#2a2f36; --ring:#7cc4ff80; --shadow:0 10px 24px rgba(0,0,0,.35);
		}}
	html, body {{ min-height: 100%; }}
	html {{ scroll-padding-top: calc(var(--topbar-offset) + 16px); }}
		body {{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial; background: linear-gradient(180deg,var(--bg) 0%, var(--bg-alt) 100%); color: var(--text); }}
	.container {{ min-height:100dvh; padding:12px 12px 16px; box-sizing:border-box; }}
	.card {{ background: var(--panel); border:1px solid var(--border); border-radius:16px; box-shadow: var(--shadow); overflow:hidden; position:relative; clip-path: inset(0 round 16px); }}
	/* Ensure the sticky header respects the rounded top corners */
	.card-hd {{ position:relative; background:var(--panel); display:flex; gap:12px; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap; }}
		.title {{ font-size:18px; font-weight:650; letter-spacing:.2px; }}
		.toolbar {{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }}
		button {{ background:var(--panel-2); color:var(--text); border:1px solid var(--border); border-radius:10px; padding:8px 10px; font-size:14px; line-height:1; outline:none; cursor:pointer; }}
		button:hover {{ border-color:#374151; }}
		button:focus {{ box-shadow:0 0 0 4px var(--ring); border-color:var(--accent); }}

		/* Content layout inside the card */
	.content {{ display:grid; grid-template-columns: 280px 1fr; gap:16px; padding:16px; }}
	nav.toc-wrap {{ position:sticky; top: calc(var(--topbar-offset) + 16px); align-self:start; padding-right:6px; background: var(--panel); }}
	.toc {{ list-style:none; padding:0; margin:0; border:1px solid var(--border); border-radius:12px; overflow:auto; max-height: calc(100dvh - var(--topbar-offset) - 48px); }}
		.toc a {{ display:block; padding:8px 10px; color:inherit; text-decoration:none; border-top:1px solid var(--border); background:var(--panel-2); }}
		.toc a:first-child {{ border-top:0; }}
		.toc a:hover {{ background:var(--panel); }}

		.articles {{ min-width:0; }}
	.article {{ background: var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px; box-shadow: var(--shadow); scroll-margin-top: calc(var(--topbar-offset) + 16px); }}
	.article:target::before {{ content: ""; display:block; height: calc(var(--topbar-offset) + 16px); margin-top: calc(-1 * (var(--topbar-offset) + 16px)); }}

		/* Minimal markdown styles tuned to tokens */
		.markdown-body h1, .markdown-body h2, .markdown-body h3 {{ border-bottom:1px solid var(--border); padding-bottom:4px; }}
		.markdown-body pre {{ background: var(--panel-2); border:1px solid var(--border); padding:12px; border-radius:10px; overflow:auto; }}
		.markdown-body code {{ background: var(--panel-2); border:1px solid var(--border); padding:2px 6px; border-radius:8px; }}
		.markdown-body table {{ border-collapse: collapse; width: 100%; }}
		.markdown-body th, .markdown-body td {{ border: 1px solid var(--border); padding: 6px 8px; }}

		.footer {{ color: var(--muted); text-align:center; padding: 12px 16px; border-top:1px solid var(--border); }}
		@media (max-width: 900px) {{ .content {{ grid-template-columns: 1fr; }} nav.toc-wrap {{ position:static; max-height:none; }} }}
	</style>
	<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
	<style>
		/* Prevent mobile text inflation */
		html {{ -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }}
	</style>
	<base target="_self">
	<meta name="color-scheme" content="light dark">
	<meta name="theme-color" content="#2563eb">
	<link rel="icon" href="data:,">
    
</head>
<body>
	<div class="container">
		<div class="card">
			<div class="card-hd">
				<div class="title">{html.escape(TITLE)}</div>
				<div class="toolbar">
					<button id="btn-theme" title="Toggle light/dark mode">🌗 Theme</button>
					<button id="btn-back" title="Back to Model Meters">↩️Model Meters</button>
				</div>
			</div>
			<div class="content">
				<nav class="toc-wrap" aria-label="Monthly summaries">
					<div style="font-size:12px; color:var(--muted); padding:6px 2px 6px 2px;">Jump to month</div>
					<ul class="toc">
						{''.join(toc_items)}
					</ul>
				</nav>
				<section class="articles">
					{''.join(section_html)}
				</section>
			</div>
			<div class="footer">Generated by consolidate-ai-summaries.py</div>
		</div>
	</div>

	<script>
		// Theme toggle (match main index.html behavior exactly)
		(function initTheme(){{
			const root = document.documentElement;
			const btn = document.getElementById('btn-theme');
			if(!btn) return; // safety
			// Prefer explicit ?theme= in URL; else fall back to stored preference
			const urlTheme = new URLSearchParams(window.location.search).get('theme');
			if (urlTheme === 'dark' || urlTheme === 'light') {{
				if (urlTheme === 'dark') root.setAttribute('data-theme','dark'); else root.removeAttribute('data-theme');
				localStorage.setItem('priceExplorerTheme', urlTheme);
			}} else {{
				const stored = localStorage.getItem('priceExplorerTheme');
				if (stored === 'dark') root.setAttribute('data-theme','dark');
			}}
			function currentMode(){{ return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }}
			function updateBtn(){{
				const mode = currentMode();
				btn.textContent = mode==='dark' ? '☀️ Light' : '🌙 Dark';
				btn.setAttribute('aria-pressed', mode==='dark');
				btn.title = 'Switch to ' + (mode==='dark' ? 'light' : 'dark') + ' mode';
			}}
			btn.addEventListener('click', ()=> {{
				const isDark = currentMode()==='dark';
				if (isDark) root.removeAttribute('data-theme'); else root.setAttribute('data-theme','dark');
				localStorage.setItem('priceExplorerTheme', isDark ? 'light':'dark');
				updateBtn();
			}});
			updateBtn();
		}})();
	</script>

	<script>
		// Back button: navigate to parent, preserving theme via ?theme=
		(function(){{
			const btn = document.getElementById('btn-back');
			if (!btn) return;
			btn.addEventListener('click', ()=>{{
				const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
				const theme = isDark ? 'dark' : 'light';
				window.location.href = '../?theme=' + encodeURIComponent(theme);
			}});
		}})();
	</script>

	<script>
		// Render markdown into each article section using marked.js
		document.querySelectorAll('div.markdown-body > script[type="text/markdown"]').forEach((script) => {{
			const container = script.parentElement;
			const raw = script.textContent || '';
			const html = marked.parse(raw, {{ breaks: true, mangle: false, headerIds: true }});
			container.innerHTML = html;
		}});
	</script>
</body>
</html>
"""
	return html_doc


def main() -> int:
	repo_root = Path(__file__).resolve().parent
	monthly_dir = repo_root / "monthly"
	aisummary_dir = monthly_dir / "aisummary"
	if not aisummary_dir.exists():
		raise SystemExit(f"Directory not found: {aisummary_dir}")

	sections = read_markdown_files(aisummary_dir)
	if not sections:
		raise SystemExit("No markdown files found in monthly/aisummary")

	html_text = build_html(sections)
	out_file = monthly_dir / "index.html"
	out_file.write_text(html_text, encoding="utf-8")
	print(f"Wrote {out_file} with {len(sections)} sections.")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

