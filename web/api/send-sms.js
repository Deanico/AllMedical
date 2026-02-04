export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
    const twilio = require('twilio')(accountSid, authToken)
    
    await twilio.messages.create({
      body: message,
      from: twilioPhone,
      to: yourPhone
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error sending SMS:', error)
    return res.status(500).json({ error: 'Failed to send SMS' })
  }
}
