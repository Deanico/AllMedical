import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://okncywujlzqictmkmggt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbmN5d3VqbHpxaWN0bWttZ2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkwMTYsImV4cCI6MjA3NzU5NTAxNn0.1oh2R2FViYsAW_29GHY5R50tWX7fijV2djrruKFFMME'
)

const email = 'demo.client@allmedical.com'
const nextShipDate = new Date()
nextShipDate.setDate(nextShipDate.getDate() + 14)
const nextShipDateIso = nextShipDate.toISOString().split('T')[0]

async function ensureLead() {
  const { data: existing, error: findError } = await supabase
    .from('leads')
    .select('id')
    .eq('email', email)
    .limit(1)

  if (findError) throw findError
  if (existing?.length) return existing[0].id

  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert({
      name: 'Demo Client',
      email,
      phone: '555-0100',
      insurance: 'Demo Insurance',
      stage: 'qualified',
      address_line1: '123 Demo Street',
      city: 'Sioux Falls',
      state: 'SD',
      zip_code: '57101'
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  return inserted.id
}

async function ensureClientProduct(leadId) {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id')
    .limit(1)

  if (productError) throw productError
  if (!products?.length) throw new Error('No products found to attach to demo client')

  const productId = products[0].id

  const { data: existingCp, error: cpFindError } = await supabase
    .from('client_products')
    .select('id')
    .eq('lead_id', leadId)
    .eq('product_id', productId)
    .eq('active', true)
    .limit(1)

  if (cpFindError) throw cpFindError

  if (existingCp?.length) {
    const { error: updateError } = await supabase
      .from('client_products')
      .update({ next_ship_date: nextShipDateIso, quantity: 1, frequency_days: 30 })
      .eq('id', existingCp[0].id)

    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase
    .from('client_products')
    .insert({
      lead_id: leadId,
      product_id: productId,
      quantity: 1,
      frequency_days: 30,
      next_ship_date: nextShipDateIso,
      active: true
    })

  if (insertError) throw insertError
}

const leadId = await ensureLead()
await ensureClientProduct(leadId)
console.log('DEMO_DATA_READY')
console.log(`EMAIL=${email}`)
console.log('PASSWORD=DemoPortal123!')
console.log(`NEXT_SHIP_DATE=${nextShipDateIso}`)
