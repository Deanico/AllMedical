import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const DEMO_PORTAL_EMAIL = 'demo.client@allmedical.com'
const DEMO_PORTAL_PASSWORD = 'DemoPortal123!'

export default function ClientPortalAuth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    resetFeedback()

    // Internal demo fallback so preview is possible even if email confirmation is enabled.
    if (email.trim().toLowerCase() === DEMO_PORTAL_EMAIL && password === DEMO_PORTAL_PASSWORD) {
      onLogin({
        id: 'demo-local-user',
        email: DEMO_PORTAL_EMAIL,
        isDemo: true,
        user_metadata: {
          full_name: 'Demo Client'
        }
      })
      return
    }

    if (!supabase) {
      setError('Portal is not configured yet. Please contact support.')
      return
    }

    setLoading(true)
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (loginError) {
      setError(loginError.message || 'Unable to log in. Please try again.')
      setLoading(false)
      return
    }

    onLogin(data.user)
    setLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    resetFeedback()

    if (!supabase) {
      setError('Portal is not configured yet. Please contact support.')
      return
    }

    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal`
    })

    if (resetError) {
      setError(resetError.message || 'Unable to send reset email. Please try again.')
      setLoading(false)
      return
    }

    setMessage('Password reset email sent. Please check your inbox.')
    setMode('login')
    setLoading(false)
  }

  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'

  return (
    <div className="min-h-screen portal-shell flex items-center justify-center px-4 py-12">
      <div className="portal-auth-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AllMedical</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">Client Portal</h1>
          <p className="text-sm text-slate-600 mt-2">
            {isLogin && 'Sign in to view your shipment schedule and product details.'}
            {isForgot && 'Enter your email to reset your password.'}
          </p>
          {isLogin && (
            <p className="text-xs text-slate-500 mt-2">
              Demo login: demo.client@allmedical.com / DemoPortal123!
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {isLogin && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full portal-primary-btn"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {isForgot && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full portal-primary-btn"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              resetFeedback()
              setMode('forgot')
            }}
            className="portal-secondary-btn"
          >
            Forgot Password
          </button>
          {!isLogin && (
            <button
              type="button"
              onClick={() => {
                resetFeedback()
                setMode('login')
              }}
              className="portal-link-btn"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
