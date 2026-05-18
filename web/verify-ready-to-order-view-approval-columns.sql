-- Verification: ready_to_order_view exposes approval workflow fields

SELECT
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'ready_to_order_view'
  AND c.column_name IN (
    'approval_requested_at',
    'approval_status',
    'approved_at',
    'approved_by'
  )
ORDER BY c.column_name;

-- Optional n8n sanity check: rows not yet requested for approval
SELECT
  pending_order_id,
  patient_full_name,
  product_name,
  ship_date,
  approval_requested_at,
  approval_status
FROM ready_to_order_view
WHERE approval_requested_at IS NULL
ORDER BY ship_date, pending_order_id
LIMIT 100;
