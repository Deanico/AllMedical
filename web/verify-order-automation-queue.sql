-- verify-order-automation-queue.sql
-- Read-only checks for shipment -> pending -> reviewed -> ready_to_order pipeline

-- 1) Required views exist
SELECT table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'shipment_due_view',
    'reviewed_orders_view',
    'ready_to_order_view',
    'product_best_price_view'
  )
ORDER BY table_name;

-- 2) pending_orders recommendation columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pending_orders'
  AND column_name IN (
    'recommended_vendor_id',
    'recommended_vendor_name',
    'recommended_unit_price',
    'client_product_id'
  )
ORDER BY column_name;

-- 3) FK checks (legacy + new)
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'pending_orders'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name IN ('preferred_supplier_id', 'recommended_vendor_id')
ORDER BY kcu.column_name;

-- 4) Rows that will not resolve product_id cleanly (legacy dirty rows)
SELECT
  po.id AS pending_order_id,
  po.client_product_id,
  po.status,
  po.ship_date,
  po.order_details
FROM pending_orders po
LEFT JOIN client_products cp ON cp.id = po.client_product_id
WHERE cp.product_id IS NULL
  AND NOT (
    (po.order_details ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
ORDER BY po.created_at DESC
LIMIT 100;

-- 5) Verify join bridge from reviewed queue to best price view by product_id
SELECT
  ro.pending_order_id,
  ro.client_product_id,
  ro.product_id,
  ro.product_name,
  COUNT(pbpv.vendor_id) AS vendor_options
FROM reviewed_orders_view ro
LEFT JOIN product_best_price_view pbpv
  ON pbpv.product_id = ro.product_id
GROUP BY ro.pending_order_id, ro.client_product_id, ro.product_id, ro.product_name
ORDER BY vendor_options ASC, ro.pending_order_id;

-- 6) Verify ready_to_order queue rows have recommendation payload
SELECT
  rto.pending_order_id,
  rto.status,
  rto.recommended_vendor_id,
  rto.recommended_vendor_name,
  rto.recommended_unit_price,
  CASE
    WHEN rto.recommended_vendor_id IS NULL AND COALESCE(rto.recommended_vendor_name, '') = '' THEN 'MISSING_RECOMMENDATION'
    WHEN rto.recommended_unit_price IS NULL OR rto.recommended_unit_price <= 0 THEN 'BAD_RECOMMENDED_PRICE'
    ELSE 'OK'
  END AS recommendation_health
FROM ready_to_order_view rto
ORDER BY recommendation_health DESC, rto.pending_order_id;

-- 7) Validate auto-generated order_details JSON shape for new rows
SELECT
  po.id AS pending_order_id,
  po.created_at,
  po.status,
  po.order_details,
  CASE WHEN po.order_details ? 'patient_name' THEN 'Y' ELSE 'N' END AS has_patient_name,
  CASE WHEN po.order_details ? 'product_name' THEN 'Y' ELSE 'N' END AS has_product_name,
  CASE WHEN po.order_details ? 'product_id' THEN 'Y' ELSE 'N' END AS has_product_id,
  CASE WHEN po.order_details ? 'quantity' THEN 'Y' ELSE 'N' END AS has_quantity,
  CASE WHEN po.order_details ? 'ship_date' THEN 'Y' ELSE 'N' END AS has_ship_date,
  CASE WHEN po.order_details ->> 'auto_generated' = 'true' THEN 'Y' ELSE 'N' END AS has_auto_generated_true
FROM pending_orders po
WHERE po.order_details ->> 'auto_generated' = 'true'
ORDER BY po.created_at DESC
LIMIT 100;
