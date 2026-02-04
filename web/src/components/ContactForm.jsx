import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ContactForm({ isOpen, onClose }) {
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
      // Check if Supabase is configured
      if (!supabase) {
        throw new Error('Database configuration not found. Please check your environment variables.')
      }

      // Insert into Supabase
      const { error: dbError } = await supabase
        .from('contact_submissions')
        .insert([formData])

      if (dbError) throw dbError

      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', insurance: '', notes: '' })
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 3000)
    } catch (err) {
      setError(err.message || 'Failed to submit form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <h2 className="text-2xl font-bold">Contact All Medical, LLC</h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl text-green-600">✓</span>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Thank You!</h3>
            <p className="text-gray-600">We'll be in touch soon!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="insurance" className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Provider *
              </label>
              <input
                type="text"
                id="insurance"
                name="insurance"
                value={formData.insurance}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Blue Cross, UnitedHealthcare"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-500 text-xs">(Optional - Please do not include sensitive medical information)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-md transition-colors"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
