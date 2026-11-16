// Builds the list of Google Sheet ranges to pull leads from.
// GOOGLE_SHEET_ID + GOOGLE_SHEET_RANGE          -> primary sheet; RANGE may list several tabs separated by "|"
// GOOGLE_SHEET_ID_2 + GOOGLE_SHEET_RANGE_2 ...  -> additional sheets (up to _9), same format
// GOOGLE_SHEET_HANDLING[_n] = "ai" or "call" (default) for the whole spreadsheet
// GOOGLE_SHEET_AI_TABS = comma-separated tab names that are always "ai", e.g. "Sheet2"
const getLeadSheetSources = (env = process.env) => {
  const sources = []
  const aiTabs = String(env.GOOGLE_SHEET_AI_TABS || '')
    .split(',')
    .map((tab) => tab.trim().toLowerCase())
    .filter(Boolean)

  const add = (sheetId, rangeValue, handlingValue) => {
    if (!sheetId) return
    const sheetHandling = String(handlingValue || '').trim().toLowerCase() === 'ai' ? 'ai' : 'call'
    String(rangeValue || 'Sheet1!A2:R')
      .split('|')
      .map((range) => range.trim())
      .filter(Boolean)
      .forEach((range) => {
        const tab = range.split('!')[0].replace(/^'|'$/g, '')
        const handling = aiTabs.includes(tab.toLowerCase()) ? 'ai' : sheetHandling
        sources.push({ sheetId: sheetId.trim(), range, label: tab, handling })
      })
  }

  add(env.GOOGLE_SHEET_ID, env.GOOGLE_SHEET_RANGE, env.GOOGLE_SHEET_HANDLING)
  for (let i = 2; i <= 9; i++) {
    add(env[`GOOGLE_SHEET_ID_${i}`], env[`GOOGLE_SHEET_RANGE_${i}`], env[`GOOGLE_SHEET_HANDLING_${i}`])
  }

  return sources
}

const getLeadHandling = (row, handling, adNameColumn = 3) => {
  const adName = String(row[adNameColumn] ?? '').trim()
  return handling === 'ai' || /^AI Agent\b/i.test(adName) ? 'ai' : handling
}

const getLeadSourceCreatedAt = (row, createdAtColumn = 1) => {
  const value = String(row[createdAtColumn] ?? '').trim()
  if (!value) return null

  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}

const getLeadIdentity = (lead) => {
  const name = String(lead.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const phone = String(lead.phone || '').replace(/\D/g, '').slice(-10)
  return name && phone ? `${name}:${phone}` : null
}

const markCombinedCampaignCandidates = (candidates) => {
  const handlingByIdentity = new Map()

  for (const candidate of candidates) {
    const identity = getLeadIdentity(candidate)
    if (!identity) continue

    const handlings = handlingByIdentity.get(identity) || new Set()
    handlings.add(candidate.handling)
    handlingByIdentity.set(identity, handlings)
  }

  for (const candidate of candidates) {
    const identity = getLeadIdentity(candidate)
    const handlings = identity && handlingByIdentity.get(identity)
    if (handlings?.has('ai') && handlings.has('call')) {
      candidate.handling = 'ai_call'
    }
  }
}

const getExistingLeads = async (supabase, emails) => {
  const uniqueEmails = [...new Set(emails.map((email) => String(email).toLowerCase()))]
  const leads = []

  for (let index = 0; index < uniqueEmails.length; index += 100) {
    const { data, error } = await supabase
      .from('leads')
      .select('email, handling, lead_source_created_at')
      .in('email', uniqueEmails.slice(index, index + 100))

    if (error) throw error
    leads.push(...(data || []))
  }

  return leads
}

const updateExistingLeads = async (supabase, candidates, existingLeads) => {
  const existingByEmail = new Map()
  for (const lead of existingLeads || []) {
    const email = String(lead.email || '').toLowerCase()
    const leads = existingByEmail.get(email) || []
    leads.push(lead)
    existingByEmail.set(email, leads)
  }

  const candidatesByEmail = new Map()
  for (const candidate of candidates) {
    const email = String(candidate.email || '').toLowerCase()
    const handlings = candidatesByEmail.get(email) || new Set()
    handlings.add(candidate.handling)
    candidatesByEmail.set(email, handlings)
  }

  const updatesByEmail = new Map()

  for (const candidate of candidates) {
    const email = String(candidate.email || '').toLowerCase()
    const existing = existingByEmail.get(email)
    if (!existing) continue

    const update = updatesByEmail.get(email) || {}
    const handlings = candidatesByEmail.get(email)
    const existingHandlings = new Set(existing.map((lead) => lead.handling))
    if (
      handlings.has('ai_call') ||
      (handlings.has('ai') && handlings.has('call')) ||
      existingHandlings.has('ai_call') ||
      (existingHandlings.has('ai') && existingHandlings.has('call'))
    ) {
      update.handling = 'ai_call'
    } else if (handlings.has('ai')) {
      update.handling = 'ai'
    }
    const existingLead = existing[0]
    if (
      !existingLead.lead_source_created_at &&
      candidate.lead_source_created_at &&
      (!update.lead_source_created_at ||
        new Date(candidate.lead_source_created_at) < new Date(update.lead_source_created_at))
    ) {
      update.lead_source_created_at = candidate.lead_source_created_at
    }
    if (Object.keys(update).length) updatesByEmail.set(email, update)
  }

  const updates = [...updatesByEmail.entries()]
  for (let index = 0; index < updates.length; index += 25) {
    const results = await Promise.all(updates.slice(index, index + 25).map(async ([email, update]) => {
      const { error } = await supabase.from('leads').update(update).eq('email', email)
      return { email, error }
    }))

    const failedUpdate = results.find((result) => result.error)
    if (failedUpdate) {
      throw new Error(`Failed to update existing lead ${failedUpdate.email}: ${failedUpdate.error.message}`)
    }
  }
}

module.exports = {
  getExistingLeads,
  markCombinedCampaignCandidates,
  getLeadHandling,
  getLeadSheetSources,
  getLeadSourceCreatedAt,
  updateExistingLeads
}
