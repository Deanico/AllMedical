import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PORTAL_TERMS_VERSION = '2026-08-25'
const PORTAL_PRIVACY_NOTICE_VERSION = '2026-08-25'

const formatDate = (value) => {
  if (!value) return 'Not scheduled'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const ORDER_STATUS_META = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Reviewed', className: 'bg-sky-100 text-sky-800' },
  ready_to_order: { label: 'Ready to Order', className: 'bg-cyan-100 text-cyan-800' },
  ordered: { label: 'Ordered', className: 'bg-indigo-100 text-indigo-800' },
  shipped: { label: 'Shipped', className: 'bg-emerald-100 text-emerald-800' },
  delivered: { label: 'Delivered', className: 'bg-teal-100 text-teal-800' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-100 text-rose-800' }
}

const formatOrderStatus = (status) => {
  if (!status) return 'Unknown'
  return ORDER_STATUS_META[status]?.label || status.replace(/_/g, ' ')
}

const formatTrackingNumber = (value) => {
  if (!value) return 'Not assigned yet'
  return value
}

const toDayKey = (value) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.floor(parsed.getTime() / 86400000)
}

const ACTIVE_STATUS_PRIORITY = {
  pending: 1,
  reviewed: 2,
  ready_to_order: 3,
  ordered: 4
}

export default function ClientPortalDashboard({ user, onLogout, previewMode = false }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [client, setClient] = useState(null)
  const [clientProducts, setClientProducts] = useState([])
  const [clientOrders, setClientOrders] = useState([])
  const [showPasswordSetup, setShowPasswordSetup] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasAcceptedLegalTerms, setHasAcceptedLegalTerms] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [showEditAccount, setShowEditAccount] = useState(false)
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountMessage, setAccountMessage] = useState(null)
  const [accountForm, setAccountForm] = useState({
    name: '',
    phone: '',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
    insurance: '',
    insurance_member_id: '',
    insurance_group_number: ''
  })

  useEffect(() => {
    let cancelled = false
    let clientProductsChannel = null
    let clientOrdersChannel = null

    const fetchClientData = async () => {
      if (!supabase || !user?.email) {
        setError('Unable to load portal data.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const { data: clientData, error: clientError } = await supabase
          .from('leads')
          .select('id, name, email, phone, insurance, address_line1, city, state, zip_code, auto_ship_enabled, portal_terms_accepted_at, portal_terms_version, portal_privacy_notice_version')
          .ilike('email', user.email)
          .limit(1)

        if (clientError) throw clientError

        const matchedClient = clientData?.[0] || null

        if (!matchedClient) {
          if (!cancelled) {
            setClient(null)
            setClientProducts([])
            setClientOrders([])
            setError('Your login is active, but your client account is not linked yet. Please contact support.')
          }
          return
        }

        const { data: productsData, error: productsError } = await supabase
          .from('client_products')
          .select(`
            id,
            quantity,
            frequency_days,
            next_ship_date,
            active,
            products (
              id,
              name,
              category,
              manufacturer
            )
          `)
          .eq('lead_id', matchedClient.id)
          .eq('active', true)
          .order('next_ship_date', { ascending: true })

        if (productsError) throw productsError

        const { data: ordersData, error: ordersError } = await supabase
          .from('pending_orders')
          .select(`
            id,
            client_product_id,
            ship_date,
            status,
            tracking_number,
            order_placed_at,
            shipped_at,
            delivered_at,
            notes,
            created_at,
            updated_at,
            order_details,
            pending_order_items (
              id,
              quantity,
              products (
                id,
                name,
                category,
                manufacturer
              )
            )
          `)
          .eq('lead_id', matchedClient.id)
          .order('ship_date', { ascending: false })
          .order('created_at', { ascending: false })

        if (ordersError) throw ordersError

        if (!cancelled) {
          setClient(matchedClient)
          setClientProducts(productsData || [])
          setClientOrders(ordersData || [])

          if (!clientProductsChannel) {
            clientProductsChannel = supabase
              .channel(`portal-client-products-${matchedClient.id}`)
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'client_products', filter: `lead_id=eq.${matchedClient.id}` },
                fetchClientData
              )
              .subscribe()
          }

          if (!clientOrdersChannel) {
            clientOrdersChannel = supabase
              .channel(`portal-client-orders-${matchedClient.id}`)
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pending_orders', filter: `lead_id=eq.${matchedClient.id}` },
                fetchClientData
              )
              .subscribe()
          }
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || 'Failed to load your portal data.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchClientData()

    return () => {
      cancelled = true
      if (clientProductsChannel) {
        supabase?.removeChannel(clientProductsChannel)
      }
      if (clientOrdersChannel) {
        supabase?.removeChannel(clientOrdersChannel)
      }
    }
  }, [user?.email])

  const nextShipment = useMemo(() => {
    if (clientProducts.length === 0) return null

    const todayKey = new Date().toISOString().split('T')[0]
    const upcoming = clientProducts.find((item) => item.next_ship_date && item.next_ship_date >= todayKey)
    return upcoming || clientProducts[0]
  }, [clientProducts])

  const activeOrder = useMemo(() => {
    if (clientOrders.length === 0) return null

    const activeStatuses = new Set(['pending', 'reviewed', 'ready_to_order', 'ordered'])
    const activeOrders = clientOrders.filter((order) => activeStatuses.has(order.status))

    if (activeOrders.length === 0) {
      return clientOrders[0]
    }

    // Treat all rows sharing the most recent ship_date as one cycle, then prefer
    // the most advanced workflow row with the most complete item breakdown.
    const latestShipDate = activeOrders.reduce((latest, order) => {
      const shipDate = order.ship_date || ''
      if (!latest) return shipDate
      return shipDate > latest ? shipDate : latest
    }, '')

    const currentCycleOrders = latestShipDate
      ? activeOrders.filter((order) => (order.ship_date || '') === latestShipDate)
      : activeOrders

    const sortedCurrentCycle = [...currentCycleOrders].sort((first, second) => {
      const firstPriority = ACTIVE_STATUS_PRIORITY[first.status] || 0
      const secondPriority = ACTIVE_STATUS_PRIORITY[second.status] || 0
      if (secondPriority !== firstPriority) {
        return secondPriority - firstPriority
      }

      const firstItemCount = first.pending_order_items?.length || 0
      const secondItemCount = second.pending_order_items?.length || 0
      if (secondItemCount !== firstItemCount) {
        return secondItemCount - firstItemCount
      }

      const firstHasOrderPlacedAt = first.order_placed_at ? 1 : 0
      const secondHasOrderPlacedAt = second.order_placed_at ? 1 : 0
      if (secondHasOrderPlacedAt !== firstHasOrderPlacedAt) {
        return secondHasOrderPlacedAt - firstHasOrderPlacedAt
      }

      const firstUpdatedAt = first.updated_at || first.created_at || ''
      const secondUpdatedAt = second.updated_at || second.created_at || ''
      return secondUpdatedAt.localeCompare(firstUpdatedAt)
    })

    return sortedCurrentCycle[0] || activeOrders[0] || clientOrders[0]
  }, [clientOrders])

  const completedOrders = useMemo(() => {
    if (clientOrders.length === 0) return []

    const activeStatuses = new Set(['pending', 'reviewed', 'ready_to_order', 'ordered'])
    const baseOrders = clientOrders.filter((order) => {
      if (order.id === activeOrder?.id) return false

      if (activeStatuses.has(order.status)) {
        // Hide sibling active rows from the same cycle to avoid confusing duplicates.
        return (order.ship_date || '') !== (activeOrder?.ship_date || '')
      }

      return true
    })

    if (!activeOrder) {
      return baseOrders
    }

    const activeProducts = new Set(
      (activeOrder.pending_order_items || [])
        .map((item) => item.products?.id || item.products?.name || null)
        .filter(Boolean)
    )

    const activeShipDay = toDayKey(activeOrder.ship_date)

    // Suppress stale, near-date subset rows caused by schedule/date reshuffles.
    return baseOrders.filter((order) => {
      const isUnshipped = !order.shipped_at
      const noTracking = !order.tracking_number
      const sameWorkflowStage = order.status === activeOrder.status
      const orderItems = order.pending_order_items || []

      if (!isUnshipped || !noTracking || !sameWorkflowStage || orderItems.length === 0 || activeProducts.size === 0) {
        return true
      }

      const orderShipDay = toDayKey(order.ship_date)
      if (orderShipDay === null || activeShipDay === null) {
        return true
      }

      const dayDelta = activeShipDay - orderShipDay
      if (dayDelta < 0 || dayDelta > 3) {
        return true
      }

      const isSubsetOfActiveProducts = orderItems.every((item) => {
        const productKey = item.products?.id || item.products?.name || null
        return Boolean(productKey) && activeProducts.has(productKey)
      })

      return !isSubsetOfActiveProducts
    })
  }, [activeOrder, clientOrders])

  const latestCompletedOrders = useMemo(() => {
    const latestOrderByProduct = new Map()

    completedOrders.forEach((order) => {
      const productKey = order.client_product_id || order.pending_order_items?.[0]?.products?.id || order.id
      if (!latestOrderByProduct.has(productKey)) {
        latestOrderByProduct.set(productKey, order)
      }
    })

    return [...latestOrderByProduct.values()]
  }, [completedOrders])

  useEffect(() => {
    if (!client) return

    setAccountForm({
      name: client.name || '',
      phone: client.phone || '',
      address_line1: client.address_line1 || '',
      city: client.city || '',
      state: client.state || '',
      zip_code: client.zip_code || '',
      insurance: client.insurance || '',
      insurance_member_id: client.insurance_id || '',
      insurance_group_number: client.insurance_group_number || ''
    })
  }, [client])

  const requiresLegalAcceptance =
    !client?.portal_terms_accepted_at ||
    client.portal_terms_version !== PORTAL_TERMS_VERSION ||
    client.portal_privacy_notice_version !== PORTAL_PRIVACY_NOTICE_VERSION

  const handleSetPassword = async (e) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    if (requiresLegalAcceptance && !hasAcceptedLegalTerms) {
      setPasswordMessage({ type: 'error', text: 'You must agree to the Terms of Service and acknowledge the Privacy Notice before setting your password.' })
      return
    }

    if (!supabase) {
      setPasswordMessage({ type: 'error', text: 'Portal auth is not configured.' })
      return
    }

    try {
      setPasswordSaving(true)
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      if (requiresLegalAcceptance) {
        const acceptedAt = new Date().toISOString()
        const { error: acceptanceError } = await supabase
          .from('leads')
          .update({
            portal_accepted_at: acceptedAt,
            portal_terms_accepted_at: acceptedAt,
            portal_terms_version: PORTAL_TERMS_VERSION,
            portal_privacy_notice_version: PORTAL_PRIVACY_NOTICE_VERSION,
            portal_auth_user_id: user?.id || null
          })
          .eq('id', client.id)

        if (acceptanceError) throw acceptanceError
        setClient((currentClient) => ({ ...currentClient, portal_terms_accepted_at: acceptedAt }))
      }

      setPasswordMessage({ type: 'success', text: 'Password updated. You can now use email and password sign-in.' })
      setNewPassword('')
      setConfirmPassword('')
      setHasAcceptedLegalTerms(false)
      setShowPasswordSetup(false)
    } catch (updateError) {
      setPasswordMessage({ type: 'error', text: updateError.message || 'Failed to update password.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleAccountFormChange = (event) => {
    const { name, value } = event.target
    setAccountForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveAccountDetails = async (e) => {
    e.preventDefault()
    setAccountMessage(null)

    if (!supabase || !client?.id) {
      setAccountMessage({ type: 'error', text: 'Unable to save updates right now.' })
      return
    }

    const normalizedInsurance = accountForm.insurance.trim()
    const normalizedMemberId = accountForm.insurance_member_id.trim()
    const normalizedGroupNumber = accountForm.insurance_group_number.trim()

    const insuranceChanged =
      normalizedInsurance !== (client.insurance || '').trim() ||
      normalizedMemberId !== (client.insurance_id || '').trim() ||
      normalizedGroupNumber !== (client.insurance_group_number || '').trim()

    if (insuranceChanged && (!normalizedInsurance || !normalizedMemberId)) {
      setAccountMessage({
        type: 'error',
        text: 'When changing insurance, Insurance Provider and Member ID are required.'
      })
      return
    }

    try {
      setAccountSaving(true)

      const profileUpdatePayload = {
        name: accountForm.name.trim() || null,
        phone: accountForm.phone.trim() || null,
        address_line1: accountForm.address_line1.trim() || null,
        city: accountForm.city.trim() || null,
        state: accountForm.state.trim() || null,
        zip_code: accountForm.zip_code.trim() || null
      }

      const { error: profileError } = await supabase
        .from('leads')
        .update(profileUpdatePayload)
        .eq('id', client.id)

      if (profileError) throw profileError

      let mergedClient = {
        ...client,
        ...profileUpdatePayload
      }

      if (insuranceChanged) {
        const insuranceRequestPayload = {
          pending_insurance_provider: normalizedInsurance,
          pending_insurance_member_id: normalizedMemberId,
          pending_insurance_group_number: normalizedGroupNumber || null,
          insurance_update_requested_at: new Date().toISOString(),
          insurance_update_review_status: 'pending'
        }

        const { error: insuranceError } = await supabase
          .from('leads')
          .update(insuranceRequestPayload)
          .eq('id', client.id)

        if (insuranceError) {
          throw insuranceError
        }

        mergedClient = {
          ...mergedClient,
          ...insuranceRequestPayload
        }
      }

      setClient(mergedClient)
      setShowEditAccount(false)
      setAccountMessage({
        type: 'success',
        text: insuranceChanged
          ? 'Profile updated. Insurance changes were submitted for review.'
          : 'Account details updated successfully.'
      })
    } catch (saveError) {
      setAccountMessage({
        type: 'error',
        text: saveError.message || 'Failed to save account changes.'
      })
    } finally {
      setAccountSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen portal-shell flex items-center justify-center px-4">
        <div className="portal-auth-card max-w-md w-full p-8 text-center">
          <p className="text-slate-600">Loading your shipment details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen portal-shell px-4 py-8 sm:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="portal-auth-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">Client Portal</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Welcome{client?.name ? `, ${client.name}` : ''}</h1>
            <p className="text-sm text-slate-600 mt-2">Review your next shipment and product schedule in one place.</p>
            {previewMode && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mt-3">Admin preview mode</p>
            )}
          </div>
          {!previewMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAccountMessage(null)
                  setShowEditAccount(prev => !prev)
                }}
                className="portal-secondary-btn"
              >
                {showEditAccount ? 'Close Account Editor' : 'Edit Account Details'}
              </button>
              <button
                onClick={() => {
                  setPasswordMessage(null)
                  setShowPasswordSetup(prev => !prev)
                }}
                className="portal-secondary-btn"
              >
                {showPasswordSetup ? 'Close Password Setup' : 'Set Password'}
              </button>
              <button onClick={onLogout} className="portal-secondary-btn">
                Sign Out
              </button>
            </div>
          )}
        </div>

        {!previewMode && showEditAccount && (
          <div className="portal-auth-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Edit Account Details</h2>
            <p className="text-sm text-slate-600 mb-4">General profile changes apply immediately. Insurance changes are sent for review before they are accepted.</p>
            <form onSubmit={handleSaveAccountDetails} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input name="name" value={accountForm.name} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input name="phone" value={accountForm.phone} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <input name="address_line1" value={accountForm.address_line1} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                <input name="city" value={accountForm.city} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  <input name="state" value={accountForm.state} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ZIP</label>
                  <input name="zip_code" value={accountForm.zip_code} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Insurance Provider</label>
                <input name="insurance" value={accountForm.insurance} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Member ID</label>
                <input name="insurance_member_id" value={accountForm.insurance_member_id} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Group # (If applicable)</label>
                <input name="insurance_group_number" value={accountForm.insurance_group_number} onChange={handleAccountFormChange} className="w-full px-4 py-3" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" disabled={accountSaving} className="portal-primary-btn">
                  {accountSaving ? 'Saving...' : 'Save Account Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {!previewMode && showPasswordSetup && (
          <div className="portal-auth-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Set Password</h2>
            <p className="text-sm text-slate-600 mb-4">
              {requiresLegalAcceptance
                ? 'Set a password for future sign-ins and review the portal terms.'
                : 'Set a new password for future sign-ins.'}
            </p>
            <form onSubmit={handleSetPassword} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-4 py-3"
                />
              </div>
              {requiresLegalAcceptance && (
                <label className="sm:col-span-2 flex items-start gap-3 text-sm leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    required
                    checked={hasAcceptedLegalTerms}
                    onChange={(e) => setHasAcceptedLegalTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    I agree to the{' '}
                    <a href="/terms-of-service.html" target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline">Terms of Service</a>{' '}
                    and acknowledge the{' '}
                    <a href="/privacy-notice.html" target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline">Privacy Notice</a>.
                  </span>
                </label>
              )}
              <button type="submit" disabled={passwordSaving} className="portal-primary-btn">
                {passwordSaving ? 'Saving...' : 'Save Password'}
              </button>
            </form>
            {passwordMessage && (
              <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${passwordMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {passwordMessage.text}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="portal-auth-card p-6 border border-amber-200 bg-amber-50">
            <p className="text-amber-800 text-sm">{error}</p>
          </div>
        )}

        {accountMessage && (
          <div className={`portal-auth-card p-4 ${accountMessage.type === 'success' ? 'border border-emerald-200 bg-emerald-50' : 'border border-rose-200 bg-rose-50'}`}>
            <p className={`text-sm ${accountMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{accountMessage.text}</p>
          </div>
        )}

        {!error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="portal-info-card p-5">
                <p className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Next Shipment</p>
                <p className="text-xl font-bold text-slate-900 mt-2">{formatDate(nextShipment?.next_ship_date)}</p>
                <p className="text-sm text-slate-600 mt-1">{nextShipment?.products?.name || 'No product assigned yet'}</p>
              </div>
              <div className="portal-info-card p-5">
                <p className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Quantity</p>
                <p className="text-xl font-bold text-slate-900 mt-2">{nextShipment?.quantity || 0}</p>
                <p className="text-sm text-slate-600 mt-1">Units in next shipment</p>
              </div>
              <div className="portal-info-card p-5">
                <p className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Frequency</p>
                <p className="text-xl font-bold text-slate-900 mt-2">{client?.auto_ship_enabled ? 80 : nextShipment?.frequency_days || 0} days</p>
                <p className="text-sm text-slate-600 mt-1">Typical refill cycle</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="portal-auth-card p-6 lg:col-span-2">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Account Details</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-900 break-all">{client?.email || user?.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-medium text-slate-900">{client?.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Insurance</p>
                    <p className="font-medium text-slate-900">{client?.insurance || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Member ID</p>
                    <p className="font-medium text-slate-900">{client?.insurance_id || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Group #</p>
                    <p className="font-medium text-slate-900">{client?.insurance_group_number || 'N/A'}</p>
                  </div>
                  {client?.insurance_update_review_status === 'pending' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Insurance Change Pending Review</p>
                      <p className="text-sm text-amber-900 mt-1">Provider: {client?.pending_insurance_provider || 'N/A'}</p>
                      <p className="text-sm text-amber-900">Member ID: {client?.pending_insurance_member_id || 'N/A'}</p>
                      <p className="text-sm text-amber-900">Group #: {client?.pending_insurance_group_number || 'N/A'}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500">Shipping Address</p>
                    <p className="font-medium text-slate-900">
                      {client?.address_line1 ? `${client.address_line1}, ` : ''}
                      {client?.city ? `${client.city}, ` : ''}
                      {client?.state ? `${client.state} ` : ''}
                      {client?.zip_code || ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="portal-auth-card p-6 lg:col-span-3">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Shipment Schedule</h2>
                {clientProducts.length === 0 ? (
                  <p className="text-sm text-slate-600">No active shipment products are assigned yet.</p>
                ) : (
                  <div className="space-y-3">
                    {clientProducts.map((item) => (
                      <div key={item.id} className="portal-row-card p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{item.products?.name || 'Unnamed product'}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 mt-1">{item.products?.category || 'General'}{item.products?.manufacturer ? ` - ${item.products.manufacturer}` : ''}</p>
                          </div>
                          <p className="text-sm font-medium text-slate-700">Next ship: {formatDate(item.next_ship_date)}</p>
                        </div>
                        <div className="mt-3 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Quantity: {item.quantity || 0}</span>
                          <span>Frequency: {client?.auto_ship_enabled ? 80 : item.frequency_days || 0} days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="portal-auth-card p-6 lg:col-span-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Order Tracking</h2>
                    <p className="text-sm text-slate-600 mt-1">See the tracking number for your current order and past shipments.</p>
                  </div>
                  {activeOrder && (
                    <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-xs font-semibold ${ORDER_STATUS_META[activeOrder.status]?.className || 'bg-slate-100 text-slate-700'}`}>
                      Current Order: {formatOrderStatus(activeOrder.status)}
                    </span>
                  )}
                </div>

                {clientOrders.length === 0 ? (
                  <p className="text-sm text-slate-600">No order history is available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activeOrder && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Current Order</p>
                            <p className="text-base font-bold text-slate-900 mt-1">Ship Date: {formatDate(activeOrder.ship_date)}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              Tracking #: <span className="font-medium text-slate-900">{formatTrackingNumber(activeOrder.tracking_number)}</span>
                            </p>
                          </div>
                          <div className="text-sm text-slate-600 sm:text-right">
                            <p>Status: <span className="font-medium text-slate-900">{formatOrderStatus(activeOrder.status)}</span></p>
                            <p>Ordered: {formatDate(activeOrder.order_placed_at)}</p>
                            <p>Shipped: {formatDate(activeOrder.shipped_at)}</p>
                            <p>Delivered: {formatDate(activeOrder.delivered_at)}</p>
                          </div>
                        </div>

                        {activeOrder.pending_order_items?.length > 0 && (
                          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {activeOrder.pending_order_items.map((item) => (
                              <div key={item.id} className="rounded-xl bg-white border border-slate-200 p-3">
                                <p className="font-semibold text-slate-900 text-sm">{item.products?.name || 'Unnamed item'}</p>
                                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 mt-1">{item.products?.category || 'General'}</p>
                                <p className="text-sm text-slate-600 mt-2">Qty: {item.quantity || 0}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {latestCompletedOrders.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">Past Orders</h3>
                        <div className="space-y-3">
                          {latestCompletedOrders.map((order) => (
                            <div key={order.id} className="portal-row-card p-4">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-900">{formatDate(order.ship_date)}</p>
                                  <p className="text-sm text-slate-600 mt-1">
                                    Tracking #: <span className="font-medium text-slate-900">{formatTrackingNumber(order.tracking_number)}</span>
                                  </p>
                                </div>
                                <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-xs font-semibold ${ORDER_STATUS_META[order.status]?.className || 'bg-slate-100 text-slate-700'}`}>
                                  {formatOrderStatus(order.status)}
                                </span>
                              </div>

                              {order.pending_order_items?.length > 0 && (
                                <p className="text-sm text-slate-600 mt-3">
                                  {order.pending_order_items.map((item) => `${item.products?.name || 'Item'} x ${item.quantity || 0}`).join(' • ')}
                                </p>
                              )}
                              {order.delivered_at && (
                                <p className="text-sm text-slate-600 mt-3">Delivered: {formatDate(order.delivered_at)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
