# Azure Retail Prices Explorer

An interactive web application for querying the Azure Retail Prices API. This tool allows users to build complex filter expressions and export the results to CSV.

## Features

- **Filter Builder**: Build complex OData filter expressions using a visual interface
- **Multiple Filter Conditions**: Combine conditions with AND/OR operators
- **API Options**: Choose API version, currency, and filter for primary meters only
- **Data Export**: Export search results to CSV format
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

The application consists of:

1. **Frontend**: A single-page application built with vanilla HTML, CSS, and JavaScript
2. **Backend API**: Azure Functions that proxy requests to the Azure Retail Prices API to solve CORS issues

### CORS Solution

The original issue was that browsers block direct cross-origin requests to the Azure Retail Prices API. This has been solved by:

1. Creating an Azure Functions API in the `/api` folder
2. The API acts as a proxy, making server-to-server requests to Azure (no CORS restrictions)
3. The API returns data with proper CORS headers for the frontend
4. Frontend calls the local `/api/prices` endpoint instead of the external Azure API directly

## Files

- `index.html` - Main HTML page with embedded CSS
- `script-standalone.js` - Frontend JavaScript (no external dependencies)
- `api/` - Azure Functions API
  - `host.json` - Azure Functions configuration
  - `package.json` - Node.js dependencies
  - `prices/` - Price proxy function
    - `function.json` - Function binding configuration
    - `index.js` - Function implementation

## Deployment

This application is configured for deployment on Azure Static Web Apps:

1. The frontend files are served from the root directory
2. The API functions are deployed from the `/api` directory
3. GitHub Actions workflow automatically deploys changes

## Development

For local development:

1. Serve the frontend files with any HTTP server
2. Run the Azure Functions locally with `func start` in the `/api` directory
3. The frontend will automatically detect localhost and use the local API

## API Endpoints

- `GET /api/prices` - Proxy to Azure Retail Prices API
  - Supports all query parameters from the original Azure API
  - Returns JSON data with proper CORS headers