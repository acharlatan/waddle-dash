# Waddle Dash

A local-first, unofficial fan-project marketing workspace. Waddle Dash imports a supported campaign CSV, shows explainable observations, and lets visitors edit and print a Waddle Report. Ask Waddle is rule-based, not AI. There is no account or external analytics integration.

## Get started

Select **Demo** to explore fictional data; **My data** returns to your uploaded session without mixing or replacing either dataset. Choose **Getting started** for a format guide and a template. The demo, upload, plan and report are held only in browser memory. Refreshing or leaving clears both workspaces.

### Custom CSV

Use UTF-8 comma-separated values with the header in the first row, up to 5 MB and 30,000 data records. Each row should represent one campaign/channel on one day. Map Date, Channel and at least one of Spend, Revenue, Conversions, Clicks or Impressions. Campaign and Currency are optional. Dates are `YYYY-MM-DD` or US `MM/DD/YYYY`; numbers use a decimal point, optional comma thousands, and common currency symbols. An optional constant channel can be entered if the CSV lacks a channel column. Download the custom template from the upload screen or guide.

### Google Ads-style campaign CSV

The supported synthetic fixture uses `Day,Campaign,Cost,Conversions,Conv. value`, one row per campaign per day, with a user-entered channel and selected currency. Optional clicks/impressions can be mapped. Report titles or other metadata must be removed so the first row contains headers. The user must confirm whether the mapped value is platform-reported conversion value or actual recorded revenue; a Google Ads path defaults to conversion value. This value is not verified revenue or profit. **Not every Google Ads export or localized format is supported.** CRM contact and deal exports are not automatically campaign-performance reports.

A single currency per file is required; mapped nonblank currency codes must match the selected currency. The app excludes identifiable `Total` rows and reports them as skipped. Exact duplicate rows are flagged but never removed automatically; they require confirmation at import. Neither check can identify every overlapping subtotal or duplicate. Users should choose one report level and review their export. Unsupported date and number formats or missing required fields are reported; the preview explains skipped records before import.

## Calculations and reports

The selected range ends on the latest date in the import. Empty cells are not zero. Totals can be partial; ROAS requires complete paired spend and revenue/conversion value with positive spend. Change comparisons require records on every date in both equal windows, and complete values; a record on every date does not prove that every campaign is present. Observations describe recorded data and do not establish causation. Line charts connect available points, not missing dates as zero. The visible chart has a separate table of the recorded values.

The experiment planner is editable and copyable. Waddle Report lets users choose metrics and edit its title, observations, plan and notes. **Print / Save as PDF** invokes the browser print dialog; it does not generate or upload a PDF by itself. Users should review their report before sharing. No report is sent or shared automatically.

Data and drafts remain in memory and are not sent to a server. There is no background sync, cloud storage, AI service, automated budget change, or persistent local saving. Keep the original data and exported reports. Users choose a goal for context; they must ensure their conversion definition matches that goal.

## Run and deploy

No build is required to serve `public/`. With Node.js, run `npm run check` and `npm test`. `wrangler.jsonc` deploys `public/` as static assets to the connected `waddle-dash` Cloudflare Worker. The Worker has no server-side code or data bindings. The background landscape is an AI-generated decorative asset and the original mascot is an SVG and the report companion is an AI-generated decorative asset.
