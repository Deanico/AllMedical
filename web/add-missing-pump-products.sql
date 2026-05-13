-- Add missing pump products needed for Diabetic Overstock pricing and catalog completeness
-- Safe to re-run: inserts only when the product name or SKU does not already exist.

BEGIN;

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'Dexcom G6 Sensor (1)', 'sensor', 'Dexcom', 'Continuous glucose monitoring sensor, single unit', 'DX-G6-1PK', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'Dexcom G6 Sensor (1)' OR sku = 'DX-G6-1PK'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'Autosoft XC 6mm 43"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 6mm cannula, 43" tubing', 'ASX-6-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'Autosoft XC 6mm 43"' OR sku = 'ASX-6-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'Autosoft XC 9mm 43"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 9mm cannula, 43" tubing', 'ASX-9-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'Autosoft XC 9mm 43"' OR sku = 'ASX-9-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'AutoSoft 90 6mm 43"', 'infusion_set', 'Tandem', 'AutoSoft 90 infusion set, 6mm cannula, 43" tubing', 'AS90-6-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'AutoSoft 90 6mm 43"' OR sku = 'AS90-6-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'AutoSoft 90 9mm 43"', 'infusion_set', 'Tandem', 'AutoSoft 90 infusion set, 9mm cannula, 43" tubing', 'AS90-9-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'AutoSoft 90 9mm 43"' OR sku = 'AS90-9-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'Autosoft 30 13mm 23"', 'infusion_set', 'Tandem', 'Autosoft 30 angled infusion set, 13mm cannula, 23" tubing', 'AS30-13-23', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'Autosoft 30 13mm 23"' OR sku = 'AS30-13-23'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'Autosoft 30 13mm 43"', 'infusion_set', 'Tandem', 'Autosoft 30 angled infusion set, 13mm cannula, 43" tubing', 'AS30-13-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'Autosoft 30 13mm 43"' OR sku = 'AS30-13-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Mio Advance Infusion Set 6mm 43in', 'infusion_set', 'Medtronic', 'MiniMed Mio Advance infusion set, 6mm cannula, 43 inch tubing', 'MM-MIOA-6-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'MiniMed Mio Advance Infusion Set 6mm 43in' OR sku = 'MM-MIOA-6-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Mio Advance Infusion Set 9mm 43in', 'infusion_set', 'Medtronic', 'MiniMed Mio Advance infusion set, 9mm cannula, 43 inch tubing', 'MM-MIOA-9-43', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'MiniMed Mio Advance Infusion Set 9mm 43in' OR sku = 'MM-MIOA-9-43'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'MiniMed Reservoir 1.8mL', 'reservoir', 'Medtronic', 'MiniMed 1.8mL insulin reservoir for Medtronic pumps', 'MM-RES-1.8ML', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'MiniMed Reservoir 1.8mL' OR sku = 'MM-RES-1.8ML'
);

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'Medtronic Extended Reservoir 3mL (10ct)', 'reservoir', 'Medtronic', 'Extended-wear 3mL insulin reservoir for Medtronic pumps, 10 count', 'MM-EXT-RES-3ML', true
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'Medtronic Extended Reservoir 3mL (10ct)' OR sku = 'MM-EXT-RES-3ML'
);

COMMIT;

SELECT name, category, manufacturer, sku, active
FROM products
WHERE name IN (
  'Dexcom G6 Sensor (1)',
  'Autosoft XC 6mm 43"',
  'Autosoft XC 9mm 43"',
  'AutoSoft 90 6mm 43"',
  'AutoSoft 90 9mm 43"',
  'Autosoft 30 13mm 23"',
  'Autosoft 30 13mm 43"',
  'MiniMed Mio Advance Infusion Set 6mm 43in',
  'MiniMed Mio Advance Infusion Set 9mm 43in',
  'MiniMed Reservoir 1.8mL',
  'Medtronic Extended Reservoir 3mL (10ct)'
)
ORDER BY name;