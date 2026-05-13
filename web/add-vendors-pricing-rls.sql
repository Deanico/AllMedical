-- Migration: basic RLS for vendors and product_vendor_pricing
-- Goals:
-- 1) Full access for service role
-- 2) Read-only access for authenticated users
-- 3) No public (anon) write access

BEGIN;

-- Enable RLS on both tables
ALTER TABLE IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_vendor_pricing ENABLE ROW LEVEL SECURITY;

-- Remove prior policies with the same names to keep this migration re-runnable
DROP POLICY IF EXISTS "Service role full access vendors" ON vendors;
DROP POLICY IF EXISTS "Authenticated read vendors" ON vendors;
DROP POLICY IF EXISTS "Service role full access product_vendor_pricing" ON product_vendor_pricing;
DROP POLICY IF EXISTS "Authenticated read product_vendor_pricing" ON product_vendor_pricing;

-- vendors policies
CREATE POLICY "Service role full access vendors"
ON vendors
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated read vendors"
ON vendors
FOR SELECT
TO authenticated
USING (true);

-- product_vendor_pricing policies
CREATE POLICY "Service role full access product_vendor_pricing"
ON product_vendor_pricing
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated read product_vendor_pricing"
ON product_vendor_pricing
FOR SELECT
TO authenticated
USING (true);

COMMIT;
