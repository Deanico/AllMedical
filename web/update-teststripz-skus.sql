-- Update Teststripz supplier SKUs with correct product URLs

DO $$
DECLARE
  v_teststripz_id UUID;
  v_omnipod5_10pk_id UUID;
  v_g7_10day_id UUID;
  v_g7_15day_id UUID;
BEGIN
  -- Get IDs
  SELECT id INTO v_teststripz_id FROM suppliers WHERE name = 'Teststripz' LIMIT 1;
  SELECT id INTO v_omnipod5_10pk_id FROM products WHERE sku = 'OP5-FL2P-10PK' LIMIT 1;
  SELECT id INTO v_g7_10day_id FROM products WHERE sku = 'DX-G7-10D-3PK' LIMIT 1;
  SELECT id INTO v_g7_15day_id FROM products WHERE sku = 'DX-G7-15D-3PK' LIMIT 1;
  
  -- Add/Update Omnipod 5 10pk (maps to Teststripz 5-pack, G6/Libre compatible)
  INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, price)
  VALUES (v_omnipod5_10pk_id, v_teststripz_id, 'copy-of-omnipod-pods-5-pack?variant=45415054442686', NULL)
  ON CONFLICT (product_id, supplier_id) DO UPDATE 
  SET supplier_sku = 'copy-of-omnipod-pods-5-pack?variant=45415054442686',
      price = NULL;
  
  -- Add/Update Dexcom G7 10-day 3-pack
  INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, price)
  VALUES (v_g7_10day_id, v_teststripz_id, 'dexcom-g7-sensor-3-pack?variant=43582075011262', NULL)
  ON CONFLICT (product_id, supplier_id) DO UPDATE 
  SET supplier_sku = 'dexcom-g7-sensor-3-pack?variant=43582075011262',
      price = NULL;
  
  -- Add/Update Dexcom G7 15-day 1-pack
  INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, price)
  VALUES (v_g7_15day_id, v_teststripz_id, 'dexcom-g7-sensor-15-day-1-pack?variant=46410631643326', NULL)
  ON CONFLICT (product_id, supplier_id) DO UPDATE 
  SET supplier_sku = 'dexcom-g7-sensor-15-day-1-pack?variant=46410631643326',
      price = NULL;
  
  -- Remove Libre 2 Plus mapping if it exists (Teststripz doesn't sell it)
  DELETE FROM product_suppliers
  WHERE supplier_id = v_teststripz_id
    AND product_id IN (SELECT id FROM products WHERE sku = 'FL2P-SENS');
  
  RAISE NOTICE 'Updated Teststripz SKUs';
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
WHERE s.name = 'Teststripz'
ORDER BY p.name;
