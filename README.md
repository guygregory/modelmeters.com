# Azure Retail Prices Explorer

A beautifully polished, client‑side front‑end for the **Azure Retail Prices API** at `https://prices.azure.com/api/retail/prices`.

> ✅ No server required — ships as a static website.  
> ✅ Build queries with a friendly UI or enter raw `$filter`.  
> ✅ Supports `contains`, `startswith`, `endswith`, and `eq`.  
> ✅ Pagination via `NextPageLink` and CSV export.

## Quick start

1. Deploy as a Static Web App or any static hosting (Azure Static Web Apps recommended).
2. Open the site, build a query, and click **Search**.
3. Use **Export CSV (this page)** or **Export CSV (all)** to download results.

## Why client‑side?
The Retail Prices API allows unauthenticated, cross‑origin requests, so your browser can call Microsoft directly — no secrets or middle tier.

## Notable details
- **API versions**: Uses `2023-01-01-preview` by default (back‑compatible), which also supports savings plan prices. Filter values are *case‑sensitive* on preview versions.
- **Filters**: The API supports filters on: `armRegionName`, `location`, `meterId`, `meterName`, `productId`, `skuId`, `productName`, `skuName`, `serviceName`, `serviceId`, `serviceFamily`, `priceType`, `armSkuName`.
- **OData functions**: `contains`, `startswith`, `endswith`, and equality `eq` for string fields.
- **Pagination**: Up to 1,000 rows per page; use `NextPageLink` to fetch more.
- **Primary meters**: Toggle adds `meterRegion=primary` (supported for 2021‑10‑01 and later).

> ℹ️ Prices are retail list prices. Non‑USD currency values are reference conversions only and might not match your invoice exactly.

## Developing locally
Just open `index.html` in a modern browser. For best results, serve via a tiny local server (e.g., `npx serve`) to avoid any file URL quirks.

## Project layout
```
.
├── index.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js
└── README.md
```

## Accessibility & UX
- Keyboard‑accessible sortable table headers (`aria-sort`).
- Sticky table header, large tap targets, dark/light mode.
- Sharable links persist query state in the URL.

## License
MIT
