const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  getExistingLeads,
  markCombinedCampaignCandidates,
  updateExistingLeads
} = require('./lead-sheet-sources.cjs')

const lead = (id, name, phone, email, handling, date = null) => ({
  id, name, phone, email, handling, lead_source_created_at: date
})

test('combines matching incoming and existing leads, including different email addresses', async () => {
  const existing = [
    lead('1', 'Jane Doe', '(555) 123-4567', 'old@example.test', 'call'),
    lead('2', 'JANE DOE', '+1 555 123 4567', 'other@example.test', 'call'),
    lead('3', 'Another Person', '5551234567', 'shared@example.test', 'call')
  ]
  const candidates = [
    lead(null, 'Jane Doe', '5551234567', 'new@example.test', 'ai')
  ]
  const combined = markCombinedCampaignCandidates(candidates, existing)
  const updates = []
  const supabase = { from: () => ({ update: (values) => ({
    eq: async (column, id) => { updates.push({ column, id, values }); return { error: null } }
  }) }) }

  await updateExistingLeads(supabase, candidates, existing, combined)
  assert.equal(candidates[0].handling, 'ai_call')
  assert.deepEqual(updates, [
    { column: 'id', id: '1', values: { handling: 'ai_call' } },
    { column: 'id', id: '2', values: { handling: 'ai_call' } }
  ])
})

test('combines a repeated email and candidate-only matches, but not same-campaign or incomplete matches', () => {
  const existing = [
    lead('1', 'Jane Doe', '5551234567', 'same@example.test', 'call'),
    lead('2', 'Sam Jones', '5551234567', 'sam@example.test', 'ai'),
    lead('3', 'Short Number', '123', 'short@example.test', 'call')
  ]
  const candidates = [
    lead(null, 'Jane Doe', '5551234567', 'same@example.test', 'ai'),
    lead(null, 'Sam Jones', '5551234567', 'sam2@example.test', 'ai'),
    lead(null, 'Short Number', '123', 'short2@example.test', 'ai'),
    lead(null, 'Alex Smith', '5559876543', 'alex1@example.test', 'call'),
    lead(null, 'Alex Smith', '5559876543', 'alex2@example.test', 'ai')
  ]
  markCombinedCampaignCandidates(candidates, existing)
  assert.deepEqual(candidates.map((candidate) => candidate.handling), ['ai_call', 'ai', 'ai', 'ai_call', 'ai_call'])
})

test('propagates a previously combined campaign without changing existing service dates', async () => {
  const existing = [
    lead('1', 'Jane Doe', '5551234567', 'same@example.test', 'ai_call', '2026-01-01T00:00:00Z'),
    lead('2', 'Jane Doe', '5551234567', 'same@example.test', 'call')
  ]
  const candidates = [lead(null, 'Jane Doe', '5551234567', 'same@example.test', 'call', '2026-02-01T00:00:00Z')]
  const combined = markCombinedCampaignCandidates(candidates, existing)
  const updates = []
  const supabase = { from: () => ({ update: (values) => ({
    eq: async (column, id) => { updates.push({ id, values }); return { error: null } }
  }) }) }
  await updateExistingLeads(supabase, candidates, existing, combined)
  assert.equal(candidates[0].handling, 'ai_call')
  assert.deepEqual(updates, [{
    id: '2',
    values: { handling: 'ai_call', lead_source_created_at: '2026-02-01T00:00:00Z' }
  }])
})

test('fetches all pages of existing leads and surfaces update errors', async () => {
  const rows = Array.from({ length: 501 }, (_, id) => lead(String(id), 'Jane Doe', '5551234567', `${id}@example.test`, 'call'))
  const supabase = { from: () => ({
    select: () => ({ order: () => ({ range: async (start, end) => ({ data: rows.slice(start, end + 1), error: null }) }) }),
    update: () => ({ eq: async () => ({ error: { message: 'denied' } }) })
  }) }
  const existing = await getExistingLeads(supabase)
  assert.equal(existing.length, 501)
  const candidates = [lead(null, 'Jane Doe', '5551234567', 'new@example.test', 'ai')]
  const combined = markCombinedCampaignCandidates(candidates, existing)
  await assert.rejects(updateExistingLeads(supabase, candidates, existing, combined), /denied/)
})
