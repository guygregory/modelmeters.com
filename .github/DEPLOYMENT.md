# Automatic Website Deployment

## Overview

The website is automatically deployed to Azure Static Web Apps whenever the daily pricing data changes. This ensures the website always shows the most up-to-date Azure pricing information.

## Workflow

1. **Daily Data Update** (`.github/workflows/daily-data-update.yml`)
   - Runs daily at midnight UTC
   - Downloads the latest Azure pricing data using `meter-download.py`
   - Compares the new data with the existing data using SHA256 hash
   - Updates `metadata.json` with timestamps and data hash
   - If data has changed:
     - Commits the changes to the repository
     - Triggers the website deployment workflow

2. **Website Deployment** (`.github/workflows/azure-static-web-apps-blue-tree-01656d710.yml`)
   - Runs on push to main branch, pull requests, and when triggered by the daily data update
   - Deploys the website to Azure Static Web Apps
   - Uses the updated `prices.ndjson` and `metadata.json` files

## How It Works

The daily workflow uses GitHub's `repository_dispatch` API to trigger the Azure Static Web Apps workflow only when data changes. This prevents unnecessary deployments when no changes are detected.

### Key Components

- **Data Change Detection**: Uses SHA256 hash comparison to detect changes in `prices.ndjson`
- **Conditional Deployment**: Only triggers deployment when `DATA_CHANGED=true`
- **Repository Dispatch**: Uses GitHub's repository dispatch API to trigger the Azure workflow
- **Metadata Tracking**: Updates `last_checked` and `last_changed` timestamps

### Event Flow

```
Daily Schedule (00:00 UTC)
  ↓
Download Latest Pricing Data
  ↓
Compare Data Hash
  ↓
Data Changed? → No → Update metadata.json (last_checked only)
  ↓ Yes
Update metadata.json (last_checked + last_changed)
  ↓
Commit Changes
  ↓
Trigger Repository Dispatch Event
  ↓
Azure Static Web Apps Deployment
```

## Manual Triggering

The daily workflow can also be triggered manually via the GitHub Actions UI using the `workflow_dispatch` trigger.