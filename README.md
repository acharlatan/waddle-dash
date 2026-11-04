# Waddle Dash

A free, local-first marketing dashboard with a cozy fan-project aesthetic. Upload a CSV to explore spend, revenue, conversions, ROAS, campaign and channel summaries, comparisons, and rule-based observations. This is an unofficial fan project and is not affiliated with Nintendo or HAL Laboratory.

## Use it

1. Open the site and choose **Upload CSV**. Your file is read in the browser.
2. Match columns to **Date**, **Channel**, and at least one of **Spend**, **Revenue**, or **Conversions**. Campaign and Currency are optional. Pick the currency used by your file.
3. Import the data. The dashboard reports skipped records and their reasons. Fix and re-upload the original file if needed.
4. Use the date selector, Campaigns, Insights, and Ask Waddle to explore the data. The sample dataset is optional and clearly labeled.

A downloadable example template is available in the upload dialog. Accepted dates are `YYYY-MM-DD` and `MM/DD/YYYY`; use UTF-8 comma-separated CSV with a header, up to 5 MB and 30,000 data records. Quoted commas, quotes, and newlines are supported. Numbers use a decimal point; comma-separated thousands and common currency symbols are supported. One currency per file is assumed; if a currency column is mapped, nonblank entries must match the selected currency. Amounts are never converted. Use the same metric definition for all rows, and do not include overlapping aggregates and detail rows together. Duplicate rows are not automatically removed.

## How the numbers work

- The selected date range ends on the latest date in the imported file, not necessarily today's date. All dates are inclusive.
- Totals sum recorded values. Blanks are not zero; cards identify partial coverage and table totals may be partial. ROAS is revenue divided by spend and requires complete spend and revenue for the relevant rows and positive total spend.
- Date-window comparisons only appear when the current and prior equal-length windows have records on every date, and the metric is complete for both windows. The presence of a record on every date does not guarantee the export includes every campaign. Values are descriptive and do not establish causation.
- Channel revenue share is hidden if a channel has negative revenue. Chart lines connect recorded points; missing dates are not inferred to be zero. The chart shows up to three channels with the largest recorded revenue.
- Ask Waddle answers a small set of predefined questions through deterministic rules. It is not a chatbot or an AI service. Recommendations are prompts for review, not automatic budget changes, profit calculations, or evidence of causation.

## Privacy and limits

Data stays in the browser's memory during the current session and is not sent to a server. Reloading or leaving the page clears it, so keep your original CSV. There are no accounts, saved workspaces, third-party analytics, AI calls, or platform integrations. The app is a fresh implementation: it does not import or preserve data or features from any separate Marketing Insights product.

## Development and deployment

No build or dependency installation is required to serve `public/` as static files. Run `npm run check` and `npm test` with a recent Node.js. `wrangler.jsonc` deploys `public/` as static assets to the `waddle-dash` Worker. The connected Cloudflare Workers Builds configuration deploys pushes to `main` with `npx wrangler deploy`. The Worker has no server-side code or data bindings.

## Cozy workspace update

The workspace includes a guided first-run panel, a Channels comparison, a Data & settings page, campaign sorting, a choice of chart metrics, and an import preview. The illustrated landscape is an AI-generated decorative asset. The mascot is an original SVG. Reporting remains local to the browser and Ask Waddle continues to use transparent rule-based answers.
