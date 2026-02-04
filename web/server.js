import express from 'express'
import cors from 'cors'
import twilio from 'twilio'
import dotenv from 'dotenv'

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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
