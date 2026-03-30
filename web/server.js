import express from 'express'
import cors from 'cors'
import twilio from 'twilio'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import https from 'https'

dotenv.config()

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

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
})
