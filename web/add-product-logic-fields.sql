-- Product Logic Fields Migration
-- Adds days_per_unit, default_90_day_qty, hcpcs to products table
-- Adds last_ship_date to client_products table
-- Deactivates removed products (test strips, patches, wipes, TruSteel, Sure-T, Silhouette, Quick Set)
-- Sets frequency_days on client_products to 88 (90 days minus 2-day shipping buffer)

BEGIN;

-- ============================================================
-- 1. Add new columns to products table
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS days_per_unit     INTEGER,       -- how many days one unit lasts
  ADD COLUMN IF NOT EXISTS default_90_day_qty INTEGER,      -- standard quantity for 90-day supply
  ADD COLUMN IF NOT EXISTS hcpcs             TEXT;          -- billing/HCPCS code

-- ============================================================
-- 2. Add last_ship_date to client_products   
-- ============================================================
ALTER TABLE client_products
  ADD COLUMN IF NOT EXISTS last_ship_date DATE;

-- ============================================================
-- 3. Populate product logic data with accurate clinical values
-- ============================================================

-- Dexcom G7 10-day sensor (standard G7 — each sensor lasts exactly 10 days)
UPDATE products SET days_per_unit = 10, default_90_day_qty = 9, hcpcs = 'A9276'
WHERE name ILIKE '%dexcom g7%' AND name NOT ILIKE '%15%day%' AND category = 'sensor';

-- Dexcom G7 15-day sensor (G7 15-day wear variant)
UPDATE products SET days_per_unit = 15, default_90_day_qty = 6, hcpcs = 'A9276'
WHERE name ILIKE '%dexcom g7%15%day%' AND category = 'sensor';

-- Dexcom G6 sensor (each sensor lasts 10 days)
UPDATE products SET days_per_unit = 10, default_90_day_qty = 9, hcpcs = 'A9276'
WHERE name ILIKE '%dexcom g6%sensor%' AND category = 'sensor';

-- Dexcom G6 transmitter (lasts 3 months / 90 days, 1 per 90-day supply)
UPDATE products SET days_per_unit = 90, default_90_day_qty = 1, hcpcs = 'A9277'
WHERE name ILIKE '%dexcom g6%transmitter%';

-- Guardian 4 sensors (7-day wear -> 13 per 90 days)
UPDATE products SET days_per_unit = 7, default_90_day_qty = 13, hcpcs = 'A9276'
WHERE name ILIKE '%guardian%4%sensor%' AND category = 'sensor';

-- Instinct sensors (align to standard 10-day sensor cadence -> 9 per 90 days)
UPDATE products SET days_per_unit = 10, default_90_day_qty = 9, hcpcs = 'A9276'
WHERE name ILIKE '%instinct%sensor%' AND category = 'sensor';

-- Freestyle Libre 2 Plus sensor (14-day wear → 7 per 90 days)
UPDATE products SET days_per_unit = 14, default_90_day_qty = 7, hcpcs = 'A9276'
WHERE name ILIKE '%freestyle libre 2 plus%sensor%';

-- Freestyle Libre 3 Plus sensor (15-day wear → 6 per 90 days)
UPDATE products SET days_per_unit = 15, default_90_day_qty = 6, hcpcs = 'A9276'
WHERE name ILIKE '%freestyle libre 3 plus%sensor%';

-- Freestyle Libre 3 sensor (14-day wear → 7 per 90 days)
UPDATE products SET days_per_unit = 14, default_90_day_qty = 7, hcpcs = 'A9276'
WHERE name ILIKE '%freestyle libre 3 sensor%' AND name NOT ILIKE '%plus%';

-- Freestyle Libre 2 sensor (14-day wear → 7 per 90 days)
UPDATE products SET days_per_unit = 14, default_90_day_qty = 7, hcpcs = 'A9276'
WHERE name ILIKE '%freestyle libre 2 sensor%' AND name NOT ILIKE '%plus%';

-- Omnipod 5 pods — each pod lasts 3 days, so 30 pods per 90-day supply
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A9274'
WHERE name ILIKE '%omnipod 5%' AND category = 'pod';

-- Omnipod DASH pods — each pod lasts 3 days, so 30 pods per 90-day supply
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A9274'
WHERE name ILIKE '%omnipod dash%' AND category = 'pod';

-- Tandem Autosoft XC infusion sets — soft cannula, changed every 3 days → 30 per 90-day supply
-- HCPCS A4225 = insulin infusion pump, soft cannula infusion set
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A4225'
WHERE name ILIKE '%autosoft xc%' AND category = 'infusion_set';

-- Tandem AutoSoft 90 infusion sets — soft cannula, changed every 3 days → 30 per 90-day supply
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A4225'
WHERE name ILIKE '%autosoft 90%' AND category = 'infusion_set';

-- Tandem Mobi cartridges — changed every 3 days → 30 per 90-day supply
-- HCPCS A4226 = insulin pump cartridges/reservoirs
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A4226'
WHERE name ILIKE '%tandem%cartridge%' OR name ILIKE '%mobi%cartridge%';

-- Tandem t:slim X2 cartridges — changed every 3 days → 30 per 90-day supply
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A4226'
WHERE name ILIKE '%t:slim%cartridge%' OR name ILIKE '%tslim%cartridge%';

-- iLet infusion sets — steel/soft infusion set cadence is every 3 days
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A4225'
WHERE name ILIKE '%ilet%infusion%' OR name ILIKE '%bionic%ilet%detach%steel%';

-- iLet cartridges — cartridge/reservoir cadence is every 3 days
UPDATE products SET days_per_unit = 3, default_90_day_qty = 30, hcpcs = 'A4226'
WHERE name ILIKE '%ilet%cartridge%';

-- ============================================================
-- 4. Deactivate removed product lines
--    (test strips, patches, wipes, TruSteel, Sure-T, Silhouette, Quick Set)
-- ============================================================

-- Test strips
UPDATE products SET active = false
WHERE name ILIKE '%test strip%' OR category ILIKE '%test_strip%' OR category ILIKE '%glucose_strip%';

-- Patches / adhesive patches
UPDATE products SET active = false
WHERE name ILIKE '%patch%' AND name NOT ILIKE '%infusion%';

-- Wipes (alcohol wipes, prep wipes, etc.)
UPDATE products SET active = false
WHERE name ILIKE '%wipe%' OR name ILIKE '%prep pad%';

-- TruSteel infusion sets (Tandem brand steel cannula — removing per request)
UPDATE products SET active = false
WHERE name ILIKE '%truesteel%' OR name ILIKE '%tru-steel%' OR name ILIKE '%trusteel%';

-- Sure-T infusion sets (Medtronic steel cannula)
UPDATE products SET active = false
WHERE name ILIKE '%sure-t%' OR name ILIKE '%sure_t%' OR name ILIKE '%suret%';

-- Silhouette infusion sets (Medtronic angled)
UPDATE products SET active = false
WHERE name ILIKE '%silhouette%' AND category = 'infusion_set';

-- Quick Set / Quick-set infusion sets (Medtronic)
UPDATE products SET active = false
WHERE name ILIKE '%quick%set%' OR name ILIKE '%quickset%';

-- ============================================================
-- 5. Update client_products.frequency_days to 88 (90 − 2 buffer)
--    for all active assignments so existing schedules stay in sync
-- ============================================================
UPDATE client_products
SET frequency_days = 88
WHERE active = true AND frequency_days != 88;

-- ============================================================
-- 6. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_hcpcs ON products(hcpcs);
CREATE INDEX IF NOT EXISTS idx_client_products_last_ship_date ON client_products(last_ship_date);

COMMIT;
