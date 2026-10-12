const patientMessaging = require('../shared/patient-messaging.cjs')

module.exports = async function (context, req) {
  try {
    const result = req.method === 'GET'
      ? await patientMessaging.getPatientMessages(req, req.params.patientId)
      : await patientMessaging.sendPatientMessage(req, req.params.patientId)

    context.res = {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
      body: result.body
    }
  } catch (error) {
    context.log.error('Patient messaging request failed:', error)
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Unable to process patient messages.' }
    }
  }
}
