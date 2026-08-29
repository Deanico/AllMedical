import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PORTAL_TERMS_VERSION = '2026-08-25'
const PORTAL_PRIVACY_NOTICE_VERSION = '2026-08-25'

export default function ClientPortalActivation({ user, onActivated, onLogout }) {
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasAcceptedLegalTerms, setHasAcceptedLegalTerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadActivationStatus = async () => {
      if (!supabase || !user?.email) {
        if (!cancelled) {
          setError('Unable to verify your portal invitation. Please contact All Medical, LLC at 352-328-8308.')
          setLoading(false)
        }
        return
      }

      const { data, error: clientError } = await supabase
        .from('leads')
        .select('id, name, email, portal_terms_accepted_at, portal_terms_version, portal_privacy_notice_version')
        .ilike('email', user.email)
        .limit(1)

      if (cancelled) return

      if (clientError || !data?.[0]) {
        setError(clientError?.message || 'Your portal account is not linked yet. Please contact All Medical, LLC at 352-328-8308.')
        setLoading(false)
        return
      }

      const hasAcceptedCurrentLegalTerms =
        data[0].portal_terms_accepted_at &&
        data[0].portal_terms_version === PORTAL_TERMS_VERSION &&
        data[0].portal_privacy_notice_version === PORTAL_PRIVACY_NOTICE_VERSION

      if (hasAcceptedCurrentLegalTerms) {
        onActivated()
        return
      }

      setClient(data[0])
      setLoading(false)
    }

    loadActivationStatus()
    return () => {
      cancelled = true
    }
  }, [onActivated, user?.email])

  const handleActivate = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!hasAcceptedLegalTerms) {
      setError('Please agree to the Terms of Service and acknowledge the Privacy Notice to activate your portal account.')
      return
    }

    try {
      setSaving(true)
      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) throw passwordError

      const acceptedAt = new Date().toISOString()
      const { error: acceptanceError } = await supabase
        .from('leads')
        .update({
          portal_accepted_at: acceptedAt,
          portal_terms_accepted_at: acceptedAt,
          portal_terms_version: PORTAL_TERMS_VERSION,
          portal_privacy_notice_version: PORTAL_PRIVACY_NOTICE_VERSION,
          portal_auth_user_id: user.id
        })
        .eq('id', client.id)

      if (acceptanceError) throw acceptanceError
      onActivated()
    } catch (activationError) {
      setError(activationError.message || 'We could not activate your portal account. Please try again or contact support.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen portal-shell flex items-center justify-center px-4 py-12">
      <div className="portal-auth-card w-full max-w-md p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AllMedical Client Portal</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">Activate Your Account</h1>
        <p className="text-sm text-slate-600 mt-2">Create your password and review the portal terms before accessing your account.</p>

        {loading && <p className="mt-6 text-sm text-slate-600">Verifying your invitation...</p>}

        {error && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && client && (
          <form onSubmit={handleActivate} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Portal Username</label>
              <input type="email" value={client.email} readOnly className="w-full px-4 py-3 bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Create Password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required className="w-full px-4 py-3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required className="w-full px-4 py-3" />
            </div>
            <label className="flex items-start gap-3 text-sm leading-5 text-slate-600">
              <input type="checkbox" required checked={hasAcceptedLegalTerms} onChange={(event) => setHasAcceptedLegalTerms(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
              <span>
                I agree to the <a href="/terms-of-service.html" target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline">Terms of Service</a> and acknowledge the <a href="/privacy-notice.html" target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline">Privacy Notice</a>.
              </span>
            </label>
            <button type="submit" disabled={saving} className="w-full portal-primary-btn">
              {saving ? 'Activating Account...' : 'Activate Portal Account'}
            </button>
          </form>
        )}

        <button type="button" onClick={onLogout} className="mt-6 text-sm text-slate-600 underline">Sign out</button>
      </div>
    </div>
  )
}