-- Cleanup: remove bare-name duplicate products and their orphaned vendor pricing rows
-- Safe to run: all 9 rows have 0 client_product links; spec'd replacements already exist.
-- Run in Supabase SQL Editor. Review the verification SELECT before committing.

BEGIN;

-- Step 1: Delete orphaned vendor pricing rows for the bare-name products
DELETE FROM product_vendor_pricing
WHERE product_id IN (
  -- Autosoft 90 (bare, no SKU, no clients)
  'efd9a9e3-c0d6-4500-a02f-ee6a7a8b5677',
  '8991c7ee-f8de-4978-a9e0-06ddf80c62a5',
  '9064a671-1e8d-471b-8006-edd0655fe23d',
  'd14681fb-c6e8-4c79-b6b2-e2ad07b801a9',
  -- Autosoft XC (bare, no SKU, no clients)
  '00a58239-7714-4302-8e57-14fe20b189af',
  'd28f0ed0-fb63-471d-a0d6-6ecaef6bf2c8',
  'ab548454-4807-4a3c-98d0-12cb8f239aeb',
  'e8510cef-e456-41e0-ae02-124921e82dc5',
  '733709ea-c22f-498e-9cec-25eecc3cd5ec'
);

-- Step 2: Delete the bare-name product rows themselves
DELETE FROM products
WHERE id IN (
  'efd9a9e3-c0d6-4500-a02f-ee6a7a8b5677',
  '8991c7ee-f8de-4978-a9e0-06ddf80c62a5',
  '9064a671-1e8d-471b-8006-edd0655fe23d',
  'd14681fb-c6e8-4c79-b6b2-e2ad07b801a9',
  '00a58239-7714-4302-8e57-14fe20b189af',
  'd28f0ed0-fb63-471d-a0d6-6ecaef6bf2c8',
  'ab548454-4807-4a3c-98d0-12cb8f239aeb',
  'e8510cef-e456-41e0-ae02-124921e82dc5',
  '733709ea-c22f-498e-9cec-25eecc3cd5ec'
);

-- Step 3: Verify — should return 0 rows if cleanup succeeded
SELECT id, name, sku
FROM products
WHERE id IN (
  'efd9a9e3-c0d6-4500-a02f-ee6a7a8b5677',
  '8991c7ee-f8de-4978-a9e0-06ddf80c62a5',
  '9064a671-1e8d-471b-8006-edd0655fe23d',
  'd14681fb-c6e8-4c79-b6b2-e2ad07b801a9',
  '00a58239-7714-4302-8e57-14fe20b189af',
  'd28f0ed0-fb63-471d-a0d6-6ecaef6bf2c8',
  'ab548454-4807-4a3c-98d0-12cb8f239aeb',
  'e8510cef-e456-41e0-ae02-124921e82dc5',
  '733709ea-c22f-498e-9cec-25eecc3cd5ec'
);

-- Step 4: Confirm spec'd replacements still exist (should return 8+ rows)
SELECT id, name, sku
FROM products
WHERE name ILIKE 'Autosoft 90%mm%'
   OR name ILIKE 'AutoSoft 90%mm%'
   OR name ILIKE 'Autosoft XC%mm%'
ORDER BY name;

COMMIT;
