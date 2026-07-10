import logo from './assets/logobackgroundproper.png'
import newPhoto from './assets/Newphoto.jpg'
import infusionSetImg from './assets/MinimedQuickSetInfusionSet.png'
import reservoirImg from './assets/Medtronic_Resevoir.webp'
import omnipodImg from './assets/omnipod.png'
import './App.css'
import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    insurance: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Save to Supabase database
      if (supabase) {
        const { error: dbError } = await supabase
          .from('leads')
          .insert([{
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            insurance: formData.insurance,
            notes: formData.notes,
            stage: 'new'
          }])

        if (dbError) {
          console.error('Database error:', dbError)
          throw new Error('Failed to save lead')
        }
      }

      // Send SMS notification
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        console.warn('SMS notification failed')
        // Don't throw error - form submission still succeeded
      }

      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', insurance: '', notes: '' })
      
      // Reset submitted message after 5 seconds
      setTimeout(() => {
        setSubmitted(false)
      }, 5000)
    } catch (err) {
      setError(err.message || 'Failed to submit form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen landing-shell text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="All Medical, LLC"
              className="w-12 h-12 object-contain rounded-xl shadow-sm"
            />
            <div>
              <p className="text-sm font-semibold tracking-wide text-slate-900">All Medical, LLC</p>
              <p className="text-xs text-slate-500">Insulin Pump Supply Specialist</p>
            </div>
          </div>
          <div className="text-right">
            <a href="tel:605-467-8546" className="text-sm md:text-base font-bold text-cyan-800 hover:text-cyan-700">605-INSULIN</a>
            <p className="text-xs text-slate-500">or 561-707-0965</p>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 pt-10 pb-12 md:pt-16 md:pb-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <p className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
              Fast Supply Support
            </p>
            <h1 className="mt-5 text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
              Reliable Insulin Pump Supplies, Without the Runaround.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600 max-w-xl">
              We help you stay stocked with trusted products and responsive service. Submit your details and our team will guide eligibility and fulfillment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth' })}
                className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-semibold px-6 py-3 shadow-md transition-colors"
              >
                Start Enrollment
              </button>
              <a href="tel:605-467-8546" className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-6 py-3 transition-colors">
                Call Now
              </a>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
              <div className="landing-stat-card">
                <p className="text-2xl font-extrabold text-slate-900">24h</p>
                <p className="text-xs text-slate-500">Response Window</p>
              </div>
              <div className="landing-stat-card">
                <p className="text-2xl font-extrabold text-slate-900">3+</p>
                <p className="text-xs text-slate-500">Major Product Lines</p>
              </div>
              <div className="landing-stat-card">
                <p className="text-2xl font-extrabold text-slate-900">1:1</p>
                <p className="text-xs text-slate-500">Dedicated Help</p>
              </div>
            </div>
          </div>

          <div className="landing-hero-media">
            <img
              src={newPhoto}
              alt="All Medical team"
              className="w-full h-[420px] md:h-[520px] object-cover object-top"
            />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-6">
        <div className="landing-message-card p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Products You Can Depend On</h2>
          <p className="mt-3 text-slate-600 text-base md:text-lg">
            Medtronic MiniMed infusion sets and reservoirs, Omnipod pods, sensors, and other essentials for day-to-day diabetes management.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">No HMOs, Medicare, or Medicaid.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="landing-product-card">
            <h3 className="text-xl font-bold text-slate-900">MiniMed Infusion Sets</h3>
            <ul className="mt-4 space-y-2 text-slate-600 text-sm">
              <li>Quick-set</li>
              <li>Mio and Mio Advance</li>
              <li>Silhouette</li>
              <li>Sure-T</li>
            </ul>
            <img src={infusionSetImg} alt="MiniMed Infusion Set" className="mt-6 h-44 w-full object-contain" />
          </div>

          <div className="landing-product-card">
            <h3 className="text-xl font-bold text-slate-900">MiniMed Reservoirs</h3>
            <ul className="mt-4 space-y-2 text-slate-600 text-sm">
              <li>1.8 mL Reservoirs</li>
              <li>3.0 mL Reservoirs</li>
              <li>Leak-resistant design</li>
            </ul>
            <img src={reservoirImg} alt="MiniMed Reservoir" className="mt-6 h-44 w-full object-contain" />
          </div>

          <div className="landing-product-card">
            <h3 className="text-xl font-bold text-slate-900">Omnipod Pods</h3>
            <ul className="mt-4 space-y-2 text-slate-600 text-sm">
              <li>Omnipod DASH Pods</li>
              <li>Omnipod 5 Pods</li>
              <li>Tubeless design</li>
            </ul>
            <img src={omnipodImg} alt="Omnipod Pod" className="mt-6 h-44 w-full object-contain" />
          </div>
        </div>
      </section>

      <section id="contact-form" className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="landing-form-shell p-6 md:p-10">
          <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 text-center">Start Your Supply Request</h3>
          <p className="text-center text-slate-600 mt-2 mb-8">Tell us a little about you and we will follow up quickly.</p>

          {submitted ? (
            <div className="max-w-2xl mx-auto p-8 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl text-emerald-600">✓</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Thank You</h3>
              <p className="text-slate-600">We will be in touch soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Full Name"
                  required
                  className="landing-input"
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  required
                  className="landing-input"
                />
              </div>

              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone Number"
                required
                className="landing-input"
              />

              <input
                type="text"
                name="insurance"
                value={formData.insurance}
                onChange={handleChange}
                placeholder="Insurance Provider"
                required
                className="landing-input"
              />

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Notes (Please do not include sensitive medical information)"
                rows="5"
                className="landing-input"
              ></textarea>

              <div className="pt-2 text-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white font-bold py-3 px-10 transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-slate-600 mb-2">© 2026 All Medical, LLC</p>
          <p className="text-slate-500 text-sm">This website does not provide medical advice. Consult your healthcare provider.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
