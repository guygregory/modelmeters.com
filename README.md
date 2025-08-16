# Azure AI Foundry Models - Retail Prices Explorer

A web-based tool for exploring and analyzing Azure Cognitive Services pricing data. This project provides an interactive interface to browse, filter, and export Azure AI service pricing information with automatic daily data updates.

## 🌟 Features

### Web Interface
- **Interactive Data Explorer**: Browse thousands of Azure Cognitive Services pricing records
- **Advanced Filtering**: Filter by service name, location, pricing tiers, and more
- **Smart Search**: Text-based filtering across all data fields
- **Sorting & Pagination**: Sort by any column with configurable page sizes
- **Theme Support**: Light and dark theme options
- **CSV Export**: Export filtered data to CSV format
- **Shareable URLs**: Generate URLs that preserve your current filters and view state
- **Real-time Data**: Automatically updated daily with the latest pricing information

### Data Management
- **Automated Updates**: Daily refresh of pricing data via GitHub Actions
- **Efficient Storage**: Uses NDJSON format for optimal performance
- **API Integration**: Direct integration with Azure Retail Prices API
- **Change Detection**: Only updates when new data is available

## 🚀 Quick Start

### Using the Web Interface

1. **Visit the Live Site**: The explorer is automatically deployed and accessible at your Azure Static Web Apps URL
2. **Browse Data**: Use the table interface to explore Azure Cognitive Services pricing
3. **Apply Filters**: Use the filter controls to narrow down results
4. **Export Data**: Click "Export to CSV" to download your filtered results
5. **Share Views**: Click "Share URL" to generate a link with your current filters

### Running Locally

#### Prerequisites
- Python 3.11+ (for the data downloader)
- Modern web browser
- Web server (for serving the HTML file locally)

#### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/guygregory/meter-explorer.git
   cd meter-explorer
   ```

2. Download the latest pricing data:
   ```bash
   python meter-download.py --cognitive-services-only --ndjson prices.ndjson
   ```

3. Serve the web interface:
   ```bash
   # Using Python's built-in server
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   
   # Or using any other static file server
   ```

4. Open your browser to `http://localhost:8000`

## 📊 Data Downloader

The `meter-download.py` script fetches pricing data from the Azure Retail Prices API.

### Usage Examples

```bash
# Download all Cognitive Services pricing data (default)
python meter-download.py

# Download to a specific NDJSON file
python meter-download.py --ndjson cognitive-services.ndjson

# Download to both NDJSON and JSON formats
python meter-download.py --ndjson data.ndjson --output data.json

# Download with custom filtering
python meter-download.py --filter "location eq 'US East'"

# Quick test with limited pages
python meter-download.py --max-pages 3 --ndjson sample.ndjson

# Add delay between API calls
python meter-download.py --delay 0.5
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--output` | Path for JSON array output file |
| `--ndjson` | Path for newline-delimited JSON output (default: prices.ndjson) |
| `--filter` | OData-style filter expression |
| `--cognitive-services-only` | Restrict to Cognitive Services only (default: enabled) |
| `--max-pages` | Limit number of pages for testing |
| `--delay` | Delay between API requests in seconds |
| `--progress-every` | Progress update frequency (default: every 5 pages) |

### Key Features
- **No Dependencies**: Uses only Python standard library
- **Resilient**: Built-in retry with exponential backoff
- **Memory Efficient**: Streams data to avoid memory issues with large datasets
- **Progress Tracking**: Real-time progress and performance metrics

## 🔄 Automated Deployment

The project uses GitHub Actions for automated data updates and deployment:

### Daily Data Update Workflow
- Runs daily at midnight UTC
- Downloads latest pricing data using the Python downloader
- Compares new data with existing data using SHA256 hash
- Updates metadata with timestamps
- Triggers deployment only when data changes
- Commits changes automatically

### Azure Static Web Apps Deployment
- Deploys automatically when data changes
- Triggered by push to main branch or manual dispatch
- Serves the web interface with updated pricing data
- Zero-downtime deployments

## 📁 Project Structure

```
meter-explorer/
├── index.html              # Main web interface
├── meter-download.py       # Azure pricing data downloader
├── prices.ndjson          # Current pricing data (NDJSON format)
├── metadata.json          # Data update metadata
├── .github/
│   ├── workflows/
│   │   ├── daily-data-update.yml           # Daily data refresh
│   │   └── azure-static-web-apps-*.yml     # Azure deployment
│   └── DEPLOYMENT.md      # Deployment documentation
├── .gitignore            # Git ignore rules
└── README.md            # This file
```

## 🎨 Web Interface Guide

### Navigation
- **Column Visibility**: Toggle columns using the column selector
- **Sorting**: Click column headers to sort (click again to reverse)
- **Filtering**: Use the filter row below headers for text-based filtering
- **Pagination**: Navigate through pages using the pagination controls

### Filtering Options
- **Text Filters**: Supports contains, equals, starts with, ends with operations
- **Value Selection**: Multi-select from distinct values in each column
- **Combined Filters**: Apply multiple filters simultaneously

### Export & Sharing
- **CSV Export**: Exports only visible columns and filtered data
- **URL Sharing**: Generates URLs that preserve:
  - Active filters and their values
  - Column visibility settings
  - Sort order and direction
  - Current page and page size

## 🔧 Configuration

### Data Source
The application fetches data from the official Azure Retail Prices API:
- **API Endpoint**: `https://prices.azure.com/api/retail/prices`
- **Default Filter**: Cognitive Services only (`serviceName eq 'Cognitive Services'`)
- **Update Frequency**: Daily at midnight UTC

### Customization
- **Page Sizes**: 20, 50, 100, 200, or "All"
- **Themes**: Light and dark modes with automatic system preference detection
- **Columns**: Fully customizable column visibility

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with sample data
5. Submit a pull request

### Reporting Issues
- Use GitHub Issues for bug reports and feature requests
- Include browser information for web interface issues
- Provide Python version for data downloader issues

### Pull Request Guidelines
- Keep changes focused and atomic
- Update documentation for new features
- Test changes locally before submitting
- Follow existing code style and conventions

## 📝 Data Schema

The pricing data includes the following fields:

| Field | Description |
|-------|-------------|
| `currencyCode` | Currency (typically USD) |
| `retailPrice` | Retail price |
| `unitPrice` | Unit price |
| `tierMinimumUnits` | Minimum units for pricing tier |
| `armRegionName` | Azure region name |
| `location` | Human-readable location |
| `effectiveStartDate` | When pricing became effective |
| `meterId` | Unique meter identifier |
| `meterName` | Descriptive meter name |
| `productName` | Azure product name |
| `serviceName` | Azure service name |
| `serviceFamily` | Service category |
| `unitOfMeasure` | Billing unit |
| `type` | Pricing type (Consumption, etc.) |

## 📄 License

This project is open source. Please see the repository for license details.

## 🔗 Links

- [Azure Retail Prices API Documentation](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Azure Static Web Apps Documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)