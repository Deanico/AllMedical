import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okncywujlzqictmkmggt.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbmN5d3VqbHpxaWN0bWttZ2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkwMTYsImV4cCI6MjA3NzU5NTAxNn0.1oh2R2FViYsAW_29GHY5R50tWX7fijV2djrruKFFMME'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const DEMO_EMAIL = 'demo.client@allmedical.com'
const DEMO_PASSWORD = 'DemoPortal123!'
const now = new Date()
const nextShipDate = new Date(now)
nextShipDate.setDate(nextShipDate.getDate() + 14)
const nextShipDateIso = nextShipDate.toISOString().split('T')[0]

async function ensureDemoAuth() {
  const { error: signUpError } = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    options: {
      data: {
        full_name: 'Demo Client'
      }
    }
  })

  if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) {
    throw signUpError
  }
}

async function ensureDemoLead() {
  const { data: existing, error: existingError } = await supabase
    .from('leads')
    .select('id')
    .eq('email', DEMO_EMAIL)
    .limit(1)

  if (existingError) throw existingError

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert({
      name: 'Demo Client',
      email: DEMO_EMAIL,
      phone: '555-0100',
      insurance: 'Demo Insurance',
      stage: 'qualified',
      address_line1: '123 Demo Street',
      city: 'Sioux Falls',
      state: 'SD',
      zip_code: '57101',
      portal_invited_at: new Date().toISOString(),
      portal_accepted_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  return inserted.id
}

async function ensureDemoClientProduct(leadId) {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .limit(1)

  if (productsError) throw productsError
  if (!products || products.length === 0) {
    throw new Error('No products found. Add at least one product first for shipment demo data.')
  }

  const productId = products[0].id

  const { data: existingCp, error: existingCpError } = await supabase
    .from('client_products')
    .select('id')
    .eq('lead_id', leadId)
    .eq('product_id', productId)
    .eq('active', true)
    .limit(1)

  if (existingCpError) throw existingCpError

  if (existingCp && existingCp.length > 0) {
    const { error: updateError } = await supabase
      .from('client_products')
      .update({
        next_ship_date: nextShipDateIso,
        quantity: 1,
        frequency_days: 30,
        active: true
      })
      .eq('id', existingCp[0].id)

    if (updateError) throw updateError
    return
  }

  const { error: insertCpError } = await supabase
    .from('client_products')
    .insert({
      lead_id: leadId,
      product_id: productId,
      quantity: 1,
      frequency_days: 30,
      next_ship_date: nextShipDateIso,
      active: true
    })

  if (insertCpError) throw insertCpError
}

async function main() {
  await ensureDemoAuth()
  const leadId = await ensureDemoLead()
  await ensureDemoClientProduct(leadId)

  console.log('DEMO_ACCOUNT_READY')
  console.log(`EMAIL=${DEMO_EMAIL}`)
  console.log(`PASSWORD=${DEMO_PASSWORD}`)
  console.log(`NEXT_SHIP_DATE=${nextShipDateIso}`)
}

main().catch((error) => {
  console.error('DEMO_ACCOUNT_ERROR')
  console.error(error.message || error)
  process.exit(1)
})
