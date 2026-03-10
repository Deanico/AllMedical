const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function (context, req) {
  context.log('Google Sheets Sync function triggered');

  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      body: { error: 'Method not allowed' }
    };
    return;
  }

  try {
    // Get environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!supabaseUrl || !supabaseKey) {
      context.res = {
        status: 500,
        body: { error: 'Supabase credentials not configured' }
      };
      return;
    }

    if (!sheetId || !serviceAccountEmail || !privateKey) {
      context.res = {
        status: 500,
        body: { error: 'Google Sheets credentials not configured' }
      };
      return;
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Google Sheets API
    const auth = new google.auth.JWT(
      serviceAccountEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    // Read data from Google Sheet
    // Adjust the range based on your sheet structure
    const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A2:E'; // Starting from row 2 (assuming row 1 is headers)
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      context.res = {
        status: 200,
        body: { added: 0, skipped: 0, message: 'No data found in spreadsheet' }
      };
      return;
    }

    // Get column mappings from environment (default: A=name, B=email, C=phone, D=insurance, E=notes)
    const nameCol = parseInt(process.env.SHEET_NAME_COLUMN || '0');
    const emailCol = parseInt(process.env.SHEET_EMAIL_COLUMN || '1');
    const phoneCol = parseInt(process.env.SHEET_PHONE_COLUMN || '2');
    const insuranceCol = parseInt(process.env.SHEET_INSURANCE_COLUMN || '3');
    const notesCol = parseInt(process.env.SHEET_NOTES_COLUMN || '4');

    let added = 0;
    let skipped = 0;

    // Process each row
    for (const row of rows) {
      const email = row[emailCol]?.trim();
      const name = row[nameCol]?.trim();
      const phone = row[phoneCol]?.trim();
      const insurance = row[insuranceCol]?.trim() || '';
      const notes = row[notesCol]?.trim() || '';

      // Skip rows without email (required field)
      if (!email || !name) {
        skipped++;
        continue;
      }

      // Check if lead already exists (by email)
      const { data: existing, error: checkError } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        // Lead already exists, skip
        skipped++;
        continue;
      }

      // Insert new lead
      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          name: name,
          email: email,
          phone: phone || '',
          insurance: insurance,
          notes: notes ? `${notes} (Source: Google Sheets)` : 'Source: Google Sheets',
          stage: 'new'
        }]);

      if (insertError) {
        context.log.error('Insert error:', insertError);
        skipped++;
      } else {
        added++;
      }
    }

    context.res = {
      status: 200,
      body: {
        added: added,
        skipped: skipped,
        message: `Successfully synced ${added} new leads, skipped ${skipped} duplicates or invalid rows`
      }
    };

  } catch (error) {
    context.log.error('Sync error:', error);
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to sync from Google Sheets' }
    };
  }
};
