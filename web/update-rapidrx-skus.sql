-- Update RapidRx USA supplier SKUs with correct product slugs

DO $$
DECLARE
  v_rapidrx_id UUID;
  v_omnipod5_10pk_id UUID;
  v_dexcom_g7_15d_id UUID;
  v_libre2plus_id UUID;
BEGIN
  -- Get supplier ID
  SELECT id INTO v_rapidrx_id FROM suppliers WHERE name = 'RapidRx USA' LIMIT 1;
  
  -- Get product IDs
  SELECT id INTO v_omnipod5_10pk_id FROM products WHERE sku = 'OP5-FL2P-10PK' LIMIT 1;
  SELECT id INTO v_dexcom_g7_15d_id FROM products WHERE sku = 'DX-G7-15D-3PK' LIMIT 1;
  SELECT id INTO v_libre2plus_id FROM products WHERE sku = 'FL2P-SENS' LIMIT 1;
  
  -- Update Omnipod 5 (10pk maps to RapidRx 5-pack)
  UPDATE product_suppliers 
  SET supplier_sku = 'omnipod-5-5-pack',
      price = NULL  -- Will be updated by price checker
  WHERE product_id = v_omnipod5_10pk_id 
    AND supplier_id = v_rapidrx_id;
  
  -- Update Dexcom G7 15-day (maps to RapidRx 15-day 1-pack)
  UPDATE product_suppliers 
  SET supplier_sku = 'dexcom-g7-15-day-1-pack',
      price = NULL
  WHERE product_id = v_dexcom_g7_15d_id
    AND supplier_id = v_rapidrx_id;
  
  -- Update Freestyle Libre 2 Plus
  UPDATE product_suppliers 
  SET supplier_sku = 'freestyle-libre-2-plus-sensor',
      price = NULL
  WHERE product_id = v_libre2plus_id
    AND supplier_id = v_rapidrx_id;
  
  RAISE NOTICE 'Updated RapidRx SKUs successfully';
END $$;

-- Verify updates
SELECT 
  p.name as product_name,
  p.sku as our_sku,
  s.name as supplier,
  ps.supplier_sku as supplier_sku,
  ps.price
FROM product_suppliers ps
JOIN products p ON p.id = ps.product_id
JOIN suppliers s ON s.id = ps.supplier_id
WHERE s.name = 'RapidRx USA'
ORDER BY p.name;
