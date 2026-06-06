-- Add missing shipment-calendar products and apply product logic defaults
-- Safe to re-run: inserts only when missing by name or SKU, then normalizes logic fields

BEGIN;

-- 1) Insert missing products
WITH missing_products AS (
  SELECT *
  FROM (VALUES
    (
      'Autosoft XC 6mm 5"'::text,
      'infusion_set'::text,
      'Tandem'::text,
      'Autosoft XC infusion set, 6mm cannula, 5" tubing'::text,
      'ASX-6-5'::text,
      'Added for shipment calendar coverage'::text
    ),
    (
      'Instinct Sensors'::text,
      'sensor'::text,
      'Instinct'::text,
      'Continuous glucose monitoring sensors'::text,
      'INSTINCT-SENS'::text,
      'Added for shipment calendar coverage'::text
    ),
    (
      'Guardian 4 Sensors'::text,
      'sensor'::text,
      'Medtronic'::text,
      'Guardian 4 continuous glucose monitoring sensors'::text,
      'G4-SENS'::text,
      'Added for shipment calendar coverage'::text
    ),
    (
      'Bionic iLet infusion set Detach Steel 23"6mm'::text,
      'infusion_set'::text,
      'Beta Bionics'::text,
      'iLet Detach Steel infusion set, 23" tubing, 6mm cannula'::text,
      'ILET-DETACH-23-6'::text,
      'Added for shipment calendar coverage'::text
    ),
    (
      'iLet Cartridges'::text,
      'reservoir'::text,
      'Beta Bionics'::text,
      'iLet insulin pump cartridges'::text,
      'ILET-CART'::text,
      'Added for shipment calendar coverage'::text
    )
  ) AS v(name, category, manufacturer, description, sku, notes)
)
INSERT INTO products (name, category, manufacturer, description, sku, notes, active)
SELECT
  mp.name,
  mp.category,
  mp.manufacturer,
  mp.description,
  mp.sku,
  mp.notes,
  true
FROM missing_products mp
WHERE NOT EXISTS (
  SELECT 1
  FROM products p
  WHERE lower(trim(p.name)) = lower(trim(mp.name))
     OR (p.sku IS NOT NULL AND p.sku = mp.sku)
);

-- 2) Ensure these products are active
UPDATE products
SET active = true,
    updated_at = NOW()
WHERE name IN (
  'Autosoft XC 6mm 5"',
  'Instinct Sensors',
  'Guardian 4 Sensors',
  'Bionic iLet infusion set Detach Steel 23"6mm',
  'iLet Cartridges'
);

-- 3) Apply shipping/product logic defaults so calendar automation behaves like existing products
-- Infusion sets: changed every 2.5 days
UPDATE products
SET days_per_unit = 2.5,
    default_90_day_qty = 36,
    hcpcs = COALESCE(hcpcs, 'A4225'),
    updated_at = NOW()
WHERE name IN (
  'Autosoft XC 6mm 5"',
  'Bionic iLet infusion set Detach Steel 23"6mm'
);

-- Reservoir/cartridge products: changed every 2.5 days
UPDATE products
SET days_per_unit = 2.5,
    default_90_day_qty = 36,
    hcpcs = COALESCE(hcpcs, 'A4226'),
    updated_at = NOW()
WHERE name = 'iLet Cartridges';

-- Guardian 4 sensors: 7-day wear
UPDATE products
SET days_per_unit = 7,
    default_90_day_qty = 13,
    hcpcs = COALESCE(hcpcs, 'A9276'),
    updated_at = NOW()
WHERE name = 'Guardian 4 Sensors';

-- Instinct sensors: default sensor cadence aligned with 10-day sensor logic
UPDATE products
SET days_per_unit = 10,
    default_90_day_qty = 9,
    hcpcs = COALESCE(hcpcs, 'A9276'),
    updated_at = NOW()
WHERE name = 'Instinct Sensors';

COMMIT;

-- Verification
SELECT
  name,
  category,
  manufacturer,
  sku,
  active,
  days_per_unit,
  default_90_day_qty,
  hcpcs
FROM products
WHERE name IN (
  'Autosoft XC 6mm 5"',
  'Instinct Sensors',
  'Guardian 4 Sensors',
  'Bionic iLet infusion set Detach Steel 23"6mm',
  'iLet Cartridges'
)
ORDER BY name;
