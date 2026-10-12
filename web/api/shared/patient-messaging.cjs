const { createClient } = require('@supabase/supabase-js')
const twilio = require('twilio')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const getRequiredEnv = (...names) => {
  const value = names.map((name) => process.env[name]).find(Boolean)
  if (!value) throw new Error(`Missing server configuration: ${names[0]}`)
  return value
}

const getSupabaseUrl = () => {
  const url = getRequiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  return String(url).trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
}

const getServiceRoleKey = () => {
  const key = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
  return String(key).trim().replace(/^["']|["']$/g, '')
}

const getServiceClient = () => createClient(
  getSupabaseUrl(),
  getServiceRoleKey(),
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
  let value
  if (typeof req.get === 'function') {
    value = req.get(name)
  } else {
    const headers = req.headers || {}
    value = headers[name.toLowerCase()] || headers[name]
  }
  if (Array.isArray(value)) value = value[0]
  return typeof value === 'string' ? value : ''
}

const authorizeAdmin = async (req) => {
  // Azure Static Web Apps can overwrite the Authorization header, so check x-supabase-auth first.
  const rawAuth = getRequestHeader(req, 'x-supabase-auth') || getRequestHeader(req, 'authorization') || ''
  const token = rawAuth.replace(/^Bearer\s+/i, '').trim().replace(/^["']|["']$/g, '')
  if (!token) {
    return { error: { status: 401, message: 'Sign in as an administrator to continue.' } }
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error) {
    console.error('Admin token check failed:', error.message)

    let diagnostic = error.message
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
        const tokenRef = payload.ref || payload.iss?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
        const serverUrl = getSupabaseUrl()
        const serverRef = serverUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

        if (payload.iss && !payload.iss.includes('supabase.co')) {
          diagnostic += ` [Non-Supabase token received from issuer "${payload.iss}". The client Authorization header was likely overridden by hosting proxy; send via X-Supabase-Auth.]`
        } else if (tokenRef && serverRef && tokenRef !== serverRef) {
          diagnostic += ` [Project mismatch: browser session is for project "${tokenRef}", but server is configured for "${serverRef}". Please log out and sign back in.]`
        } else if (error.message.includes('signature is invalid')) {
          diagnostic += ` [Session signature rejected by Supabase (${serverRef || 'configured project'}). The session in your browser is expired or from before Supabase keys were updated. Please log out and sign back in.]`
        }
      }
    } catch (_) {}

    return { error: { status: 401, message: 'The server could not verify your session. Log out and back in; if it persists, the server Supabase key or URL is wrong. (Details: ' + diagnostic + ')' } }
  }
  if (!data.user || data.user.app_metadata?.role !== 'admin') {
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
  authorizeAdmin,
  getServiceClient,
  getPatientMessages,
  handleTwilioWebhook,
  sendPatientMessage
}
