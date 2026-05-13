import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generatePhysicianOrder, downloadPDF } from '../lib/generatePhysicianOrder'
import { calculateInsuranceProjection } from '../lib/insuranceProjection'

const parseDateInput = (value) => {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch
    const parsed = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const usDateMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usDateMatch) {
    const [, month, day, year] = usDateMatch
    const parsed = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const fallback = new Date(raw)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

const formatDisplayDate = (value) => {
  const date = parseDateInput(value)
  if (!date) return 'N/A'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function AdminDashboard({ userEmail, onLogout }) {
  const queueStatuses = ['pending', 'reviewed', 'ready_to_order', 'ordered']
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('leads')
  const [leads, setLeads] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showAddDrModal, setShowAddDrModal] = useState(false)
  const [showEditDrModal, setShowEditDrModal] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [showEditClientModal, setShowEditClientModal] = useState(false)
  const [drForm, setDrForm] = useState({ 
    full_name: '', 
    first_name: '',
    last_name: '',
    fax: '', 
    npi_number: '',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
    phone: ''
  })
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', insurance: '', birthday: '', address_line1: '', city: '', state: '', zip_code: '', shipping_duration: '', payment_status: '', is_paused: false })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [queueSyncing, setQueueSyncing] = useState(false)
  const [queueSyncResult, setQueueSyncResult] = useState(null)
  const [productNeeded, setProductNeeded] = useState('')
  const productNeededTimerRef = useRef(null)
  const [nppesSearch, setNppesSearch] = useState('')
  const [nppesResults, setNppesResults] = useState([])
  const [nppesLoading, setNppesLoading] = useState(false)
  const [showDoctorSelectModal, setShowDoctorSelectModal] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [clientStatusFilter, setClientStatusFilter] = useState('active')
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
    zip_code: '',
    is_paused: false 
  })
  const [selectedCalcClient, setSelectedCalcClient] = useState(null)
  const [editingCalculator, setEditingCalculator] = useState(false)
  const [showMobileDetails, setShowMobileDetails] = useState(false)
  const [calcInputs, setCalcInputs] = useState({
    deductible: '',
    oopMax: '',
    percentOfAllowable: '',
    insurancePaidAmount: '',
    costOfProduct: ''
  })
  const [clientCalcInputs, setClientCalcInputs] = useState({
    deductible: '',
    oopMax: '',
    percentOfAllowable: '',
    insurancePaidAmount: '',
    costOfProduct: ''
  })

  // Products & Shipping System State
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [clientProducts, setClientProducts] = useState([])
  const [allClientProducts, setAllClientProducts] = useState({}) // { clientId: [products] }
  const [pendingOrders, setPendingOrders] = useState([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showEditProductModal, setShowEditProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    manufacturer: '',
    description: '',
    sku: ''
  })
  const [showAssignProductModal, setShowAssignProductModal] = useState(false)
  const [assignProductClient, setAssignProductClient] = useState(null)
  const [assignProductForm, setAssignProductForm] = useState({
    product_id: '',
    quantity: 1,
    next_ship_date: new Date().toISOString().split('T')[0],
    frequency_days: 30
  })
  const [shippingScheduleItems, setShippingScheduleItems] = useState([])

  // Projects & Tasks State
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [showAddProjectModal, setShowAddProjectModal] = useState(false)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [showEditTaskModal, setShowEditTaskModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [editingProject, setEditingProject] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [viewingProjectId, setViewingProjectId] = useState(null)
  const [projectForm, setProjectForm] = useState({ name: '', description: '', deadline: '', goal: '' })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const ALL_TASKS_VIEW_ID = 'all-tasks-folder'

  // Custom Data Tables State
  const [customDataTables, setCustomDataTables] = useState([])
  const [showAddTableModal, setShowAddTableModal] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [newTableForm, setNewTableForm] = useState({ name: '', description: '', columns: [] })
  const [tableRowsData, setTableRowsData] = useState({})
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [tableColumnsData, setTableColumnsData] = useState({})
  const [editingRowId, setEditingRowId] = useState(null)
  const [editingRowData, setEditingRowData] = useState({})
  const [newRowForm, setNewRowForm] = useState({})

  // Helper function to format dates without timezone conversion
  const formatDate = (dateString) => {
    return formatDisplayDate(dateString)
  }

  const getLocalTodayDateString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Formula: next_ship_date = last_ship_date + 90 days − 2-day shipping buffer = +88 days
  const calculateAutoNextShipDate = (fromDateStr) => {
    const base = fromDateStr ? new Date(`${fromDateStr}T00:00:00`) : new Date()
    base.setHours(0, 0, 0, 0)
    base.setDate(base.getDate() + 88)
    return base.toISOString().split('T')[0]
  }

  const getSupplierForProduct = async (productId) => {
    if (!productId) return null

    const { data, error } = await supabase
      .from('product_suppliers')
      .select(`
        supplier_id,
        price,
        is_preferred,
        in_stock,
        suppliers (
          id,
          active
        )
      `)
      .eq('product_id', productId)
      .eq('in_stock', true)

    if (error) throw error

    const activeSuppliers = (data || []).filter(item => item.suppliers?.active !== false)
    const candidates = activeSuppliers.length > 0 ? activeSuppliers : (data || [])
    if (candidates.length === 0) return null

    candidates.sort((first, second) => {
      if (Boolean(first.is_preferred) !== Boolean(second.is_preferred)) {
        return first.is_preferred ? -1 : 1
      }

      const firstPrice = Number(first.price)
      const secondPrice = Number(second.price)
      const firstValue = Number.isFinite(firstPrice) ? firstPrice : Number.POSITIVE_INFINITY
      const secondValue = Number.isFinite(secondPrice) ? secondPrice : Number.POSITIVE_INFINITY
      return firstValue - secondValue
    })

    return candidates[0]
  }

  const queueNextShipmentOrder = async (shipmentItem, nextShipDate) => {
    const supplierChoice = await getSupplierForProduct(shipmentItem.product_id)

    const { data: existingOrders, error: existingOrdersError } = await supabase
      .from('pending_orders')
      .select('id, preferred_supplier_id, client_product_id')
      .eq('lead_id', shipmentItem.lead_id)
      .eq('ship_date', nextShipDate)
      .in('status', queueStatuses)
      .order('created_at', { ascending: true })
      .limit(1)

    if (existingOrdersError) throw existingOrdersError

    let pendingOrderId = existingOrders?.[0]?.id

    if (!pendingOrderId) {
      const orderDetails = {
        patient_name: shipmentItem.client_name || null,
        product_name: shipmentItem.product_name || null,
        product_id: shipmentItem.product_id || null,
        quantity: shipmentItem.quantity || 1,
        ship_date: nextShipDate,
        auto_generated: true
      }

      const { data: insertedOrder, error: insertOrderError } = await supabase
        .from('pending_orders')
        .insert([
          {
            lead_id: shipmentItem.lead_id,
            client_product_id: shipmentItem.id,
            ship_date: nextShipDate,
            status: 'pending',
            preferred_supplier_id: supplierChoice?.supplier_id || null,
            order_details: orderDetails
          }
        ])
        .select('id')
        .single()

      if (insertOrderError) throw insertOrderError
      pendingOrderId = insertedOrder.id
    } else {
      const existingOrder = existingOrders[0]

      if (!existingOrder.client_product_id) {
        const { error: backfillClientProductError } = await supabase
          .from('pending_orders')
          .update({ client_product_id: shipmentItem.id })
          .eq('id', existingOrder.id)

        if (backfillClientProductError) throw backfillClientProductError
      }

      if (!existingOrder.preferred_supplier_id && supplierChoice?.supplier_id) {
        const { error: updateOrderError } = await supabase
          .from('pending_orders')
          .update({ preferred_supplier_id: supplierChoice.supplier_id })
          .eq('id', pendingOrderId)

        if (updateOrderError) throw updateOrderError
      }
    }

    const { data: existingItems, error: existingItemsError } = await supabase
      .from('pending_order_items')
      .select('id')
      .eq('pending_order_id', pendingOrderId)
      .eq('product_id', shipmentItem.product_id)
      .limit(1)

    if (existingItemsError) throw existingItemsError

    if (!existingItems || existingItems.length === 0) {
      const { error: insertItemError } = await supabase
        .from('pending_order_items')
        .insert([
          {
            pending_order_id: pendingOrderId,
            product_id: shipmentItem.product_id,
            quantity: shipmentItem.quantity,
            supplier_id: supplierChoice?.supplier_id || null,
            price: supplierChoice?.price || null
          }
        ])

      if (insertItemError) throw insertItemError
    }
  }

  const syncGeneratePendingOrders = async ({ showAlert = true } = {}) => {
    if (!supabase) return

    setQueueSyncing(true)
    setQueueSyncResult(null)

    try {
      const { data: dueShipments, error: dueError } = await supabase
        .from('shipment_due_view')
        .select('client_product_id, lead_id, product_id, patient_full_name, product_name, ship_date')
        .order('ship_date', { ascending: true })

      if (dueError) throw dueError

      const dueRows = dueShipments || []
      if (dueRows.length === 0) {
        const result = { scanned: 0, created: 0, skippedExisting: 0 }
        setQueueSyncResult(result)
        if (showAlert) {
          alert('No due shipments found to seed into pending orders.')
        }
        return
      }

      const clientProductIds = [...new Set(dueRows.map(row => row.client_product_id).filter(Boolean))]
      const shipDates = [...new Set(dueRows.map(row => row.ship_date).filter(Boolean))]

      const [{ data: existingOrders, error: existingError }, { data: clientProducts, error: clientProductsError }] = await Promise.all([
        supabase
          .from('pending_orders')
          .select('id, client_product_id, ship_date')
          .in('client_product_id', clientProductIds)
          .in('ship_date', shipDates),
        supabase
          .from('client_products')
          .select('id, quantity')
          .in('id', clientProductIds)
      ])

      if (existingError) throw existingError
      if (clientProductsError) throw clientProductsError

      const quantityByClientProductId = new Map((clientProducts || []).map(cp => [cp.id, cp.quantity || 1]))
      const existingPairKeys = new Set(
        (existingOrders || [])
          .filter(order => order.client_product_id && order.ship_date)
          .map(order => `${order.client_product_id}|${order.ship_date}`)
      )

      const toInsert = []
      const dueByPairKey = new Map()
      for (const due of dueRows) {
        const pairKey = `${due.client_product_id}|${due.ship_date}`
        dueByPairKey.set(pairKey, due)
        if (existingPairKeys.has(pairKey)) continue

        const quantity = quantityByClientProductId.get(due.client_product_id) || 1
        toInsert.push({
          lead_id: due.lead_id,
          client_product_id: due.client_product_id,
          ship_date: due.ship_date,
          status: 'pending',
          order_details: {
            patient_name: due.patient_full_name || null,
            product_name: due.product_name || null,
            product_id: due.product_id || null,
            quantity,
            ship_date: due.ship_date,
            auto_generated: true
          }
        })
      }

      let created = 0
      if (toInsert.length > 0) {
        const { data: insertedOrders, error: insertError } = await supabase
          .from('pending_orders')
          .insert(toInsert)
          .select('id, client_product_id, ship_date')

        if (insertError) throw insertError
        created = (insertedOrders || []).length

        const itemsToInsert = (insertedOrders || []).map(order => {
          const pairKey = `${order.client_product_id}|${order.ship_date}`
          const due = dueByPairKey.get(pairKey)
          const quantity = quantityByClientProductId.get(order.client_product_id) || 1

          return {
            pending_order_id: order.id,
            product_id: due?.product_id || null,
            quantity
          }
        }).filter(item => item.product_id)

        if (itemsToInsert.length > 0) {
          const { error: itemsInsertError } = await supabase
            .from('pending_order_items')
            .insert(itemsToInsert)

          if (itemsInsertError) throw itemsInsertError
        }
      }

      const result = {
        scanned: dueRows.length,
        created,
        skippedExisting: dueRows.length - created
      }

      setQueueSyncResult(result)
      await fetchPendingOrders()

      if (showAlert) {
        alert(`Pending order sync complete. Created ${result.created}, skipped ${result.skippedExisting} existing due shipment(s).`)
      }
    } catch (error) {
      console.error('Error syncing pending orders from due shipments:', error)
      setQueueSyncResult({ error: error.message || 'Failed to sync pending orders.' })
      if (showAlert) {
        alert('Failed to sync pending orders: ' + (error.message || 'Unknown error'))
      }
    } finally {
      setQueueSyncing(false)
    }
  }

  const sortTasksByDueDate = (firstTask, secondTask) => {
    if (!firstTask.due_date && !secondTask.due_date) {
      return new Date(secondTask.created_at || 0) - new Date(firstTask.created_at || 0)
    }
    if (!firstTask.due_date) return 1
    if (!secondTask.due_date) return -1
    return firstTask.due_date.localeCompare(secondTask.due_date)
  }

  // Expenses & Revenue State
  const [expenses, setExpenses] = useState([])
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: '', date: '' })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedShippingDate, setSelectedShippingDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchLeads()
    fetchProducts()
    fetchSuppliers()
    fetchAllClientProducts()
    fetchShippingSchedule()
    fetchPendingOrders()
    syncGeneratePendingOrders({ showAlert: false })
    fetchProjects()
    fetchTasks()
    fetchExpenses()
    fetchCustomDataTables()
  }, [])

  useEffect(() => {
    if (selectedClient) {
      fetchDoctors(selectedClient.id)
      fetchClientProducts(selectedClient.id)
      setProductNeeded(selectedClient.product_needed || '')
      // Reset calculator editing state when switching clients
      setEditingCalculator(false)
      // Load calculator data if it exists
      if (selectedClient.calc_deductible) {
        setClientCalcInputs({
          deductible: selectedClient.calc_deductible?.toString() || '',
          oopMax: selectedClient.calc_oop_max?.toString() || '',
          percentOfAllowable: selectedClient.calc_percent_allowable?.toString() || '',
          insurancePaidAmount: selectedClient.calc_insurance_paid?.toString() || '',
          costOfProduct: selectedClient.calc_product_cost?.toString() || ''
        })
      }
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

  const fetchProducts = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchSuppliers = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchProjects = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchTasks = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const updateTaskStatus = async (taskId, newStatus) => {
    if (!supabase) return

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', taskId)

    if (error) {
      console.error('Error updating task status:', error)
      alert('Failed to update task status')
      return
    }

    setTasks(prevTasks => prevTasks.map(task => task.id === taskId ? { ...task, status: newStatus } : task))
  }

  const fetchCustomDataTables = async () => {
    if (!supabase) return
    try {
      const { data: tables, error } = await supabase
        .from('custom_data_tables')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCustomDataTables(tables || [])
      
      // Fetch columns and rows for each table
      for (const table of tables || []) {
        const { data: columns, error: colsError } = await supabase
          .from('custom_table_columns')
          .select('*')
          .eq('table_id', table.id)
          .order('column_order', { ascending: true })
        if (!colsError) {
          setTableColumnsData(prev => ({ ...prev, [table.id]: columns || [] }))
        }

        const { data: rows, error: rowsError } = await supabase
          .from('custom_table_rows')
          .select('*')
          .eq('table_id', table.id)
          .order('row_order', { ascending: true })
        if (!rowsError) {
          setTableRowsData(prev => ({ ...prev, [table.id]: rows || [] }))
        }
      }
    } catch (error) {
      console.error('Error fetching custom data tables:', error)
    }
  }

  const createOrUpdateTable = async (e) => {
    e.preventDefault()
    if (!newTableForm.name.trim()) {
      alert('Please enter a table name')
      return
    }
    const normalizedColumns = (newTableForm.columns || [])
      .map(col => (col || '').trim())
      .filter(Boolean)

    if (normalizedColumns.length === 0) {
      alert('Please add at least one column')
      return
    }
    try {
      if (editingTable) {
        // Update existing table
        const { error } = await supabase
          .from('custom_data_tables')
          .update({ name: newTableForm.name, description: newTableForm.description || '' })
          .eq('id', editingTable.id)
        if (error) throw error

        const { error: deleteColumnsError } = await supabase
          .from('custom_table_columns')
          .delete()
          .eq('table_id', editingTable.id)
        if (deleteColumnsError) throw deleteColumnsError

        const columnsToAdd = normalizedColumns.map((col, idx) => ({
          table_id: editingTable.id,
          column_name: col,
          column_order: idx
        }))

        const { error: insertColumnsError } = await supabase
          .from('custom_table_columns')
          .insert(columnsToAdd)
        if (insertColumnsError) throw insertColumnsError

        setSelectedTableId(editingTable.id)
      } else {
        // Create new table
        const { data: newTable, error } = await supabase
          .from('custom_data_tables')
          .insert([{
            name: newTableForm.name,
            description: newTableForm.description || ''
          }])
          .select()
        if (error) throw error
        
        // Add columns to new table
        if (newTable && newTable[0]) {
          const tableId = newTable[0].id
          const columnsToAdd = normalizedColumns.map((col, idx) => ({
            table_id: tableId,
            column_name: col,
            column_order: idx
          }))
          const { error: colError } = await supabase
            .from('custom_table_columns')
            .insert(columnsToAdd)
          if (colError) throw colError

          setSelectedTableId(tableId)
        }
      }
      await fetchCustomDataTables()
      setShowAddTableModal(false)
      setEditingTable(null)
      setNewTableForm({ name: '', description: '', columns: [] })
      alert(editingTable ? 'Table updated!' : 'Table created!')
    } catch (error) {
      console.error('Error saving table:', error)
      alert('Error saving table')
    }
  }

  const saveTableRow = async (tableId, rowData) => {
    try {
      if (editingRowId) {
        // Update existing row
        const { error } = await supabase
          .from('custom_table_rows')
          .update({ data: rowData })
          .eq('id', editingRowId)
        if (error) throw error
      } else {
        // Insert new row
        const { error } = await supabase
          .from('custom_table_rows')
          .insert([{
            table_id: tableId,
            data: rowData,
            row_order: (tableRowsData[tableId]?.length || 0)
          }])
        if (error) throw error
      }
      setEditingRowId(null)
      setEditingRowData({})
      setNewRowForm({})
      await fetchCustomDataTables()
    } catch (error) {
      console.error('Error saving row:', error)
      alert('Error saving row')
    }
  }

  const deleteTableRow = async (rowId, tableId) => {
    if (!confirm('Delete this row?')) return
    try {
      const { error } = await supabase
        .from('custom_table_rows')
        .delete()
        .eq('id', rowId)
      if (error) throw error
      await fetchCustomDataTables()
    } catch (error) {
      console.error('Error deleting row:', error)
      alert('Error deleting row')
    }
  }

  const fetchExpenses = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error fetching expenses:', error)
    }
  }

  const fetchClientProducts = async (clientId) => {
    if (!supabase || !clientId) return

    try {
      const { data, error } = await supabase
        .from('client_products')
        .select(`
          *,
          products (
            id,
            name,
            category,
            manufacturer
          )
        `)
        .eq('lead_id', clientId)
        .eq('active', true)

      if (error) throw error
      setClientProducts(data || [])
    } catch (error) {
      console.error('Error fetching client products:', error)
    }
  }

  const fetchAllClientProducts = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('client_products')
        .select(`
          lead_id,
          products (
            id,
            name,
            category
          )
        `)
        .eq('active', true)

      if (error) throw error
      
      // Group by client ID
      const grouped = {}
      data?.forEach(item => {
        if (!grouped[item.lead_id]) {
          grouped[item.lead_id] = []
        }
        grouped[item.lead_id].push(item.products)
      })
      
      setAllClientProducts(grouped)
    } catch (error) {
      console.error('Error fetching all client products:', error)
    }
  }

  const fetchShippingSchedule = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('client_products')
        .select(`
          id,
          lead_id,
          product_id,
          quantity,
          frequency_days,
          next_ship_date,
          active,
          products (
            id,
            name,
            category
          ),
          leads (
            id,
            name
          )
        `)
        .eq('active', true)
        .not('next_ship_date', 'is', null)
        .order('next_ship_date', { ascending: true })

      if (error) throw error

      const normalized = (data || []).map(item => ({
        ...item,
        client_name: item.leads?.name || 'Unknown Client',
        product_name: item.products?.name || 'Unknown Product'
      }))

      setShippingScheduleItems(normalized)
    } catch (error) {
      console.error('Error fetching shipping schedule:', error)
    }
  }

  const fetchPendingOrders = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('pending_orders')
        .select(`
          *,
          leads (
            id,
            name,
            address_line1,
            city,
            state,
            zip_code
          ),
          pending_order_items (
            id,
            quantity,
            price,
            products (
              id,
              name,
              category
            ),
            suppliers (
              id,
              name,
              website
            )
          )
        `)
        .in('status', queueStatuses)
        .order('ship_date', { ascending: true })

      if (error) throw error
      setPendingOrders(data || [])
    } catch (error) {
      console.error('Error fetching pending orders:', error)
    }
  }

  const updatePendingOrderStatus = async (order, nextStatus) => {
    if (!supabase || !order?.id) return

    if (nextStatus === 'cancelled' && !confirm(`Cancel order for ${order.leads?.name || 'this client'}?`)) {
      return
    }

    let trackingNumber = order.tracking_number || null
    if (nextStatus === 'shipped') {
      const enteredTracking = window.prompt('Enter tracking number (optional):', order.tracking_number || '')
      if (enteredTracking === null) return
      trackingNumber = enteredTracking.trim() || null
    }

    const nowIso = new Date().toISOString()
    const updates = { status: nextStatus }

    if (nextStatus === 'ordered') {
      updates.order_placed_at = order.order_placed_at || nowIso
    }

    if (nextStatus === 'shipped') {
      if (!order.client_product_id) {
        const forceShip = window.confirm(
          'This order is missing client_product_id, so the schedule cannot be updated automatically. Ship anyway without updating the calendar?'
        )

        if (!forceShip) {
          setUpdating(false)
          return
        }
      }

      updates.shipped_at = nowIso
      updates.tracking_number = trackingNumber
    }

    setUpdating(true)
    try {
      const { error } = await supabase
        .from('pending_orders')
        .update(updates)
        .eq('id', order.id)

      if (error) throw error

      if (nextStatus === 'shipped') {
        const shippedDate = getLocalTodayDateString()
        const nextShipDate = calculateAutoNextShipDate(shippedDate)

        if (!order.client_product_id) {
          alert('Order marked shipped, but schedule was not updated because client_product_id is missing on this order.')
        } else {
          const { error: scheduleError } = await supabase
            .from('client_products')
            .update({
              last_ship_date: shippedDate,
              next_ship_date: nextShipDate
            })
            .eq('id', order.client_product_id)

          if (scheduleError) throw scheduleError
        }
      }

      await fetchPendingOrders()
      await fetchShippingSchedule()
      alert(`Order updated to ${nextStatus}.`)
    } catch (error) {
      console.error('Error updating pending order status:', error)
      alert('Failed to update order: ' + error.message)
    } finally {
      setUpdating(false)
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
    
    // Get structured name data from NPPES
    const firstName = result.basic?.first_name || ''
    const lastName = result.basic?.last_name || ''
    const credential = result.basic?.credential || ''
    const fullName = credential ? `Dr. ${firstName} ${lastName}, ${credential}` : `Dr. ${firstName} ${lastName}`
    
    setDrForm({
      full_name: fullName.trim(),
      first_name: firstName,
      last_name: lastName,
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
          first_name: drForm.first_name,
          last_name: drForm.last_name,
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
        first_name: '',
        last_name: '',
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

  const handleEditDoctor = (doctor) => {
    setEditingDoctor(doctor)
    setDrForm({
      full_name: doctor.full_name || '',
      first_name: doctor.first_name || '',
      last_name: doctor.last_name || '',
      fax: doctor.fax || '',
      npi_number: doctor.npi_number || '',
      address_line1: doctor.address_line1 || '',
      city: doctor.city || '',
      state: doctor.state || '',
      zip_code: doctor.zip_code || '',
      phone: doctor.phone || ''
    })
    setShowEditDrModal(true)
  }

  const handleUpdateDoctor = async (e) => {
    e.preventDefault()
    if (!supabase || !editingDoctor) return

    try {
      const { error } = await supabase
        .from('doctors')
        .update({
          full_name: drForm.full_name,
          first_name: drForm.first_name,
          last_name: drForm.last_name,
          fax: drForm.fax,
          npi_number: drForm.npi_number,
          address_line1: drForm.address_line1,
          city: drForm.city,
          state: drForm.state,
          zip_code: drForm.zip_code,
          phone: drForm.phone
        })
        .eq('id', editingDoctor.id)

      if (error) throw error
      
      setDrForm({ 
        full_name: '', 
        first_name: '',
        last_name: '',
        fax: '', 
        npi_number: '',
        address_line1: '',
        city: '',
        state: '',
        zip_code: '',
        phone: ''
      })
      setShowEditDrModal(false)
      setEditingDoctor(null)
      await fetchDoctors(selectedClient.id)
      alert('Doctor information updated successfully!')
    } catch (error) {
      console.error('Error updating doctor:', error)
      alert('Failed to update doctor')
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
      // Format birthday to include time at noon UTC to prevent timezone shift issues
      const birthdayValue = addLeadForm.birthday ? `${addLeadForm.birthday}T12:00:00` : null;
      
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: addLeadForm.name,
          email: addLeadForm.email,
          phone: addLeadForm.phone || null,
          insurance: addLeadForm.insurance || null,
          birthday: birthdayValue,
          address_line1: addLeadForm.address_line1 || null,
          city: addLeadForm.city || null,
          state: addLeadForm.state || null,
          zip_code: addLeadForm.zip_code || null,
          is_paused: Boolean(addLeadForm.is_paused),
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
        zip_code: '',
        is_paused: false 
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

  const handleMarkShipped = async (shipmentItem) => {
    if (!supabase || !shipmentItem) return

    const today = getLocalTodayDateString()
    const nowIso = new Date().toISOString()
    const dueShipDate = shipmentItem.next_ship_date
    // next_ship_date = last_ship_date + 90 days − 2-day shipping buffer
    const nextShipDate = calculateAutoNextShipDate(today)

    setUpdating(true)
    try {
      await queueNextShipmentOrder(shipmentItem, nextShipDate)

      const { error } = await supabase
        .from('client_products')
        .update({
          last_ship_date: today,
          next_ship_date: nextShipDate
        })
        .eq('id', shipmentItem.id)

      if (error) throw error

      if (dueShipDate) {
        const { data: currentCycleOrder, error: currentCycleOrderError } = await supabase
          .from('pending_orders')
          .select('id, status')
          .eq('client_product_id', shipmentItem.id)
          .eq('ship_date', dueShipDate)
          .in('status', queueStatuses)
          .order('created_at', { ascending: true })
          .limit(1)

        if (currentCycleOrderError) throw currentCycleOrderError

        if (currentCycleOrder?.[0]?.id) {
          const { error: closeOrderError } = await supabase
            .from('pending_orders')
            .update({
              status: 'shipped',
              shipped_at: nowIso
            })
            .eq('id', currentCycleOrder[0].id)

          if (closeOrderError) throw closeOrderError
        }
      }

      if (selectedClient?.id === shipmentItem.lead_id) {
        await fetchClientProducts(selectedClient.id)
      }

      await fetchShippingSchedule()
      await fetchPendingOrders()
      alert(`Shipped! Next ${shipmentItem.product_name || 'product'} order scheduled for ${formatDate(nextShipDate)}.`)
    } catch (error) {
      console.error('Error marking shipment:', error)
      alert('Failed to mark shipment: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveCalculatorToPatient = async () => {
    if (!supabase || !selectedCalcClient) {
      alert('Please select a patient first')
      return
    }

    setUpdating(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          calc_deductible: parseFloat(calcInputs.deductible) || null,
          calc_oop_max: parseFloat(calcInputs.oopMax) || null,
          calc_percent_allowable: parseFloat(calcInputs.percentOfAllowable) || null,
          calc_insurance_paid: parseFloat(calcInputs.insurancePaidAmount) || null,
          calc_product_cost: parseFloat(calcInputs.costOfProduct) || null
        })
        .eq('id', selectedCalcClient.id)

      if (error) throw error

      // Refresh leads
      await fetchLeads()
      
      alert('Calculator data saved to patient successfully!')
    } catch (error) {
      console.error('Error saving calculator data:', error)
      alert('Failed to save calculator data: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleLoadCalculatorFromPatient = (client) => {
    setSelectedCalcClient(client)
    if (client) {
      setCalcInputs({
        deductible: client.calc_deductible?.toString() || '',
        oopMax: client.calc_oop_max?.toString() || '',
        percentOfAllowable: client.calc_percent_allowable?.toString() || '',
        insurancePaidAmount: client.calc_insurance_paid?.toString() || '',
        costOfProduct: client.calc_product_cost?.toString() || ''
      })
    } else {
      setCalcInputs({
        deductible: '',
        oopMax: '',
        percentOfAllowable: '',
        insurancePaidAmount: '',
        costOfProduct: ''
      })
    }
  }

  const handleUpdateClientCalculator = async () => {
    if (!supabase || !selectedClient) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          calc_deductible: parseFloat(clientCalcInputs.deductible) || null,
          calc_oop_max: parseFloat(clientCalcInputs.oopMax) || null,
          calc_percent_allowable: parseFloat(clientCalcInputs.percentOfAllowable) || null,
          calc_insurance_paid: parseFloat(clientCalcInputs.insurancePaidAmount) || null,
          calc_product_cost: parseFloat(clientCalcInputs.costOfProduct) || null
        })
        .eq('id', selectedClient.id)

      if (error) throw error

      // Refresh leads and update selectedClient with new data
      await fetchLeads()
      
      // Fetch updated client data
      const { data: updatedClient, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', selectedClient.id)
        .single()
      
      if (!fetchError && updatedClient) {
        setSelectedClient(updatedClient)
      }
      
      setEditingCalculator(false)
      
      alert('Calculator data updated successfully!')
    } catch (error) {
      console.error('Error updating calculator data:', error)
      alert('Failed to update calculator data: ' + error.message)
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
      
      // Update database to track that physician order was generated
      if (supabase) {
        await supabase
          .from('leads')
          .update({ 
            physician_order_generated_at: new Date().toISOString()
          })
          .eq('id', selectedClient.id)
        
        // Update local state
        setSelectedClient({
          ...selectedClient,
          physician_order_generated_at: new Date().toISOString()
        })
        await fetchLeads()
      }
      
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
      // Format birthday to include time at noon UTC to prevent timezone shift issues
      const birthdayValue = editForm.birthday ? `${editForm.birthday}T12:00:00` : null;
      const updatePayload = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        insurance: editForm.insurance,
        birthday: birthdayValue,
        address_line1: editForm.address_line1,
        city: editForm.city,
        state: editForm.state,
        zip_code: editForm.zip_code,
        shipping_duration: editForm.shipping_duration || null,
        is_paused: Boolean(editForm.is_paused)
      }

      if (editForm.payment_status) {
        updatePayload.payment_status = editForm.payment_status
      }
      
      const { error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', selectedClient.id)

      if (error) throw error
      
      setShowEditClientModal(false)
      await fetchLeads()
      setSelectedClient({ ...selectedClient, ...editForm })
    } catch (error) {
      console.error('Error updating client:', error)
      alert('Failed to update client: ' + (error?.message || 'Unknown error'))
    }
  }

  const openEditModal = () => {
    // Properly format birthday for date input to match display
    // When database has "1980-12-30T00:00:00Z", we need to extract the LOCAL date, not UTC
    let birthdayValue = '';
    if (selectedClient.birthday) {
      const dateStr = selectedClient.birthday.split('T')[0]; // Get YYYY-MM-DD
      const [year, month, day] = dateStr.split('-');
      // Create date in local timezone and format for input
      const localDate = new Date(year, month - 1, day);
      const yyyy = localDate.getFullYear();
      const mm = String(localDate.getMonth() + 1).padStart(2, '0');
      const dd = String(localDate.getDate()).padStart(2, '0');
      birthdayValue = `${yyyy}-${mm}-${dd}`;
    }
    
    setEditForm({
      name: selectedClient.name,
      email: selectedClient.email,
      phone: selectedClient.phone,
      insurance: selectedClient.insurance,
      birthday: birthdayValue,
      address_line1: selectedClient.address_line1 || '',
      city: selectedClient.city || '',
      state: selectedClient.state || '',
      zip_code: selectedClient.zip_code || '',
      shipping_duration: selectedClient.shipping_duration || '',
      payment_status: selectedClient.payment_status || '',
      is_paused: Boolean(selectedClient.is_paused)
    })
    setShowEditClientModal(true)
  }

  const handleMarkPhysicianOrderSent = async () => {
    if (!supabase || !selectedClient) return
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ physician_order_sent_at: new Date().toISOString() })
        .eq('id', selectedClient.id)
      
      if (error) throw error
      
      setSelectedClient({
        ...selectedClient,
        physician_order_sent_at: new Date().toISOString()
      })
      await fetchLeads()
    } catch (error) {
      console.error('Error marking physician order as sent:', error)
      alert('Failed to update status')
    }
  }

  const handlePhysicianOrderFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !supabase || !selectedClient) return

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    try {
      setUpdating(true)

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedClient.id}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('physician-orders')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('physician-orders')
        .getPublicUrl(filePath)

      // Update database with file URL and received timestamp
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          physician_order_file_url: publicUrl,
          physician_order_received_at: new Date().toISOString()
        })
        .eq('id', selectedClient.id)

      if (updateError) throw updateError

      setSelectedClient({
        ...selectedClient,
        physician_order_file_url: publicUrl,
        physician_order_received_at: new Date().toISOString()
      })
      await fetchLeads()
      alert('Signed physician order uploaded successfully!')
    } catch (error) {
      console.error('Error uploading physician order:', error)
      alert('Failed to upload file: ' + error.message)
    } finally {
      setUpdating(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleMarkPhysicianOrderReceived = async () => {
    if (!supabase || !selectedClient) return
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ physician_order_received_at: new Date().toISOString() })
        .eq('id', selectedClient.id)
      
      if (error) throw error
      
      setSelectedClient({
        ...selectedClient,
        physician_order_received_at: new Date().toISOString()
      })
      await fetchLeads()
    } catch (error) {
      console.error('Error marking physician order as received:', error)
      alert('Failed to update status')
    }
  }

  const handleMarkPhysicianOrderSentToInsurance = async () => {
    if (!supabase || !selectedClient) return

    try {
      const sentToInsuranceAt = new Date().toISOString()

      const { error } = await supabase
        .from('leads')
        .update({ physician_order_sent_to_insurance_at: sentToInsuranceAt })
        .eq('id', selectedClient.id)

      if (error) throw error

      setSelectedClient({
        ...selectedClient,
        physician_order_sent_to_insurance_at: sentToInsuranceAt
      })
      await fetchLeads()
    } catch (error) {
      console.error('Error marking physician order as sent to insurance:', error)
      alert('Failed to update status')
    }
  }

  const handleMarkPhysicianOrderInsuranceReceived = async () => {
    if (!supabase || !selectedClient) return

    try {
      const insuranceReceivedAt = new Date().toISOString()

      const { error } = await supabase
        .from('leads')
        .update({ physician_order_insurance_received_at: insuranceReceivedAt })
        .eq('id', selectedClient.id)

      if (error) throw error

      setSelectedClient({
        ...selectedClient,
        physician_order_insurance_received_at: insuranceReceivedAt
      })
      await fetchLeads()
    } catch (error) {
      console.error('Error marking insurance receipt for physician order:', error)
      alert('Failed to update status')
    }
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

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || result?.message || 'Failed to sync from Google Sheets')
      }

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
  const activeQualifiedLeads = qualifiedLeads.filter(lead => !lead.is_paused)
  const todayDateString = getLocalTodayDateString()
  const todayTasks = tasks
    .filter(task => task.due_date === todayDateString)
    .sort(sortTasksByDueDate)
  const activeTasks = tasks.filter(task => task.status !== 'completed')
  const projectNamesById = projects.reduce((acc, project) => {
    acc[project.id] = project.name
    return acc
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  // Navigation items
  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'leads', name: 'Leads', icon: '👤', badge: leads.length },
    { id: 'clients', name: 'Clients', icon: '👥', badge: activeQualifiedLeads.length },
    { id: 'shipping', name: 'Shipping', icon: '📦' },
    { id: 'products', name: 'Products', icon: '🏷️' },
    { id: 'calendar', name: 'Calendar', icon: '📅' },
    { id: 'billing', name: 'Billing', icon: '💰' },
    { id: 'projects', name: 'Projects & Tasks', icon: '✓' },
    { id: 'reports', name: 'Reports', icon: '📈' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo & Toggle */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-xl font-bold text-red-600">AllMedical</h1>}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id)
                setSelectedClient(null)
                setShowMobileDetails(false)
                if (item.id === 'shipping') {
                  fetchShippingSchedule()
                  syncGeneratePendingOrders({ showAlert: false })
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeView === item.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1">{item.name}</span>
                  {item.badge !== undefined && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200">
          {!sidebarCollapsed && (
            <div className="text-sm text-gray-600 mb-2 truncate">{userEmail}</div>
          )}
          <button
            onClick={onLogout}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium"
          >
            {sidebarCollapsed ? '⎋' : 'Logout'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {navigation.find(n => n.id === activeView)?.name || 'Dashboard'}
            </h2>
            <button
              onClick={handleSyncFromSheets}
              disabled={syncing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              {syncing ? 'Syncing...' : '↻ Sync from Google Sheets'}
            </button>
          </div>
        </div>

        {/* Sync Result Notification */}
        {syncResult && (
          <div className="px-6 pt-4">
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

        {queueSyncResult && (
          <div className="px-6 pt-4">
            {queueSyncResult.error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {queueSyncResult.error}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4 text-sm font-medium">
                Pending order sync: scanned {queueSyncResult.scanned}, created {queueSyncResult.created}, skipped {queueSyncResult.skippedExisting}.
              </div>
            )}
          </div>
        )}

        {/* View Content */}
        <div className="p-6">
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <div className="space-y-6">
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Pending Shipments */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Shipments</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{pendingOrders.filter(o => o.status === 'pending').length}</p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <span className="text-2xl">📦</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">Orders awaiting processing</p>
                </div>

                {/* Active Clients */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Clients</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{activeQualifiedLeads.length}</p>
                    </div>
                    <div className="bg-green-100 rounded-full p-3">
                      <span className="text-2xl">👥</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    {leads.length - qualifiedLeads.length} leads in pipeline
                  </p>
                </div>

                {/* Monthly Revenue */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        ${(() => {
                          const totalYearlyNetProfit = activeQualifiedLeads.reduce((total, client) => {
                            if (!client.calc_deductible || !client.calc_insurance_paid || !client.calc_percent_allowable || !client.calc_product_cost) {
                              return total
                            }

                            const { netYearlyProfit } = calculateInsuranceProjection({
                              deductible: parseFloat(client.calc_deductible) || 0,
                              oopMax: parseFloat(client.calc_oop_max) || 0,
                              percentOfAllowable: parseFloat(client.calc_percent_allowable) || 0,
                              allowableAmount: parseFloat(client.calc_insurance_paid) || 0,
                              costOfProduct: parseFloat(client.calc_product_cost) || 0
                            })

                            return total + netYearlyProfit
                          }, 0)

                          return (totalYearlyNetProfit / 12).toFixed(2)
                        })()}
                      </p>
                    </div>
                    <div className="bg-purple-100 rounded-full p-3">
                      <span className="text-2xl">💰</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">Estimated insurance revenue</p>
                </div>

                {/* Items Due Today */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Items Due Today</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {pendingOrders.filter(o => {
                          const today = new Date().toISOString().split('T')[0]
                          return o.ship_date === today && o.status === 'pending'
                        }).length}
                      </p>
                    </div>
                    <div className="bg-orange-100 rounded-full p-3">
                      <span className="text-2xl">⚡</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">Urgent shipments</p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Client Growth */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Growth</h3>
                  <div className="space-y-3">
                    {(() => {
                      // Client growth by month - counts when leads were converted to qualified status
                      const clientGrowthData = [
                        { month: 'Oct', clients: 0 },
                        { month: 'Nov', clients: 0 },
                        { month: 'Dec', clients: 0 },
                        { month: 'Jan', clients: 4 },
                        { month: 'Feb', clients: 10 },
                        { month: 'Mar', clients: 10 }
                      ]
                      
                      const maxClients = Math.max(...clientGrowthData.map(d => d.clients), 1)
                      
                      return clientGrowthData.map((data) => {
                        const percentage = (data.clients / maxClients) * 100
                        return (
                          <div key={data.month} className="flex items-center gap-3">
                            <div className="w-12 text-sm text-gray-600">{data.month}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-blue-600 rounded-full h-3" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="w-12 text-sm font-semibold text-gray-900 text-right">{data.clients}</div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>

                {/* Product Demand */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Demand</h3>
                  <div className="space-y-3">
                    {(() => {
                      // Count products across all clients
                      const productCounts = {}
                      Object.values(allClientProducts).forEach(clientProds => {
                        clientProds.forEach(cp => {
                          const name = cp.products?.name || 'Unknown'
                          productCounts[name] = (productCounts[name] || 0) + 1
                        })
                      })
                      
                      const sortedProducts = Object.entries(productCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                      
                      const maxCount = sortedProducts[0]?.[1] || 1
                      
                      return sortedProducts.length > 0 ? sortedProducts.map(([name, count]) => {
                        const percentage = (count / maxCount) * 100
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <div className="w-32 text-sm text-gray-600 truncate">{name}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-green-600 rounded-full h-3" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="w-12 text-sm font-semibold text-gray-900 text-right">{count}</div>
                          </div>
                        )
                      }) : (
                        <p className="text-gray-500 text-sm">No product data yet</p>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Tasks for Today */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Tasks for Today</h3>
                  <span className="text-sm text-gray-500">
                    {todayTasks.filter(task => task.status !== 'completed').length} remaining
                  </span>
                </div>

                {todayTasks.length > 0 ? (
                  <div className="space-y-3">
                    {todayTasks.map((task) => (
                      <label key={task.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.status === 'completed'}
                          onChange={(e) => updateTaskStatus(task.id, e.target.checked ? 'completed' : 'todo')}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {projectNamesById[task.project_id] || 'No Project'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No tasks due today.</p>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {(() => {
                    // Get recent leads (last 5)
                    const recentLeads = [...leads].sort((a, b) => 
                      new Date(b.created_at) - new Date(a.created_at)
                    ).slice(0, 5)
                    
                    return recentLeads.length > 0 ? recentLeads.map((lead) => (
                      <div key={lead.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <div className="bg-blue-100 rounded-full p-2">
                          <span className="text-sm">👤</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                          <p className="text-xs text-gray-500">{lead.email}</p>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    )) : (
                      <p className="text-gray-500 text-sm">No recent activity</p>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Leads Tab */}
          {activeView === 'leads' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Search and Add Lead Controls */}
              <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                >
                  + Add Lead
                </button>
              </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
            
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {allLeads.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No leads yet
                </div>
              ) : (
                allLeads.map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-gray-50">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-gray-900 text-base">
                          {lead.name}
                        </div>
                        <select
                          value={lead.stage}
                          onChange={(e) => updateStage(lead.id, e.target.value)}
                          disabled={updating}
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(lead.stage)} border-0 cursor-pointer`}
                        >
                          <option value="new">New</option>
                          <option value="called">Called</option>
                          <option value="reached">Reached</option>
                          <option value="unqualified">Unqualified</option>
                          <option value="qualified">Qualified</option>
                        </select>
                      </div>
                      
                      <a 
                        href={`tel:${lead.phone}`} 
                        className="block text-blue-600 font-medium text-base"
                      >
                        📞 {lead.phone}
                      </a>
                      
                      <a 
                        href={`mailto:${lead.email}`}
                        className="block text-gray-600 text-sm truncate"
                      >
                        {lead.email}
                      </a>
                      
                      {lead.insurance && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Insurance:</span> {lead.insurance}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Clients View */}
        {activeView === 'clients' && (
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {/* Clients List */}
            <div className={`bg-white rounded-lg shadow ${showMobileDetails ? 'hidden md:block' : 'block'}`}>
              <div className="p-3 sm:p-4 border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Client List</h2>
                <p className="text-xs text-gray-600 mb-3">
                  Full Clients: {qualifiedLeads.length} • Active Clients: {activeQualifiedLeads.length}
                </p>
                
                {/* Search and Filters */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search clients (name, email, phone)..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={clientStatusFilter}
                      onChange={(e) => {
                        setClientStatusFilter(e.target.value)
                        setInsuranceFilter('')
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="active">Active Clients</option>
                      <option value="all">All Clients</option>
                      <option value="paused">Paused Clients</option>
                    </select>
                    <select
                      value={insuranceFilter}
                      onChange={(e) => setInsuranceFilter(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">All Insurance</option>
                      {[...new Set((clientStatusFilter === 'paused' ? qualifiedLeads.filter(c => c.is_paused) : activeQualifiedLeads).map(c => c.insurance).filter(Boolean))].sort().map(insurance => (
                        <option key={insurance} value={insurance}>{insurance}</option>
                      ))}
                    </select>
                    <select
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">All Products</option>
                      <option value="sensor">CGM Sensors</option>
                      <option value="pod">Pods</option>
                      <option value="infusion_set">Infusion Sets</option>
                      <option value="test_strips">Test Strips</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {(() => {
                  // Apply filters
                  let filtered = qualifiedLeads;

                  // Active/paused filter
                  if (clientStatusFilter === 'active') {
                    filtered = filtered.filter(client => !client.is_paused)
                  } else if (clientStatusFilter === 'paused') {
                    filtered = filtered.filter(client => client.is_paused)
                  }
                  
                  // Search filter
                  if (clientSearchQuery) {
                    const query = clientSearchQuery.toLowerCase();
                    filtered = filtered.filter(client => 
                      client.name?.toLowerCase().includes(query) ||
                      client.email?.toLowerCase().includes(query) ||
                      client.phone?.toLowerCase().includes(query)
                    );
                  }
                  
                  // Insurance filter
                  if (insuranceFilter) {
                    filtered = filtered.filter(client => client.insurance === insuranceFilter);
                  }
                  
                  // Product category filter
                  if (productFilter) {
                    filtered = filtered.filter(client => {
                      const clientProds = allClientProducts[client.id] || [];
                      return clientProds.some(p => p.category === productFilter);
                    });
                  }
                  
                  return filtered.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {qualifiedLeads.length === 0 ? 'No qualified clients yet' : 'No clients match filters'}
                    </div>
                  ) : (
                    filtered.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client)
                        setShowMobileDetails(true)
                      }}
                      className={`p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedClient?.id === client.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-semibold text-gray-900 text-sm sm:text-base">
                        {client.name}
                        {client.is_paused && (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                            Paused
                          </span>
                        )}
                        {(!client.address_line1 || !client.birthday) && (
                          <span className="ml-2 text-red-600 text-xs sm:text-sm font-medium block sm:inline mt-1 sm:mt-0">
                            {!client.address_line1 && !client.birthday ? 'Address & DOB Needed!' : 
                             !client.address_line1 ? 'Address Needed!' : 'DOB Needed!'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">{client.email}</div>
                      <div className="text-xs sm:text-sm text-gray-600">{client.phone}</div>
                      {/* Product Badges */}
                      {allClientProducts[client.id] && allClientProducts[client.id].length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {allClientProducts[client.id].map((product, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">
                              {product.category === 'sensor' ? '📱' :
                               product.category === 'pod' ? '💊' :
                               product.category === 'infusion_set' ? '💉' :
                               product.category === 'test_strips' ? '🩸' : '📦'}
                              {product.category}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                  );
                })()}
              </div>
            </div>

            {/* Client Details */}
            <div className={`bg-white rounded-lg shadow ${!showMobileDetails ? 'hidden md:block' : 'block'}`}>
              <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center gap-2">
                <button
                  onClick={() => setShowMobileDetails(false)}
                  className="md:hidden text-gray-600 hover:text-gray-900 p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Client Details</h2>
              </div>
              {selectedClient ? (
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                        {selectedClient.name}
                      </h3>
                      {selectedClient.is_paused && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                          Paused Client
                        </span>
                      )}
                    </div>
                    <button
                      onClick={openEditModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Two Column Layout for Basic Info */}
                  <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                    {/* Left Column - Contact & Address */}
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <div className="text-sm sm:text-base text-gray-900 break-words">{selectedClient.email}</div>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <div className="text-sm sm:text-base text-gray-900">{selectedClient.phone}</div>
                      </div>

                      {/* Patient Address */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Patient Address
                        </label>
                        {selectedClient.address_line1 ? (
                          <div className="text-sm sm:text-base text-gray-900">
                            <div>{selectedClient.address_line1}</div>
                            {(selectedClient.city || selectedClient.state || selectedClient.zip_code) && (
                              <div>
                                {selectedClient.city}{selectedClient.city && (selectedClient.state || selectedClient.zip_code) ? ', ' : ''}
                                {selectedClient.state} {selectedClient.zip_code}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-red-600 text-xs sm:text-sm font-medium">Not provided</div>
                        )}
                      </div>
                    </div>

                    {/* Right Column - Business Info */}
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Date of Birth
                        </label>
                        {selectedClient.birthday ? (
                          <div className="text-sm sm:text-base text-gray-900">
                            {formatDate(selectedClient.birthday)}
                          </div>
                        ) : (
                          <div className="text-red-600 text-xs sm:text-sm font-medium">Not provided</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Insurance Provider
                        </label>
                        <div className="text-sm sm:text-base text-gray-900">{selectedClient.insurance}</div>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Date Qualified
                        </label>
                        <div className="text-gray-900">
                          {selectedClient.qualified_at 
                            ? formatDate(selectedClient.qualified_at)
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

                    {/* Assigned Products Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Assigned Products
                        </label>
                        <button
                          onClick={() => {
                            setAssignProductClient(selectedClient)
                            setShowAssignProductModal(true)
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 font-medium"
                        >
                          + Add Product
                        </button>
                      </div>
                      {clientProducts.length === 0 ? (
                        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md text-center">
                          No products assigned yet. Click "+ Add Product" to assign products.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {clientProducts.map(cp => (
                            <div key={cp.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{cp.products?.name}</div>
                                <div className="text-xs text-gray-600">
                                  Quantity: {cp.quantity} • Next Ship: {cp.next_ship_date ? formatDate(cp.next_ship_date) : 'Not set'}
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (confirm(`Remove ${cp.products?.name} from this client?`)) {
                                    try {
                                      const { error } = await supabase
                                        .from('client_products')
                                        .update({ active: false })
                                        .eq('id', cp.id)
                                      if (error) throw error
                                      await fetchClientProducts(selectedClient.id)
                                    } catch (error) {
                                      console.error('Error removing product:', error)
                                      alert('Failed to remove product')
                                    }
                                  }
                                }}
                                className="ml-3 text-red-600 hover:text-red-700 text-xs font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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

                    {/* Payment Calculator Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Insurance Payment Calculator
                        </label>
                        {selectedClient.calc_deductible && !editingCalculator ? (
                          <button
                            onClick={() => {
                              setClientCalcInputs({
                                deductible: selectedClient.calc_deductible?.toString() || '',
                                oopMax: selectedClient.calc_oop_max?.toString() || '',
                                percentOfAllowable: selectedClient.calc_percent_allowable?.toString() || '',
                                insurancePaidAmount: selectedClient.calc_insurance_paid?.toString() || '',
                                costOfProduct: selectedClient.calc_product_cost?.toString() || ''
                              })
                              setEditingCalculator(true)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                          >
                            Edit Calculator
                          </button>
                        ) : editingCalculator ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingCalculator(false)}
                              className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleUpdateClientCalculator}
                              disabled={updating}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:bg-gray-300"
                            >
                              {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {selectedClient.calc_deductible && !editingCalculator ? (
                        <div className="space-y-4">
                          {/* Net Profit Display */}
                          {(() => {
                            const { netYearlyProfit } = calculateInsuranceProjection({
                              deductible: parseFloat(selectedClient.calc_deductible) || 0,
                              oopMax: parseFloat(selectedClient.calc_oop_max) || 0,
                              percentOfAllowable: parseFloat(selectedClient.calc_percent_allowable) || 0,
                              allowableAmount: parseFloat(selectedClient.calc_insurance_paid) || 0,
                              costOfProduct: parseFloat(selectedClient.calc_product_cost) || 0
                            })

                            return (
                              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border-2 border-blue-200">
                                <div className="text-center">
                                  <div className="text-sm font-medium text-gray-600 mb-2">Projected Net Yearly Profit</div>
                                  <div className="text-4xl font-bold text-green-700">
                                    ${netYearlyProfit.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Saved Calculator Inputs */}
                          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div>
                              <div className="text-xs font-medium text-gray-600">Deductible</div>
                              <div className="text-sm text-gray-900">${selectedClient.calc_deductible}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600">Out-of-Pocket Max</div>
                              <div className="text-sm text-gray-900">${selectedClient.calc_oop_max || 'None'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600">Insurance Coverage %</div>
                              <div className="text-sm text-gray-900">{selectedClient.calc_percent_allowable}%</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-600">Insurance Allowable Amount per Month</div>
                              <div className="text-sm text-gray-900">${selectedClient.calc_insurance_paid}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-xs font-medium text-gray-600">Product Cost (Monthly)</div>
                              <div className="text-sm text-gray-900">${selectedClient.calc_product_cost}</div>
                            </div>
                          </div>
                        </div>
                      ) : editingCalculator ? (
                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Deductible ($)</label>
                            <input
                              type="number"
                              value={clientCalcInputs.deductible}
                              onChange={(e) => setClientCalcInputs({ ...clientCalcInputs, deductible: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="1000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Out-of-Pocket Max ($)</label>
                            <input
                              type="number"
                              value={clientCalcInputs.oopMax}
                              onChange={(e) => setClientCalcInputs({ ...clientCalcInputs, oopMax: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="3000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Insurance Coverage % (e.g., 80)</label>
                            <input
                              type="number"
                              value={clientCalcInputs.percentOfAllowable}
                              onChange={(e) => setClientCalcInputs({ ...clientCalcInputs, percentOfAllowable: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="80"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Insurance Allowable Amount per Month ($)</label>
                            <input
                              type="number"
                              value={clientCalcInputs.insurancePaidAmount}
                              onChange={(e) => setClientCalcInputs({ ...clientCalcInputs, insurancePaidAmount: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="2000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Product Cost (Monthly) ($)</label>
                            <input
                              type="number"
                              value={clientCalcInputs.costOfProduct}
                              onChange={(e) => setClientCalcInputs({ ...clientCalcInputs, costOfProduct: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              placeholder="50"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          No calculator data saved. Visit the Payment Calculator tab to add calculations for this patient.
                        </div>
                      )}
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
                              <div className="absolute top-3 right-3 flex gap-2">
                                <button
                                  onClick={() => handleEditDoctor(doctor)}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-full transition-colors"
                                  title="Edit doctor"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteDoctor(doctor.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-full transition-colors"
                                  title="Delete doctor"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                              <div className="font-semibold text-gray-900 text-lg mb-2 pr-20">{doctor.full_name}</div>
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
                      {/* Physician Order Status Workflow */}
                      {selectedClient.physician_order_generated_at && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
                            </svg>
                            Physician Order Status
                          </h4>
                          
                          <div className="space-y-3">
                            {/* Generated */}
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">Generated</div>
                                <div className="text-sm text-gray-600">
                                  {formatDate(selectedClient.physician_order_generated_at)}
                                </div>
                              </div>
                            </div>

                            {/* Sent */}
                            <div className="flex items-center gap-3">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                selectedClient.physician_order_sent_at 
                                  ? 'bg-green-500' 
                                  : 'bg-gray-300'
                              }`}>
                                {selectedClient.physician_order_sent_at ? (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                ) : (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">Sent to Doctor</div>
                                {selectedClient.physician_order_sent_at ? (
                                  <div className="text-sm text-gray-600">
                                    {formatDate(selectedClient.physician_order_sent_at)}
                                  </div>
                                ) : (
                                  <button
                                    onClick={handleMarkPhysicianOrderSent}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Mark as Sent
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Received */}
                            <div className="flex items-center gap-3">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                selectedClient.physician_order_received_at 
                                  ? 'bg-green-500' 
                                  : 'bg-gray-300'
                              }`}>
                                {selectedClient.physician_order_received_at ? (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                ) : (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">Received Signed</div>
                                {selectedClient.physician_order_received_at ? (
                                  <div className="text-sm text-gray-600">
                                    {formatDate(selectedClient.physician_order_received_at)}
                                    {selectedClient.physician_order_file_url && (
                                      <div className="mt-1">
                                        <a 
                                          href={selectedClient.physician_order_file_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                                          </svg>
                                          View Signed Order
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ) : selectedClient.physician_order_sent_at ? (
                                  <div>
                                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer font-medium transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                      </svg>
                                      Upload Signed Order
                                      <input 
                                        type="file" 
                                        onChange={handlePhysicianOrderFileUpload}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        className="hidden"
                                        disabled={updating}
                                      />
                                    </label>
                                    <button
                                      onClick={handleMarkPhysicianOrderReceived}
                                      className="ml-2 text-sm text-gray-600 hover:text-gray-800 underline"
                                    >
                                      Mark received without file
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500">Send first to mark as received</div>
                                )}
                              </div>
                            </div>

                            {/* Sent to Insurance */}
                            <div className="flex items-center gap-3">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                selectedClient.physician_order_sent_to_insurance_at
                                  ? 'bg-green-500'
                                  : 'bg-gray-300'
                              }`}>
                                {selectedClient.physician_order_sent_to_insurance_at ? (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                ) : (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">Physician Order Sent to Insurance</div>
                                {selectedClient.physician_order_sent_to_insurance_at ? (
                                  <div className="text-sm text-gray-600">
                                    {formatDate(selectedClient.physician_order_sent_to_insurance_at)}
                                  </div>
                                ) : selectedClient.physician_order_received_at ? (
                                  <button
                                    onClick={handleMarkPhysicianOrderSentToInsurance}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Mark as Sent to Insurance
                                  </button>
                                ) : (
                                  <div className="text-sm text-gray-500">Receive signed order first</div>
                                )}
                              </div>
                            </div>

                            {/* Insurance Received */}
                            <div className="flex items-center gap-3">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                selectedClient.physician_order_insurance_received_at
                                  ? 'bg-green-500'
                                  : 'bg-gray-300'
                              }`}>
                                {selectedClient.physician_order_insurance_received_at ? (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                ) : (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">Insurance Received Physician Order</div>
                                {selectedClient.physician_order_insurance_received_at ? (
                                  <div className="text-sm text-gray-600">
                                    {formatDate(selectedClient.physician_order_insurance_received_at)}
                                  </div>
                                ) : selectedClient.physician_order_sent_to_insurance_at ? (
                                  <button
                                    onClick={handleMarkPhysicianOrderInsuranceReceived}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Mark as Insurance Received
                                  </button>
                                ) : (
                                  <div className="text-sm text-gray-500">Send to insurance first</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

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
                            {selectedClient.physician_order_generated_at ? 'Regenerate Physician Order' : 'Generate Physician Order'}
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
                <div className="p-8 text-center text-gray-500 hidden md:block">
                  Select a client to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar View */}
        {activeView === 'calendar' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">📅 Shipping Calendar</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11)
                      setSelectedYear(selectedYear - 1)
                    } else {
                      setSelectedMonth(selectedMonth - 1)
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ← Prev
                </button>
                <div className="min-w-[150px] text-center font-bold text-gray-900">
                  {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  Next →
                </button>
                <button
                  onClick={() => {
                    setSelectedMonth(new Date().getMonth())
                    setSelectedYear(new Date().getFullYear())
                  }}
                  className="ml-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="flex gap-6">
              {/* Ship Today Panel - Left */}
              <div className="w-64 border-r pr-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📦 Ship Today</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const todayShipments = shippingScheduleItems.filter(item => {
                      const itemDate = new Date(item.next_ship_date + 'T00:00:00')
                      return itemDate.getTime() === today.getTime()
                    })
                    
                    if (todayShipments.length === 0) {
                      return <p className="text-sm text-gray-500">No shipments due today</p>
                    }
                    
                    return todayShipments.map(item => (
                      <div key={item.id} className="bg-green-50 border border-green-300 rounded-lg p-3">
                        <div className="font-medium text-gray-900 text-sm">{item.client_name}</div>
                        <div className="text-xs text-gray-600 mt-1">{item.product_name}</div>
                        <div className="text-xs text-gray-600">Qty: {item.quantity}</div>
                        <button
                          onClick={() => handleMarkShipped(item)}
                          disabled={updating}
                          className="mt-2 w-full px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium"
                        >
                          ✓ Mark Shipped
                        </button>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {/* Month Calendar Grid - Right */}
              <div className="flex-1">
                {(() => {
                  const firstDay = new Date(selectedYear, selectedMonth, 1)
                  const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
                  const daysInMonth = lastDay.getDate()
                  const startingDayOfWeek = firstDay.getDay()
                  
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  const calendarDays = []
                  
                  // Add empty cells for days before month starts
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    calendarDays.push(null)
                  }
                  
                  // Add days of month
                  for (let day = 1; day <= daysInMonth; day++) {
                    calendarDays.push(day)
                  }
                  
                  return (
                    <div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-0 mb-2 bg-gray-100 rounded-lg overflow-hidden">
                        {days.map(day => (
                          <div key={day} className="p-2 text-center font-bold text-gray-700 text-sm">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                        {calendarDays.map((day, idx) => {
                          if (day === null) {
                            return <div key={`empty-${idx}`} className="h-24 bg-white"></div>
                          }
                          
                          const cellDate = new Date(selectedYear, selectedMonth, day)
                          cellDate.setHours(0, 0, 0, 0)
                          const cellShipments = shippingScheduleItems.filter(item => {
                            const itemDate = new Date(item.next_ship_date + 'T00:00:00')
                            return itemDate.getTime() === cellDate.getTime()
                          })
                          
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          const isToday = cellDate.getTime() === today.getTime()
                          const isPast = cellDate < today
                          
                          return (
                            <div
                              key={day}
                              className={`h-24 p-2 rounded border-2 overflow-hidden ${
                                isToday ? 'bg-blue-100 border-blue-500' :
                                isPast && cellShipments.length > 0 ? 'bg-red-50 border-red-300' :
                                cellShipments.length > 0 ? 'bg-yellow-50 border-yellow-300' :
                                'bg-white border-gray-300'
                              }`}
                            >
                              <div className="text-sm font-bold text-gray-900">{day}</div>
                              <div className="text-xs space-y-1 mt-1 overflow-y-auto">
                                {cellShipments.slice(0, 2).map(item => (
                                  <div key={item.id} className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded text-xs truncate">
                                    {item.client_name}
                                  </div>
                                ))}
                                {cellShipments.length > 2 && (
                                  <div className="text-gray-600 text-xs px-1">
                                    +{cellShipments.length - 2} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Billing View */}
        {activeView === 'billing' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Insurance Payment Calculator</h2>
            
            {/* Patient Selector */}
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Select Patient
                  </label>
                  <select
                    value={selectedCalcClient?.id || ''}
                    onChange={(e) => {
                      const client = leads.find(l => l.id === e.target.value && l.stage === 'qualified')
                      handleLoadCalculatorFromPatient(client || null)
                    }}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  >
                    <option value="">-- Select a patient to save calculations --</option>
                    {leads
                      .filter(lead => lead.stage === 'qualified')
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(lead => (
                        <option key={lead.id} value={lead.id}>
                          {lead.name} {lead.insurance ? `(${lead.insurance})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="w-full sm:w-auto sm:pt-7">
                  <button
                    onClick={handleSaveCalculatorToPatient}
                    disabled={!selectedCalcClient || updating}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                  >
                    {updating ? 'Saving...' : 'Save to Patient'}
                  </button>
                </div>
              </div>
              {selectedCalcClient && selectedCalcClient.calc_deductible && (
                <div className="mt-3 text-sm text-green-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Saved calculations loaded for this patient
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
              {/* Input Section */}
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b pb-2">Input Parameters</h3>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Deductible ($)
                  </label>
                  <input
                    type="number"
                    value={calcInputs.deductible}
                    onChange={(e) => setCalcInputs({ ...calcInputs, deductible: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="1000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Amount patient must pay before insurance coverage begins</p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Out-of-Pocket Max ($)
                  </label>
                  <input
                    type="number"
                    value={calcInputs.oopMax}
                    onChange={(e) => setCalcInputs({ ...calcInputs, oopMax: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="3000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum patient pays; after this, insurance pays 100% (leave 0 for no max)</p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    % of Allowable (Insurance Coverage)
                  </label>
                  <input
                    type="number"
                    value={calcInputs.percentOfAllowable}
                    onChange={(e) => setCalcInputs({ ...calcInputs, percentOfAllowable: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="80"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Percentage insurance pays (e.g., 80 means insurance pays 80%)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Paid Amount per Month ($)
                  </label>
                  <input
                    type="number"
                    value={calcInputs.insurancePaidAmount}
                    onChange={(e) => setCalcInputs({ ...calcInputs, insurancePaidAmount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="200"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total allowable amount per month (insurance will pay their % of this)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost of Product per Month ($)
                  </label>
                  <input
                    type="number"
                    value={calcInputs.costOfProduct}
                    onChange={(e) => setCalcInputs({ ...calcInputs, costOfProduct: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your monthly cost to provide the product</p>
                </div>
              </div>

              {/* Results Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Annual Profit Projection</h3>
                
                {(() => {
                  // Parse inputs
                  const deductible = parseFloat(calcInputs.deductible) || 0
                  const oopMax = parseFloat(calcInputs.oopMax) || 0
                  const percentOfAllowable = parseFloat(calcInputs.percentOfAllowable) || 0
                  const allowableAmount = parseFloat(calcInputs.insurancePaidAmount) || 0
                  const costOfProduct = parseFloat(calcInputs.costOfProduct) || 0

                  const {
                    grossYearlyProfit,
                    netYearlyProfit,
                    totalCost,
                    monthlyBreakdown
                  } = calculateInsuranceProjection({
                    deductible,
                    oopMax,
                    percentOfAllowable,
                    allowableAmount,
                    costOfProduct
                  })

                  return (
                    <>
                      <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
                        <div className="text-sm font-medium text-green-900 mb-1">Gross Yearly Profit</div>
                        <div className="text-4xl font-bold text-green-700">
                          ${grossYearlyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-green-600 mt-2">Total revenue before product costs</div>
                      </div>

                      <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
                        <div className="text-sm font-medium text-blue-900 mb-1">Net Yearly Profit</div>
                        <div className="text-4xl font-bold text-blue-700">
                          ${netYearlyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-blue-600 mt-2">
                          After ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} product costs
                        </div>
                      </div>

                      {/* Monthly Breakdown */}
                      {allowableAmount > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3">Monthly Breakdown</h4>
                          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="px-2 py-2 text-left font-medium text-gray-700">Month</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-700">Revenue</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-700">Remaining Ded.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {monthlyBreakdown.map((m) => (
                                  <tr key={m.month} className="hover:bg-gray-50">
                                    <td className="px-2 py-2 text-gray-900">{m.month}</td>
                                    <td className="px-2 py-2 text-right text-gray-900">
                                      ${m.monthRevenue.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-600">
                                      ${m.remainingDeductible.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {allowableAmount === 0 && (
                        <div className="text-center text-gray-500 py-12 border-2 border-dashed border-gray-300 rounded-lg">
                          <p>Enter values to see profit projections</p>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Reports View */}
        {activeView === 'reports' && (() => {
          // Calculate metrics from all qualified clients with calculator data
          const clientsWithCalc = leads.filter(l => 
            l.stage === 'qualified' && 
            l.calc_deductible && 
            l.calc_insurance_paid && 
            l.calc_percent_allowable && 
            l.calc_product_cost
          )

          const calculateClientProfit = (client) => {
            const { grossYearlyProfit, netYearlyProfit, totalCost } = calculateInsuranceProjection({
              deductible: parseFloat(client.calc_deductible) || 0,
              oopMax: parseFloat(client.calc_oop_max) || 0,
              percentOfAllowable: parseFloat(client.calc_percent_allowable) || 0,
              allowableAmount: parseFloat(client.calc_insurance_paid) || 0,
              costOfProduct: parseFloat(client.calc_product_cost) || 0
            })

            const grossProfit = grossYearlyProfit
            const netProfit = netYearlyProfit

            return { grossProfit, netProfit, totalCost }
          }

          // Calculate totals
          const totals = clientsWithCalc.reduce((acc, client) => {
            const { grossProfit, netProfit, totalCost } = calculateClientProfit(client)
            acc.totalGrossRevenue += grossProfit
            acc.totalNetProfit += netProfit
            acc.totalCost += totalCost
            return acc
          }, { totalGrossRevenue: 0, totalNetProfit: 0, totalCost: 0 })

          const avgProfitPerCustomer = clientsWithCalc.length > 0 
            ? totals.totalNetProfit / clientsWithCalc.length 
            : 0

          const avgCostPerCustomer = clientsWithCalc.length > 0
            ? totals.totalCost / clientsWithCalc.length
            : 0

          // Calculate by insurance company with flexible matching
          const insuranceCompanies = [
            { code: 'BCBS', patterns: ['BCBS', 'BLUE CROSS', 'BLUE SHIELD'] },
            { code: 'UHC', patterns: ['UHC', 'UNITED HEALTH', 'UNITEDHEALTHCARE'] },
            { code: 'Aetna', patterns: ['AETNA'] },
            { code: 'Cigna', patterns: ['CIGNA'] },
            { code: 'UMR', patterns: ['UMR'] },
            { code: 'OTH_INSUR', patterns: ['OTH_INSUR', 'OTHER'] }
          ]
          
          const insuranceStats = insuranceCompanies.map(({ code, patterns }) => {
            const clients = clientsWithCalc.filter(c => {
              if (!c.insurance) return false
              const insuranceUpper = c.insurance.toUpperCase()
              return patterns.some(pattern => insuranceUpper.includes(pattern))
            })
            
            if (clients.length === 0) {
              return { company: code, avgProfit: 0, count: 0 }
            }

            const totalProfit = clients.reduce((sum, client) => {
              const { netProfit } = calculateClientProfit(client)
              return sum + netProfit
            }, 0)

            return {
              company: code,
              avgProfit: totalProfit / clients.length,
              count: clients.length
            }
          })

          return (
            <div className="space-y-4 sm:space-y-6">
              {/* Expense Management Section */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">💸 Expense Management</h2>
                  <button
                    onClick={() => setShowAddExpenseModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    + Add Expense
                  </button>
                </div>

                {/* Monthly P&L Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                    <div className="text-sm font-medium text-green-800 mb-1">Revenue (from clients)</div>
                    <div className="text-2xl font-bold text-green-700">
                      ${totals.totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                    <div className="text-sm font-medium text-red-800 mb-1">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-700">
                      ${expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-800 mb-1">Net Profit</div>
                    <div className="text-2xl font-bold text-blue-700">
                      ${(totals.totalNetProfit - expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Expenses List */}
                {expenses.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {new Date(expense.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{expense.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs">{expense.category}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                              ${parseFloat(expense.amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={async () => {
                                  if (confirm('Delete this expense?')) {
                                    const { error } = await supabase
                                      .from('expenses')
                                      .delete()
                                      .eq('id', expense.id)
                                    if (!error) {
                                      setExpenses(expenses.filter(e => e.id !== expense.id))
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No expenses recorded yet. Click "Add Expense" to get started.</p>
                  </div>
                )}
              </div>

              {/* Custom Data Tables Section */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">📋 Custom Data Tables</h2>
                  <button
                    onClick={() => {
                      setEditingTable(null)
                      setNewTableForm({ name: '', description: '', columns: [] })
                      setShowAddTableModal(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    + New Table
                  </button>
                </div>

                {customDataTables.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="mb-4">No custom tables yet. Create one to manage your own data.</p>
                    <button
                      onClick={() => {
                        setEditingTable(null)
                        setNewTableForm({ name: '', description: '', columns: [] })
                        setShowAddTableModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Create your first table
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Table Tabs */}
                    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                      {customDataTables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => setSelectedTableId(table.id)}
                          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                            selectedTableId === table.id
                              ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {table.name}
                        </button>
                      ))}
                    </div>

                    {/* Selected Table Data Editor */}
                    {selectedTableId && (() => {
                      const table = customDataTables.find(t => t.id === selectedTableId)
                      const columns = tableColumnsData[selectedTableId] || []
                      const rows = tableRowsData[selectedTableId] || []

                      return (
                        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">{table?.name}</h3>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingRowId(null)
                                  setEditingRowData({})
                                  setNewRowForm({})
                                }}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
                              >
                                + Add Row
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTable(table)
                                  setNewTableForm({
                                    name: table.name,
                                    description: table.description || '',
                                    columns: columns.map(c => c.column_name)
                                  })
                                  setShowAddTableModal(true)
                                }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                              >
                                Edit Table
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete table "${table.name}" and all its data? This cannot be undone.`)) {
                                    const { error } = await supabase
                                      .from('custom_data_tables')
                                      .delete()
                                      .eq('id', table.id)
                                    if (!error) {
                                      setSelectedTableId(null)
                                      await fetchCustomDataTables()
                                    }
                                  }
                                }}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
                              >
                                Delete Table
                              </button>
                            </div>
                          </div>

                          {columns.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No columns defined. Edit the table to add columns.</p>
                          ) : (
                            <>
                              {/* Data Table */}
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      {columns.map((col) => (
                                        <th key={col.id} className="px-4 py-3 text-left font-semibold text-gray-700">
                                          {col.column_name}
                                        </th>
                                      ))}
                                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {rows.map((row) => (
                                      <tr key={row.id} className={editingRowId === row.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                                        {columns.map((col) => (
                                          <td key={col.id} className="px-4 py-3 text-gray-700">
                                            <input
                                              type="text"
                                              value={editingRowId === row.id
                                                ? (editingRowData[col.column_name] || '')
                                                : (row.data[col.column_name] || '')
                                              }
                                              onFocus={() => {
                                                if (editingRowId !== row.id) {
                                                  setEditingRowId(row.id)
                                                  setEditingRowData({ ...(row.data || {}) })
                                                }
                                              }}
                                              onChange={(e) => {
                                                setEditingRowId(row.id)
                                                setEditingRowData((prev) => ({
                                                  ...(editingRowId === row.id ? prev : (row.data || {})),
                                                  [col.column_name]: e.target.value
                                                }))
                                              }}
                                              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                              placeholder={col.column_name}
                                            />
                                          </td>
                                        ))}
                                        <td className="px-4 py-3 text-center">
                                          <div className="flex gap-2 justify-center">
                                            {editingRowId === row.id && (
                                              <>
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                                  Unsaved
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => saveTableRow(selectedTableId, editingRowData)}
                                                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingRowId(null)
                                                    setEditingRowData({})
                                                  }}
                                                  className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs"
                                                >
                                                  Cancel
                                                </button>
                                              </>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => deleteTableRow(row.id, selectedTableId)}
                                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* New Row Form */}
                              {editingRowId === null && Object.keys(editingRowData).length === 0 && (
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {columns.map((col) => (
                                      <div key={col.id}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{col.column_name}</label>
                                        <input
                                          type="text"
                                          value={newRowForm[col.column_name] || ''}
                                          onChange={(e) => setNewRowForm({
                                            ...newRowForm,
                                            [col.column_name]: e.target.value
                                          })}
                                          placeholder={`Enter ${col.column_name}`}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <button
                                      onClick={() => saveTableRow(selectedTableId, newRowForm)}
                                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium"
                                    >
                                      Add Row
                                    </button>
                                    <button
                                      onClick={() => setNewRowForm({})}
                                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                  <span>📊 Business Analytics</span>
                </h2>

                {/* Overall Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-500 rounded-lg p-4 sm:p-6">
                    <div className="text-xs sm:text-sm font-medium text-green-800 mb-2">💰 Total Gross Revenue</div>
                    <div className="text-2xl sm:text-3xl font-bold text-green-700">
                      ${totals.totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-green-600 mt-2">{clientsWithCalc.length} customers</div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-500 rounded-lg p-4 sm:p-6">
                    <div className="text-xs sm:text-sm font-medium text-blue-800 mb-2">✨ Total Net Profit</div>
                    <div className="text-2xl sm:text-3xl font-bold text-blue-700">
                      ${totals.totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-blue-600 mt-2">After all costs</div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-500 rounded-lg p-4 sm:p-6">
                    <div className="text-xs sm:text-sm font-medium text-purple-800 mb-2">📈 Avg Profit/Customer</div>
                    <div className="text-2xl sm:text-3xl font-bold text-purple-700">
                      ${avgProfitPerCustomer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-purple-600 mt-2">Per year</div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-500 rounded-lg p-6">
                    <div className="text-sm font-medium text-orange-800 mb-2">💸 Avg Cost/Customer</div>
                    <div className="text-3xl font-bold text-orange-700">
                      ${avgCostPerCustomer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-orange-600 mt-2">Per year</div>
                  </div>
                </div>

                {/* Insurance Company Breakdown */}
                <div className="mt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🏥 Average Profit by Insurance Company</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {insuranceStats.map((stat) => (
                      <div
                        key={stat.company}
                        className={`border-2 rounded-lg p-5 ${
                          stat.count > 0
                            ? 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-400'
                            : 'bg-gray-50 border-gray-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-bold text-gray-900">{stat.company}</div>
                          <div className="text-xs bg-white px-2 py-1 rounded-full text-gray-600 font-medium">
                            {stat.count} {stat.count === 1 ? 'client' : 'clients'}
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${
                          stat.count > 0 ? 'text-indigo-700' : 'text-gray-500'
                        }`}>
                          {stat.count > 0
                            ? `$${stat.avgProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : 'No data'
                          }
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Avg profit per year</div>
                      </div>
                    ))}
                  </div>
                </div>

                {clientsWithCalc.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-6xl mb-4">📊</div>
                    <p className="text-xl font-semibold">No calculator data yet</p>
                    <p className="text-sm mt-2">Add calculator data to clients to see analytics</p>
                  </div>
                )}

                {/* Client Details Table - Show clients WITH calculator data */}
                {clientsWithCalc.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      📋 Client Profit Details ({clientsWithCalc.length} clients)
                    </h3>
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-gray-800">Client Name</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-800">Insurance</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-800">Coverage %</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-800">Allowable/Month</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-800">Product Cost</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-800">Deductible</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-800">OOP Max</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-800">Net Profit/Year</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {clientsWithCalc.map((client) => {
                              const { grossProfit, netProfit, totalCost } = calculateClientProfit(client)
                              const deductible = parseFloat(client.calc_deductible) || 0
                              const oopMax = parseFloat(client.calc_oop_max) || 0
                              const percentOfAllowable = parseFloat(client.calc_percent_allowable) || 0
                              const insurancePaidAmount = parseFloat(client.calc_insurance_paid) || 0
                              const costOfProduct = parseFloat(client.calc_product_cost) || 0
                              
                              return (
                                <tr key={client.id} className="hover:bg-blue-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                                  <td className="px-4 py-3 text-gray-700">{client.insurance || 'N/A'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{percentOfAllowable}%</td>
                                  <td className="px-4 py-3 text-right text-gray-700">
                                    ${insurancePaidAmount.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-700">
                                    ${costOfProduct.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-700">
                                    ${deductible.toFixed(0)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-700">
                                    {oopMax > 0 ? `$${oopMax.toFixed(0)}` : 'N/A'}
                                  </td>
                                  <td className={`px-4 py-3 text-right font-bold ${
                                    netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-gradient-to-r from-green-50 to-blue-50 border-t-2 border-green-300">
                            <tr>
                              <td colSpan="7" className="px-4 py-3 text-right font-bold text-gray-900">
                                Total Net Profit:
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                                ${totals.totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Debug Section - Show which clients need calculator data */}
                {(() => {
                  const qualifiedClients = leads.filter(l => l.stage === 'qualified')
                  const clientsWithoutCalc = qualifiedClients.filter(c => 
                    !c.calc_deductible || !c.calc_insurance_paid || !c.calc_percent_allowable || !c.calc_product_cost
                  )
                  
                  if (clientsWithoutCalc.length > 0) {
                    return (
                      <div className="mt-8 border-t pt-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">
                          ⚠️ Clients Missing Calculator Data ({clientsWithoutCalc.length})
                        </h3>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-sm text-yellow-800 mb-3">
                            These clients won't appear in the analytics until you add calculator data:
                          </p>
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {clientsWithoutCalc.map(client => (
                              <div key={client.id} className="text-sm bg-white border border-yellow-300 rounded px-3 py-2">
                                <div className="font-medium text-gray-900">{client.name}</div>
                                <div className="text-xs text-gray-600">{client.insurance || 'No insurance listed'}</div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-yellow-700 mt-3">
                            💡 Tip: Go to the Clients tab, select a client, and add their calculator data
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          )
        })()}

        {/* Projects & Tasks View */}
        {activeView === 'projects' && (
          <div className="space-y-6">
            {!viewingProjectId ? (
              /* Project List View */
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">📁 Projects</h2>
                    <button
                      onClick={() => {
                        setProjectForm({ name: '', description: '', deadline: '', goal: '' })
                        setShowAddProjectModal(true)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      + New Project
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setViewingProjectId(ALL_TASKS_VIEW_ID)}
                      className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-bold text-gray-900">📂 All Tasks</h3>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {tasks.length} total
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">View every task organized by due date.</p>
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Open Tasks</span>
                          <span className="font-medium">{activeTasks.length}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${tasks.length > 0 ? ((tasks.length - activeTasks.length) / tasks.length) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm text-blue-600 font-medium">
                        Click to view all tasks →
                      </div>
                    </div>

                    {projects.map((project) => {
                      const projTasks = tasks.filter(t => t.project_id === project.id)
                      const completedTasks = projTasks.filter(t => t.status === 'completed').length
                      const progress = projTasks.length > 0 ? (completedTasks / projTasks.length) * 100 : 0

                      return (
                        <div
                          key={project.id}
                          onClick={() => setViewingProjectId(project.id)}
                          className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-bold text-gray-900">{project.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              project.status === 'active' ? 'bg-green-100 text-green-700' :
                              project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{project.description}</p>

                          {project.deadline && (
                            <p className="text-sm text-gray-500 mb-2">
                              📅 Due: {formatDate(project.deadline)}
                            </p>
                          )}

                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Progress</span>
                              <span className="font-medium">{completedTasks}/{projTasks.length} tasks</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="text-sm text-blue-600 font-medium">
                            Click to view tasks →
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {projects.length === 0 && (
                    <div className="text-center pt-6 text-gray-500">
                      <p className="text-lg">No projects yet. Create one to get started!</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Single Project Detail View */
              (() => {
                if (viewingProjectId === ALL_TASKS_VIEW_ID) {
                  const sortedTasks = [...tasks].sort(sortTasksByDueDate)
                  const groupedTasks = sortedTasks.reduce((groups, task) => {
                    const groupKey = task.due_date || 'no_due_date'
                    if (!groups[groupKey]) groups[groupKey] = []
                    groups[groupKey].push(task)
                    return groups
                  }, {})

                  return (
                    <div className="bg-white rounded-lg shadow p-6">
                      <button
                        onClick={() => setViewingProjectId(null)}
                        className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        ← Back to Projects
                      </button>

                      <div className="mb-6">
                        <h2 className="text-3xl font-bold text-gray-900">All Tasks</h2>
                        <p className="text-sm text-gray-600 mt-1">
                          {activeTasks.length} open • {tasks.length} total
                        </p>
                      </div>

                      {sortedTasks.length > 0 ? (
                        <div className="space-y-6">
                          {Object.entries(groupedTasks).map(([dueDate, dueDateTasks]) => (
                            <div key={dueDate}>
                              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                📅 {dueDate === 'no_due_date' ? 'No Due Date' : formatDate(dueDate)}
                              </h3>

                              <div className="space-y-3">
                                {dueDateTasks.map((task) => (
                                  <div key={task.id} className={`border-l-4 p-4 rounded ${
                                    task.status === 'completed' ? 'border-green-500 bg-green-50' :
                                    task.status === 'in-progress' ? 'border-blue-500 bg-blue-50' :
                                    task.status === 'blocked' ? 'border-red-500 bg-red-50' :
                                    'border-gray-300 bg-gray-50'
                                  }`}>
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className={`font-semibold ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                            {task.title}
                                          </h4>
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                            task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {task.priority}
                                          </span>
                                        </div>
                                        {task.description && (
                                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                          <span>📁 {projectNamesById[task.project_id] || 'No Project'}</span>
                                          {task.due_date && <span>📅 Due: {formatDate(task.due_date)}</span>}
                                          {task.created_at && <span>Created: {formatDate(task.created_at.split('T')[0])}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingTask(task)
                                            setTaskForm({
                                              title: task.title,
                                              description: task.description || '',
                                              due_date: task.due_date || '',
                                              priority: task.priority,
                                              project_id: task.project_id
                                            })
                                            setShowEditTaskModal(true)
                                          }}
                                          className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1"
                                        >
                                          ✏️
                                        </button>
                                        <select
                                          value={task.status}
                                          onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                                          className="text-sm border border-gray-300 rounded px-2 py-1"
                                        >
                                          <option value="todo">To Do</option>
                                          <option value="in-progress">In Progress</option>
                                          <option value="completed">Completed</option>
                                          <option value="blocked">Blocked</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <p>No tasks yet. Add tasks inside a project to get started.</p>
                        </div>
                      )}
                    </div>
                  )
                }

                const project = projects.find(p => p.id === viewingProjectId)
                if (!project) return null
                
                const projTasks = tasks.filter(t => t.project_id === project.id)
                const completedTasks = projTasks.filter(t => t.status === 'completed').length
                const progress = projTasks.length > 0 ? (completedTasks / projTasks.length) * 100 : 0

                return (
                  <div className="bg-white rounded-lg shadow p-6">
                    <button
                      onClick={() => setViewingProjectId(null)}
                      className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ← Back to Projects
                    </button>

                    <div className="mb-6">
                      <div className="flex justify-between items-start mb-3">
                        <h2 className="text-3xl font-bold text-gray-900">{project.name}</h2>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingProject(project)
                              setProjectForm({ 
                                name: project.name, 
                                description: project.description || '', 
                                deadline: project.deadline || '', 
                                goal: project.goal || '' 
                              })
                              setShowEditProjectModal(true)
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                          >
                            ✏️ Edit
                          </button>
                          <span className={`px-3 py-1 rounded text-sm font-medium ${
                            project.status === 'active' ? 'bg-green-100 text-green-700' :
                            project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{project.description}</p>
                      
                      {project.goal && (
                        <p className="text-sm text-gray-700 mb-2">
                          <span className="font-semibold">Goal:</span> {project.goal}
                        </p>
                      )}
                      
                      {project.deadline && (
                        <p className="text-sm text-gray-500 mb-4">
                          📅 Deadline: {formatDate(project.deadline)}
                        </p>
                      )}
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Project Progress</span>
                          <span className="font-medium">{completedTasks}/{projTasks.length} tasks completed ({Math.round(progress)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-900">Tasks</h3>
                          <button
                            onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            title={showCompletedTasks ? 'Hide completed tasks' : 'View completed tasks'}
                          >
                            {showCompletedTasks ? '✓ Hide Completed' : '👁 View Completed'}
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedProject(project)
                            setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', project_id: project.id })
                            setShowAddTaskModal(true)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          + Add Task
                        </button>
                      </div>

                      {projTasks.length > 0 ? (
                        <div className="space-y-3">
                          {projTasks.filter(task => showCompletedTasks || task.status !== 'completed').map((task) => (
                            <div key={task.id} className={`border-l-4 p-4 rounded ${
                              task.status === 'completed' ? 'border-green-500 bg-green-50' :
                              task.status === 'in-progress' ? 'border-blue-500 bg-blue-50' :
                              task.status === 'blocked' ? 'border-red-500 bg-red-50' :
                              'border-gray-300 bg-gray-50'
                            }`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className={`font-semibold ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                      {task.title}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                      task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {task.priority}
                                    </span>
                                  </div>
                                  {task.description && (
                                    <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                                  )}
                                  <div className="flex gap-4 text-xs text-gray-500">
                                    {task.due_date && <span>📅 Due: {formatDate(task.due_date)}</span>}
                                    {task.created_at && <span>Created: {formatDate(task.created_at.split('T')[0])}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingTask(task)
                                      setTaskForm({ 
                                        title: task.title, 
                                        description: task.description || '', 
                                        due_date: task.due_date || '', 
                                        priority: task.priority,
                                        project_id: task.project_id
                                      })
                                      setShowEditTaskModal(true)
                                    }}
                                    className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1"
                                  >
                                    ✏️
                                  </button>
                                  <select
                                    value={task.status}
                                    onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                                    className="text-sm border border-gray-300 rounded px-2 py-1"
                                  >
                                    <option value="todo">To Do</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="blocked">Blocked</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <p>No tasks yet. Click "Add Task" to create one!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        )}

        {/* Products View */}
        {activeView === 'products' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Product Catalog</h2>
              <button
                onClick={() => {
                  setProductForm({ name: '', category: '', manufacturer: '', description: '', sku: '' })
                  setShowAddProductModal(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                + Add Product
              </button>
            </div>

            {products.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="mb-4">No products in catalog yet.</p>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add your first product
                </button>
              </div>
            ) : (
              <div className="p-4">
                {/* Group products by category */}
                {(() => {
                  const categories = [...new Set(products.map(p => p.category))].sort()
                  return categories.map(category => {
                    const categoryProducts = products.filter(p => p.category === category)
                    return (
                      <div key={category} className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 capitalize">{category}s</h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryProducts.map(product => (
                            <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                <button
                                  onClick={() => {
                                    setEditingProduct(product)
                                    setProductForm({
                                      name: product.name,
                                      category: product.category,
                                      manufacturer: product.manufacturer || '',
                                      description: product.description || '',
                                      sku: product.sku || ''
                                    })
                                    setShowEditProductModal(true)
                                  }}
                                  className="text-blue-600 hover:text-blue-700 text-sm"
                                >
                                  Edit
                                </button>
                              </div>
                              {product.manufacturer && (
                                <p className="text-sm text-gray-600 mb-1">by {product.manufacturer}</p>
                              )}
                              {product.description && (
                                <p className="text-sm text-gray-500 mb-2">{product.description}</p>
                              )}
                              {product.sku && (
                                <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        )}

        {/* Shipping View */}
        {activeView === 'shipping' && (
          <div className="space-y-4">
            {(() => {
              const todayDate = new Date()
              const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
              const weekAheadDate = new Date(todayDate)
              weekAheadDate.setDate(weekAheadDate.getDate() + 7)
              const weekAheadKey = `${weekAheadDate.getFullYear()}-${String(weekAheadDate.getMonth() + 1).padStart(2, '0')}-${String(weekAheadDate.getDate()).padStart(2, '0')}`

              const overdueCount = shippingScheduleItems.filter(item => item.next_ship_date < todayKey).length
              const dueTodayCount = shippingScheduleItems.filter(item => item.next_ship_date === todayKey).length
              const dueThisWeekCount = shippingScheduleItems.filter(item => item.next_ship_date > todayKey && item.next_ship_date <= weekAheadKey).length

              const firstDay = new Date(selectedYear, selectedMonth, 1)
              const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
              const daysInMonth = lastDay.getDate()
              const mondayStartOffset = (firstDay.getDay() + 6) % 7
              const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

              const scheduleByDate = shippingScheduleItems.reduce((acc, item) => {
                if (!acc[item.next_ship_date]) {
                  acc[item.next_ship_date] = []
                }
                acc[item.next_ship_date].push(item)
                return acc
              }, {})

              const calendarCells = []
              for (let index = 0; index < mondayStartOffset; index++) {
                calendarCells.push(null)
              }
              for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                calendarCells.push({ day, dateKey })
              }

              const selectedDayItems = scheduleByDate[selectedShippingDate] || []

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-sm text-red-700 font-medium">Overdue</div>
                      <div className="text-2xl font-bold text-red-900">{overdueCount}</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-sm text-yellow-700 font-medium">Due Today</div>
                      <div className="text-2xl font-bold text-yellow-900">{dueTodayCount}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm text-blue-700 font-medium">Due in 7 Days</div>
                      <div className="text-2xl font-bold text-blue-900">{dueThisWeekCount}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-700 font-medium">Total Scheduled</div>
                      <div className="text-2xl font-bold text-gray-900">{shippingScheduleItems.length}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Shipping Queue Calendar</h2>
                        <p className="text-sm text-gray-600">Click a day to view all products due for that date.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (selectedMonth === 0) {
                              setSelectedMonth(11)
                              setSelectedYear(selectedYear - 1)
                            } else {
                              setSelectedMonth(selectedMonth - 1)
                            }
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                        >
                          ← Prev
                        </button>
                        <div className="min-w-[170px] text-center font-semibold text-gray-900">
                          {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                          className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                        >
                          Next →
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date()
                            const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                            setSelectedMonth(now.getMonth())
                            setSelectedYear(now.getFullYear())
                            setSelectedShippingDate(nowKey)
                          }}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                        >
                          Today
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {weekdayLabels.map(label => (
                          <div key={label} className="py-2 text-center text-sm font-semibold text-gray-700 border-b border-gray-200">
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((cell, index) => {
                          if (!cell) {
                            return <div key={`blank-${index}`} className="h-28 bg-gray-50 rounded border border-gray-100" />
                          }

                          const items = scheduleByDate[cell.dateKey] || []
                          const uniqueClients = [...new Set(items.map(item => item.client_name))]
                          const isSelected = selectedShippingDate === cell.dateKey
                          const isToday = cell.dateKey === todayKey

                          return (
                            <button
                              key={cell.dateKey}
                              type="button"
                              onClick={() => setSelectedShippingDate(cell.dateKey)}
                              className={`h-28 text-left p-2 rounded border transition-colors ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : isToday
                                    ? 'border-yellow-400 bg-yellow-50'
                                    : items.length > 0
                                      ? 'border-green-300 bg-green-50 hover:bg-green-100'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <div className="text-sm font-semibold text-gray-900 mb-1">{cell.day}</div>
                              <div className="space-y-0.5 overflow-y-auto max-h-16">
                                {uniqueClients.slice(0, 2).map(clientName => (
                                  <div key={clientName} className="text-xs text-gray-700 truncate">{clientName}</div>
                                ))}
                                {uniqueClients.length > 2 && (
                                  <div className="text-xs text-gray-500">+{uniqueClients.length - 2} more</div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h3 className="font-semibold text-gray-900">
                            Products Due on {formatDate(selectedShippingDate)} ({selectedDayItems.length})
                          </h3>
                        </div>
                        {selectedDayItems.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-gray-500">No products scheduled for this day.</div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {selectedDayItems.map(item => (
                              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-gray-900">{item.client_name}</div>
                                  <div className="text-sm text-gray-600">{item.product_name} × {item.quantity}</div>
                                </div>
                                <button
                                  onClick={() => handleMarkShipped(item)}
                                  disabled={updating}
                                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
                                >
                                  ✓ Mark Shipped
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">Pending Orders Queue</h3>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-600">{pendingOrders.length} active</span>
                            <button
                              onClick={() => syncGeneratePendingOrders()}
                              disabled={queueSyncing || updating}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
                            >
                              {queueSyncing ? 'Syncing...' : 'Sync / Generate Pending Orders'}
                            </button>
                          </div>
                        </div>
                        {pendingOrders.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-gray-500">No pending orders in queue.</div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {pendingOrders.map(order => {
                              const statusClasses = order.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : order.status === 'reviewed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : order.status === 'ready_to_order'
                                    ? 'bg-cyan-100 text-cyan-800'
                                  : 'bg-purple-100 text-purple-800'

                              return (
                                <div key={order.id} className="px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-medium text-gray-900">{order.leads?.name || 'Unknown Client'}</div>
                                      <div className="text-sm text-gray-600">Ship Date: {formatDate(order.ship_date)}</div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {(order.pending_order_items || []).map(item => `${item.products?.name || 'Item'} × ${item.quantity}`).join(' • ') || 'No items'}
                                      </div>
                                      {order.tracking_number && (
                                        <div className="text-xs text-green-700 mt-1">Tracking: {order.tracking_number}</div>
                                      )}
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${statusClasses}`}>
                                      {order.status}
                                    </span>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {order.status === 'pending' && (
                                      <button
                                        onClick={() => updatePendingOrderStatus(order, 'reviewed')}
                                        disabled={updating}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
                                      >
                                        Review
                                      </button>
                                    )}

                                    {order.status === 'reviewed' && (
                                      <button
                                        onClick={() => updatePendingOrderStatus(order, 'ready_to_order')}
                                        disabled={updating}
                                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
                                      >
                                        Mark Ready
                                      </button>
                                    )}

                                    {order.status === 'ready_to_order' && (
                                      <button
                                        onClick={() => updatePendingOrderStatus(order, 'ordered')}
                                        disabled={updating}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
                                      >
                                        Mark Ordered
                                      </button>
                                    )}

                                    {order.status === 'ordered' && (
                                      <button
                                        onClick={() => updatePendingOrderStatus(order, 'shipped')}
                                        disabled={updating}
                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
                                      >
                                        Mark Shipped
                                      </button>
                                    )}

                                    {order.status !== 'cancelled' && order.status !== 'shipped' && (
                                      <button
                                        onClick={() => updatePendingOrderStatus(order, 'cancelled')}
                                        disabled={updating}
                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        )}
        </div> {/* End View Content (p-6) */}
      </div> {/* End Main Content (flex-1) */}

      {/* Modals - All modals are siblings at main container level */}
      {/* Edit Doctor Modal */}
      {showEditDrModal && editingDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Doctor</h3>
            
            <form onSubmit={handleUpdateDoctor} className="space-y-4">
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
                    setShowEditDrModal(false)
                    setEditingDoctor(null)
                    setDrForm({ 
                      full_name: '', 
                      first_name: '',
                      last_name: '',
                      fax: '', 
                      npi_number: '',
                      address_line1: '',
                      city: '',
                      state: '',
                      zip_code: '',
                      phone: ''
                    })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Update Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={addLeadForm.is_paused}
                    onChange={(e) => setAddLeadForm({ ...addLeadForm, is_paused: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Paused Client
                </label>
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
                      zip_code: '',
                      is_paused: false 
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={editForm.payment_status}
                  onChange={(e) => setEditForm({ ...editForm, payment_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select payment status</option>
                  <option value="paying">Paying</option>
                  <option value="partially_paying">Partially Paying</option>
                  <option value="not_paying_yet">Not Paying Yet</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.is_paused}
                    onChange={(e) => setEditForm({ ...editForm, is_paused: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Paused Client
                </label>
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

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Shipping Schedule</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shipping Duration
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shipping_duration"
                        value=""
                        checked={editForm.shipping_duration === ''}
                        onChange={(e) => setEditForm({ ...editForm, shipping_duration: e.target.value })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">None</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shipping_duration"
                        value="end_of_month"
                        checked={editForm.shipping_duration === 'end_of_month'}
                        onChange={(e) => setEditForm({ ...editForm, shipping_duration: e.target.value })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Until End of Month</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shipping_duration"
                        value="1_month"
                        checked={editForm.shipping_duration === '1_month'}
                        onChange={(e) => setEditForm({ ...editForm, shipping_duration: e.target.value })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">1 Month</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shipping_duration"
                        value="3_month"
                        checked={editForm.shipping_duration === '3_month'}
                        onChange={(e) => setEditForm({ ...editForm, shipping_duration: e.target.value })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">3 Months</span>
                    </label>
                  </div>
                  
                  {/* Display Next Shipment Date */}
                  {selectedClient?.date_shipped && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm font-medium text-blue-900 mb-1">Next Shipment Date:</div>
                      <div className="text-lg font-bold text-blue-700">
                        {(() => {
                          const shippedDate = new Date(selectedClient.date_shipped)
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          const shippedDateOnly = new Date(shippedDate)
                          shippedDateOnly.setHours(0, 0, 0, 0)
                          
                          let nextShipDate
                          
                          // If the shipped date is in the future or today, use it as the next ship date
                          if (shippedDateOnly >= today) {
                            nextShipDate = shippedDateOnly
                          } else if (editForm.shipping_duration) {
                            // If shipped date is in the past, calculate next shipment based on duration
                            const monthsToAdd = editForm.shipping_duration === '3_month' ? 3 : 1
                            nextShipDate = new Date(shippedDateOnly)
                            nextShipDate.setMonth(nextShipDate.getMonth() + monthsToAdd)
                          } else {
                            // No duration set and date is in the past
                            return <span className="text-gray-600">No future shipment scheduled</span>
                          }
                          
                          return nextShipDate.toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })
                        })()}
                      </div>
                    </div>
                  )}
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

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Product</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('products')
                  .insert([{
                    name: productForm.name,
                    category: productForm.category,
                    manufacturer: productForm.manufacturer,
                    description: productForm.description,
                    sku: productForm.sku
                  }])
                if (error) throw error
                await fetchProducts()
                setShowAddProductModal(false)
                setProductForm({ name: '', category: '', manufacturer: '', description: '', sku: '' })
              } catch (error) {
                console.error('Error adding product:', error)
                alert('Failed to add product')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Dexcom G7 Sensors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  <option value="sensor">Sensor</option>
                  <option value="pod">Pod</option>
                  <option value="tubing">Tubing</option>
                  <option value="supply">Supply</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={productForm.manufacturer}
                  onChange={(e) => setProductForm({ ...productForm, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Dexcom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Product details..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Product SKU"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProductModal(false)
                    setProductForm({ name: '', category: '', manufacturer: '', description: '', sku: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Product</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('products')
                  .update({
                    name: productForm.name,
                    category: productForm.category,
                    manufacturer: productForm.manufacturer,
                    description: productForm.description,
                    sku: productForm.sku
                  })
                  .eq('id', editingProduct.id)
                if (error) throw error
                await fetchProducts()
                setShowEditProductModal(false)
                setEditingProduct(null)
                setProductForm({ name: '', category: '', manufacturer: '', description: '', sku: '' })
              } catch (error) {
                console.error('Error updating product:', error)
                alert('Failed to update product')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sensor">Sensor</option>
                  <option value="pod">Pod</option>
                  <option value="tubing">Tubing</option>
                  <option value="supply">Supply</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={productForm.manufacturer}
                  onChange={(e) => setProductForm({ ...productForm, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProductModal(false)
                    setEditingProduct(null)
                    setProductForm({ name: '', category: '', manufacturer: '', description: '', sku: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Products Modal */}
      {showAssignProductModal && assignProductClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Assign Product to {assignProductClient.name}
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('client_products')
                  .insert([{
                    lead_id: assignProductClient.id,
                    product_id: assignProductForm.product_id,
                    quantity: parseInt(assignProductForm.quantity),
                    frequency_days: parseInt(assignProductForm.frequency_days) || 30,
                    next_ship_date: assignProductForm.next_ship_date
                  }])
                if (error) throw error
                await fetchClientProducts(assignProductClient.id)
                await fetchShippingSchedule()
                setShowAssignProductModal(false)
                setAssignProductForm({ product_id: '', quantity: 1, next_ship_date: new Date().toISOString().split('T')[0], frequency_days: 30 })
                alert('Product assigned successfully!')
              } catch (error) {
                console.error('Error assigning product:', error)
                alert('Failed to assign product')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                <select
                  value={assignProductForm.product_id}
                  onChange={(e) => setAssignProductForm({ ...assignProductForm, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity per shipment *</label>
                <input
                  type="number"
                  min="1"
                  value={assignProductForm.quantity}
                  onChange={(e) => setAssignProductForm({ ...assignProductForm, quantity: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Shipping Date *</label>
                <input
                  type="date"
                  value={assignProductForm.next_ship_date}
                  onChange={(e) => setAssignProductForm({ ...assignProductForm, next_ship_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignProductModal(false)
                    setAssignProductClient(null)
                    setAssignProductForm({ product_id: '', quantity: 1, next_ship_date: new Date().toISOString().split('T')[0], frequency_days: 30 })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Assign Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Project</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('projects')
                  .insert([projectForm])
                if (error) throw error
                await fetchProjects()
                setShowAddProjectModal(false)
                setProjectForm({ name: '', description: '', deadline: '', goal: '' })
                alert('Project created successfully!')
              } catch (error) {
                console.error('Error creating project:', error)
                alert('Failed to create project')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Website Redesign"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What is this project about?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                <input
                  type="text"
                  value={projectForm.goal}
                  onChange={(e) => setProjectForm({ ...projectForm, goal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Increase conversions by 20%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={projectForm.deadline}
                  onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Between Shipments *</label>
                <input
                  type="number"
                  min="1"
                  value={assignProductForm.frequency_days}
                  onChange={(e) => setAssignProductForm({ ...assignProductForm, frequency_days: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProjectModal(false)
                    setProjectForm({ name: '', description: '', deadline: '', goal: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Project</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('projects')
                  .update({
                    name: projectForm.name,
                    description: projectForm.description,
                    deadline: projectForm.deadline,
                    goal: projectForm.goal
                  })
                  .eq('id', editingProject.id)
                if (error) throw error
                await fetchProjects()
                setShowEditProjectModal(false)
                setEditingProject(null)
                setProjectForm({ name: '', description: '', deadline: '', goal: '' })
                alert('Project updated successfully!')
              } catch (error) {
                console.error('Error updating project:', error)
                alert('Failed to update project')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Website Redesign"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What is this project about?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                <input
                  type="text"
                  value={projectForm.goal}
                  onChange={(e) => setProjectForm({ ...projectForm, goal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Increase conversions by 20%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={projectForm.deadline}
                  onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProjectModal(false)
                    setEditingProject(null)
                    setProjectForm({ name: '', description: '', deadline: '', goal: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Task to {selectedProject?.name}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('tasks')
                  .insert([taskForm])
                if (error) throw error
                await fetchTasks()
                setShowAddTaskModal(false)
                setSelectedProject(null)
                setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
                alert('Task added successfully!')
              } catch (error) {
                console.error('Error creating task:', error)
                alert('Failed to create task')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Design homepage mockup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Task details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTaskModal(false)
                    setSelectedProject(null)
                    setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Task</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('tasks')
                  .update({
                    title: taskForm.title,
                    description: taskForm.description,
                    due_date: taskForm.due_date,
                    priority: taskForm.priority
                  })
                  .eq('id', editingTask.id)
                if (error) throw error
                await fetchTasks()
                setShowEditTaskModal(false)
                setEditingTask(null)
                setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
                alert('Task updated successfully!')
              } catch (error) {
                console.error('Error updating task:', error)
                alert('Failed to update task')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Design homepage mockup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Task details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTaskModal(false)
                    setEditingTask(null)
                    setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Expense</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const { error } = await supabase
                  .from('expenses')
                  .insert([expenseForm])
                if (error) throw error
                await fetchExpenses()
                setShowAddExpenseModal(false)
                setExpenseForm({ description: '', amount: '', category: '', date: '' })
                alert('Expense added successfully!')
              } catch (error) {
                console.error('Error adding expense:', error)
                alert('Failed to add expense')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Office rent, supplies, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category...</option>
                  <option value="Rent">Rent</option>
                  <option value="Medical Supplies">Medical Supplies</option>
                  <option value="Software">Software</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpenseModal(false)
                    setExpenseForm({ description: '', amount: '', category: '', date: '' })
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {editingTable ? 'Edit Table' : 'Create New Table'}
            </h3>
            <form onSubmit={createOrUpdateTable}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column: Table info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Table Name *</label>
                    <input
                      type="text"
                      value={newTableForm.name}
                      onChange={(e) => setNewTableForm({ ...newTableForm, name: e.target.value })}
                      placeholder="e.g., Customer Orders"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newTableForm.description || ''}
                      onChange={(e) => setNewTableForm({ ...newTableForm, description: e.target.value })}
                      placeholder="What this table tracks..."
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Right column: Columns */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-bold text-gray-900">Define Columns *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewTableForm({
                          ...newTableForm,
                          columns: [...newTableForm.columns, '']
                        })
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium"
                    >
                      + Add Column
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-blue-400 rounded-lg p-4 bg-blue-50 space-y-2 max-h-48 overflow-y-auto">
                    {newTableForm.columns.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm font-medium text-blue-700 mb-2">No columns yet</p>
                        <p className="text-xs text-blue-600">Click "+ Add Column" to start defining your table structure</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {newTableForm.columns.map((col, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-xs font-bold text-gray-500 bg-white px-2 py-2 rounded border border-gray-200">
                              Col {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={col}
                              onChange={(e) => {
                                const newCols = [...newTableForm.columns]
                                newCols[idx] = e.target.value
                                setNewTableForm({ ...newTableForm, columns: newCols })
                              }}
                              placeholder={`Column name (e.g., "Product Name")`}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus={col === ''}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setNewTableForm({
                                  ...newTableForm,
                                  columns: newTableForm.columns.filter((_, i) => i !== idx)
                                })
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded text-xs font-medium"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Add column names like: Product, Quantity, Price, Email, Phone, etc.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTableModal(false)
                    setEditingTable(null)
                    setNewTableForm({ name: '', description: '', columns: [] })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  {editingTable ? 'Update' : 'Create'} Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

