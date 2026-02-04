const twilio = require('twilio');

module.exports = async function (context, req) {
  context.log('SMS API function triggered');

  // Only allow POST requests
  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      body: { error: 'Method not allowed' }
    };
    return;
  }

  try {
    const { name, email, phone, insurance, notes } = req.body;

    // Twilio credentials from environment variables
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.VITE_TWILIO_PHONE_NUMBER;
    const yourPhone = process.env.VITE_YOUR_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone || !yourPhone) {
      context.log.error('Missing Twilio configuration');
      context.res = {
        status: 500,
        body: { error: 'SMS service not configured' }
      };
      return;
    }

    // Create SMS message
    const message = `New Contact Form Submission:
Name: ${name}
Email: ${email}
Phone: ${phone}
Insurance: ${insurance}
Notes: ${notes || 'None'}`;

    // Send SMS using Twilio
    const client = twilio(accountSid, authToken);
    
    await client.messages.create({
      body: message,
      from: twilioPhone,
      to: yourPhone
    });

    context.res = {
      status: 200,
      body: { success: true }
    };
  } catch (error) {
    context.log.error('Error sending SMS:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to send SMS' }
    };
  }
};
