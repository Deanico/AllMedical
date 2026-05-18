-- Migration: add approval workflow support columns to pending_orders
-- Additive only: no data rewrite, no column drops, no behavior changes

BEGIN;

ALTER TABLE IF EXISTS public.pending_orders
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text;

COMMIT;
