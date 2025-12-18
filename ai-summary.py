import os
import sys
import argparse
from datetime import datetime
#from urllib import response
from openai import OpenAI
from dotenv import load_dotenv
import time

# --- Global environment initialization ---
REQUIRED_ENV_VARS = [
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_V1_API_ENDPOINT",
    "AZURE_OPENAI_API_MODEL",
]

# Globals made available to the rest of the module
azure_key = None
azure_endpoint = None
azure_model = None
reasoning_effort = "low"  # default; can be overridden per-model below (minimal | low | medium | high)


def _have_all_required_env_vars() -> bool:
    return all(os.getenv(v) for v in REQUIRED_ENV_VARS)


def _initialize_env():
    """Load env vars globally.

    1) Try loading from .env
    2) If still missing, try environment as provided by GitHub Repository secrets (e.g., GitHub Actions)
    3) Leave globals set from os.environ if present; main() will error if still missing
    """

    # Try .env first
    load_dotenv(override=False)

    if not _have_all_required_env_vars():
        # Fallback to GitHub Actions/Repository secrets environment (no explicit fetch possible)
        # If running in Actions, secrets are already in environment.
        # Nothing to actively load here; just proceed to read whatever is present.
        pass

    global azure_key, azure_endpoint, azure_model
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_V1_API_ENDPOINT")
    azure_model = os.getenv("AZURE_OPENAI_API_MODEL")


# Initialize on import so values are available module-wide
_initialize_env()

now = datetime.now()
current_date_uk = f"{now.day} {now.strftime('%B %Y')}"

system_message = """

<general instructions>
You are a helpful AI assistant that summarises a price list file of new Azure AI Foundry Model meters, and provides a concise overview of the file. The file is provided in ndjson format. Stick to the facts. Do not include a title or preamble.
When summarising, group the models by model provider (using heading level 3), and try to summarise one model per bullet point.

<general instructions/>

<output sections>

A summary of the new Azure AI Foundry Model meters, grouped by model provider.

After each model group, use the Microsoft Learn MCP tool to provide links to the documentation for each specific model family, or service mentioned.

<pricing format>

- All the prices are in USD, show prices with a dollar sign.
- Do not write $3.0 per 1 Hour, write $3/hour. Same for seconds.
- For $3.0 per 1K tokens, write $3/1k tokens.
- For $3.0 per 1M tokens, write $3/1M tokens.
- Do not round up or round down pricing
- When there are multiple prices for the same model, don't quote the range or individual prices, just state "from $(lowest price)".
- Express prices given in scientific notation as a decimal amount. e.g 5e-05 will be $0.00005
- Unless otherwise specified, quote the exact price listed.

<pricing format/>

<common abbreviations>
Reasoning
Data Zone
Batch
Cached
Input
Output
Priority Processing

<common abbreviations>

"""


def main():
    # Match ai-summary.py: accept --date and resolve paths relative to this file
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--date", dest="date", type=str, help="Date in YYYY-MM-DD format")
    parser.add_argument("--force", dest="force", action="store_true", help="Overwrite existing summary if present")
    args, unknown = parser.parse_known_args()

    if not args.date:
        print("Tip: run with --date YYYY-MM-DD. Example: python ai-summary.py --date 2025-08-01 [--force]")
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

    # Ensure required Azure environment variables are present (loaded globally at import time)
    if not azure_key or not azure_endpoint or not azure_model:
        print("Error: Missing Azure OpenAI environment variables. Set AZURE_OPENAI_API_KEY, AZURE_OPENAI_V1_API_ENDPOINT, and AZURE_OPENAI_API_MODEL.")
        sys.exit(7)

    client = OpenAI(
        api_key=azure_key,
        base_url=azure_endpoint,
        default_query={"api-version": "preview"},
    )
    filename = os.path.basename(input_path)
    print(f"Using {azure_model} with {reasoning_effort} reasoning effort on {filename}.")
    api_call_seconds = None
    start_time = time.perf_counter()
    try:
        response = client.responses.create(
            model=azure_model,
            **({"reasoning": {"effort": reasoning_effort}} if azure_model.lower() == "gpt-5" else {}),
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
        api_call_seconds = time.perf_counter() - start_time
    except Exception as e:
        print(f"Error from model API: {e}")
        sys.exit(5)

    content = getattr(response, "output_text", "")

    # print(response)
    # Print output tokens by parsing the JSON-like response
    # Minimal token usage extraction
    usage = getattr(response, "usage", None)
    if hasattr(usage, "model_dump"):
        try:
            usage = usage.model_dump()
        except Exception:
            pass

    def _uget(primary, fallback=None):
        if isinstance(usage, dict):
            val = usage.get(primary)
            return usage.get(fallback) if val is None and fallback else val
        else:
            val = getattr(usage, primary, None)
            return getattr(usage, fallback, None) if val is None and fallback else val

    input_tokens = _uget("input_tokens", "prompt_tokens")
    output_tokens = _uget("output_tokens", "completion_tokens")
    total_tokens = _uget("total_tokens")

    if total_tokens is None:
        parts = [t for t in (input_tokens, output_tokens) if isinstance(t, (int, float))]
        total_tokens = int(sum(parts)) if parts else None

    print(f"Input tokens: {format(int(input_tokens), ',') if input_tokens is not None else 'n/a'}")
    print(f"Output tokens: {format(int(output_tokens), ',') if output_tokens is not None else 'n/a'}")
    print(f"Total tokens: {format(int(total_tokens), ',') if total_tokens is not None else 'n/a'}")
    if api_call_seconds is not None:
        print(f"Time taken: {int(round(api_call_seconds))}s")

    reasoning_effort_text = ""
    if (azure_model).lower() == "gpt-5":
        reasoning_effort_text = f" with {reasoning_effort} reasoning effort"

    disclaimer = (
    f"_This summary was AI-generated in {int(round(api_call_seconds))} seconds on {current_date_uk} using {azure_model or 'an Azure model'}{reasoning_effort_text}.<br>It may contain mistakes, or outdated pricing data. "
    "Always use the Azure Retail Prices API for live pricing. The existence of a price meter does not always imply model/service availability. Prices vary depending on different factors, including region.<br>"
    f"Input tokens: {format(int(input_tokens), ',') if input_tokens is not None else 'n/a'} | "
    f"Output tokens: {format(int(output_tokens), ',') if output_tokens is not None else 'n/a'} | "
    f"Total tokens: {format(int(total_tokens), ',') if total_tokens is not None else 'n/a'}._"
    )

    try:
        os.makedirs(output_dir, exist_ok=True)
        full_date_title = f"# {parsed_date.day} {parsed_date.strftime('%B %Y')}\n\n"
        final_markdown = f"{full_date_title}{content or ''}\n\n{disclaimer}"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_markdown)
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(6)


if __name__ == "__main__":
    main()
