import os
import sys
import argparse
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv


load_dotenv()

system_message = """

<general instructions>
You are a helpful AI assistant that summarises a price list file of new Azure AI Foundry Model meters, and provides a concise overview of the file. The file is provided in ndjson format. Stick to the facts. Do not include a title or preamble.  At the end of the document, state that prices vary depending on region.
When summarising, group the models by model provider (using heading level 3), and try to summarise one model per bullet point.

<general instructions/>

<output sections>

A summary of the new Azure AI Foundry Model meters, grouped by model provider.

After each model group, use the Microsoft Learn MCP tool to provide links to the documentation for each specific model family, or service mentioned.

<pricing format>

- All the prices are in USD
- Do not round up or round down pricing
- When there are multiple prices for the same model, don't quote the rage, just state from $xxxxx.
- Aways quote the exact price listed

<pricing format/>

<common abbreviations>
Reasoning
Data Zone
Batch
Cached
Input
Output

<common abbreviations>

"""


def main():
    # Match ai-summary.py: accept --date and resolve paths relative to this file
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--date", dest="date", type=str, help="Date in YYYY-MM-DD format")
    parser.add_argument("--force", dest="force", action="store_true", help="Overwrite existing summary if present")
    args, unknown = parser.parse_known_args()

    if not args.date:
        print("Tip: run with --date YYYY-MM-DD. Example: python ai-summary-responses.py --date 2025-08-01 [--force]")
        sys.exit(1)

    try:
        parsed_date = datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print("Error: --date must be in YYYY-MM-DD format (e.g., 2025-08-01).")
        sys.exit(2)

    date_str = parsed_date.strftime("%Y-%m-%d")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, "monthly", "partial", f"{date_str}.ndjson")
    output_dir = os.path.join(base_dir, "monthly", "aisummary")
    output_path = os.path.join(output_dir, f"{date_str}.md")

    if not os.path.exists(input_path):
        print(f"Error: input file not found: {input_path}")
        sys.exit(3)

    if os.path.exists(output_path) and not args.force:
        print(f"Info: summary already exists for {date_str}, skipping: {output_path}")
        sys.exit(0)
    elif os.path.exists(output_path) and args.force:
        print(f"Info: --force set; overwriting existing summary: {output_path}")

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            ndjson_content = f.read()
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(4)

    # Ensure required Azure environment variables are present
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_V1_API_ENDPOINT")
    azure_model = os.getenv("AZURE_OPENAI_API_MODEL")
    if not azure_key or not azure_endpoint or not azure_model:
        print("Error: Missing Azure OpenAI environment variables. Set AZURE_OPENAI_API_KEY, AZURE_OPENAI_V1_API_ENDPOINT, and AZURE_OPENAI_API_MODEL.")
        sys.exit(7)

    client = OpenAI(
        api_key=azure_key,
        base_url=azure_endpoint,
        default_query={"api-version": "preview"},
    )

    try:
        response = client.responses.create(
            model=azure_model,
            instructions=system_message,
            tools=[
                {
                    "type": "mcp",
                    "server_label": "MicrosoftLearn",
                    "server_url": "https://learn.microsoft.com/api/mcp",
                    "require_approval": "never",
                },
            ],
            input=ndjson_content,
        )
    except Exception as e:
        print(f"Error from model API: {e}")
        sys.exit(5)

    content = getattr(response, "output_text", "")

    try:
        os.makedirs(output_dir, exist_ok=True)
        full_date_title = f"# {parsed_date.day} {parsed_date.strftime('%B %Y')}\n\n"
        final_markdown = f"{full_date_title}{content or ''}"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_markdown)
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(6)


if __name__ == "__main__":
    main()