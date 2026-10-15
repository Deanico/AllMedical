import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PatientMessagesPanel from './PatientMessagesPanel'

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

const conversationKey = (m) => m.patient_id || `phone:${m.direction === 'outbound' ? m.to_phone : m.from_phone}`

export default function AllMessagesPanel() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        let token = sessionData.session?.access_token
        const expiresAt = sessionData.session?.expires_at
        if (!token || (expiresAt && expiresAt * 1000 < Date.now() + 60000)) {
          const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: null }))
          token = refreshed?.session?.access_token || token
        }
        if (!token) throw new Error('Your administrator session has expired. Please sign in again.')

        const response = await fetch('/api/patient-messages/all', {
          headers: { Authorization: `Bearer ${token}`, 'X-Supabase-Auth': `Bearer ${token}` }
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to load messages.')
        if (!cancelled) {
          setMessages(result.messages || [])
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load messages.')
      } finally {
        if (!cancelled && showLoading) setLoading(false)
      }
    }

    load(true)
    const interval = window.setInterval(() => load(), 15000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [refreshToken])

  // Messages arrive newest first, so the first one seen per conversation is the latest.
  const conversations = useMemo(() => {
    const map = new Map()
    messages.forEach((m) => {
      const key = conversationKey(m)
      if (!map.has(key)) {
        const phone = m.direction === 'outbound' ? m.to_phone : m.from_phone
        map.set(key, {
          key,
          patientId: m.patient_id,
          name: m.leads?.name || null,
          phone: m.leads?.phone || phone,
          latest: m,
          messages: []
        })
      }
      map.get(key).messages.push(m)
    })
    return Array.from(map.values())
  }, [messages])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((c) =>
      [c.name, c.phone, c.latest.body].some((v) => String(v || '').toLowerCase().includes(term))
    )
  }, [conversations, search])

  const selected = conversations.find((c) => c.key === selectedKey)

  if (selected) {
    return (
      <section className="space-y-4 p-6">
        <button
          type="button"
          onClick={() => {
            setSelectedKey(null)
            setRefreshToken((n) => n + 1)
          }}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Back to all conversations
        </button>
        <div className="rounded-lg bg-white p-4 shadow">
          {selected.patientId ? (
            <PatientMessagesPanel
              patient={{ id: selected.patientId, name: selected.name || selected.phone, phone: selected.phone }}
            />
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{selected.phone}</h3>
                <p className="text-sm text-amber-700">
                  This number doesn’t match a patient, so replies can’t be sent from here.
                </p>
              </div>
              <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
                {[...selected.messages].reverse().map((m) => (
                  <div key={m.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-2">
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{m.body}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatTime(m.sent_at || m.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 p-6" aria-label="All text message conversations">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, phone, or message…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading conversations…</p>
        ) : visible.length ? (
          <ul className="divide-y divide-gray-200">
            {visible.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(c.key)}
                  className="w-full p-4 text-left hover:bg-gray-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{c.name || 'Unknown sender'}</span>
                      <span className="text-sm text-gray-500">{c.phone}</span>
                      {!c.patientId && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">No patient match</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{formatTime(c.latest.sent_at || c.latest.created_at)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-600">
                    {c.latest.direction === 'outbound' ? 'You: ' : ''}{c.latest.body}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-gray-500">No conversations found.</p>
        )}
      </div>
    </section>
  )
}
