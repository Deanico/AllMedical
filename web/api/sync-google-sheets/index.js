const { google } = require('googleapis');
const patientMessaging = require('../shared/patient-messaging.cjs');
const { getLeadHandling, getLeadSheetSources } = require('../shared/lead-sheet-sources.cjs');

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
    const authorization = await patientMessaging.authorizeAdmin(req);
    if (authorization.error) {
      context.res = {
        status: authorization.error.status,
        body: { error: authorization.error.message }
      };
      return;
    }
    const supabase = authorization.supabase;

    // Get environment variables
    const sources = getLeadSheetSources();
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!sources.length || !serviceAccountEmail || !privateKey) {
      context.res = {
        status: 500,
        body: { error: 'Google Sheets credentials not configured' }
      };
      return;
    }

    // Initialize Google Sheets API
    const auth = new google.auth.JWT(
      serviceAccountEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    const rowLimit = Math.max(1, Number(process.env.GOOGLE_SHEET_ROW_LIMIT || 1000));
    const recentRows = [];
    const sourceErrors = [];
    let totalRows = 0;

    // Read the latest rows from every configured sheet/tab; one failing tab doesn't block the rest
    for (const source of sources) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: source.sheetId,
          range: source.range,
        });
        const sourceRows = response.data.values || [];
        totalRows += sourceRows.length;
        sourceRows.slice(-rowLimit).forEach((row) => recentRows.push({ row, label: source.label, handling: source.handling }));
      } catch (sourceError) {
        context.log.error(`Sync failed for ${source.range}:`, sourceError.message);
        sourceErrors.push(`${source.range}: ${sourceError.message}`);
      }
    }

    if (recentRows.length === 0) {
      if (sourceErrors.length === sources.length) {
        context.res = { status: 500, body: { error: `Could not read any sheet. ${sourceErrors.join('; ')}` } };
      } else {
        context.res = {
          status: 200,
          body: { added: 0, skipped: 0, message: 'No data found in spreadsheet', errors: sourceErrors }
        };
      }
      return;
    }

    // Get column mappings from environment (default: A=name, B=email, C=phone, D=insurance, E=notes)
    const nameCol = parseInt(process.env.SHEET_NAME_COLUMN || '0');
    const emailCol = parseInt(process.env.SHEET_EMAIL_COLUMN || '1');
    const phoneCol = parseInt(process.env.SHEET_PHONE_COLUMN || '2');
    const insuranceCol = parseInt(process.env.SHEET_INSURANCE_COLUMN || '3');
    const notesCol = parseInt(process.env.SHEET_NOTES_COLUMN || '4');
    const adNameCol = parseInt(process.env.SHEET_AD_NAME_COLUMN || '3');

    const clean = (value) => String(value ?? '').trim();
    const candidates = [];
    let skipped = 0;

    for (const { row, label, handling: sourceHandling } of recentRows) {
      const email = clean(row[emailCol]).toLowerCase();
      const name = clean(row[nameCol]);
      const phone = clean(row[phoneCol]);
      const insurance = clean(row[insuranceCol]);
      const notes = clean(row[notesCol]);
      const handling = getLeadHandling(row, sourceHandling, adNameCol);

      if (!email || !name) {
        skipped++;
        continue;
      }

      candidates.push({
        name,
        email,
        phone,
        insurance,
        notes,
        label,
        handling
      });
    }

    if (candidates.length === 0) {
      context.res = {
        status: 200,
        body: {
          added: 0,
          skipped,
          processed: recentRows.length,
          totalRows,
          rowLimit,
          errors: sourceErrors,
          message: 'No valid rows found in selected range'
        }
      };
      return;
    }

    const uniqueEmails = [...new Set(candidates.map((candidate) => candidate.email))];
    const { data: existingLeads, error: existingError } = await supabase
      .from('leads')
      .select('email')
      .in('email', uniqueEmails);

    if (existingError) {
      throw existingError;
    }

    const existingEmailSet = new Set((existingLeads || []).map((lead) => String(lead.email || '').toLowerCase()));

    // Re-tag leads that already exist but appear in an AI sheet
    const aiEmails = [...new Set(candidates.filter((c) => c.handling === 'ai' && existingEmailSet.has(c.email)).map((c) => c.email))];
    if (aiEmails.length) {
      const { error: retagError } = await supabase.from('leads').update({ handling: 'ai' }).in('email', aiEmails);
      if (retagError) throw retagError;
    }

    let added = 0;
    for (const candidate of candidates) {
      if (existingEmailSet.has(candidate.email)) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          insurance: candidate.insurance,
          notes: candidate.notes ? `${candidate.notes} (Source: Google Sheets - ${candidate.label})` : `Source: Google Sheets (${candidate.label})`,
          handling: candidate.handling,
          stage: 'new'
        }]);

      if (insertError) {
        context.log.error('Insert error:', insertError);
        skipped++;
        continue;
      }

      existingEmailSet.add(candidate.email);
      added++;
    }

    context.res = {
      status: 200,
      body: {
        added: added,
        skipped: skipped,
        processed: recentRows.length,
        totalRows,
        rowLimit,
        errors: sourceErrors,
        message: `Successfully synced ${added} new leads from ${sources.length} sheet range(s) (${recentRows.length} rows checked), skipped ${skipped}${sourceErrors.length ? `. Could not read: ${sourceErrors.join('; ')}` : ''}`
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
