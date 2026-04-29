-- Add missing Tandem products to the live catalog
-- Safe to run multiple times

INSERT INTO products (name, category, manufacturer, description, sku)
VALUES
  ('Tandem Mobi Cartridge 2mL', 'reservoir', 'Tandem', 'Insulin cartridge for Tandem Mobi pump, 2mL capacity', 'MOBI-2ML'),
  ('Tandem Autosoft XC Infusion Set 6mm 5"', 'infusion_set', 'Tandem', 'Autosoft XC infusion set, 6mm cannula, 5" tubing', 'ASX-6-5')
ON CONFLICT DO NOTHING;

-- Verify both products exist
SELECT name, category, manufacturer, sku
FROM products
WHERE sku IN ('MOBI-2ML', 'ASX-6-5')
ORDER BY name;
