import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export default function AllMessagesPanel({ onOpenPatient }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

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
  }, [])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return messages.filter((m) => {
      if (filter === 'unmatched' && m.patient_id) return false
      if (filter === 'inbound' && m.direction !== 'inbound') return false
      if (filter === 'outbound' && m.direction !== 'outbound') return false
      if (!term) return true
      return [m.body, m.leads?.name, m.from_phone, m.to_phone]
        .some((v) => String(v || '').toLowerCase().includes(term))
    })
  }, [messages, search, filter])

  return (
    <section className="space-y-4 p-6" aria-label="All text messages">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, or message…"
          className="min-w-[240px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All messages</option>
          <option value="inbound">Received</option>
          <option value="outbound">Sent</option>
          <option value="unmatched">Unmatched numbers</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading messages…</p>
        ) : visible.length ? (
          <ul className="divide-y divide-gray-200">
            {visible.map((m) => {
              const outbound = m.direction === 'outbound'
              const phone = outbound ? m.to_phone : m.from_phone
              return (
                <li key={m.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{m.leads?.name || 'Unknown sender'}</span>
                      <span className="text-sm text-gray-500">{phone}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${outbound ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                        {outbound ? 'Sent' : 'Received'}
                      </span>
                      {!m.patient_id && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">No patient match</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{formatTime(m.sent_at || m.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-800">{m.body}</p>
                  {m.patient_id && onOpenPatient && (
                    <button
                      type="button"
                      onClick={() => onOpenPatient(m.patient_id)}
                      className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Open conversation
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-gray-500">No messages found.</p>
        )}
      </div>
    </section>
  )
}
