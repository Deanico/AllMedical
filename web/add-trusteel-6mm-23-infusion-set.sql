-- Add (or reactivate) Tandem TruSteel infusion set 6mm 23"
BEGIN;

UPDATE products
SET active = true, updated_at = NOW()
WHERE sku = 'TS-6-23';

INSERT INTO products (name, category, manufacturer, description, sku, active)
SELECT 'TruSteel 6mm 23"', 'infusion_set', 'Tandem', 'TruSteel steel cannula infusion set, 6mm, 23" tubing', 'TS-6-23', true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TS-6-23');

UPDATE products
SET days_per_unit = 2.5,
    default_90_day_qty = 36,
    hcpcs = COALESCE(hcpcs, 'A4225'),
    updated_at = NOW()
WHERE sku = 'TS-6-23';

COMMIT;
