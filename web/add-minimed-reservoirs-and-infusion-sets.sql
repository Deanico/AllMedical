-- Restore/add MiniMed reservoirs and infusion sets
-- Ensures these products are active and visible in the UI

BEGIN;

-- 1) Reactivate any existing Medtronic/MiniMed reservoirs
UPDATE products
SET active = true, updated_at = NOW()
WHERE category = 'reservoir'
  AND (
    manufacturer ILIKE '%medtronic%'
    OR manufacturer ILIKE '%minimed%'
    OR name ILIKE '%minimed%'
    OR name ILIKE '%medtronic%'
  );

-- 2) Ensure core MiniMed reservoir SKUs exist
INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Reservoir 3mL', 'reservoir', 'Medtronic', 'MiniMed 3mL insulin reservoir for Medtronic pumps', 'MM-RES-3ML', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MM-RES-3ML');

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Reservoir 1.8mL', 'reservoir', 'Medtronic', 'MiniMed 1.8mL insulin reservoir for Medtronic pumps', 'MM-RES-1.8ML', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MM-RES-1.8ML');

-- 3) Add MiniMed infusion sets
INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Mio Advance Infusion Set 6mm 23in', 'infusion_set', 'Medtronic', 'MiniMed Mio Advance infusion set, 6mm cannula, 23 inch tubing', 'MM-MIOA-6-23', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MM-MIOA-6-23');

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Mio Advance Infusion Set 9mm 23in', 'infusion_set', 'Medtronic', 'MiniMed Mio Advance infusion set, 9mm cannula, 23 inch tubing', 'MM-MIOA-9-23', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MM-MIOA-9-23');

-- 4) Add MiniMed Extended infusion sets
INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Extended Infusion Set 6mm 23in', 'infusion_set', 'Medtronic', 'MiniMed Extended infusion set, 6mm cannula, 23 inch tubing', 'MM-EXT-6-23', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MM-EXT-6-23');

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Extended Infusion Set 9mm 23in', 'infusion_set', 'Medtronic', 'MiniMed Extended infusion set, 9mm cannula, 23 inch tubing', 'MM-EXT-9-23', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MM-EXT-9-23');

-- 5) Product logic defaults for automation
UPDATE products
SET days_per_unit = 3,
    default_90_day_qty = 30,
    hcpcs = COALESCE(hcpcs, 'A4225'),
    active = true,
    updated_at = NOW()
WHERE sku IN ('MM-MIOA-6-23', 'MM-MIOA-9-23', 'MM-EXT-6-23', 'MM-EXT-9-23')
   OR (
     category = 'infusion_set'
     AND (name ILIKE '%minimed%' OR name ILIKE '%mio advance%' OR name ILIKE '%extended infusion%')
   );

UPDATE products
SET days_per_unit = 3,
    default_90_day_qty = 30,
    hcpcs = COALESCE(hcpcs, 'A4226'),
    active = true,
    updated_at = NOW()
WHERE sku IN ('MM-RES-3ML', 'MM-RES-1.8ML')
   OR (
     category = 'reservoir'
     AND (name ILIKE '%minimed%' OR name ILIKE '%medtronic%')
   );

COMMIT;
