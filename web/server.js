import express from 'express'
import cors from 'cors'
import twilio from 'twilio'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import crypto from 'crypto'

dotenv.config()

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const cleanCell = (value) => String(value ?? '').trim()

const parseDateCell = (value) => {
  const raw = cleanCell(value)
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== Number(year) ||
      parsed.getUTCMonth() !== Number(month) - 1 ||
      parsed.getUTCDate() !== Number(day)
    ) {
      return null
    }
    return raw
  }

  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const [, month, day, year] = usMatch
    return `${year}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseAmountCell = (value) => {
  const normalized = cleanCell(value).replace(/[$,()\s]/g, '')
  if (!normalized) return 0

  const isNegativeParen = /^\(.*\)$/.test(cleanCell(value))
  const numberValue = Number(normalized)
  if (!Number.isFinite(numberValue)) return 0
  return isNegativeParen ? Math.abs(numberValue) : numberValue
}

const hashRow = (parts) => {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex')
}

const getGoogleSheetsClient = () => {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Sheets credentials not configured')
  }

  const auth = new google.auth.JWT(
    serviceAccountEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  )

  return google.sheets({ version: 'v4', auth })
}

app.post('/api/send-sms', async (req, res) => {
  try {
    const { name, email, phone, insurance, notes } = req.body

    // Twilio credentials from environment variables
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.VITE_TWILIO_PHONE_NUMBER
    const yourPhone = process.env.VITE_YOUR_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhone || !yourPhone) {
      console.error('Missing Twilio configuration')
      return res.status(500).json({ error: 'SMS service not configured' })
    }

    // Create SMS message
    const message = `New Contact Form Submission:
Name: ${name}
Email: ${email}
Phone: ${phone}
Insurance: ${insurance}
Notes: ${notes || 'None'}`

    // Send SMS using Twilio
    const client = twilio(accountSid, authToken)
    
    await client.messages.create({
      body: message,
      from: twilioPhone,
      to: yourPhone
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error sending SMS:', error)
    return res.status(500).json({ error: 'Failed to send SMS' })
  }
})

app.post('/api/sync-google-sheets', async (req, res) => {
  try {
    console.log('Google Sheets Sync triggered')

    // Get environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    const sheetId = process.env.GOOGLE_SHEET_ID
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials not configured' })
    }

    if (!sheetId || !serviceAccountEmail || !privateKey) {
      return res.status(500).json({ error: 'Google Sheets credentials not configured' })
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Initialize Google Sheets API
    const auth = new google.auth.JWT(
      serviceAccountEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    )

    const sheets = google.sheets({ version: 'v4', auth })

    // Read data from Google Sheet
    const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A2:R'
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    })

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return res.status(200).json({ added: 0, skipped: 0, message: 'No data found in spreadsheet' })
    }

    const rowLimit = Math.max(1, Number(process.env.GOOGLE_SHEET_ROW_LIMIT || 50))
    const recentRows = rows.slice(-rowLimit)

    // Column mappings (O=14, P=15, Q=16, R=17 in 0-indexed)
    const insuranceCol = 14  // Column O
    const emailCol = 15      // Column P
    const nameCol = 16       // Column Q
    const phoneCol = 17      // Column R

    const clean = (value) => String(value ?? '').trim()
    const candidates = []
    let skipped = 0

    for (const row of recentRows) {
      const email = clean(row[emailCol]).toLowerCase()
      const name = clean(row[nameCol])
      const phone = clean(row[phoneCol])
      const insurance = clean(row[insuranceCol])

      if (!email || !name) {
        skipped++
        continue
      }

      candidates.push({
        name,
        email,
        phone,
        insurance
      })
    }

    if (candidates.length === 0) {
      return res.status(200).json({
        added: 0,
        skipped,
        processed: recentRows.length,
        totalRows: rows.length,
        rowLimit,
        message: 'No valid rows found in selected range'
      })
    }

    const uniqueEmails = [...new Set(candidates.map(candidate => candidate.email))]
    const { data: existingLeads, error: existingError } = await supabase
      .from('leads')
      .select('email')
      .in('email', uniqueEmails)

    if (existingError) throw existingError

    const existingEmailSet = new Set((existingLeads || []).map(lead => String(lead.email || '').toLowerCase()))

    let added = 0
    for (const candidate of candidates) {
      if (existingEmailSet.has(candidate.email)) {
        skipped++
        continue
      }

      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          insurance: candidate.insurance,
          notes: 'Source: Google Sheets',
          stage: 'new'
        }])

      if (insertError) {
        console.error('Insert error:', insertError)
        skipped++
        continue
      }

      existingEmailSet.add(candidate.email)
      added++
    }

    return res.status(200).json({
      added: added,
      skipped: skipped,
      processed: recentRows.length,
      totalRows: rows.length,
      rowLimit,
      message: `Successfully synced ${added} new leads from the latest ${recentRows.length} rows, skipped ${skipped}`
    })

  } catch (error) {
    console.error('Sync error:', error)
    return res.status(500).json({ error: error.message || 'Failed to sync from Google Sheets' })
  }
})

app.post('/api/sync-financial-sheets', async (req, res) => {
  let supabase = null
  const syncSummary = {
    claimsRowsRead: 0,
    claimsRowsUpserted: 0,
    claimsRowsSkipped: 0,
    opsRowsRead: 0,
    opsRowsUpserted: 0,
    opsRowsSkipped: 0
  }

  try {
    console.log('Financial sheets sync triggered')

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials not configured' })
    }

    const claimsSheetId = process.env.GOOGLE_CLAIMS_SHEET_ID
    const claimsRange = process.env.GOOGLE_CLAIMS_SHEET_RANGE || 'Paid Claims!A2:F'
    const opsSheetId = process.env.GOOGLE_OPS_SHEET_ID
    const opsRange = process.env.GOOGLE_OPS_SHEET_RANGE || 'Expenses & Shipments!A2:G'

    if (!claimsSheetId || !opsSheetId) {
      return res.status(500).json({
        error: 'Financial sheet IDs not configured. Set GOOGLE_CLAIMS_SHEET_ID and GOOGLE_OPS_SHEET_ID.'
      })
    }

    supabase = createClient(supabaseUrl, supabaseKey)
    const sheets = getGoogleSheetsClient()

    const [claimsResponse, opsResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: claimsSheetId, range: claimsRange }),
      sheets.spreadsheets.values.get({ spreadsheetId: opsSheetId, range: opsRange })
    ])

    const claimsRows = claimsResponse.data.values || []
    const opsRows = opsResponse.data.values || []

    syncSummary.claimsRowsRead = claimsRows.length
    syncSummary.opsRowsRead = opsRows.length

    const claimsDateCol = Number(process.env.CLAIMS_DATE_COLUMN || 0)
    const claimsPatientCol = Number(process.env.CLAIMS_PATIENT_COLUMN || 1)
    const claimsPayerCol = Number(process.env.CLAIMS_PAYER_COLUMN || 2)
    const claimsAmountCol = Number(process.env.CLAIMS_AMOUNT_COLUMN || 3)
    const claimsIdCol = Number(process.env.CLAIMS_ID_COLUMN || 4)
    const claimsNotesCol = Number(process.env.CLAIMS_NOTES_COLUMN || 5)

    const opsDateCol = Number(process.env.OPS_DATE_COLUMN || 0)
    const opsTypeCol = Number(process.env.OPS_TYPE_COLUMN || 1)
    const opsCategoryCol = Number(process.env.OPS_CATEGORY_COLUMN || 2)
    const opsDescriptionCol = Number(process.env.OPS_DESCRIPTION_COLUMN || 3)
    const opsVendorCol = Number(process.env.OPS_VENDOR_COLUMN || 4)
    const opsAmountCol = Number(process.env.OPS_AMOUNT_COLUMN || 5)
    const opsNotesCol = Number(process.env.OPS_NOTES_COLUMN || 6)
    const opsFallbackDescriptionCols = String(process.env.OPS_FALLBACK_DESCRIPTION_COLUMNS || '1,4')
      .split(',')
      .map(value => Number(value.trim()))
      .filter(Number.isFinite)

    const claimsRawRows = []
    const claimsLedgerRows = []

    claimsRows.forEach((row, index) => {
      const paidDate = parseDateCell(row[claimsDateCol])
      const patientName = cleanCell(row[claimsPatientCol])
      const payer = cleanCell(row[claimsPayerCol])
      const amountPaid = parseAmountCell(row[claimsAmountCol])
      const claimId = cleanCell(row[claimsIdCol])
      const notes = cleanCell(row[claimsNotesCol])

      if (!patientName || amountPaid <= 0) {
        syncSummary.claimsRowsSkipped += 1
        return
      }

      const rowHash = hashRow([
        claimsSheetId,
        paidDate || '',
        patientName,
        payer,
        String(amountPaid),
        claimId,
        notes
      ])

      claimsRawRows.push({
        source_sheet_id: claimsSheetId,
        source_row_number: index + 2,
        source_sheet_name: claimsRange.split('!')[0] || 'Paid Claims',
        source_row_hash: rowHash,
        claim_id: claimId || null,
        patient_name: patientName,
        payer: payer || null,
        paid_date: paidDate,
        amount_paid: amountPaid,
        notes: notes || null,
        raw_data: row,
        synced_at: new Date().toISOString()
      })

      claimsLedgerRows.push({
        source_kind: 'paid_claim',
        source_row_hash: `claim:${rowHash}`,
        txn_date: paidDate,
        category: 'Paid Claim',
        description: claimId ? `Claim ${claimId}` : `Paid claim for ${patientName}`,
        vendor_or_payer: payer || null,
        amount: amountPaid,
        signed_amount: amountPaid,
        metadata: {
          claim_id: claimId || null,
          patient_name: patientName,
          notes: notes || null
        },
        synced_at: new Date().toISOString()
      })
    })

    const opsRawRows = []
    const opsLedgerRows = []

    opsRows.forEach((row, index) => {
      const entryDate = parseDateCell(row[opsDateCol])
      const entryTypeRaw = cleanCell(row[opsTypeCol]).toLowerCase()
      const category = cleanCell(row[opsCategoryCol])
      const primaryDescription = cleanCell(row[opsDescriptionCol])
      const fallbackDescription = opsFallbackDescriptionCols
        .map(colIndex => cleanCell(row[colIndex]))
        .find(Boolean) || ''
      const description = primaryDescription || fallbackDescription
      const vendor = cleanCell(row[opsVendorCol])
      const amount = parseAmountCell(row[opsAmountCol])
      const notes = cleanCell(row[opsNotesCol])

      const entryType = entryTypeRaw.includes('ship') ? 'shipment' : 'expense'

      if (amount <= 0) {
        syncSummary.opsRowsSkipped += 1
        return
      }

      const rowHash = hashRow([
        opsSheetId,
        entryDate || '',
        entryType,
        category,
        description,
        vendor,
        String(amount),
        notes
      ])

      opsRawRows.push({
        source_sheet_id: opsSheetId,
        source_row_number: index + 2,
        source_sheet_name: opsRange.split('!')[0] || 'Expenses & Shipments',
        source_row_hash: rowHash,
        entry_type: entryType,
        category: category || null,
        description,
        vendor: vendor || null,
        entry_date: entryDate,
        amount,
        notes: notes || null,
        raw_data: row,
        synced_at: new Date().toISOString()
      })

      opsLedgerRows.push({
        source_kind: entryType,
        source_row_hash: `ops:${rowHash}`,
        txn_date: entryDate,
        category: category || (entryType === 'shipment' ? 'Shipment' : 'Expense'),
        description,
        vendor_or_payer: vendor || null,
        amount,
        signed_amount: -Math.abs(amount),
        metadata: {
          entry_type: entryType,
          notes: notes || null
        },
        synced_at: new Date().toISOString()
      })
    })

    for (const row of claimsRawRows) {
      const { error } = await supabase
        .from('sheet_paid_claims_raw')
        .upsert([row], { onConflict: 'source_row_hash' })

      if (error) {
        syncSummary.claimsRowsSkipped += 1
        console.warn('Skipping claim row due to insert error:', error.message)
      } else {
        syncSummary.claimsRowsUpserted += 1
      }
    }

    for (const row of opsRawRows) {
      const { error } = await supabase
        .from('sheet_ops_raw')
        .upsert([row], { onConflict: 'source_row_hash' })

      if (error) {
        syncSummary.opsRowsSkipped += 1
        console.warn('Skipping ops row due to insert error:', error.message)
      } else {
        syncSummary.opsRowsUpserted += 1
      }
    }

    const ledgerRows = [...claimsLedgerRows, ...opsLedgerRows]
    for (const row of ledgerRows) {
      const { error } = await supabase
        .from('financial_ledger')
        .upsert([row], { onConflict: 'source_row_hash' })

      if (error) {
        console.warn('Skipping ledger row due to insert error:', error.message)
      }
    }

    const { error: jobInsertError } = await supabase
      .from('sheet_sync_jobs')
      .insert([{
        sync_type: 'financial_sheets',
        status: 'success',
        claims_rows_read: syncSummary.claimsRowsRead,
        claims_rows_upserted: syncSummary.claimsRowsUpserted,
        claims_rows_skipped: syncSummary.claimsRowsSkipped,
        ops_rows_read: syncSummary.opsRowsRead,
        ops_rows_upserted: syncSummary.opsRowsUpserted,
        ops_rows_skipped: syncSummary.opsRowsSkipped
      }])

    if (jobInsertError) {
      console.warn('Failed to log sync job:', jobInsertError.message)
    }

    return res.status(200).json({
      success: true,
      ...syncSummary,
      message: `Financial sync complete. Claims upserted: ${syncSummary.claimsRowsUpserted}, Ops upserted: ${syncSummary.opsRowsUpserted}.`
    })
  } catch (error) {
    console.error('Financial sync error:', error)

    if (supabase) {
      const { error: jobInsertError } = await supabase
        .from('sheet_sync_jobs')
        .insert([{
          sync_type: 'financial_sheets',
          status: 'failed',
          claims_rows_read: syncSummary.claimsRowsRead,
          claims_rows_upserted: syncSummary.claimsRowsUpserted,
          claims_rows_skipped: syncSummary.claimsRowsSkipped,
          ops_rows_read: syncSummary.opsRowsRead,
          ops_rows_upserted: syncSummary.opsRowsUpserted,
          ops_rows_skipped: syncSummary.opsRowsSkipped,
          error_message: error.message || 'Unknown error'
        }])

      if (jobInsertError) {
        console.warn('Failed to log failed sync job:', jobInsertError.message)
      }
    }

    return res.status(500).json({ error: error.message || 'Failed to sync financial sheets' })
  }
})

// NPPES Registry search endpoint (proxy to avoid CORS)
app.get('/api/nppes-search', async (req, res) => {
  try {
    const searchQuery = req.query.q

    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    console.log('NPPES search for:', searchQuery)

    // Determine if search is by NPI (numbers only) or by name
    const isNPI = /^\d+$/.test(searchQuery.trim())
    
    let searchParam
    if (isNPI) {
      searchParam = `number=${encodeURIComponent(searchQuery)}`
    } else {
      // Try to split name into first and last
      const nameParts = searchQuery.trim().split(/\s+/)
      if (nameParts.length === 1) {
        // Single word - search by first name only
        searchParam = `first_name=${encodeURIComponent(nameParts[0])}`
      } else {
        // Multiple words - use first word as first name, rest as last name
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ')
        searchParam = `first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}`
      }
    }

    // Build NPPES API URL
    const nppesUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&${searchParam}&limit=10`

    console.log('NPPES URL:', nppesUrl)

    // Make request to NPPES API
    https.get(nppesUrl, (nppesRes) => {
      let data = ''

      nppesRes.on('data', (chunk) => {
        data += chunk
      })

      nppesRes.on('end', () => {
        if (nppesRes.statusCode === 200) {
          try {
            const parsedData = JSON.parse(data)
            res.status(200).json(parsedData)
          } catch (e) {
            console.error('Failed to parse NPPES response:', e)
            res.status(500).json({ error: 'Failed to parse NPPES response' })
          }
        } else {
          console.error('NPPES API returned status:', nppesRes.statusCode)
          res.status(nppesRes.statusCode).json({ error: 'NPPES API error' })
        }
      })
    }).on('error', (error) => {
      console.error('NPPES request error:', error)
      res.status(500).json({ error: 'Failed to connect to NPPES' })
    })

  } catch (error) {
    console.error('NPPES search error:', error)
    return res.status(500).json({ error: error.message || 'Failed to search NPPES' })
  }
})

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)

  const syncIntervalMinutes = Number(process.env.FINANCIAL_SYNC_INTERVAL_MINUTES || 0)
  const shouldRunOnStart = String(process.env.FINANCIAL_SYNC_RUN_ON_START || 'false').toLowerCase() === 'true'

  const triggerScheduledFinancialSync = async () => {
    try {
      const response = await fetch(`http://localhost:${PORT}/api/sync-financial-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        console.error('Scheduled financial sync failed:', payload?.error || response.statusText)
        return
      }

      console.log('Scheduled financial sync complete:', payload?.message || 'OK')
    } catch (error) {
      console.error('Scheduled financial sync error:', error.message)
    }
  }

  if (shouldRunOnStart) {
    triggerScheduledFinancialSync()
  }

  if (Number.isFinite(syncIntervalMinutes) && syncIntervalMinutes > 0) {
    console.log(`Financial auto-sync enabled: every ${syncIntervalMinutes} minute(s)`)
    setInterval(triggerScheduledFinancialSync, syncIntervalMinutes * 60 * 1000)
  }
})
