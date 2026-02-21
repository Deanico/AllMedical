import logo from './assets/logobackgroundproper.png'
import infusionSetImg from './assets/MinimedQuickSetInfusionSet.png'
import reservoirImg from './assets/Medtronic_Resevoir.webp'
import omnipodImg from './assets/omnipod.png'
import suppliesScreenshot from './assets/Image-1.jpg'
import './App.css'
import { useState } from 'react'

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
      // Send SMS notification
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
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
    <div className="min-h-screen bg-white">
      {/* Hero Section with Logo */}
      <section className="bg-gradient-to-r from-blue-200 via-blue-100 to-yellow-100 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Logo */}
          <div className="flex justify-center">
            <img 
              src={logo} 
              alt="All Medical, LLC - 605-INSULIN" 
              className="w-auto h-64 md:h-80 object-contain drop-shadow-md"
            />
          </div>
          
          <div className="mt-8">
            <p className="text-xl md:text-2xl text-blue-900 font-semibold">Trusted Insulin Pump Supplier</p>
          </div>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {/* Page Title */}
          <h2 className="text-4xl font-bold text-center text-blue-900 mb-10">
            Insulin Pump Supplier
          </h2>

          {/* Description */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-gray-700 text-lg leading-relaxed">
              All Medical, LLC provides reliable insulin pump supplies for daily diabetes care, 
              including Medtronic MiniMed infusion sets, reservoirs, Omnipod pods, sensors, etc. AT NO COST TO YOU! <span className="text-sm">(with eligibility)</span>
            </p>
            <p className="text-gray-800 font-bold text-base mt-4">
              ONLY PPO'S, NO HMO, MEDICARE OR MEDICAID
            </p>
          </div>

          {/* Product Cards - Four Column Layout */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {/* Screenshot Card */}
            <div className="bg-purple-50 rounded-lg p-8 shadow-md flex items-center justify-center">
              <img 
                src={suppliesScreenshot} 
                alt="All Medical Insulin Pump Supplies" 
                className="w-full rounded-lg shadow-lg transform rotate-2 hover:rotate-0 transition-transform duration-300"
              />
            </div>

            {/* MiniMed Infusion Sets Card */}
            <div className="bg-blue-50 rounded-lg p-8 shadow-md">
              <h3 className="text-2xl font-bold text-blue-900 mb-6">MiniMed Infusion Sets</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Quick-set®</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Mio™ & Mio™ Advance</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Silhouette™</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Sure-T®</span>
                </li>
              </ul>
              <div className="mt-8 flex justify-center">
                <img src={infusionSetImg} alt="MiniMed Infusion Set" className="w-48 h-48 object-contain" />
              </div>
            </div>

            {/* MiniMed Reservoirs Card */}
            <div className="bg-green-50 rounded-lg p-8 shadow-md">
              <h3 className="text-2xl font-bold text-blue-900 mb-6">MiniMed Reservoirs</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>1.8 mL Reservoirs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>3.0 mL Reservoirs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>Leak-resistant design</span>
                </li>
              </ul>
              <div className="mt-8 flex justify-center">
                <img src={reservoirImg} alt="MiniMed Reservoir" className="w-48 h-48 object-contain" />
              </div>
            </div>

            {/* Omnipod Pods Card */}
            <div className="bg-yellow-50 rounded-lg p-8 shadow-md">
              <h3 className="text-2xl font-bold text-blue-900 mb-6">Omnipod Pods</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>Omnipod DASH® Pods</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>Omnipod® 5 Pods</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>No tubing required</span>
                </li>
              </ul>
              <div className="mt-8 flex justify-center">
                <img src={omnipodImg} alt="Omnipod Pod" className="w-48 h-48 object-contain" />
              </div>
            </div>
          </div>

          {/* Call to Action Box */}
          <div className="bg-green-50 rounded-lg p-10 text-center shadow-lg mb-16">
            <h3 className="text-3xl font-bold text-blue-900 mb-6">Need Insulin Pump Supplies?</h3>
            <p className="text-2xl font-bold text-blue-700 mb-2">
              Call <a href="tel:605-467-8546" className="hover:underline">605-INSULIN</a> OR <a href="tel:561-707-0965" className="hover:underline">561-707-0965</a>
            </p>
          </div>

          {/* Contact Form Section */}
          <div className="bg-gray-50 rounded-lg p-10 shadow-lg">
            <h3 className="text-3xl font-bold text-center text-blue-900 mb-10">Contact All Medical, LLC</h3>
            
            {submitted ? (
              <div className="max-w-2xl mx-auto p-8 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-3xl text-green-600">✓</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Thank You!</h3>
                <p className="text-gray-600">We'll be in touch soon!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {/* Name and Email Row */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Full Name"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email Address"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Phone Number"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Insurance Provider */}
                <div>
                  <input
                    type="text"
                    name="insurance"
                    value={formData.insurance}
                    onChange={handleChange}
                    placeholder="Insurance Provider (e.g., Blue Cross, UnitedHealthcare)"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Message */}
                <div>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="How can we help? (Please do not include sensitive medical information)"
                    rows="5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>

                {/* Submit Button */}
                <div className="text-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white font-bold py-4 px-12 rounded-md transition-colors text-lg"
                  >
                    {loading ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-600 mb-2">© 2026 All Medical, LLC</p>
          <p className="text-gray-500 text-sm">
            This website does not provide medical advice. Consult your healthcare provider.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
