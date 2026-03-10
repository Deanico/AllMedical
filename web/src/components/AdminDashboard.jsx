import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminDashboard({ userEmail, onLogout }) {
  const [activeTab, setActiveTab] = useState('leads')
  const [leads, setLeads] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showAddDrModal, setShowAddDrModal] = useState(false)
  const [showEditClientModal, setShowEditClientModal] = useState(false)
  const [drForm, setDrForm] = useState({ full_name: '', fax: '', npi_number: '' })
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', insurance: '' })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  useEffect(() => {
    if (selectedClient) {
      fetchDoctors(selectedClient.id)
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
      const { error } = await supabase
        .from('leads')
        .update({ [field]: value })
        .eq('id', leadId)

      if (error) throw error
      await fetchLeads()
      
      // Update selected client if it's the one being edited
      if (selectedClient?.id === leadId) {
        setSelectedClient({ ...selectedClient, [field]: value })
      }
    } catch (error) {
      console.error('Error updating client:', error)
    }
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
          npi_number: drForm.npi_number
        }])

      if (error) throw error
      
      setDrForm({ full_name: '', fax: '', npi_number: '' })
      setShowAddDrModal(false)
      await fetchDoctors(selectedClient.id)
    } catch (error) {
      console.error('Error adding doctor:', error)
      alert('Failed to add doctor')
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
          insurance: editForm.insurance
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
      insurance: selectedClient.insurance
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

  const allLeads = leads // Show ALL leads in Leads tab
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
            Leads ({allLeads.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('clients')
              setSelectedClient(null)
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'clients'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Clients ({qualifiedLeads.length})
          </button>
        </div>

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
                      <div className="font-semibold text-gray-900">{client.name}</div>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Needed
                      </label>
                      <textarea
                        value={selectedClient.product_needed || ''}
                        onChange={(e) => updateClientDetails(selectedClient.id, 'product_needed', e.target.value)}
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
                        <div className="space-y-2">
                          {doctors.map((doctor) => (
                            <div key={doctor.id} className="bg-gray-50 p-3 rounded">
                              <div className="font-medium text-gray-900">{doctor.full_name}</div>
                              <div className="text-sm text-gray-600">Fax: {doctor.fax}</div>
                              <div className="text-sm text-gray-600">NPI: {doctor.npi_number}</div>
                            </div>
                          ))}
                        </div>
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
      </div>

      {/* Add Doctor Modal */}
      {showAddDrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Doctor</h3>
            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fax Number
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NPI Number
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
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDrModal(false)
                    setDrForm({ full_name: '', fax: '', npi_number: '' })
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

      {/* Edit Client Modal */}
      {showEditClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
              <div className="flex gap-3 justify-end">
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
    </div>
  )
}
