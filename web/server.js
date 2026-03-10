import express from 'express'
import cors from 'cors'
import twilio from 'twilio'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

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

    // Column mappings (O=14, P=15, Q=16, R=17 in 0-indexed)
    const insuranceCol = 14  // Column O
    const emailCol = 15      // Column P
    const nameCol = 16       // Column Q
    const phoneCol = 17      // Column R

    let added = 0
    let skipped = 0

    // Process each row
    for (const row of rows) {
      const email = row[emailCol]?.trim()
      const name = row[nameCol]?.trim()
      const phone = row[phoneCol]?.trim()
      const insurance = row[insuranceCol]?.trim() || ''

      // Skip rows without email (required field)
      if (!email || !name) {
        skipped++
        continue
      }

      // Check if lead already exists (by email)
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email)
        .single()

      if (existing) {
        // Lead already exists, skip
        skipped++
        continue
      }

      // Insert new lead
      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          name: name,
          email: email,
          phone: phone || '',
          insurance: insurance,
          notes: 'Source: Google Sheets',
          stage: 'new'
        }])

      if (insertError) {
        console.error('Insert error:', insertError)
        skipped++
      } else {
        added++
      }
    }

    return res.status(200).json({
      added: added,
      skipped: skipped,
      message: `Successfully synced ${added} new leads, skipped ${skipped} duplicates or invalid rows`
    })

  } catch (error) {
    console.error('Sync error:', error)
    return res.status(500).json({ error: error.message || 'Failed to sync from Google Sheets' })
  }
})

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
