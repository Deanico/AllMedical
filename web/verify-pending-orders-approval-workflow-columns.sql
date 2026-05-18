-- Verification: approval workflow columns on pending_orders
-- Read-only checks

-- 1) Column existence and definitions
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'pending_orders'
  AND c.column_name IN (
    'approval_requested_at',
    'approval_status',
    'approved_at',
    'approved_by'
  )
ORDER BY c.column_name;

-- 2) Existing rows unchanged check (new columns should remain NULL after additive migration)
SELECT
  COUNT(*) AS total_pending_orders,
  COUNT(*) FILTER (
    WHERE approval_requested_at IS NOT NULL
       OR approval_status IS NOT NULL
       OR approved_at IS NOT NULL
       OR approved_by IS NOT NULL
  ) AS rows_with_any_approval_value,
  COUNT(*) FILTER (
    WHERE approval_requested_at IS NULL
      AND approval_status IS NULL
      AND approved_at IS NULL
      AND approved_by IS NULL
  ) AS rows_with_all_new_columns_null
FROM public.pending_orders;

-- 3) Queue views still accessible
SELECT
  table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('reviewed_orders_view', 'ready_to_order_view')
ORDER BY table_name;
