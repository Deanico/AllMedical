import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const EMPTY_FORM = {
  date_of_service: '',
  hcpcs_code: '',
  billed_amount: '',
  allowed_amount: '',
  paid_amount: '',
  deductible_amount: '',
  notes: ''
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? `$${numberValue.toFixed(2)}` : '—'
}

const formatDate = (value) => {
  if (!value) return 'N/A'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const sumField = (records, field) =>
  records.reduce((total, record) => total + (Number(record[field]) || 0), 0)

export default function ClientBillingPanel({ client }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchRecords = async () => {
    if (!supabase || !client?.id) return
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('client_billing_records')
      .select('*')
      .eq('lead_id', client.id)
      .order('date_of_service', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Apply the client_billing_records migration (add-client-billing-records.sql) to enable this tab.')
      setRecords([])
    } else {
      setRecords(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRecords()
    setShowForm(false)
    setEditingRecordId(null)
    setForm(EMPTY_FORM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  const openAddForm = () => {
    setEditingRecordId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (record) => {
    setEditingRecordId(record.id)
    setForm({
      date_of_service: record.date_of_service || '',
      hcpcs_code: record.hcpcs_code || '',
      billed_amount: record.billed_amount ?? '',
      allowed_amount: record.allowed_amount ?? '',
      paid_amount: record.paid_amount ?? '',
      deductible_amount: record.deductible_amount ?? '',
      notes: record.notes || ''
    })
    setShowForm(true)
  }

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase || !client?.id) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        lead_id: client.id,
        date_of_service: form.date_of_service || null,
        hcpcs_code: form.hcpcs_code.trim() || null,
        billed_amount: form.billed_amount === '' ? null : Number(form.billed_amount),
        allowed_amount: form.allowed_amount === '' ? null : Number(form.allowed_amount),
        paid_amount: form.paid_amount === '' ? null : Number(form.paid_amount),
        deductible_amount: form.deductible_amount === '' ? null : Number(form.deductible_amount),
        notes: form.notes.trim() || null
      }

      if (editingRecordId) {
        const { error: updateError } = await supabase
          .from('client_billing_records')
          .update(payload)
          .eq('id', editingRecordId)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('client_billing_records')
          .insert(payload)
        if (insertError) throw insertError
      }

      setShowForm(false)
      setEditingRecordId(null)
      setForm(EMPTY_FORM)
      await fetchRecords()
    } catch (submitError) {
      setError(submitError.message || 'Failed to save billing record.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record) => {
    if (!supabase) return
    if (!confirm('Delete this billing record? This cannot be undone.')) return

    const { error: deleteError } = await supabase
      .from('client_billing_records')
      .delete()
      .eq('id', record.id)

    if (deleteError) {
      alert(deleteError.message || 'Failed to delete billing record.')
      return
    }

    await fetchRecords()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Billing Ledger</label>
        <button
          onClick={openAddForm}
          className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 font-medium"
        >
          + Add Billing Record
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-gray-50 rounded-md p-2">
            <div className="text-xs text-gray-500">Total Billed</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(sumField(records, 'billed_amount'))}</div>
          </div>
          <div className="bg-gray-50 rounded-md p-2">
            <div className="text-xs text-gray-500">Total Allowed</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(sumField(records, 'allowed_amount'))}</div>
          </div>
          <div className="bg-gray-50 rounded-md p-2">
            <div className="text-xs text-gray-500">Total Paid</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(sumField(records, 'paid_amount'))}</div>
          </div>
          <div className="bg-gray-50 rounded-md p-2">
            <div className="text-xs text-gray-500">Total Deductible</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(sumField(records, 'deductible_amount'))}</div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date of Service</label>
              <input
                type="date"
                value={form.date_of_service}
                onChange={(e) => handleFormChange('date_of_service', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">HCPCS Code</label>
              <input
                type="text"
                value={form.hcpcs_code}
                onChange={(e) => handleFormChange('hcpcs_code', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="e.g. A4253"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Billed Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.billed_amount}
                onChange={(e) => handleFormChange('billed_amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Allowed Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.allowed_amount}
                onChange={(e) => handleFormChange('allowed_amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.paid_amount}
                onChange={(e) => handleFormChange('paid_amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Deductible Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.deductible_amount}
                onChange={(e) => handleFormChange('deductible_amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingRecordId(null) }}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm"
            >
              {saving ? 'Saving...' : editingRecordId ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading billing records...</div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md text-center">
          No billing records on file yet. Click "+ Add Billing Record" to add one.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-2 py-2 text-left">Date of Service</th>
                <th className="px-2 py-2 text-left">HCPCS</th>
                <th className="px-2 py-2 text-right">Billed</th>
                <th className="px-2 py-2 text-right">Allowed</th>
                <th className="px-2 py-2 text-right">Paid</th>
                <th className="px-2 py-2 text-right">Deductible</th>
                <th className="px-2 py-2 text-left">Notes</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-900">{formatDate(record.date_of_service)}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-900 font-medium">{record.hcpcs_code || '—'}</td>
                  <td className="px-2 py-2 text-right text-gray-900">{formatCurrency(record.billed_amount)}</td>
                  <td className="px-2 py-2 text-right text-gray-900">{formatCurrency(record.allowed_amount)}</td>
                  <td className="px-2 py-2 text-right text-gray-900">{formatCurrency(record.paid_amount)}</td>
                  <td className="px-2 py-2 text-right text-gray-900">{formatCurrency(record.deductible_amount)}</td>
                  <td className="px-2 py-2 text-gray-600 max-w-[160px] truncate" title={record.notes || ''}>{record.notes || '—'}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openEditForm(record)} className="text-blue-600 hover:text-blue-700 font-medium mr-2">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(record)} className="text-red-600 hover:text-red-700 font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
