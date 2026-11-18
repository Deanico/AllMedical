# Financial Reports Setup (Paid Claims + Expenses/Shipments + P&L)

This setup creates a clean Reports pipeline from 2 Google Sheets:
- Paid claims sheet
- Expenses and shipments sheet

The app syncs both sheets into Supabase tables and computes Profit & Loss automatically.

## 1) Run the new SQL migration in Supabase

In Supabase SQL Editor, run:
- `web/add-financial-sheets-reporting.sql`

This creates:
- `sheet_paid_claims_raw`
- `sheet_ops_raw`
- `financial_ledger`
- `sheet_sync_jobs`
- reporting views:
  - `v_reports_claims`
  - `v_reports_expenses_shipments`
  - `v_profit_loss_totals`
  - `v_profit_loss_monthly`

## 2) Add env variables in `web/.env`

Use `web/.env.example` as reference. Add at least:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GOOGLE_CLAIMS_SHEET_ID=...
GOOGLE_CLAIMS_SHEET_RANGE=Paid Claims!A2:F

GOOGLE_OPS_SHEET_ID=...
GOOGLE_OPS_SHEET_RANGE=Expenses & Shipments!A2:G

# Column mapping (0-based indexes)
CLAIMS_DATE_COLUMN=0
CLAIMS_PATIENT_COLUMN=1
CLAIMS_PAYER_COLUMN=2
CLAIMS_AMOUNT_COLUMN=3
CLAIMS_ID_COLUMN=4
CLAIMS_NOTES_COLUMN=5

OPS_DATE_COLUMN=0
OPS_TYPE_COLUMN=1
OPS_CATEGORY_COLUMN=2
OPS_DESCRIPTION_COLUMN=3
OPS_VENDOR_COLUMN=4
OPS_AMOUNT_COLUMN=5
OPS_NOTES_COLUMN=6
```

Your workspace now includes a prefilled template with your three sheet IDs:
- `web/FINANCIAL_ENV_READY.txt`

Use that file as the source of truth for copy/paste values.

Optional auto-sync timer (if backend stays running):

```env
FINANCIAL_SYNC_INTERVAL_MINUTES=15
FINANCIAL_SYNC_RUN_ON_START=true
```

## 3) Share both Google Sheets with service account

Share each sheet with:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`

Permission:
- Viewer

## 4) Start web app + backend

From `web/`:

```bash
npm run server
npm run dev
```

## 4.1) Important for your current workbook layout

- Claims workbook is configured for `Patient Ledger!A:R`.
- Expenses workbook tab name must be set manually in `GOOGLE_OPS_SHEET_RANGE`.
- P&L workbook is optional and currently not read by the sync endpoint.

## 5) Trigger first sync

In Admin -> Reports:
- click `Sync Financial Sheets`

Expected result:
- Paid Claims table populated
- Expenses & Shipments table populated
- P&L totals and monthly section populated

## 6) Validate your numbers

Cross-check:
- `sum(Paid Claims.amount_paid)` equals Revenue card
- `sum(Expenses where entry_type='expense')` equals Expenses card
- `sum(Expenses where entry_type='shipment')` equals Shipment Cost card
- `Net Profit = Revenue - Expenses - Shipment Cost`

## Website financial reports

Run `web/add-patient-financial-reporting.sql` in the Supabase SQL Editor before
deploying this version. It adds patient expense classification and optional claim
payment dates; existing expenses remain general expenses and existing claims
keep an unknown payment date. Expense records are restricted to administrators.

Reports -> General uses paid claim records from patient profiles and subtracts
both patient and general expenses entered on the website. Claim and EOB records
may describe the same payment, so EOBs are excluded. Verify duplicate claims
and enter all costs before treating recorded net as complete profit. The
Google Sheets section is retained as a separate historical reference and is
not added to website totals.

Regular and extra patient expenses are individual entries, not recurring
charges. Patient expenses can be added in each patient's Financial tab; general
expenses remain in Reports. Projections and By Insurance are calculator
estimates and are separate from recorded financials.

The dashboard's Average Monthly Revenue divides all recorded paid claim revenue
by the number of calendar months from the earliest paid claim's service date
through the current month, including months with no claims. Undated and
future-dated paid amounts remain in the total; the card identifies them because
the average may be misleading. If no paid claim has a service date up to the
current month, the average is unavailable. This is not monthly cash received.
The historical Google monthly P&L still assigns undated rows to their sync month.

## Client growth on the dashboard

Run `web/add-client-growth-history.sql` in the Supabase SQL Editor. The dashboard
shows the last six calendar months of net client changes: qualifying a lead adds
one, while changing a qualified lead to another stage or deleting it subtracts
one. Pausing a client does not change qualification. Months follow the viewer's
local time.
Select a month to see the recorded qualifications; the bar shows the net after
removals, so it may differ from the number of new patients listed. Deleted or
otherwise unavailable patient records cannot be named.

The migration backfills currently qualified leads only when `qualified_at` is
known. Past removals, earlier qualification cycles, deleted leads, and missing
qualification dates cannot be recovered from existing records, so older months
may be incomplete. Future changes are recorded automatically.

## Column assumptions used by current sync code

Paid Claims rows require:
- patient name
- amount > 0

Expenses/Shipments rows require:
- description
- amount > 0

Type parsing:
- if type cell contains `ship`, row becomes shipment cost
- otherwise it becomes expense

## Troubleshooting

If Reports is empty:
1. Check SQL migration was run successfully.
2. Check both sheet IDs and ranges.
3. Check service account email has access to both sheets.
4. Check backend logs for `/api/sync-financial-sheets` errors.

If columns are shifted:
1. Keep range broad enough to include your columns.
2. Update the `*_COLUMN` indexes.
3. Sync again.

## Notes

- Sync is idempotent using row hashes, so re-running sync updates existing rows and avoids duplicates.
- Existing expense-management UI is still present; new synced financial sections are now added above it in Reports.

## Azure Finalization

1. Open your Azure Web App that hosts the backend.
2. Go to `Settings` -> `Environment variables` (or `Configuration` -> `Application settings`, depending on portal layout).
3. Add the same keys from `web/FINANCIAL_ENV_READY.txt`:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PRIVATE_KEY`
  - `GOOGLE_CLAIMS_SHEET_ID`
  - `GOOGLE_CLAIMS_SHEET_RANGE`
  - `CLAIMS_*` keys
  - `GOOGLE_OPS_SHEET_ID`
  - `GOOGLE_OPS_SHEET_RANGE`
  - `OPS_*` keys
  - optional sync timer keys
4. Save changes and restart the app service.
5. Open Admin -> Reports and click `Sync Financial Sheets` once to verify production config.

Security notes:
- Keep sheets private.
- Share only to service account email as Viewer.
- Do not enable "Anyone with the link".
