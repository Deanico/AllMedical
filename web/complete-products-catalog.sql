-- Complete product catalog for AllMedical
-- This replaces all existing products with a full catalog

-- Clear existing products to avoid duplicates
DELETE FROM products;

-- Reset sequence if needed (PostgreSQL specific)
-- This ensures clean IDs

-- Main CGM and Pod Products (Your most common)
INSERT INTO products (name, category, manufacturer, description, sku) VALUES
  -- Dexcom Products
  ('Dexcom G7 Sensors (15-day)', 'sensor', 'Dexcom', 'Continuous glucose monitoring sensors, 15-day wear (3 pack)', 'DX-G7-15D-3PK'),
  ('Dexcom G7 Sensors (10-day)', 'sensor', 'Dexcom', 'Continuous glucose monitoring sensors, 10-day wear (3 pack)', 'DX-G7-10D-3PK'),
  ('Dexcom G6 Sensors', 'sensor', 'Dexcom', 'Continuous glucose monitoring sensors (3 pack)', 'DX-G6-3PK'),
  ('Dexcom G6 Transmitter', 'sensor', 'Dexcom', 'Bluetooth transmitter for G6 system', 'DX-G6-TX'),
  
  -- Omnipod Products
  ('Omnipod 5 Pods (Libre 2 Plus)', 'pod', 'Insulet', 'Tubeless insulin pump pods, Freestyle Libre 2 Plus compatible (5 pack)', 'OP5-FL2P-5PK'),
  ('Omnipod 5 Pods (Libre 2 Plus 10pk)', 'pod', 'Insulet', 'Tubeless insulin pump pods, Freestyle Libre 2 Plus compatible (10 pack)', 'OP5-FL2P-10PK'),
  ('Omnipod 5 Pods (Dexcom G6)', 'pod', 'Insulet', 'Tubeless insulin pump pods, Dexcom G6 compatible (5 pack)', 'OP5-G6-5PK'),
  ('Omnipod 5 Pods (Dexcom G6 10pk)', 'pod', 'Insulet', 'Tubeless insulin pump pods, Dexcom G6 compatible (10 pack)', 'OP5-G6-10PK'),
  ('Omnipod DASH Pods', 'pod', 'Insulet', 'Tubeless insulin pump pods for DASH system (5 pack)', 'OP-DASH-5PK'),
  
  -- Freestyle Libre Products
  ('Freestyle Libre 2 Plus Sensors', 'sensor', 'Abbott', 'Continuous glucose monitoring sensors', 'FL2P-SENS'),
  ('Freestyle Libre 3 Plus Sensors', 'sensor', 'Abbott', 'Continuous glucose monitoring sensors', 'FL3P-SENS'),
  ('Freestyle Libre 3 Sensors', 'sensor', 'Abbott', 'Continuous glucose monitoring sensors', 'FL3-SENS'),
  ('Freestyle Libre 2 Reader', 'sensor', 'Abbott', 'Reader device for Libre 2 system', 'FL2-READER'),

-- Tandem Autosoft XC Infusion Sets
  ('Tandem Autosoft XC Infusion Set 6mm 5"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 6mm cannula, 5" tubing', 'ASX-6-5'),
  ('Autosoft XC 6mm 23"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 6mm cannula, 23" tubing', 'ASX-6-23'),
  ('Autosoft XC 6mm 32"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 6mm cannula, 32" tubing', 'ASX-6-32'),
  ('Autosoft XC 9mm 23"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 9mm cannula, 23" tubing', 'ASX-9-23'),
  ('Autosoft XC 9mm 32"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 9mm cannula, 32" tubing', 'ASX-9-32'),

-- Tandem Autosoft 90 Infusion Sets  
  ('AutoSoft 90 6mm 23"', 'infusion_set', 'Tandem', 'AutoSoft 90 infusion set, 6mm cannula, 23" tubing', 'AS90-6-23'),
  ('AutoSoft 90 6mm 32"', 'infusion_set', 'Tandem', 'AutoSoft 90 infusion set, 6mm cannula, 32" tubing', 'AS90-6-32'),
  ('AutoSoft 90 9mm 23"', 'infusion_set', 'Tandem', 'AutoSoft 90 infusion set, 9mm cannula, 23" tubing', 'AS90-9-23'),
  ('AutoSoft 90 9mm 32"', 'infusion_set', 'Tandem', 'AutoSoft 90 infusion set, 9mm cannula, 32" tubing', 'AS90-9-32'),

-- Tandem TruSteel Infusion Sets
  ('TruSteel 6mm 23"', 'infusion_set', 'Tandem', 'TruSteel steel cannula infusion set, 6mm, 23" tubing', 'TS-6-23'),
  ('TruSteel 6mm 32"', 'infusion_set', 'Tandem', 'TruSteel steel cannula infusion set, 6mm, 32" tubing', 'TS-6-32'),
  ('TruSteel 8mm 23"', 'infusion_set', 'Tandem', 'TruSteel steel cannula infusion set, 8mm, 23" tubing', 'TS-8-23'),
  ('TruSteel 8mm 32"', 'infusion_set', 'Tandem', 'TruSteel steel cannula infusion set, 8mm, 32" tubing', 'TS-8-32'),

-- Medtronic Quick-set Infusion Sets
  ('Quick-set 6mm 23"', 'infusion_set', 'Medtronic', 'Quick-set infusion set, 6mm cannula, 23" tubing', 'QS-6-23'),
  ('Quick-set 6mm 32"', 'infusion_set', 'Medtronic', 'Quick-set infusion set, 6mm cannula, 32" tubing', 'QS-6-32'),
  ('Quick-set 6mm 43"', 'infusion_set', 'Medtronic', 'Quick-set infusion set, 6mm cannula, 43" tubing', 'QS-6-43'),
  ('Quick-set 9mm 23"', 'infusion_set', 'Medtronic', 'Quick-set infusion set, 9mm cannula, 23" tubing', 'QS-9-23'),
  ('Quick-set 9mm 32"', 'infusion_set', 'Medtronic', 'Quick-set infusion set, 9mm cannula, 32" tubing', 'QS-9-32'),
  ('Quick-set 9mm 43"', 'infusion_set', 'Medtronic', 'Quick-set infusion set, 9mm cannula, 43" tubing', 'QS-9-43'),

-- Medtronic Silhouette Infusion Sets
  ('Silhouette 13mm 23"', 'infusion_set', 'Medtronic', 'Silhouette angled infusion set, 13mm cannula, 23" tubing', 'SIL-13-23'),
  ('Silhouette 13mm 32"', 'infusion_set', 'Medtronic', 'Silhouette angled infusion set, 13mm cannula, 32" tubing', 'SIL-13-32'),
  ('Silhouette 13mm 43"', 'infusion_set', 'Medtronic', 'Silhouette angled infusion set, 13mm cannula, 43" tubing', 'SIL-13-43'),
  ('Silhouette 17mm 23"', 'infusion_set', 'Medtronic', 'Silhouette angled infusion set, 17mm cannula, 23" tubing', 'SIL-17-23'),
  ('Silhouette 17mm 32"', 'infusion_set', 'Medtronic', 'Silhouette angled infusion set, 17mm cannula, 32" tubing', 'SIL-17-32'),
  ('Silhouette 17mm 43"', 'infusion_set', 'Medtronic', 'Silhouette angled infusion set, 17mm cannula, 43" tubing', 'SIL-17-43'),

-- Medtronic Sure-T Infusion Sets
  ('Sure-T 6mm 23"', 'infusion_set', 'Medtronic', 'Sure-T steel cannula infusion set, 6mm, 23" tubing', 'ST-6-23'),
  ('Sure-T 6mm 32"', 'infusion_set', 'Medtronic', 'Sure-T steel cannula infusion set, 6mm, 32" tubing', 'ST-6-32'),
  ('Sure-T 6mm 43"', 'infusion_set', 'Medtronic', 'Sure-T steel cannula infusion set, 6mm, 43" tubing', 'ST-6-43'),
  ('Sure-T 8mm 23"', 'infusion_set', 'Medtronic', 'Sure-T steel cannula infusion set, 8mm, 23" tubing', 'ST-8-23'),
  ('Sure-T 8mm 32"', 'infusion_set', 'Medtronic', 'Sure-T steel cannula infusion set, 8mm, 32" tubing', 'ST-8-32'),
  ('Sure-T 8mm 43"', 'infusion_set', 'Medtronic', 'Sure-T steel cannula infusion set, 8mm, 43" tubing', 'ST-8-43'),

-- Medtronic Mio Infusion Sets
  ('Mio 6mm 23"', 'infusion_set', 'Medtronic', 'Mio all-in-one infusion set, 6mm cannula, 23" tubing', 'MIO-6-23'),
  ('Mio 6mm 32"', 'infusion_set', 'Medtronic', 'Mio all-in-one infusion set, 6mm cannula, 32" tubing', 'MIO-6-32'),
  ('Mio 9mm 23"', 'infusion_set', 'Medtronic', 'Mio all-in-one infusion set, 9mm cannula, 23" tubing', 'MIO-9-23'),
  ('Mio 9mm 32"', 'infusion_set', 'Medtronic', 'Mio all-in-one infusion set, 9mm cannula, 32" tubing', 'MIO-9-32'),

-- Reservoirs
  ('Medtronic 3mL Reservoir', 'reservoir', 'Medtronic', 'Standard 3mL insulin reservoir for Medtronic pumps', 'RES-3ML'),
  ('Medtronic 1.8mL Reservoir', 'reservoir', 'Medtronic', 'Smaller 1.8mL insulin reservoir for Medtronic pumps', 'RES-1.8ML'),
  ('Tandem Mobi Cartridge 2mL', 'reservoir', 'Tandem', 'Insulin cartridge for Tandem Mobi pump, 2mL capacity', 'MOBI-2ML'),
  ('Tandem t:slim X2 Cartridge 3mL', 'reservoir', 'Tandem', 'Insulin cartridge for t:slim X2 pump, 3mL capacity', 'TSLIM-3ML'),

-- Common Supplies
  ('Skin Tac Wipes', 'supply', 'Torbot', 'Adhesive wipes for securing infusion sites', 'SKINTAC'),
  ('Skin Prep Wipes', 'supply', 'Smith & Nephew', 'Protective barrier wipes for skin under adhesive', 'SKINPREP'),
  ('IV Prep Wipes', 'supply', 'Smith & Nephew', 'Skin preparation wipes for infusion site', 'IVPREP'),
  ('Tegaderm Patches', 'supply', '3M', 'Transparent dressing for securing infusion sets', 'TEGADERM'),
  ('Unisolve Adhesive Remover', 'supply', 'Smith & Nephew', 'Adhesive removal wipes for infusion sets', 'UNISOLVE'),
  
-- Test Strips
  ('Contour Next Test Strips', 'test_strips', 'Ascensia', 'Blood glucose test strips (100 count)', 'CONTOUR-100'),
  ('FreeStyle Lite Test Strips', 'test_strips', 'Abbott', 'Blood glucose test strips (100 count)', 'FSLITE-100'),
  ('OneTouch Ultra Test Strips', 'test_strips', 'LifeScan', 'Blood glucose test strips (100 count)', 'OTULTRA-100');

-- Verify the results
SELECT category, COUNT(*) as product_count, STRING_AGG(DISTINCT manufacturer, ', ') as manufacturers
FROM products
WHERE active = true
GROUP BY category
ORDER BY category;

-- Show main products (CGM/Pods)
SELECT name, category, manufacturer, sku
FROM products
WHERE category IN ('sensor', 'pod')
ORDER BY manufacturer, name;
