# Azure Meter Explorer

Client-side web UI for the public **Azure Retail Prices API**. Build dynamic filters, explore meter prices, paginate through results, and export to CSV. Deployed automatically as an Azure Static Web App.

## Features
- Multi-clause filter builder for all documented filterable fields (armRegionName, Location, meterId, meterName, productId, skuId, productName, skuName, serviceName, serviceId, serviceFamily, priceType, armSkuName)
- Operators: `eq`, `contains`, `startswith`, `endswith` (AND-combined)
- Optional: primary meters only, API version selection, currency code, row limit, timeout
- Handles pagination (`NextPageLink`) until limit or cancel
- Responsive sortable table + quick in-table text filter
- CSV export with metadata header
- Copy constructed API URL, shareable bookmark (`?filter=`)
- Dark / light theme toggle (auto prefers-color-scheme)
- Example queries for quick start

## Running Locally
No build step required; open `index.html` in a browser. (When served via `file://` the Clipboard API may require a user gesture for copy.)

For a simple local server (optional):
```bash
python -m http.server 5173
# then open http://localhost:5173
```

## Usage Tips
1. Add one or more clauses. Empty values are ignored.
2. Use function operators for substring / prefix / suffix queries.
3. Preview API version enforces case sensitivity.
4. Large result sets: raise row limit cautiously (client memory). 5–10k rows is usually fine.
5. Cancel mid-fetch with the Cancel button.

## CSV Export
The first line is a comment (beginning with `#`) containing filter metadata for traceability.

## Accessibility
Semantic HTML, focus management for status updates, keyboard shortcut (Ctrl/Cmd + Enter) to run search.

## License
MIT

---
This project is not an official Microsoft product; it simply consumes the public unauthenticated API.
