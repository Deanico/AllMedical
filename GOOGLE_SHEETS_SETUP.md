# Google Sheets Sync Setup Guide

This guide will help you set up automatic syncing from your Google Sheet to your admin dashboard.

## Overview

Once set up, you'll have a green "Sync from Google Sheets" button in your admin dashboard. Click it to import new leads - it automatically skips duplicates!

## Step 1: Get Your Google Sheet ID

1. Open your Google Sheet where Facebook leads are stored
2. Look at the URL in your browser:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```
3. Copy the `SHEET_ID_HERE` part (the long string between `/d/` and `/edit`)
4. Save it - you'll need it later

## Step 2: Create a Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Click the hamburger menu → **APIs & Services** → **Enabled APIs & Services**
4. Click **+ ENABLE APIS AND SERVICES**
5. Search for "Google Sheets API" and enable it
6. Go to **Credentials** (in the left sidebar)
7. Click **+ CREATE CREDENTIALS** → **Service Account**
8. Fill in:
   - **Service account name:** `allmedical-sheets-sync` (or any name)
   - **Service account ID:** Will auto-fill
9. Click **CREATE AND CONTINUE**
10. Skip the optional steps and click **DONE**

## Step 3: Create Service Account Key

1. In **Credentials**, click on the service account you just created
2. Go to the **KEYS** tab
3. Click **ADD KEY** → **Create new key**
4. Choose **JSON** format
5. Click **CREATE** - a JSON file will download
6. Open this file in a text editor

The file looks like this:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "allmedical-sheets-sync@project-name.iam.gserviceaccount.com",
  ...
}
```

7. Copy these values:
   - `client_email` (the long email address)
   - `private_key` (the entire key including BEGIN and END lines)

## Step 4: Share Your Google Sheet

1. Open your Google Sheet
2. Click the **Share** button (top right)
3. Paste the `client_email` from Step 3 (e.g., `allmedical-sheets-sync@project-name.iam.gserviceaccount.com`)
4. Set permission to **Viewer**
5. Uncheck "Notify people"
6. Click **Share**

## Step 5: Configure Your Spreadsheet Columns

Your Google Sheet should have these columns (in this order by default):

| Column A | Column B | Column C | Column D   | Column E |
|----------|----------|----------|------------|----------|
| Name     | Email    | Phone    | Insurance  | Notes    |

**Important:** Row 1 should have headers, data starts in Row 2.

If your columns are in a different order, that's fine - we'll configure the mapping in the next step.

## Step 6: Add Environment Variables

Add these to your `.env` file:

```env
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_sheet_id_from_step_1
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email_from_step_3
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"

# Optional: Customize sheet range and column mapping
GOOGLE_SHEET_RANGE=Sheet1!A2:E
SHEET_NAME_COLUMN=0
SHEET_EMAIL_COLUMN=1
SHEET_PHONE_COLUMN=2
SHEET_INSURANCE_COLUMN=3
SHEET_NOTES_COLUMN=4
```

### Important Notes:

- **GOOGLE_PRIVATE_KEY**: Must include the quotes and the `\n` characters exactly as shown in the JSON file
- **Column numbers start at 0**: A=0, B=1, C=2, D=3, E=4, etc.
- **GOOGLE_SHEET_RANGE**: Adjust if your data is on a different sheet or starts at a different row

### Column Mapping Examples:

If your sheet has columns in this order: **Email, Name, Phone, Insurance**

```env
SHEET_EMAIL_COLUMN=0
SHEET_NAME_COLUMN=1
SHEET_PHONE_COLUMN=2
SHEET_INSURANCE_COLUMN=3
```

## Step 7: Install Dependencies

Run this in your terminal:

```bash
cd web/api
npm install
cd ../..
```

## Step 8: Restart Your Dev Server

```bash
cd web
npm run dev
```

## Step 9: Test the Sync

1. Go to `http://localhost:5173/admin`
2. Log in
3. Click the green **"↻ Sync from Google Sheets"** button
4. You should see: "✓ Sync complete! Added X new leads. Skipped Y duplicates."

## How It Works

- **Duplicate Detection:** Checks by email address - if the email already exists, it skips that row
- **Required Fields:** Name and Email must have values, or the row is skipped
- **Source Tracking:** Imported leads have "(Source: Google Sheets)" added to their notes

## Troubleshooting

### "Google Sheets credentials not configured"
- Check that all three Google variables are in your `.env` file
- Make sure the private key includes the quotes and `\n` characters

### "Failed to sync from Google Sheets"
- Verify you shared the sheet with the service account email
- Check that the Google Sheets API is enabled in your Google Cloud project
- Confirm the Sheet ID is correct

### "Added 0 new leads"
- Check that your data starts in Row 2 (Row 1 should be headers)
- Verify the column mapping matches your spreadsheet
- Make sure Name and Email columns have data

### Rows are being skipped
- Each row must have at least a Name and Email
- Duplicate emails are automatically skipped (this is by design!)
- Check the browser console (F12) for detailed error messages

## Column Customization

If your Google Sheet has different columns or order, update these environment variables:

```env
# Example: Your sheet has columns: FirstName, LastName, Email, Mobile, Provider
GOOGLE_SHEET_RANGE=Sheet1!A2:F
SHEET_NAME_COLUMN=0        # Column A (you'll need to combine first+last in the sync code)
SHEET_EMAIL_COLUMN=2       # Column C
SHEET_PHONE_COLUMN=3       # Column D
SHEET_INSURANCE_COLUMN=4   # Column E
```

## Security Notes

- **Never commit your `.env` file to Git** - it contains sensitive credentials
- The `.gitignore` file should already exclude `.env`
- For production, use Azure environment variables or similar secure storage

## Need Help?

Common issues:
1. **Authentication errors:** Double-check the service account email is exactly as shown in the JSON file
2. **Parse errors:** Make sure the private key in `.env` has quotes around it
3. **No data found:** Verify the sheet name and range (e.g., "Sheet1!A2:E")

---

Once set up, syncing is as simple as clicking one button! The system handles duplicates automatically so you can click sync as many times as you want without worrying about duplicate entries.
