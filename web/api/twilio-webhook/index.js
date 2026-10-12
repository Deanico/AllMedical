const patientMessaging = require('../shared/patient-messaging.cjs')

module.exports = async function (context, req) {
  try {
    const result = await patientMessaging.handleTwilioWebhook(req)
    context.res = {
      status: result.status,
      headers: { 'Content-Type': result.contentType || 'text/plain' },
      body: result.body
    }
  } catch (error) {
    context.log.error('Twilio webhook failed:', error)
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Unable to process Twilio webhook.'
    }
  }
}
