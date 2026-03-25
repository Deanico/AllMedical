-- Add price tracking and supplier management
-- Run this to enable automated price checking and supplier selection

-- Ensure product_suppliers table exists with all needed fields
-- (This may already exist from add-products-system.sql)
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  price DECIMAL(10, 2),
  url TEXT, -- Direct URL to product page on supplier site
  supplier_sku TEXT, -- SKU/product code on supplier's website
  is_preferred BOOLEAN DEFAULT false,
  in_stock BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  availability_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

-- Add missing columns if table already existed
ALTER TABLE product_suppliers 
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS supplier_sku TEXT,
  ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_notes TEXT;

-- Price history tracking - records every price change
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_supplier_id UUID REFERENCES product_suppliers(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  in_stock BOOLEAN DEFAULT true,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_price ON product_suppliers(price);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred ON product_suppliers(is_preferred);
CREATE INDEX IF NOT EXISTS idx_price_history_product_supplier ON price_history(product_supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at);

-- Add more suppliers for price comparison
INSERT INTO suppliers (name, website, notes) VALUES
  ('RapidRx USA', 'https://rapidrxusa.com', 'Competitive prices on CGM sensors and pods'),
  ('Diabetic Warehouse', 'https://diabeticwarehouse.org', 'Wide selection of diabetes supplies'),
  ('ADW Diabetes', 'https://www.adwdiabetes.com', 'Established supplier with good inventory'),
  ('Diabetic Overstock', 'https://diabeticoverstock.com', 'Discounted diabetes products')
ON CONFLICT DO NOTHING;

-- Function to get cheapest supplier for a product
CREATE OR REPLACE FUNCTION get_cheapest_supplier(p_product_id UUID)
RETURNS TABLE(
  supplier_id UUID,
  supplier_name TEXT,
  price DECIMAL(10, 2),
  url TEXT,
  last_checked_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.supplier_id,
    s.name,
    ps.price,
    ps.url,
    ps.last_checked_at
  FROM product_suppliers ps
  JOIN suppliers s ON s.id = ps.supplier_id
  WHERE ps.product_id = p_product_id
    AND ps.price IS NOT NULL
    AND ps.in_stock = true
    AND s.active = true
  ORDER BY ps.price ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- View to see all products with their cheapest supplier
CREATE OR REPLACE VIEW product_best_prices AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.category,
  p.manufacturer,
  best.supplier_id as best_supplier_id,
  best.supplier_name as best_supplier_name,
  best.price as best_price,
  best.url as product_url,
  best.last_checked_at,
  (
    SELECT COUNT(DISTINCT ps2.supplier_id)
    FROM product_suppliers ps2
    WHERE ps2.product_id = p.id 
      AND ps2.price IS NOT NULL
      AND ps2.in_stock = true
  ) as supplier_count
FROM products p
LEFT JOIN LATERAL (
  SELECT * FROM get_cheapest_supplier(p.id)
) AS best ON true
WHERE p.active = true
ORDER BY p.category, p.name;

-- View to compare prices across all suppliers for each product
CREATE OR REPLACE VIEW product_price_comparison AS
SELECT 
  p.name as product_name,
  p.category,
  s.name as supplier_name,
  ps.price,
  ps.in_stock,
  ps.url,
  ps.last_checked_at,
  RANK() OVER (PARTITION BY p.id ORDER BY ps.price ASC NULLS LAST) as price_rank
FROM products p
JOIN product_suppliers ps ON ps.product_id = p.id
JOIN suppliers s ON s.id = ps.supplier_id
WHERE p.active = true 
  AND s.active = true
  AND ps.price IS NOT NULL
ORDER BY p.name, ps.price;

-- Sample: Add some initial product-supplier mappings for key products
-- Note: Prices are examples - the automation will update these

-- Get supplier IDs
DO $$
DECLARE
  v_teststripz_id UUID;
  v_rapidrx_id UUID;
  v_diabetic_warehouse_id UUID;
BEGIN
  -- Get supplier IDs
  SELECT id INTO v_teststripz_id FROM suppliers WHERE name = 'Teststripz' LIMIT 1;
  SELECT id INTO v_rapidrx_id FROM suppliers WHERE name = 'RapidRx USA' LIMIT 1;
  SELECT id INTO v_diabetic_warehouse_id FROM suppliers WHERE name = 'Diabetic Warehouse' LIMIT 1;

  -- Add mappings for Omnipod 5 products
  INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku)
  SELECT p.id, v_teststripz_id, 89.99, 'OP5-FL2P-10'
  FROM products p WHERE p.sku = 'OP5-FL2P-10PK'
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

  INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku)
  SELECT p.id, v_rapidrx_id, 92.50, 'omnipod-5-libre-10pk'
  FROM products p WHERE p.sku = 'OP5-FL2P-10PK'
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

  -- Add mappings for Dexcom G7 sensors
  INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku)
  SELECT p.id, v_rapidrx_id, 259.00, 'dexcom-g7-sensors-3pk'
  FROM products p WHERE p.sku = 'DX-G7-15D-3PK'
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

  INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku)
  SELECT p.id, v_diabetic_warehouse_id, 275.00, 'DX-G7-3PK'
  FROM products p WHERE p.sku = 'DX-G7-15D-3PK'
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

  -- Add Freestyle Libre sensors
  INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku)
  SELECT p.id, v_teststripz_id, 119.99, 'libre-2-plus'
  FROM products p WHERE p.sku = 'FL2P-SENS'
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

  INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku)
  SELECT p.id, v_rapidrx_id, 115.00, 'freestyle-libre-2-plus'
  FROM products p WHERE p.sku = 'FL2P-SENS'
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

END $$;

-- Verify setup
SELECT 'Products with supplier pricing:' as info;
SELECT * FROM product_best_prices LIMIT 10;

SELECT 'Price comparisons:' as info;
SELECT * FROM product_price_comparison LIMIT 20;
