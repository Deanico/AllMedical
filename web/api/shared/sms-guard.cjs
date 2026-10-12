const FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  insurance: 100,
  notes: 500
}

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 5
const MAX_REQUESTS_GLOBAL_PER_WINDOW = 50

const hits = new Map()
let globalHits = []

// Collapse control characters and whitespace so submitted text cannot reshape the SMS.
const clean = (value, limit) =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

const validateContactPayload = (body) => {
  if (!body || typeof body !== 'object') return null

  const payload = {}
  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    payload[field] = clean(body[field], limit)
  }

  if (!payload.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return null

  return payload
}

// Best-effort in-memory limiter (per server instance); also caps total volume so spend stays bounded.
const isRateLimited = (key) => {
  const now = Date.now()
  globalHits = globalHits.filter((time) => now - time < WINDOW_MS)
  const recent = (hits.get(key) || []).filter((time) => now - time < WINDOW_MS)

  if (recent.length >= MAX_REQUESTS_PER_WINDOW || globalHits.length >= MAX_REQUESTS_GLOBAL_PER_WINDOW) {
    hits.set(key, recent)
    return true
  }

  recent.push(now)
  globalHits.push(now)
  hits.set(key, recent)

  if (hits.size > 5000) {
    for (const [storedKey, times] of hits) {
      if (!times.some((time) => now - time < WINDOW_MS)) hits.delete(storedKey)
    }
  }

  return false
}

module.exports = { validateContactPayload, isRateLimited }
