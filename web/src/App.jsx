import { useState } from 'react'
import ContactForm from './components/ContactForm'
import './App.css'

function App() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-blue-600">AllMedical</div>
            <div className="hidden md:flex space-x-8">
              <a href="#services" className="text-gray-700 hover:text-blue-600 transition">Services</a>
              <a href="#benefits" className="text-gray-700 hover:text-blue-600 transition">Benefits</a>
              <a href="#about" className="text-gray-700 hover:text-blue-600 transition">About</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-blue-50 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
                Insulin Pump Supplies Shipped At <span className="text-blue-600">No Cost to you</span>
              </h1>
              <p className="text-lg text-gray-600 mb-6">(Eligibility Required)</p>
              <p className="text-xl font-semibold text-red-600 mb-8">
                NO HMO's / Medicare
              </p>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                All Medical, LLC will verify insurance and obtain correct endocrinologist (Dr) Information. 
                Next, we ship supplies to your door/office.
              </p>
              
              {/* Phone Number - Large */}
              <div className="mb-8">
                <p className="text-sm text-gray-600 mb-2">Please call:</p>
                <a 
                  href="tel:605-467-8546" 
                  className="text-4xl md:text-5xl font-bold text-blue-600 hover:text-blue-700 transition block mb-2"
                >
                  605-INSULIN
                </a>
                <p className="text-2xl text-gray-700">(605-467-8546)</p>
              </div>

              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 px-8 rounded-lg hover:from-blue-700 hover:to-blue-800 transition transform hover:scale-105 shadow-lg"
              >
                Contact Form
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 h-80">
              <div className="bg-gray-100 rounded-lg flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">💉</div>
                  <p className="text-sm font-semibold text-gray-700">Medtronic MiniMed</p>
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🧬</div>
                  <p className="text-sm font-semibold text-gray-700">Infusion Sets</p>
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🔧</div>
                  <p className="text-sm font-semibold text-gray-700">Reservoirs</p>
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">⭕</div>
                  <p className="text-sm font-semibold text-gray-700">Omnipod Pods</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supplies Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Insulin Pump Supplies such as:</h2>
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-center">
                <span className="text-3xl mr-4">💉</span>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Medtronic MiniMed</h3>
                  <p className="text-gray-600">Infusion Sets / Reservoirs</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-center">
                <span className="text-3xl mr-4">⭕</span>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Omnipod</h3>
                  <p className="text-gray-600">Pods</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-center">
                <span className="text-3xl mr-4">🔧</span>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Cartridges</h3>
                  <p className="text-gray-600">All compatible cartridges</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-16 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Your Supplies?</h2>
          <div className="mb-8">
            <p className="text-xl mb-4 text-blue-100">Call us today:</p>
            <a 
              href="tel:605-467-8546" 
              className="text-5xl font-bold hover:text-blue-100 transition inline-block"
            >
              605-INSULIN
            </a>
            <p className="text-2xl mt-2 text-blue-100">(605-467-8546)</p>
          </div>
          <p className="text-xl mb-8 text-blue-100">
            Or fill out our contact form below
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-white text-blue-600 font-bold py-4 px-8 rounded-lg hover:bg-gray-100 transition transform hover:scale-105 shadow-lg"
          >
            Contact Form
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h3 className="text-white font-bold text-2xl mb-4">All Medical, LLC</h3>
            <p className="text-lg mb-4">Your trusted insulin pump supply partner</p>
            <div className="text-xl">
              <a href="tel:605-467-8546" className="hover:text-white transition">
                📞 605-INSULIN (605-467-8546)
              </a>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p>&copy; 2026 All Medical, LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Button */}
      <button
        onClick={() => setIsFormOpen(true)}
        className="fixed right-6 bottom-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 px-6 rounded-full shadow-2xl hover:from-blue-700 hover:to-blue-800 transition transform hover:scale-110 z-40"
        aria-label="Contact Form"
      >
        <div className="text-center">
          <div className="text-xs">CONTACT</div>
          <div className="text-xs">FORM</div>
        </div>
      </button>

      {/* Contact Form Modal */}
      <ContactForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  )
}

export default App
