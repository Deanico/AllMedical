import { useState, useEffect } from 'react'
import App from './App'
import AdminLogin from './components/AdminLogin'
import AdminDashboard from './components/AdminDashboard'
import ClientPortalAuth from './components/ClientPortalAuth'
import ClientPortalActivation from './components/ClientPortalActivation'
import ClientPortalDashboard from './components/ClientPortalDashboard'
import { supabase } from './lib/supabaseClient'

export default function Router() {
  const [view, setView] = useState('public') // 'public', 'adminLogin', 'adminDashboard', 'clientLogin', 'clientActivation', 'clientDashboard'
  const [adminEmail, setAdminEmail] = useState(null)
  const [clientUser, setClientUser] = useState(null)
  const [ready, setReady] = useState(false)

  // Check for existing admin session on load
  useEffect(() => {
    let mounted = true

    const initializeRouter = async () => {
      // Check both localStorage (remember me) and sessionStorage
      const authData = localStorage.getItem('adminAuth') || sessionStorage.getItem('adminAuth')
      if (authData) {
        try {
          const { email } = JSON.parse(authData)
          if (mounted) setAdminEmail(email)
        } catch (e) {
          localStorage.removeItem('adminAuth')
          sessionStorage.removeItem('adminAuth')
        }
      }

      const path = window.location.pathname

      if (path === '/admin') {
        if (mounted) {
          setView(authData ? 'adminDashboard' : 'adminLogin')
          setReady(true)
        }
        return
      }

      if (path === '/portal') {
        const demoAuth = sessionStorage.getItem('clientDemoAuth')
        if (demoAuth) {
          try {
            const parsed = JSON.parse(demoAuth)
            if (mounted) {
              setClientUser(parsed)
              setView('clientDashboard')
              setReady(true)
            }
            return
          } catch {
            sessionStorage.removeItem('clientDemoAuth')
          }
        }

        if (supabase) {
          const { data } = await supabase.auth.getSession()
          const user = data?.session?.user || null
          if (mounted) {
            setClientUser(user)
            setView(user ? 'clientActivation' : 'clientLogin')
            setReady(true)
          }
        } else if (mounted) {
          setView('clientLogin')
          setReady(true)
        }
        return
      }

      if (mounted) {
        setView('public')
        setReady(true)
      }
    }

    initializeRouter()

    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (window.location.pathname === '/portal') {
        const user = session?.user || null
        setClientUser(user)
        setView(user ? 'clientActivation' : 'clientLogin')
      }
    })

    return () => {
      mounted = false
      authListener?.data?.subscription?.unsubscribe()
    }
  }, [])

  // Handle URL changes for admin and portal routes
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/admin') {
        if (adminEmail) {
          setView('adminDashboard')
        } else {
          setView('adminLogin')
        }
      } else if (window.location.pathname === '/portal') {
        if (clientUser) {
          setView('clientActivation')
        } else {
          setView('clientLogin')
        }
      } else {
        setView('public')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [adminEmail, clientUser])

  const handleLogin = (email) => {
    setAdminEmail(email)
    setView('adminDashboard')
    window.history.pushState({}, '', '/admin')
  }

  const handleLogout = () => {
    localStorage.removeItem('adminAuth')
    sessionStorage.removeItem('adminAuth')
    setAdminEmail(null)
    setView('public')
    window.history.pushState({}, '', '/')
  }

  const handleClientLogin = (user) => {
    setClientUser(user)
    if (user?.isDemo) {
      sessionStorage.setItem('clientDemoAuth', JSON.stringify(user))
    }
    setView(user?.isDemo ? 'clientDashboard' : 'clientActivation')
    window.history.pushState({}, '', '/portal')
  }

  const handleClientLogout = async () => {
    sessionStorage.removeItem('clientDemoAuth')
    if (supabase) {
      await supabase.auth.signOut()
    }
    setClientUser(null)
    setView('clientLogin')
    window.history.pushState({}, '', '/portal')
  }

  // Navigate to admin login
  const goToAdmin = () => {
    setView('adminLogin')
    window.history.pushState({}, '', '/admin')
  }

  const goToPortal = () => {
    setView(clientUser ? 'clientActivation' : 'clientLogin')
    window.history.pushState({}, '', '/portal')
  }

  if (!ready) {
    return (
      <div className="min-h-screen portal-shell flex items-center justify-center px-4">
        <div className="portal-auth-card max-w-md w-full p-8 text-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (view === 'adminLogin') {
    return <AdminLogin onLogin={handleLogin} />
  }

  if (view === 'adminDashboard') {
    return <AdminDashboard userEmail={adminEmail} onLogout={handleLogout} />
  }

  if (view === 'clientLogin') {
    return <ClientPortalAuth onLogin={handleClientLogin} />
  }

  if (view === 'clientActivation') {
    return <ClientPortalActivation user={clientUser} onActivated={() => setView('clientDashboard')} onLogout={handleClientLogout} />
  }

  if (view === 'clientDashboard') {
    return <ClientPortalDashboard user={clientUser} onLogout={handleClientLogout} />
  }

  // Public site with admin link in footer
  return (
    <>
      <App />
      <div className="text-center pb-4 space-x-3">
        <button
          onClick={goToPortal}
          className="text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          Client Portal
        </button>
        {/* Add admin link in footer - hidden in plain sight */}
        <button 
          onClick={goToAdmin}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          •
        </button>
      </div>
    </>
  )
}
