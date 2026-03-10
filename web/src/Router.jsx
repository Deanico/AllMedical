import { useState, useEffect } from 'react'
import App from './App'
import AdminLogin from './components/AdminLogin'
import AdminDashboard from './components/AdminDashboard'

export default function Router() {
  const [view, setView] = useState('public') // 'public', 'adminLogin', 'adminDashboard'
  const [adminEmail, setAdminEmail] = useState(null)

  // Check for existing admin session on load
  useEffect(() => {
    const authData = sessionStorage.getItem('adminAuth')
    if (authData) {
      try {
        const { email } = JSON.parse(authData)
        setAdminEmail(email)
      } catch (e) {
        sessionStorage.removeItem('adminAuth')
      }
    }

    // Check URL for admin route
    if (window.location.pathname === '/admin') {
      if (authData) {
        setView('adminDashboard')
      } else {
        setView('adminLogin')
      }
    } else {
      setView('public')
    }
  }, [])

  // Handle URL changes for admin route
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/admin') {
        if (adminEmail) {
          setView('adminDashboard')
        } else {
          setView('adminLogin')
        }
      } else {
        setView('public')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [adminEmail])

  const handleLogin = (email) => {
    setAdminEmail(email)
    setView('adminDashboard')
    window.history.pushState({}, '', '/admin')
  }

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth')
    setAdminEmail(null)
    setView('public')
    window.history.pushState({}, '', '/')
  }

  // Navigate to admin login
  const goToAdmin = () => {
    setView('adminLogin')
    window.history.pushState({}, '', '/admin')
  }

  if (view === 'adminLogin') {
    return <AdminLogin onLogin={handleLogin} />
  }

  if (view === 'adminDashboard') {
    return <AdminDashboard userEmail={adminEmail} onLogout={handleLogout} />
  }

  // Public site with admin link in footer
  return (
    <>
      <App />
      {/* Add admin link in footer - hidden in plain sight */}
      <div className="text-center pb-4">
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
