# Waddle Dash

A local-first, unofficial fan-project marketing workspace. Waddle Dash imports supported campaign CSVs, shows explainable rule-based observations, offers Mystery Lab and Time Machine, and lets visitors edit and print a Waddle Report. Ask Waddle is rule-based, not AI. There is no account or external analytics integration.

## Getting started

Use **Demo** for fictional data; **My data** returns to the uploaded session without mixing the datasets. The active upload, plan and report live in browser memory and clear on refresh or leaving. Time Machine optionally saves snapshots in browser storage after the user opts in and explicitly saves; these snapshots remain on the same device until deleted or browser storage is cleared. They are not synced or described as encrypted.

## Supported imports

Use UTF-8 comma-separated values, no more than 5 MB or 30,000 data records, with at most 100 introductory nonempty CSV records before the header and at most 150 mapped columns. A quoted multiline field is one CSV record. Select the header among the first 100 nonempty records; the app suggests one and previews the first records. Each data row should represent one campaign/channel on one day. Map Date, Channel (or explicitly assign a constant channel) and at least one of Spend, Revenue, Conversions, Clicks or Impressions. Campaign and Currency are optional. Dates are `YYYY-MM-DD` or US `MM/DD/YYYY`; numbers use decimal points and optional comma thousands separators. Other locales may require editing. Data records with more fields than the selected header are blocked to prevent silent column shifts; fix extra delimiters or select the correct header.

The Google Ads-style **synthetic** fixture has `Day,Campaign,Cost,Conversions,Conv. value,Clicks,Impressions`, one row per campaign per day, with an explicitly assigned channel. Explicitly choose a reporting currency and select whether a mapped value column is actual recorded revenue or platform-reported conversion value; conversion value is not verified revenue or profit. Not all Google Ads exports, localized formats, CRM contact lists or deal exports are supported.

Amounts with explicit currency symbols or codes must match the selected currency, and a mapped currency column must contain matching ISO codes. A bare `$` can represent USD, CAD or AUD, so the chosen dollar currency is a user declaration, not a verified inference. Amounts without a currency marker cannot be independently verified. The app blocks conflicts and performs no conversion. It excludes identifiable summary rows and reports exclusions. It flags exact duplicate raw rows without removing them. These checks cannot detect every overlapping subtotal, duplicate, or inconsistent attribution definition; review the file.

The import review allows choosing a different header, mapping columns, previewing data, and reviewing excluded record reasons before confirmation. File record numbers refer to nonempty logical CSV records, including the header; quoted multiline records count as one.

## Analysis and coverage

The selected date window ends on the latest imported date. The app distinguishes this window from dates actually recorded, lists missing days (up to 14, with a count), and shows per-metric row coverage. It can suggest comparing seven-day periods when observed date and group coverage allow it. Matching recorded days or group names still cannot establish that the export is complete.

Change comparisons are paused when imports retain exact duplicates, exclude invalid data rows, or recorded campaign/channel groups differ or do not have rows on each date in both windows. Missing rows are not zero and may be due to an export filter, a new or paused campaign, or other causes. Metric comparisons additionally require complete values, and ROAS requires complete paired spend and revenue/conversion value with positive spend. Line charts connect available points and provide a table alternative. Observations do not establish causation.

Goals change the overview, the briefing, the default chart metric, and channel emphasis: leads and bookings use recorded conversion volume and cost, website activity uses available click and impression metrics, and sales uses recorded value and ROAS. The user may confirm the meaning of the conversions column or leave it unknown, and can edit this setting in Data & settings. This is a declaration applying to the whole report, not automatic verification of the conversion action or attribution. Recorded conversions per click are shown only with a confirmed definition and complete non-negative inputs; this ratio does not imply unique users. Cost per conversion requires complete non-negative inputs and a positive conversion denominator.

Mystery Lab ranks comparable named campaign-and-channel groups by recorded conversion decrease, with cost change as a secondary clue. Its spending case displays shares only with complete non-negative spend and no unresolved duplicate or invalid-row warning. A missing group blocks the comparison; it is never treated as zero. The test fixture `synthetic_lead_shift.csv` is fictional and verifies a spend-stable decline; it is not a real export.

Time Machine retains the existing storage structure. New snapshots carry an additive currency-check marker. Older snapshots remain accessible and are not changed or deleted, but comparisons involving snapshots from before the currency-symbol check are paused because the original symbols cannot be reconstructed. Reimport the original reports and save new snapshots to compare them safely. Conversion definitions are also stored as an additive optional field: incompatible confirmed definitions block snapshot comparisons; when a definition is unknown, conversion counts, cost per conversion and platform conversion value are withheld. Older snapshots are not migrated or modified.

The experiment planner is editable and copyable. Waddle Report allows editing observations, plan and notes. **Print / Save as PDF** opens the browser print dialog; it does not create or upload a PDF itself. No report is sent or shared automatically. There is no background sync, cloud storage, AI service, or automated budget change. Users should review results and ensure conversion definitions match their goals.

## Run and deploy

No build is required to serve `public/`. With Node.js, run `npm run check` and `npm test`. `wrangler.jsonc` deploys `public/` as static assets to the connected `waddle-dash` Cloudflare Worker. The Worker has no server-side code or data bindings.
