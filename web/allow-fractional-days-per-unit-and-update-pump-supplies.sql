-- Allow fractional days_per_unit values and align pump supplies to 2.5-day cadence.
-- Safe to re-run.

BEGIN;

ALTER TABLE products
  ALTER COLUMN days_per_unit TYPE NUMERIC(6,2)
  USING days_per_unit::numeric;

UPDATE products
SET days_per_unit = 2.5,
    default_90_day_qty = 36,
    updated_at = NOW()
WHERE (
    name ILIKE '%tandem%cartridge%'
    OR name ILIKE '%mobi%cartridge%'
    OR name ILIKE '%t:slim%cartridge%'
    OR name ILIKE '%tslim%cartridge%'
    OR name ILIKE '%ilet%infusion%'
    OR name ILIKE '%bionic%ilet%detach%steel%'
    OR name ILIKE '%ilet%cartridge%'
    OR name = 'Autosoft XC 6mm 5"'
  )
  OR sku IN ('MM-MIOA-6-23', 'MM-MIOA-9-23', 'MM-EXT-6-23', 'MM-EXT-9-23', 'MM-RES-3ML', 'MM-RES-1.8ML');

UPDATE products
SET days_per_unit = 2.5,
    default_90_day_qty = 36,
    hcpcs = COALESCE(hcpcs, 'A4225'),
    updated_at = NOW()
WHERE name IN ('Autosoft XC 6mm 5"', 'Bionic iLet infusion set Detach Steel 23"6mm')
   OR sku IN ('MM-MIOA-6-23', 'MM-MIOA-9-23', 'MM-EXT-6-23', 'MM-EXT-9-23');

UPDATE products
SET days_per_unit = 2.5,
    default_90_day_qty = 36,
    hcpcs = COALESCE(hcpcs, 'A4226'),
    updated_at = NOW()
WHERE name = 'iLet Cartridges'
   OR sku IN ('MM-RES-3ML', 'MM-RES-1.8ML')
   OR name ILIKE '%tandem%cartridge%'
   OR name ILIKE '%mobi%cartridge%'
   OR name ILIKE '%t:slim%cartridge%'
   OR name ILIKE '%tslim%cartridge%';

COMMIT;