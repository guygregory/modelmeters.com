# Model Meters - Azure AI Foundry Pricing Explorer

[modelmeters.com](https://modelmeters.com) provides a simple front-end to the [Azure Retail Prices API](https://docs.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices), automatically downloading and enriching Azure AI pricing data with AI-generated summaries and insights.

<img width="1280" height="640" alt="socialpreview" src="https://github.com/user-attachments/assets/3cb11499-770f-4e87-818a-af22979e5595" />


## Solution Overview

Model Meters combines several Azure and GitHub services to create an automated pricing intelligence solution:

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

## Technologies Used

### Core Technologies
- **[GitHub Copilot](https://github.com/features/copilot)** - AI-powered code completion and development assistance
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD automation and workflow orchestration
- **[Azure Static Web Apps](https://azure.microsoft.com/services/app-service/static/)** - Static site hosting with integrated CI/CD
- **[Azure AI Foundry](https://azure.microsoft.com/products/ai-foundry/)** - AI model deployment and management platform
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** - Protocol for AI model context sharing

### Development Stack
- **HTML/CSS/JavaScript** - Frontend web interface
- **Python 3.1x** - Backend data processing and AI integration
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

> **Pricing Disclaimer**: Costs are approximate, correct at time of writing (August 2025), and may vary based on:
> - Actual usage patterns and data volumes
> - Regional pricing differences
> - Azure service tier selections
> - Token consumption for AI summaries
> - Additional monitoring or storage requirements
> 
> Other costs may be incurred depending on specific implementation choices and usage patterns.

## Getting Started

### Prerequisites

- Azure subscription with AI Foundry access
- GitHub repository
- Python 3.11+ for local development

### Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/guygregory/modelmeters.com.git
   cd modelmeters.com
   ```

2. **Configure Azure OpenAI** (for AI summaries):
   ```bash
   # Set environment variables
   export AZURE_OPENAI_API_KEY="your-api-key"
   export AZURE_OPENAI_V1_API_ENDPOINT="https://your-resource.openai.azure.com/openai/v1/"
   export AZURE_OPENAI_API_MODEL="gpt-4"
   ```

3. **Configure GitHub Token** (for GitHub Models fallback):
   ```bash
   export GITHUB_TOKEN="your-github-token"
   ```

### Local Development

1. **Download pricing data**:
   ```bash
   python meter-download.py --cognitive-services-only --ndjson prices.ndjson
   ```

2. **Process monthly data**:
   ```bash
   python split_into_monthly.py
   ```

3. **Generate AI summaries**:
   ```bash
   python create-ai-summaries.py
   ```

4. **Serve locally**:
   ```bash
   python -m http.server 8000
   # Visit http://localhost:8000
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

- **Azure Pricing Documentation**: https://docs.microsoft.com/azure/cost-management-billing/
- **Azure AI Foundry**: https://docs.microsoft.com/azure/ai-foundry/
- **GitHub Actions**: https://docs.github.com/en/actions
- **Azure Static Web Apps**: https://docs.microsoft.com/azure/static-web-apps/
- **Microsoft Learn MCP Server**: [https://github.com/microsoftdocs/mcp](https://github.com/microsoftdocs/mcp)

## License

This project is provided under the MIT License. See LICENSE file for details.
