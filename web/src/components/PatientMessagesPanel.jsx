import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const formatMessageTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export default function PatientMessagesPanel({ patient }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const getValidAccessToken = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    let token = sessionData.session?.access_token
    const expiresAt = sessionData.session?.expires_at
    if (!token || (expiresAt && expiresAt * 1000 < Date.now() + 60000)) {
      const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: null }))
      token = refreshed?.session?.access_token || token
    }
    return token
  }

  useEffect(() => {
    let cancelled = false
    let refreshInterval

    const loadMessages = async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const accessToken = await getValidAccessToken()
        if (!accessToken) throw new Error('Your administrator session has expired. Please sign in again.')

        const response = await fetch(`/api/patient-messages/${encodeURIComponent(patient.id)}`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Supabase-Auth': `Bearer ${accessToken}` }
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to load this patient’s messages.')
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

    loadMessages(true)
    refreshInterval = window.setInterval(() => loadMessages(), 15000)

    return () => {
      cancelled = true
      window.clearInterval(refreshInterval)
    }
  }, [patient.id])

  const handleSend = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    try {
      setSending(true)
      setError('')
      const accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Your administrator session has expired. Please sign in again.')

      const response = await fetch(`/api/patient-messages/${encodeURIComponent(patient.id)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`, 'X-Supabase-Auth': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send this message.')
      setMessages((current) => [...current, result.message])
      setDraft('')
    } catch (sendError) {
      setError(sendError.message || 'Unable to send this message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="space-y-4" aria-label={`Text messages with ${patient.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Text messages</h3>
          <p className="text-sm text-gray-500">{patient.phone || 'No phone number on file'}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          SMS is not for emergencies
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span className="flex-1 min-w-[200px]">{error}</span>
          {(error.toLowerCase().includes('session') || error.toLowerCase().includes('jwt') || error.toLowerCase().includes('signature') || error.toLowerCase().includes('log out') || error.toLowerCase().includes('administrator')) && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await supabase?.auth.signOut({ scope: 'local' })
                } catch (_) {}
                window.location.href = '/admin'
              }}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-semibold rounded-md text-red-800 bg-white hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign Out &amp; Log Back In
            </button>
          )}
        </div>
      )}

      <div className="max-h-[28rem] min-h-48 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4" aria-live="polite">
        {loading ? (
          <p className="text-sm text-gray-500">Loading conversation…</p>
        ) : messages.length ? messages.map((message) => {
          const outbound = message.direction === 'outbound'
          return (
            <div key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${outbound ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-900'}`}>
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <p className={`mt-1 text-xs ${outbound ? 'text-blue-100' : 'text-gray-500'}`}>
                  {outbound ? 'You' : 'Patient'} · {formatMessageTime(message.sent_at || message.created_at)}
                  {outbound && message.status ? ` · ${message.status}` : ''}
                </p>
              </div>
            </div>
          )
        }) : (
          <p className="py-12 text-center text-sm text-gray-500">No text messages yet.</p>
        )}
      </div>

      <form onSubmit={handleSend} className="space-y-2">
        <label htmlFor={`patient-message-${patient.id}`} className="block text-sm font-medium text-gray-700">
          New message
        </label>
        <textarea
          id={`patient-message-${patient.id}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1600}
          rows={3}
          placeholder="Write a text message…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">{draft.length}/1,600 characters</p>
          <button
            type="submit"
            disabled={sending || !draft.trim() || !patient.phone}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {sending ? 'Sending…' : 'Send text'}
          </button>
        </div>
      </form>
    </section>
  )
}
