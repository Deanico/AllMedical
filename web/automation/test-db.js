import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

async function testDB() {
  const { data, error } = await supabase
    .from('product_suppliers')
    .select(`
      id,
      supplier_sku,
      price,
      products (name, sku),
      suppliers (name)
    `)
    .not('supplier_sku', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Product-Supplier Mappings:\n');
  data.forEach(m => {
    console.log(`${m.products.name} (${m.products.sku})`);
    console.log(`  → ${m.suppliers.name}: ${m.supplier_sku}`);
    console.log(`  → Price: $${m.price || 'NULL'}\n`);
  });
}

testDB();
