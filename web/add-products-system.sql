-- Create products and shipping automation system
-- This adds product catalog, supplier tracking, and automated order queuing

-- 1. Products table - catalog of all shippable items
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'sensor', 'pod', 'tubing', etc.
  description TEXT,
  manufacturer TEXT,
  sku TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Suppliers table - tracks where to buy each product
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product-Supplier mapping - which suppliers sell which products and at what price
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  price DECIMAL(10, 2),
  is_preferred BOOLEAN DEFAULT false, -- preferred supplier for this product
  availability_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

-- 4. Client Products - what each client receives monthly
CREATE TABLE IF NOT EXISTS client_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  frequency_days INTEGER DEFAULT 30, -- how often to ship (typically 30 or 90 days)
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pending Orders - automated queue of orders to be placed
CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  ship_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'ordered', 'shipped', 'cancelled'
  order_details JSONB, -- stores full order info: products, quantities, addresses, etc.
  preferred_supplier_id UUID REFERENCES suppliers(id),
  tracking_number TEXT,
  order_placed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Order Items - individual products in each pending order
CREATE TABLE IF NOT EXISTS pending_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pending_order_id UUID REFERENCES pending_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  price DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_products_lead_id ON client_products(lead_id);
CREATE INDEX IF NOT EXISTS idx_client_products_active ON client_products(active);
CREATE INDEX IF NOT EXISTS idx_pending_orders_lead_id ON pending_orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_ship_date ON pending_orders(ship_date);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_order_items_order_id ON pending_order_items(pending_order_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred ON product_suppliers(is_preferred);

-- Insert initial suppliers
INSERT INTO suppliers (name, website, notes) VALUES
  ('Teststripz', 'https://teststripz.com', 'Good for test strips and general supplies'),
  ('Diabetic Warehouse', 'https://diabeticwarehouse.org', 'Wide selection of diabetes supplies'),
  ('Diabetic Overstock', 'https://diabeticoverstock.com', 'Discounted diabetes products'),
  ('Total Diabetes Supply', 'https://totaldiabetessupply.com', 'Comprehensive diabetes supplies')
ON CONFLICT DO NOTHING;

-- Insert initial product catalog
INSERT INTO products (name, category, manufacturer, description) VALUES
  ('Dexcom G7 Sensors', 'sensor', 'Dexcom', 'Continuous glucose monitoring sensors'),
  ('Omnipod 5 Pods', 'pod', 'Insulet', 'Tubeless insulin pump pods'),
  ('Freestyle Libre 2 Plus Sensors', 'sensor', 'Abbott', 'Continuous glucose monitoring sensors'),
  ('Freestyle Libre 3 Plus Sensors', 'sensor', 'Abbott', 'Continuous glucose monitoring sensors'),
  ('Insulin Pump Tubing', 'tubing', 'Various', 'Tubing for traditional insulin pumps')
ON CONFLICT DO NOTHING;

-- Add RLS policies for the new tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_order_items ENABLE ROW LEVEL SECURITY;

-- Allow public access (since we're using admin authentication at app level)
CREATE POLICY "Public access to products" ON products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access to suppliers" ON suppliers FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access to product_suppliers" ON product_suppliers FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access to client_products" ON client_products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access to pending_orders" ON pending_orders FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access to pending_order_items" ON pending_order_items FOR ALL TO public USING (true) WITH CHECK (true);
