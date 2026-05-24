-- Fill missing TestStripz product URLs for specific canonical products only
-- Rules:
-- 1) Only vendor rows for TestStripz
-- 2) Only where product_vendor_pricing.product_url is missing/blank
-- 3) Do not update price fields

BEGIN;

WITH target_rows AS (
  SELECT
    pvp.id,
    p.name AS product_name,
    p.sku,
    CASE
      -- Dexcom G7 10-day variants
      WHEN (
        lower(p.name) ~ 'dexcom.*g7.*10.*day.*6.*(pack|pk)'
        OR coalesce(p.sku, '') ILIKE '%G7%10D%6%'
      ) THEN 'https://shop.teststripz.com/products/dexcom-g7-sensor-6-pack?variant=43702956949694'

      WHEN (
        lower(p.name) ~ 'dexcom.*g7.*10.*day.*1.*(pack|pk)'
        OR coalesce(p.sku, '') ILIKE '%G7%10D%1%'
      ) THEN 'https://shop.teststripz.com/products/dexcom-g7-sensor-1-pack?variant=43524364009662'

      WHEN (
        lower(p.name) ~ 'dexcom.*g7.*10.*day'
        OR p.name = 'Dexcom G7 Sensors (10-day)'
      ) THEN 'https://shop.teststripz.com/products/dexcom-g7-sensor-3-pack?variant=43582075011262'

      -- Omnipod 5 variants
      WHEN lower(p.name) ~ 'omnipod.*5.*20.*(pack|pk)'
      THEN 'https://shop.teststripz.com/products/omnipod-5-pods-20-pack?_pos=5&_sid=391b369e6&_ss=r'

      WHEN lower(p.name) ~ 'omnipod.*5.*5.*(pack|pk)'
      THEN 'https://shop.teststripz.com/products/omnipod-5-pods-5-pack-copy?_pos=1&_sid=391b369e6&_ss=r&variant=46652189540542'

      ELSE NULL
    END AS new_product_url
  FROM product_vendor_pricing pvp
  JOIN vendors v ON v.id = pvp.vendor_id
  JOIN products p ON p.id = pvp.product_id
  WHERE regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g') = 'teststripz'
    AND COALESCE(NULLIF(BTRIM(pvp.product_url), ''), NULL) IS NULL
), updated AS (
  UPDATE product_vendor_pricing pvp
  SET product_url = t.new_product_url
  FROM target_rows t
  WHERE pvp.id = t.id
    AND t.new_product_url IS NOT NULL
  RETURNING pvp.id
)
SELECT COUNT(*) AS rows_updated
FROM updated;

COMMIT;

-- Verification: show TestStripz rows for mapped products
SELECT
  p.name AS product_name,
  p.sku,
  pvp.price,
  pvp.product_url,
  v.name AS vendor_name
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g') = 'teststripz'
  AND (
    lower(p.name) LIKE '%dexcom%g7%10%day%'
    OR lower(p.name) LIKE '%omnipod%5%'
  )
ORDER BY p.name;
