import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generatePhysicianOrder, downloadPDF } from '../lib/generatePhysicianOrder'

export default function AdminDashboard({ userEmail, onLogout }) {
  const [activeTab, setActiveTab] = useState('leads')
  const [leads, setLeads] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showAddDrModal, setShowAddDrModal] = useState(false)
  const [showEditClientModal, setShowEditClientModal] = useState(false)
  const [drForm, setDrForm] = useState({ 
    full_name: '', 
    fax: '', 
    npi_number: '',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
    phone: ''
  })
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', insurance: '', birthday: '', address_line1: '', city: '', state: '', zip_code: '' })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [productNeeded, setProductNeeded] = useState('')
  const productNeededTimerRef = useRef(null)
  const [nppesSearch, setNppesSearch] = useState('')
  const [nppesResults, setNppesResults] = useState([])
  const [nppesLoading, setNppesLoading] = useState(false)
  const [showDoctorSelectModal, setShowDoctorSelectModal] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
  const [addLeadForm, setAddLeadForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    insurance: '', 
    birthday: '', 
    address_line1: '', 
    city: '', 
    state: '', 
    zip_code: '' 
  })
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [shippingClient, setShippingClient] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchLeads()
  }, [])

  useEffect(() => {
    if (selectedClient) {
      fetchDoctors(selectedClient.id)
      setProductNeeded(selectedClient.product_needed || '')
    }
    
    // Cleanup timer when client changes
    return () => {
      if (productNeededTimerRef.current) {
        clearTimeout(productNeededTimerRef.current)
      }
    }
  }, [selectedClient])

  const fetchLeads = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return
    }

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDoctors = async (clientId) => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDoctors(data || [])
    } catch (error) {
      console.error('Error fetching doctors:', error)
    }
  }

  const updateStage = async (leadId, newStage) => {
    if (!supabase) return
    setUpdating(true)

    try {
      const updates = { stage: newStage }
      if (newStage === 'qualified') {
        updates.qualified_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId)

      if (error) throw error
      await fetchLeads()
    } catch (error) {
      console.error('Error updating stage:', error)
    } finally {
      setUpdating(false)
    }
  }

  const updateClientDetails = async (leadId, field, value) => {
    if (!supabase) return

    try {
      // Update selected client immediately for better UX
      if (selectedClient?.id === leadId) {
        setSelectedClient({ ...selectedClient, [field]: value })
      }

      // Update in database
      const { error } = await supabase
        .from('leads')
        .update({ [field]: value })
        .eq('id', leadId)

      if (error) throw error
      
      // Update the leads array locally without re-fetching
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId ? { ...lead, [field]: value } : lead
        )
      )
    } catch (error) {
      console.error('Error updating client:', error)
      // Revert on error
      await fetchLeads()
    }
  }

  const handleProductNeededChange = (value) => {
    setProductNeeded(value)
    
    // Clear existing timer
    if (productNeededTimerRef.current) {
      clearTimeout(productNeededTimerRef.current)
    }
    
    // Set new timer to update after 500ms of no typing
    productNeededTimerRef.current = setTimeout(() => {
      if (selectedClient) {
        updateClientDetails(selectedClient.id, 'product_needed', value)
      }
    }, 500)
  }

  const searchNPPES = async () => {
    if (!nppesSearch.trim()) return
    
    setNppesLoading(true)
    setNppesResults([])

    try {
      // Use our backend API to avoid CORS issues
      const response = await fetch(
        `/api/nppes-search?q=${encodeURIComponent(nppesSearch.trim())}`
      )
      
      if (!response.ok) throw new Error('NPPES search failed')
      
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        setNppesResults(data.results)
      } else {
        setNppesResults([])
        alert('No results found. Try a different search term.')
      }
    } catch (error) {
      console.error('NPPES search error:', error)
      alert('Failed to search NPPES. Please try again.')
    } finally {
      setNppesLoading(false)
    }
  }

  const selectNppesDoctor = (result) => {
    const practiceLocation = result.addresses?.find(addr => addr.address_purpose === 'LOCATION') || result.addresses?.[0]
    const mailingAddress = result.addresses?.find(addr => addr.address_purpose === 'MAILING')
    const address = practiceLocation || mailingAddress || {}
    
    // Get fax from practice location or mailing address
    const fax = address.fax_number || ''
    const phone = address.telephone_number || ''
    
    // Format name
    const firstName = result.basic?.first_name || ''
    const lastName = result.basic?.last_name || ''
    const credential = result.basic?.credential || ''
    const fullName = credential ? `Dr. ${firstName} ${lastName}, ${credential}` : `Dr. ${firstName} ${lastName}`
    
    setDrForm({
      full_name: fullName.trim(),
      fax: fax,
      npi_number: result.number || '',
      address_line1: address.address_1 || '',
      city: address.city || '',
      state: address.state || '',
      zip_code: address.postal_code?.substring(0, 5) || '', // Remove +4 if present
      phone: phone
    })
    
    setNppesResults([])
    setNppesSearch('')
  }

  const handleAddDoctor = async (e) => {
    e.preventDefault()
    if (!supabase || !selectedClient) return

    try {
      const { error } = await supabase
        .from('doctors')
        .insert([{
          client_id: selectedClient.id,
          full_name: drForm.full_name,
          fax: drForm.fax,
          npi_number: drForm.npi_number,
          address_line1: drForm.address_line1,
          city: drForm.city,
          state: drForm.state,
          zip_code: drForm.zip_code,
          phone: drForm.phone
        }])

      if (error) throw error
      
      setDrForm({ 
        full_name: '', 
        fax: '', 
        npi_number: '',
        address_line1: '',
        city: '',
        state: '',
        zip_code: '',
        phone: ''
      })
      setShowAddDrModal(false)
      setNppesResults([])
      setNppesSearch('')
      await fetchDoctors(selectedClient.id)
    } catch (error) {
      console.error('Error adding doctor:', error)
      alert('Failed to add doctor')
    }
  }

  const handleDeleteDoctor = async (doctorId) => {
    if (!supabase || !selectedClient) return
    
    const confirmed = window.confirm('Are you sure you want to delete this doctor?')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', doctorId)

      if (error) throw error
      
      await fetchDoctors(selectedClient.id)
    } catch (error) {
      console.error('Error deleting doctor:', error)
      alert('Failed to delete doctor')
    }
  }

  const handleAddLead = async () => {
    if (!supabase) return
    
    // Basic validation
    if (!addLeadForm.name || !addLeadForm.email) {
      alert('Please provide at least a name and email')
      return
    }

    setUpdating(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: addLeadForm.name,
          email: addLeadForm.email,
          phone: addLeadForm.phone || null,
          insurance: addLeadForm.insurance || null,
          birthday: addLeadForm.birthday || null,
          address_line1: addLeadForm.address_line1 || null,
          city: addLeadForm.city || null,
          state: addLeadForm.state || null,
          zip_code: addLeadForm.zip_code || null,
          stage: 'new'
        }])
        .select()

      if (error) throw error

      // Refresh leads list
      await fetchLeads()
      
      // Reset form and close modal
      setAddLeadForm({ 
        name: '', 
        email: '', 
        phone: '', 
        insurance: '', 
        birthday: '', 
        address_line1: '', 
        city: '', 
        state: '', 
        zip_code: '' 
      })
      setShowAddLeadModal(false)
      
      alert('Lead added successfully!')
    } catch (error) {
      console.error('Error adding lead:', error)
      alert('Failed to add lead: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleMarkShipped = async (duration) => {
    if (!supabase || !shippingClient) return

    setUpdating(true)
    try {
      // Calculate the new shipping date based on duration
      const today = new Date()
      let shippingDuration = '1_month'
      
      if (duration === 'end_of_month') {
        // Calculate days until end of current month
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        shippingDuration = 'end_of_month'
      } else if (duration === '3_month') {
        shippingDuration = '3_month'
      } else {
        shippingDuration = '1_month'
      }

      const { error } = await supabase
        .from('leads')
        .update({ 
          date_shipped: today.toISOString().split('T')[0],
          shipping_duration: shippingDuration
        })
        .eq('id', shippingClient.id)

      if (error) throw error

      // Refresh leads list
      await fetchLeads()
      
      // Close modal
      setShowShippingModal(false)
      setShippingClient(null)
      
      alert('Shipment marked successfully!')
    } catch (error) {
      console.error('Error marking shipment:', error)
      alert('Failed to mark shipment: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleGeneratePhysicianOrder = async (doctor = null) => {
    if (!selectedClient) return

    // If no doctor specified and multiple doctors exist, show selection modal
    if (!doctor && doctors.length > 1) {
      setShowDoctorSelectModal(true)
      return
    }

    // Use the provided doctor or the first one if only one exists
    const selectedDoctor = doctor || doctors[0]

    setGeneratingPDF(true)
    try {
      // Generate the document
      const docBlob = await generatePhysicianOrder(selectedClient, selectedDoctor)
      
      // Create filename with patient name and date
      const patientName = selectedClient.name.replace(/[^a-z0-9]/gi, '_')
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `Physician_Order_${patientName}_${dateStr}.docx`
      
      // Download the document
      downloadPDF(docBlob, fileName)
      
      // Close modal if open
      setShowDoctorSelectModal(false)
      
      // Show success message
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error generating physician order:', error)
      alert('Failed to generate physician order: ' + error.message)
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleEditClient = async (e) => {
    e.preventDefault()
    if (!supabase || !selectedClient) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          insurance: editForm.insurance,
          birthday: editForm.birthday || null,
          address_line1: editForm.address_line1,
          city: editForm.city,
          state: editForm.state,
          zip_code: editForm.zip_code
        })
        .eq('id', selectedClient.id)

      if (error) throw error
      
      setShowEditClientModal(false)
      await fetchLeads()
      setSelectedClient({ ...selectedClient, ...editForm })
    } catch (error) {
      console.error('Error updating client:', error)
      alert('Failed to update client')
    }
  }

  const openEditModal = () => {
    setEditForm({
      name: selectedClient.name,
      email: selectedClient.email,
      phone: selectedClient.phone,
      insurance: selectedClient.insurance,
      birthday: selectedClient.birthday || '',
      address_line1: selectedClient.address_line1 || '',
      city: selectedClient.city || '',
      state: selectedClient.state || '',
      zip_code: selectedClient.zip_code || ''
    })
    setShowEditClientModal(true)
  }

  const handleSyncFromSheets = async () => {
    setSyncing(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/sync-google-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to sync from Google Sheets')
      }

      const result = await response.json()
      setSyncResult(result)
      await fetchLeads()

      // Clear result message after 30 seconds
      setTimeout(() => {
        setSyncResult(null)
      }, 30000)
    } catch (error) {
      console.error('Sync error:', error)
      setSyncResult({ error: error.message || 'Failed to sync. Please try again.' })
    } finally {
      setSyncing(false)
    }
  }

  const getStageColor = (stage) => {
    const colors = {
      new: 'bg-gray-100 text-gray-800',
      called: 'bg-blue-100 text-blue-800',
      reached: 'bg-green-100 text-green-800',
      unqualified: 'bg-red-100 text-red-800',
      qualified: 'bg-purple-100 text-purple-800'
    }
    return colors[stage] || colors.new
  }

  // Filter leads based on search query
  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query) ||
      lead.insurance?.toLowerCase().includes(query)
    )
  })

  const allLeads = activeTab === 'leads' ? filteredLeads : leads // Show filtered leads in Leads tab
  const qualifiedLeads = leads.filter(lead => lead.stage === 'qualified')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSyncFromSheets}
              disabled={syncing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              {syncing ? 'Syncing...' : '↻ Sync from Google Sheets'}
            </button>
            <span className="text-gray-600 text-sm">{userEmail}</span>
            <button
              onClick={onLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Sync Result Notification */}
      {syncResult && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          {syncResult.error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {syncResult.error}
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-400 text-green-800 px-6 py-4 rounded-lg mb-4 text-lg font-semibold">
              ✓ Successfully imported {syncResult.added} new leads from Google Sheets! ({syncResult.skipped} duplicates skipped)
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'leads'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('clients')
              setSelectedClient(null)
              setSearchQuery('') // Clear search when switching tabs
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'clients'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Clients ({qualifiedLeads.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('calendar')
              setSearchQuery('') // Clear search when switching tabs
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'calendar'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Calendar
          </button>
        </div>

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Search and Add Lead Controls */}
            <div className="p-4 border-b border-gray-200 flex gap-3 items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search leads by name, email, phone, or insurance..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddLeadModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
              >
                + Add Lead
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[18%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="w-[13%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="w-[22%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="w-[27%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Insurance Provider
                    </th>
                    <th className="w-[20%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allLeads.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        No leads yet
                      </td>
                    </tr>
                  ) : (
                    allLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm font-medium text-gray-900 truncate">
                          {lead.name}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 truncate">
                          {lead.phone}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 truncate">
                          {lead.email}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 truncate">
                          {lead.insurance}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <select
                            value={lead.stage}
                            onChange={(e) => updateStage(lead.id, e.target.value)}
                            disabled={updating}
                            className={`w-full px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(lead.stage)} border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          >
                            <option value="new">New</option>
                            <option value="called">Called</option>
                            <option value="reached">Reached</option>
                            <option value="unqualified">Unqualified</option>
                            <option value="qualified">Qualified</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Clients List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Client List</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {qualifiedLeads.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No qualified clients yet
                  </div>
                ) : (
                  qualifiedLeads.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedClient?.id === client.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-semibold text-gray-900">
                        {client.name}
                        {(!client.address_line1 || !client.birthday) && (
                          <span className="ml-2 text-red-600 text-sm font-medium">
                            {!client.address_line1 && !client.birthday ? 'Address & DOB Needed!' : 
                             !client.address_line1 ? 'Address Needed!' : 'DOB Needed!'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{client.email}</div>
                      <div className="text-sm text-gray-600">{client.phone}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Client Details */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Client Details</h2>
              </div>
              {selectedClient ? (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedClient.name}
                    </h3>
                    <button
                      onClick={openEditModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Two Column Layout for Basic Info */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Column - Contact & Address */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <div className="text-gray-900">{selectedClient.email}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <div className="text-gray-900">{selectedClient.phone}</div>
                      </div>

                      {/* Patient Address */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Patient Address
                        </label>
                        {selectedClient.address_line1 ? (
                          <div className="text-gray-900">
                            <div>{selectedClient.address_line1}</div>
                            {(selectedClient.city || selectedClient.state || selectedClient.zip_code) && (
                              <div>
                                {selectedClient.city}{selectedClient.city && (selectedClient.state || selectedClient.zip_code) ? ', ' : ''}
                                {selectedClient.state} {selectedClient.zip_code}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-red-600 text-sm font-medium">Not provided</div>
                        )}
                      </div>
                    </div>

                    {/* Right Column - Business Info */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date of Birth
                        </label>
                        {selectedClient.birthday ? (
                          <div className="text-gray-900">
                            {new Date(selectedClient.birthday).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="text-red-600 text-sm font-medium">Not provided</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Insurance Provider
                        </label>
                        <div className="text-gray-900">{selectedClient.insurance}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date Qualified
                        </label>
                        <div className="text-gray-900">
                          {selectedClient.qualified_at 
                            ? new Date(selectedClient.qualified_at).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Width Fields */}
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Needed
                      </label>
                      <textarea
                        value={productNeeded}
                        onChange={(e) => handleProductNeededChange(e.target.value)}
                        placeholder="e.g., MiniMed Quick-set, Omnipod DASH"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Shipped
                      </label>
                      <input
                        type="date"
                        value={selectedClient.date_shipped || ''}
                        onChange={(e) => updateClientDetails(selectedClient.id, 'date_shipped', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shipping Duration
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={`shipping_duration_${selectedClient.id}`}
                            value="1_month"
                            checked={selectedClient.shipping_duration === '1_month'}
                            onChange={(e) => updateClientDetails(selectedClient.id, 'shipping_duration', e.target.value)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                          />
                          <span className="ml-2 text-sm text-gray-700">1 Month</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={`shipping_duration_${selectedClient.id}`}
                            value="3_month"
                            checked={selectedClient.shipping_duration === '3_month'}
                            onChange={(e) => updateClientDetails(selectedClient.id, 'shipping_duration', e.target.value)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                          />
                          <span className="ml-2 text-sm text-gray-700">3 Months</span>
                        </label>
                      </div>
                    </div>

                    {/* Doctors Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Doctors
                        </label>
                        <button
                          onClick={() => setShowAddDrModal(true)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Add DR
                        </button>
                      </div>
                      {doctors.length === 0 ? (
                        <div className="text-sm text-gray-500 italic">No doctors added yet</div>
                      ) : (
                        <div className="space-y-3">
                          {doctors.map((doctor) => (
                            <div key={doctor.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                              <button
                                onClick={() => handleDeleteDoctor(doctor.id)}
                                className="absolute top-3 right-3 text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-full transition-colors"
                                title="Delete doctor"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <div className="font-semibold text-gray-900 text-lg mb-2 pr-8">{doctor.full_name}</div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-600">
                                  <span className="font-medium">NPI:</span> {doctor.npi_number}
                                </div>
                                {doctor.phone && (
                                  <div className="text-gray-600">
                                    <span className="font-medium">Phone:</span> {doctor.phone}
                                  </div>
                                )}
                                <div className="text-gray-600 col-span-2">
                                  <span className="font-medium">Fax:</span> {doctor.fax}
                                </div>
                              </div>
                              {doctor.address_line1 && (
                                <div className="mt-3 pt-3 border-t border-gray-300 text-sm text-gray-600">
                                  <div className="font-medium text-gray-700 mb-1">Practice Address:</div>
                                  <div>{doctor.address_line1}</div>
                                  {(doctor.city || doctor.state || doctor.zip_code) && (
                                    <div>
                                      {doctor.city}{doctor.city && (doctor.state || doctor.zip_code) ? ', ' : ''}
                                      {doctor.state} {doctor.zip_code}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Generate Physician Order Button */}
                    <div className="border-t pt-4">
                      <button
                        onClick={() => handleGeneratePhysicianOrder()}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={doctors.length === 0 || !selectedClient.address_line1 || !selectedClient.birthday || generatingPDF}
                      >
                        {generatingPDF ? (
                          <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
                            </svg>
                            Generate Physician Order
                          </>
                        )}
                      </button>
                      {(doctors.length === 0 || !selectedClient.address_line1 || !selectedClient.birthday) && (
                        <p className="text-sm text-gray-500 mt-2 text-center">
                          {doctors.length === 0 ? 'Add a doctor to generate physician order' : 
                           !selectedClient.address_line1 && !selectedClient.birthday ? 'Patient address and DOB required' :
                           !selectedClient.address_line1 ? 'Patient address required' :
                           'Patient DOB required'}
                        </p>
                      )}
                    </div>

                    {selectedClient.notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <div className="text-gray-900 text-sm bg-gray-50 p-3 rounded">
                          {selectedClient.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  Select a client to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Shipping Calendar</h2>
              
              {/* Month Navigation */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11)
                      setSelectedYear(selectedYear - 1)
                    } else {
                      setSelectedMonth(selectedMonth - 1)
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Previous month"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                </button>
                
                <div className="text-center min-w-[200px]">
                  <div className="text-xl font-bold text-gray-900">
                    {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0)
                      setSelectedYear(selectedYear + 1)
                    } else {
                      setSelectedMonth(selectedMonth + 1)
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Next month"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
                
                <button
                  onClick={() => {
                    setSelectedMonth(new Date().getMonth())
                    setSelectedYear(new Date().getFullYear())
                  }}
                  className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  Today
                </button>
              </div>
            </div>
            
            {(() => {
              // Calculate upcoming shipping dates for clients with date_shipped and shipping_duration
              const upcomingShipments = qualifiedLeads
                .filter(client => client.date_shipped && client.shipping_duration)
                .map(client => {
                  const shippedDate = new Date(client.date_shipped)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const shippedDateOnly = new Date(shippedDate)
                  shippedDateOnly.setHours(0, 0, 0, 0)
                  
                  let nextShipDate
                  
                  // If the shipped date is in the future or today, use it as the next ship date
                  if (shippedDateOnly >= today) {
                    nextShipDate = shippedDateOnly
                  } else {
                    // If shipped date is in the past, calculate next shipment
                    const monthsToAdd = client.shipping_duration === '3_month' ? 3 : 1
                    nextShipDate = new Date(shippedDateOnly)
                    nextShipDate.setMonth(nextShipDate.getMonth() + monthsToAdd)
                  }
                  
                  return {
                    ...client,
                    nextShipDate,
                    daysUntilShip: Math.ceil((nextShipDate - today) / (1000 * 60 * 60 * 24)),
                    isFirstShipment: shippedDateOnly >= today
                  }
                })
                .sort((a, b) => a.nextShipDate - b.nextShipDate)

              // Filter shipments for the selected month
              const shipmentsInSelectedMonth = upcomingShipments.filter(shipment => {
                const shipDate = shipment.nextShipDate
                return shipDate.getMonth() === selectedMonth && shipDate.getFullYear() === selectedYear
              })

              // Calculate summary stats (for all upcoming shipments, not just selected month)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const overdue = upcomingShipments.filter(s => s.daysUntilShip < 0).length
              const dueThisWeek = upcomingShipments.filter(s => s.daysUntilShip >= 0 && s.daysUntilShip <= 7).length
              const dueThisMonth = upcomingShipments.filter(s => {
                const currentMonth = today.getMonth()
                const currentYear = today.getFullYear()
                return s.nextShipDate.getMonth() === currentMonth && 
                       s.nextShipDate.getFullYear() === currentYear &&
                       s.daysUntilShip >= 0
              }).length

              return (
                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-red-900 font-semibold text-sm mb-1">Overdue</div>
                      <div className="text-3xl font-bold text-red-600">{overdue}</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-yellow-900 font-semibold text-sm mb-1">Due This Week</div>
                      <div className="text-3xl font-bold text-yellow-600">{dueThisWeek}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-blue-900 font-semibold text-sm mb-1">Due This Month</div>
                      <div className="text-3xl font-bold text-blue-600">{dueThisMonth}</div>
                    </div>
                  </div>

                  {/* Calendar Grid for Selected Month */}
                  {shipmentsInSelectedMonth.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <p className="text-lg">No shipments scheduled for this month.</p>
                      <p className="text-sm mt-2">Use the navigation to view other months.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shipmentsInSelectedMonth.map(shipment => {
                            const isOverdue = shipment.daysUntilShip < 0
                            const isDueSoon = shipment.daysUntilShip >= 0 && shipment.daysUntilShip <= 7
                            
                            return (
                              <div 
                                key={shipment.id}
                                className={`border-2 rounded-lg p-4 hover:shadow-md transition-shadow ${
                                  isOverdue ? 'border-red-300 bg-red-50' :
                                  isDueSoon ? 'border-yellow-300 bg-yellow-50' :
                                  shipment.isFirstShipment ? 'border-green-300 bg-green-50' :
                                  'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="font-semibold text-gray-900 text-lg">{shipment.name}</div>
                                  {isOverdue && (
                                    <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full font-semibold">
                                      OVERDUE
                                    </span>
                                  )}
                                  {isDueSoon && !isOverdue && (
                                    <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full font-semibold">
                                      SOON
                                    </span>
                                  )}
                                  {shipment.isFirstShipment && !isDueSoon && !isOverdue && (
                                    <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full font-semibold">
                                      NEW
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-1 text-sm">
                                  <div className="text-gray-600">
                                    <span className="font-medium">
                                      {shipment.isFirstShipment ? 'First Shipment:' : 'Due:'}
                                    </span>{' '}
                                    {shipment.nextShipDate.toLocaleDateString('en-US', { 
                                      month: 'numeric', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </div>
                                  {!shipment.isFirstShipment && (
                                    <div className="text-gray-600">
                                      <span className="font-medium">Last Shipped:</span>{' '}
                                      {new Date(shipment.date_shipped).toLocaleDateString('en-US', { 
                                        month: 'numeric', 
                                        day: 'numeric', 
                                        year: 'numeric' 
                                      })}
                                    </div>
                                  )}
                                  <div className="text-gray-600">
                                    <span className="font-medium">Duration:</span>{' '}
                                    {shipment.shipping_duration === '3_month' ? '3 Months' : '1 Month'}
                                  </div>
                                  {shipment.product_needed && (
                                    <div className="text-gray-600 mt-2 pt-2 border-t border-gray-200">
                                      <span className="font-medium">Product:</span>{' '}
                                      {shipment.product_needed}
                                    </div>
                                  )}
                                  <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                      {shipment.isFirstShipment 
                                        ? `${shipment.daysUntilShip} days until first shipment`
                                        : `${Math.abs(shipment.daysUntilShip)} days ${isOverdue ? 'overdue' : 'until due'}`
                                      }
                                    </span>
                                    <button
                                      onClick={() => {
                                        setShippingClient(shipment)
                                        setShowShippingModal(true)
                                      }}
                                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-semibold transition-colors"
                                    >
                                      ✓ Shipped
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Add Doctor Modal */}
      {showAddDrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Doctor</h3>
            
            {/* NPPES Search */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                🔍 Search NPPES Registry
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nppesSearch}
                  onChange={(e) => setNppesSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), searchNPPES())}
                  placeholder="Enter doctor name or NPI number"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={searchNPPES}
                  disabled={nppesLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium"
                >
                  {nppesLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              
              {/* NPPES Results */}
              {nppesResults.length > 0 && (
                <div className="mt-3 max-h-[500px] overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg">
                  {nppesResults.map((result, index) => {
                    const practiceAddr = result.addresses?.find(a => a.address_purpose === 'LOCATION') || result.addresses?.[0]
                    return (
                      <div
                        key={index}
                        onClick={() => selectNppesDoctor(result)}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                      >
                        <div className="font-semibold text-gray-900">
                          {result.basic?.first_name} {result.basic?.last_name}
                          {result.basic?.credential && `, ${result.basic.credential}`}
                        </div>
                        <div className="text-sm text-gray-600">NPI: {result.number}</div>
                        {practiceAddr && (
                          <div className="text-sm text-gray-600">
                            {practiceAddr.address_1 && <div>{practiceAddr.address_1}</div>}
                            <div>{practiceAddr.city}, {practiceAddr.state} {practiceAddr.postal_code?.substring(0, 5)}</div>
                          </div>
                        )}
                        {result.taxonomies?.[0]?.desc && (
                          <div className="text-xs text-gray-500 mt-1">
                            {result.taxonomies[0].desc}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={drForm.full_name}
                  onChange={(e) => setDrForm({ ...drForm, full_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dr. John Smith"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NPI Number *
                  </label>
                  <input
                    type="text"
                    value={drForm.npi_number}
                    onChange={(e) => setDrForm({ ...drForm, npi_number: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={drForm.phone}
                    onChange={(e) => setDrForm({ ...drForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="555-123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fax Number *
                </label>
                <input
                  type="text"
                  value={drForm.fax}
                  onChange={(e) => setDrForm({ ...drForm, fax: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="555-123-4567"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Practice Address</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={drForm.address_line1}
                      onChange={(e) => setDrForm({ ...drForm, address_line1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123 Medical Center Dr"
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={drForm.city}
                        onChange={(e) => setDrForm({ ...drForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="City"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={drForm.state}
                        onChange={(e) => setDrForm({ ...drForm, state: e.target.value.toUpperCase() })}
                        maxLength="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CA"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={drForm.zip_code}
                        onChange={(e) => setDrForm({ ...drForm, zip_code: e.target.value })}
                        maxLength="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDrModal(false)
                    setDrForm({ 
                      full_name: '', 
                      fax: '', 
                      npi_number: '',
                      address_line1: '',
                      city: '',
                      state: '',
                      zip_code: '',
                      phone: ''
                    })
                    setNppesResults([])
                    setNppesSearch('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md"
                >
                  Add Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Lead</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleAddLead(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={addLeadForm.name}
                  onChange={(e) => setAddLeadForm({ ...addLeadForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={addLeadForm.email}
                  onChange={(e) => setAddLeadForm({ ...addLeadForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={addLeadForm.phone}
                  onChange={(e) => setAddLeadForm({ ...addLeadForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="555-123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={addLeadForm.insurance}
                  onChange={(e) => setAddLeadForm({ ...addLeadForm, insurance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Blue Cross"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={addLeadForm.birthday}
                  onChange={(e) => setAddLeadForm({ ...addLeadForm, birthday: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Address (Optional)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={addLeadForm.address_line1}
                      onChange={(e) => setAddLeadForm({ ...addLeadForm, address_line1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123 Main St"
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={addLeadForm.city}
                        onChange={(e) => setAddLeadForm({ ...addLeadForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="City"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={addLeadForm.state}
                        onChange={(e) => setAddLeadForm({ ...addLeadForm, state: e.target.value.toUpperCase() })}
                        maxLength="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CA"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={addLeadForm.zip_code}
                        onChange={(e) => setAddLeadForm({ ...addLeadForm, zip_code: e.target.value })}
                        maxLength="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLeadModal(false)
                    setAddLeadForm({ 
                      name: '', 
                      email: '', 
                      phone: '', 
                      insurance: '', 
                      birthday: '', 
                      address_line1: '', 
                      city: '', 
                      state: '', 
                      zip_code: '' 
                    })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md"
                >
                  {updating ? 'Adding...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Client</h3>
            <form onSubmit={handleEditClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={editForm.insurance}
                  onChange={(e) => setEditForm({ ...editForm, insurance: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editForm.birthday}
                  onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Patient Address</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={editForm.address_line1}
                      onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123 Main St"
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="City"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={editForm.state}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value.toUpperCase() })}
                        maxLength="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CA"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={editForm.zip_code}
                        onChange={(e) => setEditForm({ ...editForm, zip_code: e.target.value })}
                        maxLength="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditClientModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Selection Modal */}
      {showDoctorSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Select Doctor</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which doctor to use for the physician order:
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
              {doctors.map((doctor) => (
                <button
                  key={doctor.id}
                  onClick={() => handleGeneratePhysicianOrder(doctor)}
                  disabled={generatingPDF}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-semibold text-gray-900">{doctor.full_name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>NPI: {doctor.npi_number}</div>
                    {doctor.phone && <div>Phone: {doctor.phone}</div>}
                    {doctor.fax && <div>Fax: {doctor.fax}</div>}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDoctorSelectModal(false)}
                disabled={generatingPDF}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md text-center shadow-xl">
            <div className="mb-4">
              <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">PHY Order Created!</h3>
            <p className="text-gray-600 text-sm mb-6">
              To fax: Open the document in Word, then File → Save As → PDF
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Shipping Duration Modal */}
      {showShippingModal && shippingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Mark as Shipped</h3>
            <p className="text-gray-600 mb-6">
              Confirm shipment for <span className="font-semibold">{shippingClient.name}</span>. How long until the next shipment?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleMarkShipped('end_of_month')}
                disabled={updating}
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Till End of Month
              </button>
              <button
                onClick={() => handleMarkShipped('1_month')}
                disabled={updating}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                1 Month
              </button>
              <button
                onClick={() => handleMarkShipped('3_month')}
                disabled={updating}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                3 Months
              </button>
              <button
                onClick={() => {
                  setShowShippingModal(false)
                  setShippingClient(null)
                }}
                disabled={updating}
                className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
