# Model Meters - Azure AI Foundry Pricing Explorer

[modelmeters.com](https://modelmeters.com) provides a simple front-end to the [Azure Retail Prices API](https://docs.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices), automatically downloading and enriching Azure AI pricing data with AI-generated summaries and insights.

<img width="1280" height="640" alt="socialpreview" src="https://github.com/user-attachments/assets/3cb11499-770f-4e87-818a-af22979e5595" />

## Cloud Champion overview session and slides (Microsoft Partners)

<img width="1280" height="720" alt="How I built Model Meters in a weekend - Cloud Champion 6th November 2025" src="https://github.com/user-attachments/assets/4e9bf528-f9b3-47f5-b4a0-ada2404166ab" />

To watch the November 2025 Cloud Champion session associated with this tool, please browse to the recording [here](https://www.cloudchampion.co/c/using-azure-ai-foundry-and-github-services-to-build-modelmeters-com).

## Solution Overview

Model Meters combines several Azure and GitHub services to create an automated pricing intelligence solution. The system architecture orchestrates daily updates through GitHub Actions workflows, with Azure OpenAI generating insights and Azure Static Web Apps hosting the results. The social preview image at the top of this README provides a visual overview of how these components work together.

### Architecture Flow

1. **Daily Data Collection**: GitHub Actions automatically downloads the latest Azure pricing data using the Azure Retail Prices API
2. **Data Processing**: The raw pricing data is split into segments based on the pricing `startDate` value
3. **AI Enhancement**: Azure OpenAI (via Azure AI Foundry) generates intelligent summaries of the latest pricing changes, using Model Context Protocol (MCP) to include Microsoft Learn documentation
4. **Web Deployment**: The processed data and summaries are automatically deployed to Azure Static Web Apps using GitHub Actions
5. **User Interface**: A responsive web interface allows users to explore pricing data and AI-generated insights

### Key Agentic AI Features

- **GitHub Actions Workflow**: Runs daily at midnight UTC to check for pricing updates
- **AI-Powered Summaries**: Leverages Azure OpenAI to generate concise, factual summaries of pricing changes grouped by model provider
- **Documentation Integration**: Uses [Microsoft Learn MCP Server](https://github.com/microsoftdocs/mcp) to automatically include relevant documentation links
- **Human-in-the-loop**: As AI summaries are stored in markdown format, this allows for quick and easy human review (and potentially AI agent review)

<img width="1531" height="700" alt="image" src="https://github.com/user-attachments/assets/aabbf3c8-14cb-488a-a49c-cca6440bb33d" />

## Who Would Benefit From This?

This sample is designed to help Microsoft partners (and their customers) understand how they can:

- **Use GitHub and GitHub Copilot** to rapidly build a simple AI agent for data processing
- **Combine GitHub Actions with Azure AI Foundry** to automate repeatable tasks at scale
- **Use LLMs to enrich frequently updated structured data**, such as price lists, inventory, or sales data
- **Incorporate the use of Model Context Protocol (MCP)** within their solutions for enhanced AI capabilities
- **Build cost-effective monitoring solutions** for tracking Azure service pricing changes
- **Create automated reporting systems** that combine real-time data with AI-generated insights

### Value Proposition

**Before modelmeters.com:**
- Manually checking Azure pricing pages to track AI model costs
- Missing important price changes that impact project budgets
- Difficult to compare pricing across different regions and models
- No historical view of how AI pricing has evolved over time

**After modelmeters.com:**
- Automated daily price monitoring with AI-generated summaries
- Historical pricing data and trend analysis at your fingertips
- Side-by-side model comparison with interactive filtering
- RSS/email notifications when new pricing data is available

## Technologies Used

### Core Technologies
- **[GitHub Copilot](https://github.com/features/copilot)** - AI-powered code completion and development assistance
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD automation and workflow orchestration
- **[Azure Static Web Apps](https://azure.microsoft.com/services/app-service/static/)** - Static site hosting with integrated CI/CD
- **[Azure AI Foundry](https://azure.microsoft.com/products/ai-foundry/)** - AI model deployment and management platform
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** - Protocol for AI model context sharing

### Development Stack
- **HTML/CSS/JavaScript** - Frontend web interface
- **Python 3.11+** - Backend data processing and AI integration
- **OpenAI Python SDK** - AI model interaction
- **JSON/NDJSON** - Data storage and interchange formats

## Services Used

### Azure Services
- **[Azure Retail Prices API](https://docs.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices)** - Official Azure pricing data source
- **[Azure OpenAI Service](https://azure.microsoft.com/products/ai-services/openai-service/)** - AI model hosting and inference
- **[Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)** - Web application hosting and deployment

### AI Services
- **[Microsoft Learn MCP Server](https://learn.microsoft.com/api/mcp)** - Documentation context provider for AI summaries
- **[Responses API](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/responses)** - AI response generation, with support for MCP

### GitHub Services
- **[GitHub Actions](https://docs.github.com/en/actions)** - Workflow automation and CI/CD
- **[GitHub Models](https://github.com/marketplace/models)** - Alternative AI model access (fallback option, especially for simpler, smaller demos)

## Cost Breakdown

The minimal solution takes advantage of free tiers where available, and has been designed to be deployed on a Visual Studio Subscription, or an Azure Free account. The Advanced demo could be deployed on Azure Bulk Credit, or on a commercial Azure subscription (CSP, PAYG, MCA-E, etc.).

### Understanding the Cost Tiers

- **Minimal demo:** Suitable for learning, personal projects, or proof-of-concept. Uses free tiers where available. Best for understanding how the system works and experimenting with the code.
- **Advanced demo:** Designed for production use with higher data volumes, custom domains, and enhanced monitoring. Includes features like Azure AI Search and Microsoft Fabric for advanced analytics.

| Component | Minimal demo | Advanced demo | Notes |
|-----------|----------------------|------------------------|-------|
| **Azure Static Web Apps** | $0/month | $9/month (Standard) | Free tier includes 100GB bandwidth, 0.5GB storage |
| **Azure AI Foundry - OpenAI** | ~$5-20/month | ~$50-100/month | Price varies based on token usage |
| **Azure Retail Prices API** | $0/month | $0/month | Free public API with rate limits |
| **GitHub Actions** | $0/month | $4/month (Team plan) | 2000 minutes/month free, then $0.008/minute |
| **GitHub Repository** | $0/month | $4/month (Team plan) | Public and private repos free, additional features in Team plan |
| **Domain/Custom DNS** | Optional $15/year | Optional $15/year | Optional custom domain, via third-party domain registrar |
| **Monitoring/Analytics** | $0/month | $10-25/month | Optional Application Insights, etc. |
| **Storage (backup/logs)** | $0-2/month | $5-15/month | Azure Storage for additional data retention |
| **Azure AI Search** | Optional (Free tier) | Optional \~\$75/month (Basic tier) | Free tier includes up to 3 indexes, 50MB storage; Basic tier allows larger workloads |
| **Microsoft Fabric** | N/A | Optional \~\$262/month (F2 capacity) | Based on Fabric F2 capacity |
| **Total Monthly Cost** | **$5-10/month** | **$100-500/month** |  |

> **Pricing Disclaimer**: Costs are approximate, correct at time of writing (November 2025), and may vary based on:
> - Actual usage patterns and data volumes
> - Regional pricing differences
> - Azure service tier selections
> - Token consumption for AI summaries
> - Additional monitoring or storage requirements
> 
> Other costs may be incurred depending on specific implementation choices and usage patterns.

## Getting Started

### Prerequisites

**Required:**
- **Azure subscription** with Azure AI Foundry or Azure OpenAI Service access
  - [Create a free Azure account](https://azure.microsoft.com/free/) or use an existing subscription
  - [Deploy an Azure OpenAI resource](https://learn.microsoft.com/azure/ai-services/openai/how-to/create-resource)
- **Python 3.11 or later** ([Download Python](https://www.python.org/downloads/))
- **Git** for cloning the repository
- **Python packages:** `openai`, `python-dotenv` (installed via pip in setup steps)

**Optional (for deploying your own version):**
- GitHub account with repository access
- Azure Static Web Apps resource for hosting

### Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/guygregory/modelmeters.com.git
   cd modelmeters.com
   ```

2. **Install Python dependencies**:
   ```bash
   pip install openai python-dotenv
   ```

3. **Configure Azure OpenAI** (for AI summaries):
   ```bash
   # Set environment variables
   export AZURE_OPENAI_API_KEY="your-api-key"
   export AZURE_OPENAI_V1_API_ENDPOINT="https://your-resource.openai.azure.com/openai/v1/"
   export AZURE_OPENAI_API_MODEL="gpt-4"
   
   # Verify environment variables are set (optional):
   env | grep AZURE_OPENAI
   ```

4. **Configure GitHub Token** (optional, for GitHub Models fallback):
   ```bash
   export GITHUB_TOKEN="your-github-token"
   ```
   
   > **Note:** GitHub Models provides a simpler alternative for demos and experimentation. The project automatically falls back to GitHub Models if Azure OpenAI credentials are not configured. See `ai-summary-github-models.py` for implementation details.

### Local Development

1. **Download pricing data**:
   ```bash
   python meter-download.py --cognitive-services-only --ndjson prices.ndjson
   # Expected output:
   # Fetching Azure Retail Prices...
   # Downloaded 234 items
   # Completed: 234 items written to prices.ndjson
   ```

2. **Process monthly data**:
   ```bash
   python split_into_monthly.py
   # Expected output:
   # Processing prices.ndjson...
   # Created 45 monthly files in monthly/full/ and monthly/partial/
   ```

3. **Generate AI summaries**:
   ```bash
   python create-ai-summaries.py
   # Expected output:
   # Generating AI summary for 2024-10-01...
   # Summary saved to monthly/aisummary/2024-10-01.md
   ```

4. **Serve locally**:
   ```bash
   python -m http.server 8000
   # Visit http://localhost:8000
   # You should see the pricing data explorer interface
   ```

### Deployment

The project automatically deploys to Azure Static Web Apps via GitHub Actions when changes are pushed to the main branch.

## Project Structure

```
├── index.html              # Main pricing data explorer
├── agent/                  # AI summary interface
├── monthly/                # Monthly pricing data and summaries
│   ├── full/              # Complete monthly data files
│   ├── partial/           # Filtered monthly data files
│   └── aisummary/         # AI-generated summaries
├── .github/workflows/     # GitHub Actions automation
├── ai-summary.py          # Azure OpenAI summary generation
├── ai-summary-github-models.py # GitHub Models fallback
├── meter-download.py      # Azure pricing data downloader
├── split_into_monthly.py  # Data processing utilities
└── prices.ndjson         # Latest pricing data
```

## Features

### 🔍 **Interactive Pricing Explorer**
- Real-time filtering and search capabilities
- Sortable columns with customizable views
- Export functionality for data analysis
- Responsive design for mobile and desktop

### 🤖 **AI-Powered Insights**
- Daily automated summaries of pricing changes
- Model provider groupings and comparisons  
- Integration with Microsoft Learn documentation
- Contextual links to relevant resources

### ⚡ **Automated Updates**
- Daily data refresh via GitHub Actions
- Intelligent change detection to minimize costs
- Automatic deployment on data changes
- Comprehensive error handling and retry logic

## API Usage Examples

### Azure Retail Prices API
```python
# Basic pricing data retrieval
import requests

response = requests.get(
    "https://prices.azure.com/api/retail/prices",
    params={"$filter": "serviceName eq 'Cognitive Services'"}
)
pricing_data = response.json()
```

### AI Summary Generation
```python
# Generate AI summary using Azure OpenAI
# NOTE: This is a conceptual example showing the approach used in ai-summary.py
#       Actual implementation may differ based on Azure OpenAI SDK version

from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://your-resource.openai.azure.com/openai/v1/",
    default_query={"api-version": "preview"}
)

response = client.responses.create(
    model="gpt-4",
    instructions="Summarize Azure pricing changes...",
    tools=[{
        "type": "mcp",
        "server_label": "MicrosoftLearn",
        "server_url": "https://learn.microsoft.com/api/mcp"
    }],
    input=pricing_data
)
```

## Command Reference

### Data Download Commands

Download all Azure pricing data:
```bash
python meter-download.py --ndjson prices.ndjson
```

Download only Cognitive Services (AI) pricing:
```bash
python meter-download.py --cognitive-services-only --ndjson prices.ndjson
```

Quick test with limited pages:
```bash
python meter-download.py --max-pages 3 --ndjson sample.ndjson
```

### Data Processing Commands

Split pricing data into monthly files:
```bash
python split_into_monthly.py
# Creates files in monthly/full/ (complete data) and monthly/partial/ (filtered data)
```

Generate AI summaries for all months:
```bash
python create-ai-summaries.py
# Creates AI-generated summaries in monthly/aisummary/
```

Generate AI summary for a specific date:
```bash
python ai-summary.py monthly/partial/2024-10-01.json
# Outputs markdown summary to monthly/aisummary/2024-10-01.md
```

Use GitHub Models fallback (no Azure OpenAI needed):
```bash
python ai-summary-github-models.py monthly/partial/2024-10-01.json
```

### Local Development Commands

Serve the site locally:
```bash
python -m http.server 8000
# Then visit http://localhost:8000 in your browser
```

Generate RSS feed:
```bash
python generate-rss.py
# Creates agent/rss.xml with recent AI summaries
```

Consolidate multiple AI summaries:
```bash
python consolidate-ai-summaries.py
# Combines summaries for analysis
```

## Troubleshooting

### Common Issues

**Problem:** `ModuleNotFoundError: No module named 'openai'` or `No module named 'dotenv'`  
**Solution:** Install the required Python packages:
```bash
pip install openai python-dotenv
```

**Problem:** AI summaries fail with authentication error  
**Solution:** Verify your environment variables are set correctly:
```bash
# Check that all required variables are set:
env | grep AZURE_OPENAI

# Verify the values (be careful not to expose your actual API key):
echo $AZURE_OPENAI_API_KEY | head -c 10  # Should show first 10 chars
echo $AZURE_OPENAI_V1_API_ENDPOINT       # Should show your endpoint URL
echo $AZURE_OPENAI_API_MODEL             # Should show your model name (e.g., gpt-4)
```

Ensure:
- `AZURE_OPENAI_API_KEY` is your actual API key from Azure portal
- `AZURE_OPENAI_V1_API_ENDPOINT` ends with `/openai/v1/`
- `AZURE_OPENAI_API_MODEL` matches your Azure OpenAI deployment name

**Problem:** Data download times out or returns errors  
**Solution:** The Azure Retail Prices API has rate limits. The script includes retry logic with exponential backoff. Common causes:
- Network connectivity issues - check your internet connection
- API rate limiting - the script will automatically retry with delays
- Temporary API unavailability - try again in a few minutes

**Problem:** Local web server shows no data or empty tables  
**Solution:** Ensure you've completed all steps in "Local Development" in order:
1. Download pricing data (creates `prices.ndjson`)
2. Process monthly data (creates files in `monthly/full/` and `monthly/partial/`)
3. Verify files exist: `ls -lh monthly/partial/`
4. Then serve the site

**Problem:** `python` command not found  
**Solution:** On some systems, Python 3 is called `python3`:
```bash
python3 --version              # Check Python 3 is installed
python3 -m pip install openai  # Use python3 instead of python
python3 meter-download.py      # Run scripts with python3
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally using the setup instructions
5. Submit a pull request

## Disclaimer

⚠️ **Important Notice**:

- **Demonstration Purposes**: The site and code in this repository are for **demonstration purposes only**, not intended for production use
- **No Warranties**: No warranties, guarantees, or support is provided for this code
- **AI-Generated Content**: Summaries are AI-generated and could contain mistakes or inaccuracies
- **Authoritative Source**: Always refer to the [official Azure pricing page](https://azure.microsoft.com/pricing/) and price lists directly for authoritative pricing information
- **Data Accuracy**: While we strive for accuracy, pricing data may be delayed or incomplete
- **Usage Responsibility**: Users are responsible for validating any pricing information before making business decisions

## Support and Resources

- **Azure Pricing Documentation**: [Cost Management and Billing](https://docs.microsoft.com/azure/cost-management-billing/)
- **Azure AI Foundry**: [AI Foundry Documentation](https://docs.microsoft.com/azure/ai-foundry/)
- **GitHub Actions**: [GitHub Actions Documentation](https://docs.github.com/en/actions)
- **Azure Static Web Apps**: [Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- **Microsoft Learn MCP Server**: [MCP Server on GitHub](https://github.com/microsoftdocs/mcp)

## License

This project is provided under the MIT License. See LICENSE file for details.
