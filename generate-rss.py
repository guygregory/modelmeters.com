#!/usr/bin/env python3
"""
Generate RSS 2.0 feed for AI summaries in monthly/aisummary/
"""

from __future__ import annotations

import html
import re
from pathlib import Path
from datetime import datetime
from email.utils import formatdate

def extract_title_and_content(markdown_text: str) -> tuple[str, str]:
    """Extract title (first H1) and content from markdown text."""
    lines = markdown_text.strip().split('\n')
    title = None
    content_lines = []
    
    # Find the first H1 and use it as title
    title_found = False
    for line in lines:
        if line.startswith('# ') and not title_found:
            title = line[2:].strip()
            title_found = True
        elif title_found:
            content_lines.append(line)
        else:
            content_lines.append(line)
    
    # If no H1 found, use the first few words as title
    if not title:
        first_line = lines[0] if lines else ""
        title = first_line[:50] + "..." if len(first_line) > 50 else first_line
        content_lines = lines
    
    content = '\n'.join(content_lines).strip()
    
    # Convert markdown to basic HTML for RSS description
    # First escape any existing HTML to prevent issues, then apply markdown patterns
    content = html.escape(content)
    
    # Simple conversion - replace common markdown patterns
    content = re.sub(r'^### (.+)$', r'<h3>\1</h3>', content, flags=re.MULTILINE)
    content = re.sub(r'^## (.+)$', r'<h2>\1</h2>', content, flags=re.MULTILINE)
    content = re.sub(r'^# (.+)$', r'<h1>\1</h1>', content, flags=re.MULTILINE)
    content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', content)
    content = re.sub(r'\*(.+?)\*', r'<em>\1</em>', content)
    content = re.sub(r'_(.+?)_', r'<em>\1</em>', content)  # Support underscore italics
    content = re.sub(r'`(.+?)`', r'<code>\1</code>', content)
    content = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', content)
    
    # Convert line breaks to HTML
    content = content.replace('\n\n', '</p><p>')
    content = content.replace('\n', '<br>')
    if content and not content.startswith('<'):
        content = f'<p>{content}</p>'
    
    return title, content

def read_markdown_files(aisummary_dir: Path) -> list[tuple[str, str, str, datetime]]:
    """Return list of (id, title, content, date) sorted descending by date."""
    files = sorted(
        (p for p in aisummary_dir.glob("*.md") if p.is_file()),
        key=lambda p: p.stem,
        reverse=True,
    )
    
    result: list[tuple[str, str, str, datetime]] = []
    for p in files:
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = p.read_text(errors="replace")
        
        title, content = extract_title_and_content(text)
        
        # Parse date from filename (YYYY-MM-DD format)
        try:
            date_obj = datetime.strptime(p.stem, "%Y-%m-%d")
        except ValueError:
            # Fallback to file modification time
            date_obj = datetime.fromtimestamp(p.stat().st_mtime)
        
        result.append((p.stem, title, content, date_obj))
    
    return result

def generate_rss_feed(summaries: list[tuple[str, str, str, datetime]], base_url: str = "https://modelmeters.com") -> str:
    """Generate RSS 2.0 XML feed."""
    
    # RSS header
    rss_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Model Meters - AI-generated Monthly Summaries</title>
<link>{base_url}/agent/</link>
<description>AI-generated monthly summaries of Azure AI Foundry pricing changes and updates</description>
<language>en-us</language>
<lastBuildDate>{last_build_date}</lastBuildDate>
<atom:link href="{base_url}/agent/rss.xml" rel="self" type="application/rss+xml"/>
<generator>Model Meters RSS Generator</generator>
<webMaster>guy.gregory@microsoft.com</webMaster>
<managingEditor>guy.gregory@microsoft.com</managingEditor>
<category>Technology</category>
<category>Azure</category>
<category>AI</category>
'''.format(
        base_url=base_url,
        last_build_date=formatdate(datetime.now().timestamp())
    )
    
    # Add items
    for file_id, title, content, pub_date in summaries[:20]:  # Limit to 20 most recent
        # Escape HTML in title only - content is already converted HTML
        escaped_title = html.escape(title)
        # Don't escape content as it's already been converted from markdown to HTML
        
        # Create item
        item_xml = f'''
<item>
<title>{escaped_title}</title>
<link>{base_url}/agent/#{file_id}</link>
<description>{content}</description>
<pubDate>{formatdate(pub_date.timestamp())}</pubDate>
<guid isPermaLink="true">{base_url}/agent/#{file_id}</guid>
<category>Azure AI</category>
</item>'''
        
        rss_xml += item_xml
    
    # Close RSS
    rss_xml += '''
</channel>
</rss>'''
    
    return rss_xml

def main() -> int:
    """Generate RSS feed for AI summaries."""
    repo_root = Path(__file__).resolve().parent
    monthly_dir = repo_root / "monthly"
    aisummary_dir = monthly_dir / "aisummary"
    agent_dir = repo_root / "agent"
    
    if not aisummary_dir.exists():
        raise SystemExit(f"Directory not found: {aisummary_dir}")
    
    if not agent_dir.exists():
        agent_dir.mkdir(parents=True)
    
    summaries = read_markdown_files(aisummary_dir)
    if not summaries:
        print("No markdown files found in monthly/aisummary")
        return 0
    
    rss_xml = generate_rss_feed(summaries)
    
    # Write RSS feed
    rss_file = agent_dir / "rss.xml"
    rss_file.write_text(rss_xml, encoding="utf-8")
    
    print(f"Generated RSS feed: {rss_file} with {len(summaries)} items")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
