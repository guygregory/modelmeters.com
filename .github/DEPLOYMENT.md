# Data updates and deployment

This guide describes the repository's GitHub Actions workflows for updating the data and deploying the static site to Azure Static Web Apps.

## Configure the repository

For summary generation in the daily workflow, configure these repository secrets:

- `AZURE_OPENAI_API_KEY`: the Azure OpenAI API key.
- `AZURE_OPENAI_V1_API_ENDPOINT`: the Azure OpenAI v1 endpoint URL.
- `AZURE_OPENAI_API_MODEL`: a compatible model deployment name.

For deployment, configure `AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE_TREE_01656D710` with the deployment token for the target Static Web App. A different app may require changing the secret referenced in the deployment workflow. The daily workflow uses the GitHub-provided `GITHUB_TOKEN` to commit changes and request a deployment; repository Actions settings must permit the required writes.

## Daily data update

[`daily-data-update.yml`](workflows/daily-data-update.yml) runs at 00:00 UTC daily and supports manual runs. It:

1. Downloads Foundry Models prices to `prices.ndjson` and GitHub prices to `prices-github.ndjson`.
2. Splits Foundry prices by `effectiveStartDate` into full and reduced, deduplicated files under `monthly/`.
3. Generates Azure OpenAI summaries for dates that do not already have a Markdown summary. Existing summaries are not refreshed when their inputs change.
4. Regenerates `monthly/aisummary/index.json` and `agent/rss.xml`, then writes the current UTC time to `metadata.json` as `last_updated`.
5. Stages the price files, metadata, `monthly/`, and RSS feed. If the staged files differ, it commits and pushes them, then requests a `data-updated` repository dispatch.

The workflow does **not** compare pricing hashes or dispatch only when prices change. The timestamp in `metadata.json` and the regenerated RSS feed can change even when prices do not, so successful runs normally produce a commit and deployment request. A failed earlier step stops the subsequent steps.

## Website deployment

[`azure-static-web-apps-blue-tree-01656d710.yml`](workflows/azure-static-web-apps-blue-tree-01656d710.yml) deploys the repository root to Azure Static Web Apps on:

- A push to `main`.
- A pull request targeting `main` when opened, synchronized, or reopened.
- A `data-updated` repository dispatch or a manual run.

When a pull request closes, the workflow runs the Static Web Apps close action instead of deploying it. The site has no separate application build or API directory.

## Summary maintenance

[`update-markdown-index.yml`](workflows/update-markdown-index.yml) regenerates the summary index and RSS feed on a push to `main` that changes summary Markdown, or on a manual run. [`open-issue-for-new-ai-summary.yml`](workflows/open-issue-for-new-ai-summary.yml) handles matching pushes by comparing the latest commit with its parent and opening a review issue for each newly added summary. The issue workflow uses the configured assignee and `help wanted` label.

Pushes made using the workflows' `GITHUB_TOKEN` do not normally trigger other push workflows. The daily workflow therefore generates the index and feed itself and explicitly requests deployment; do not rely on its commit to trigger the summary review workflow.

## Run manually

In the repository's **Actions** tab, select **Daily Data Update**, **Update Markdown Index**, or **Azure Static Web Apps CI/CD**, then choose **Run workflow**. The first refreshes data and requests deployment if it commits changes; the second refreshes the index and feed; the third deploys without refreshing data. Check the run and its jobs for failures.

For local commands and prerequisites, see the [README](../README.md#getting-started).