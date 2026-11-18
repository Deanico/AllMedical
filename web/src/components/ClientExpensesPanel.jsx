import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const emptyForm = { description: '', amount: '', date: '', expense_type: 'regular' }

export default function ClientExpensesPanel({ client, expenses, error, onRefresh }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const reset = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    setFormError('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!supabase || !client?.id) return
    const description = form.description.trim()
    if (!description || !form.date || form.amount === '' || !Number.isFinite(Number(form.amount)) || Number(form.amount) < 0) {
      setFormError('Enter a description, date, and valid non-negative amount.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = { ...form, description, amount: Number(form.amount), lead_id: client.id, category: 'Patient Expense' }
      const query = editingId
        ? supabase.from('expenses').update(payload).eq('id', editingId).eq('lead_id', client.id)
        : supabase.from('expenses').insert(payload)
      const { error: saveError } = await query.select('id').single()
      if (saveError) throw saveError
      reset()
      await onRefresh()
    } catch (saveError) {
      setFormError(saveError.message || 'Failed to save expense.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (expense) => {
    if (!window.confirm('Delete this patient expense?')) return
    setFormError('')
    try {
      const { error: deleteError } = await supabase.from('expenses').delete()
        .eq('id', expense.id).eq('lead_id', client.id).select('id').single()
      if (deleteError) throw deleteError
      if (editingId === expense.id) reset()
      await onRefresh()
    } catch (deleteError) {
      setFormError(deleteError.message || 'Failed to delete expense.')
    }
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-700">Patient Expenses</h3>
        <button type="button" onClick={() => { reset(); setShowForm(true) }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
          Add Expense
        </button>
      </div>
      <p className="text-xs text-gray-500">Each expense is entered individually and included in website reports.</p>
      {(error || formError) && <p role="alert" className="text-sm text-red-700">{error || formError}</p>}
      {showForm && (
        <form onSubmit={save} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
          <label className="block text-xs font-medium text-gray-700">Description
            <input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border border-gray-300 rounded px-2 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-medium text-gray-700">Amount
              <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full border border-gray-300 rounded px-2 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-700">Date
              <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1 w-full border border-gray-300 rounded px-2 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-700">Type
              <select value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value })} className="mt-1 w-full border border-gray-300 rounded px-2 py-2 text-sm">
                <option value="regular">Regular</option>
                <option value="extra">Extra</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={reset} className="text-gray-700 px-3 py-1 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}
      {!error && expenses.length === 0 && <p className="text-sm text-gray-500">No patient expenses recorded.</p>}
      {expenses.map(expense => (
        <div key={expense.id} className={`rounded-lg border p-3 ${expense.expense_type === 'extra' ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-100 border-gray-300'}`}>
          <div className="flex justify-between gap-3 flex-wrap">
            <div>
              <div className="font-medium text-sm text-gray-900">{expense.description}</div>
              <div className="text-xs text-gray-600">{expense.expense_type === 'extra' ? 'Extra' : 'Regular'} · {expense.date} · ${Number(expense.amount).toFixed(2)}</div>
            </div>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => { setEditingId(expense.id); setForm({ description: expense.description, amount: String(expense.amount), date: expense.date, expense_type: expense.expense_type }); setFormError(''); setShowForm(true) }} className="text-blue-700">Edit</button>
              <button type="button" onClick={() => remove(expense)} className="text-red-700">Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
