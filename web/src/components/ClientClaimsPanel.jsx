import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const STATUS_META = {
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' },
  denied: { label: 'Denied', className: 'bg-rose-100 text-rose-800' },
  appealed: { label: 'Appealed', className: 'bg-purple-100 text-purple-800' }
}

const EMPTY_FORM = {
  claim_number: '',
  date_of_service: '',
  record_type: 'claim',
  billed_amount: '',
  allowed_amount: '',
  paid_amount: '',
  patient_responsibility: '',
  status: 'submitted',
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

export default function ClientClaimsPanel({ client }) {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingClaimId, setEditingClaimId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchClaims = async () => {
    if (!supabase || !client?.id) return
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('client_claims')
      .select('*')
      .eq('lead_id', client.id)
      .order('date_of_service', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Apply the client_claims migration (add-client-claims-eobs.sql) to enable this tab.')
      setClaims([])
    } else {
      setClaims(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchClaims()
    setShowForm(false)
    setEditingClaimId(null)
    setForm(EMPTY_FORM)
    setFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  const openAddForm = () => {
    setEditingClaimId(null)
    setForm(EMPTY_FORM)
    setFile(null)
    setShowForm(true)
  }

  const openEditForm = (claim) => {
    setEditingClaimId(claim.id)
    setForm({
      claim_number: claim.claim_number || '',
      date_of_service: claim.date_of_service || '',
      record_type: claim.record_type || 'claim',
      billed_amount: claim.billed_amount ?? '',
      allowed_amount: claim.allowed_amount ?? '',
      paid_amount: claim.paid_amount ?? '',
      patient_responsibility: claim.patient_responsibility ?? '',
      status: claim.status || 'submitted',
      notes: claim.notes || ''
    })
    setFile(null)
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
      let fileUrl = null
      let fileName = null

      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB')
        }

        const fileExt = file.name.split('.').pop()
        const filePath = `${client.id}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase
          .storage
          .from('client-claims')
          .upload(filePath, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase
          .storage
          .from('client-claims')
          .getPublicUrl(filePath)

        fileUrl = publicUrl
        fileName = file.name
      }

      const payload = {
        lead_id: client.id,
        claim_number: form.claim_number.trim() || null,
        date_of_service: form.date_of_service || null,
        record_type: form.record_type,
        billed_amount: form.billed_amount === '' ? null : Number(form.billed_amount),
        allowed_amount: form.allowed_amount === '' ? null : Number(form.allowed_amount),
        paid_amount: form.paid_amount === '' ? null : Number(form.paid_amount),
        patient_responsibility: form.patient_responsibility === '' ? null : Number(form.patient_responsibility),
        status: form.status,
        notes: form.notes.trim() || null,
        ...(fileUrl ? { file_url: fileUrl, file_name: fileName } : {})
      }

      if (editingClaimId) {
        const { error: updateError } = await supabase
          .from('client_claims')
          .update(payload)
          .eq('id', editingClaimId)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('client_claims')
          .insert(payload)
        if (insertError) throw insertError
      }

      setShowForm(false)
      setEditingClaimId(null)
      setForm(EMPTY_FORM)
      setFile(null)
      await fetchClaims()
    } catch (submitError) {
      setError(submitError.message || 'Failed to save claim.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (claim) => {
    if (!supabase) return
    if (!confirm('Delete this claim/EOB record? This cannot be undone.')) return

    const { error: deleteError } = await supabase
      .from('client_claims')
      .delete()
      .eq('id', claim.id)

    if (deleteError) {
      alert(deleteError.message || 'Failed to delete claim.')
      return
    }

    await fetchClaims()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Claims & EOBs</label>
        <button
          onClick={openAddForm}
          className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 font-medium"
        >
          + Add Claim / EOB
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Record Type</label>
              <select
                value={form.record_type}
                onChange={(e) => handleFormChange('record_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="claim">Claim</option>
                <option value="eob">EOB</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => handleFormChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Claim Number</label>
              <input
                type="text"
                value={form.claim_number}
                onChange={(e) => handleFormChange('claim_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Patient Responsibility ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.patient_responsibility}
                onChange={(e) => handleFormChange('patient_responsibility', e.target.value)}
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Upload File (claim form, EOB PDF, or image){editingClaimId ? ' — leave empty to keep existing file' : ''}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingClaimId(null) }}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm"
            >
              {saving ? 'Saving...' : editingClaimId ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading claims...</div>
      ) : claims.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md text-center">
          No claims or EOBs on file yet. Click "+ Add Claim / EOB" to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {claims.map((claim) => (
            <div key={claim.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm uppercase">{claim.record_type}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_META[claim.status]?.className || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_META[claim.status]?.label || claim.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {claim.claim_number ? `Claim #${claim.claim_number} • ` : ''}Date of Service: {formatDate(claim.date_of_service)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {claim.file_url && (
                    <a href={claim.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-medium">
                      View File
                    </a>
                  )}
                  <button onClick={() => openEditForm(claim)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(claim)} className="text-red-600 hover:text-red-700 text-xs font-medium">
                    Delete
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                <div>
                  <div className="text-gray-500">Billed</div>
                  <div className="text-gray-900 font-medium">{formatCurrency(claim.billed_amount)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Allowed</div>
                  <div className="text-gray-900 font-medium">{formatCurrency(claim.allowed_amount)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Paid</div>
                  <div className="text-gray-900 font-medium">{formatCurrency(claim.paid_amount)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Patient Resp.</div>
                  <div className="text-gray-900 font-medium">{formatCurrency(claim.patient_responsibility)}</div>
                </div>
              </div>
              {claim.notes && (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">{claim.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
