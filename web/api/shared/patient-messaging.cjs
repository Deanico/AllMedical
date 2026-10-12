const { createClient } = require('@supabase/supabase-js')
const twilio = require('twilio')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const getRequiredEnv = (...names) => {
  const value = names.map((name) => process.env[name]).find(Boolean)
  if (!value) throw new Error(`Missing server configuration: ${names[0]}`)
  return value
}

const getServiceClient = () => createClient(
  getRequiredEnv('VITE_SUPABASE_URL'),
  getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const getTwilioConfig = () => ({
  accountSid: getRequiredEnv('TWILIO_ACCOUNT_SID', 'VITE_TWILIO_ACCOUNT_SID'),
  authToken: getRequiredEnv('TWILIO_AUTH_TOKEN', 'VITE_TWILIO_AUTH_TOKEN'),
  phoneNumber: getRequiredEnv('TWILIO_PHONE_NUMBER', 'VITE_TWILIO_PHONE_NUMBER')
})

const getWebhookUrl = () => {
  const baseUrl = getRequiredEnv('TWILIO_WEBHOOK_BASE_URL').replace(/\/+$/, '')
  return `${baseUrl}/api/twilio-webhook`
}

const getRequestHeader = (req, name) => {
  if (typeof req.get === 'function') return req.get(name)
  const headers = req.headers || {}
  return headers[name.toLowerCase()] || headers[name]
}

const authorizeAdmin = async (req) => {
  const authorization = getRequestHeader(req, 'authorization') || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    return { error: { status: 401, message: 'Sign in as an administrator to access messages.' } }
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user || data.user.app_metadata?.role !== 'admin') {
    return { error: { status: 403, message: 'Administrator access is required.' } }
  }

  return { supabase, user: data.user }
}

const validatePatientId = (patientId) => UUID_PATTERN.test(String(patientId || ''))

const getPatientMessages = async (req, patientId) => {
  if (!validatePatientId(patientId)) {
    return { status: 400, body: { error: 'A valid patient ID is required.' } }
  }

  const authorization = await authorizeAdmin(req)
  if (authorization.error) {
    return { status: authorization.error.status, body: { error: authorization.error.message } }
  }

  const { data, error } = await authorization.supabase
    .from('patient_sms_messages')
    .select('id, patient_id, direction, from_phone, to_phone, body, status, sent_at, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return { status: 200, body: { messages: data || [] } }
}

const normalizePhoneNumber = (value) => {
  const input = String(value || '').trim()
  const digits = input.replace(/\D/g, '')
  if (!digits) return null
  if (input.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

const sendPatientMessage = async (req, patientId) => {
  if (!validatePatientId(patientId)) {
    return { status: 400, body: { error: 'A valid patient ID is required.' } }
  }

  const authorization = await authorizeAdmin(req)
  if (authorization.error) {
    return { status: authorization.error.status, body: { error: authorization.error.message } }
  }

  const body = String(req.body?.body || '').trim()
  if (!body || body.length > 1600) {
    return { status: 400, body: { error: 'Enter a message between 1 and 1,600 characters.' } }
  }

  const { supabase, user } = authorization
  const { data: patient, error: patientError } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('id', patientId)
    .maybeSingle()

  if (patientError) throw patientError
  if (!patient) return { status: 404, body: { error: 'Patient not found.' } }

  const recipient = normalizePhoneNumber(patient.phone)
  if (!recipient) {
    return { status: 400, body: { error: 'This patient needs a valid phone number in international format before SMS can be sent.' } }
  }

  const { accountSid, authToken, phoneNumber } = getTwilioConfig()
  const { data: savedMessage, error: insertError } = await supabase
    .from('patient_sms_messages')
    .insert({
      patient_id: patientId,
      direction: 'outbound',
      from_phone: phoneNumber,
      to_phone: recipient,
      body,
      status: 'queued',
      sent_by: user.id
    })
    .select('id')
    .single()

  if (insertError) throw insertError

  let sentMessage
  try {
    const client = twilio(accountSid, authToken)
    sentMessage = await client.messages.create({
      body,
      from: phoneNumber,
      to: recipient,
      statusCallback: getWebhookUrl()
    })
  } catch (error) {
    const { error: updateError } = await supabase
      .from('patient_sms_messages')
      .update({ status: 'failed' })
      .eq('id', savedMessage.id)
    if (updateError) console.error('Unable to record failed SMS status:', updateError)
    throw error
  }

  const { data: message, error: updateError } = await supabase
    .from('patient_sms_messages')
    .update({
      twilio_sid: sentMessage.sid,
      status: sentMessage.status || 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', savedMessage.id)
    .select('id, patient_id, direction, from_phone, to_phone, body, status, sent_at, created_at')
    .single()

  if (updateError) throw updateError
  return { status: 201, body: { message } }
}

const validateTwilioWebhook = (req) => {
  const { authToken } = getTwilioConfig()
  const signature = getRequestHeader(req, 'x-twilio-signature')
  if (!signature || !twilio.validateRequest(authToken, signature, getWebhookUrl(), req.body || {})) {
    return false
  }
  return true
}

const handleTwilioWebhook = async (req) => {
  if (!validateTwilioWebhook(req)) {
    return { status: 403, body: 'Invalid Twilio signature.' }
  }

  const supabase = getServiceClient()
  const { MessageSid: sid, MessageStatus: messageStatus } = req.body || {}

  if (messageStatus && sid) {
    const { error } = await supabase
      .from('patient_sms_messages')
      .update({ status: messageStatus })
      .eq('twilio_sid', sid)
    if (error) throw error
    return { status: 200, body: '' }
  }

  const { From: fromPhone, To: toPhone, Body: body } = req.body || {}
  if (!sid || !fromPhone || !toPhone || typeof body !== 'string') {
    return { status: 400, body: 'Invalid inbound message.' }
  }

  const { data: matches, error: matchError } = await supabase
    .rpc('find_sms_patient_by_phone', { phone_number: fromPhone })
  if (matchError) throw matchError

  const patients = matches || []
  const patientId = patients.length === 1 ? patients[0].patient_id : null
  const { error: insertError } = await supabase
    .from('patient_sms_messages')
    .upsert({
      patient_id: patientId,
      twilio_sid: sid,
      direction: 'inbound',
      from_phone: fromPhone,
      to_phone: toPhone,
      body,
      status: 'received',
      sent_at: new Date().toISOString()
    }, { onConflict: 'twilio_sid', ignoreDuplicates: true })

  if (insertError) throw insertError
  if (!patientId) {
    console.error(`Stored inbound Twilio message ${sid} without a patient match (${patients.length} matches).`)
  }

  return {
    status: 200,
    body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    contentType: 'text/xml'
  }
}

module.exports = {
  getPatientMessages,
  handleTwilioWebhook,
  sendPatientMessage
}
