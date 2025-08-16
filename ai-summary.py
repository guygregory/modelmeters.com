import os
import sys
from datetime import datetime
from openai import OpenAI

import argparse
endpoint = "https://models.github.ai/inference"
model = "openai/gpt-4.1"

system_message = """You are a helpful AI assistant that summarises a price list file of new Azure AI Foundry Model meters, and provides a concise overview of the file. The file is provided in ndjson format, and all the prices are in USD. Stick to the facts. Do not include a title or preamble. When there are multiple prices for the same model, don't quote the rage, just state from $xxxxx. At the end of the document, state that prices vary depending on region.
When summarising, group the models by model provider (using heading level 3), and try to summarise one model per bullet point. Do not round up or round down pricing.

When quoting dollars, don't show to one decimal place, use two instead (or more if available)

Treat these models are different: o3-mini, o3, o3-pro."""

def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--date", dest="date", type=str, help="Date in YYYY-MM-DD format")
    # Don't let argparse print its own usage; we provide a friendlier tip per requirements.
    args, unknown = parser.parse_known_args()

    if not args.date:
        print("Tip: run with --date YYYY-MM-DD. Example: python ai-summary.py --date 2025-08-01")
        sys.exit(1)

    # Validate date format and keep it as a variable for later use
    try:
        parsed_date = datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print("Error: --date must be in YYYY-MM-DD format (e.g., 2025-08-01).")
        sys.exit(2)

    date_str = parsed_date.strftime("%Y-%m-%d")

    # Resolve paths relative to this script's directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, "monthly", "partial", f"{date_str}.ndjson")
    output_dir = os.path.join(base_dir, "monthly", "aisummary")
    output_path = os.path.join(output_dir, f"{date_str}.md")

    if not os.path.exists(input_path):
        print(f"Error: input file not found: {input_path}")
        sys.exit(3)

    # If the output already exists, skip generation to avoid rework and extra API calls
    if os.path.exists(output_path):
        print(f"Info: summary already exists for {date_str}, skipping: {output_path}")
        sys.exit(0)

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            ndjson_content = f.read()
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(4)

    # Acquire token only when needed (after early exits above)
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Error: GITHUB_TOKEN environment variable is not set. Set it before running.")
        sys.exit(7)

    client = OpenAI(
        base_url=endpoint,
        api_key=token,
    )

    try:
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_message,
                },
                {
                    "role": "user",
                    # Use the NDJSON string directly as the user content
                    "content": ndjson_content,
                }
            ],
            temperature=1,
            top_p=1,
            model=model
        )
    except Exception as e:
        print(f"Error from model API: {e}")
        sys.exit(5)

    content = response.choices[0].message.content if response and response.choices else ""

    try:
        os.makedirs(output_dir, exist_ok=True)
        # Build a level-1 heading with the date in full format, e.g., "14 March 2025"
        # Use parsed components to avoid platform-specific %-d/%#d issues
        full_date_title = f"# {parsed_date.day} {parsed_date.strftime('%B %Y')}\n\n"
        final_markdown = f"{full_date_title}{content or ''}"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_markdown)
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(6)


if __name__ == "__main__":
    main()

