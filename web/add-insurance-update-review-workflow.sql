-- Adds account insurance review workflow fields for client portal edits
-- Behavior:
-- 1) Client can edit profile fields directly
-- 2) Insurance changes are stored as pending and require admin approval

alter table if exists public.leads
  add column if not exists insurance_group_number text,
  add column if not exists pending_insurance_provider text,
  add column if not exists pending_insurance_member_id text,
  add column if not exists pending_insurance_group_number text,
  add column if not exists insurance_update_review_status text,
  add column if not exists insurance_update_requested_at timestamptz,
  add column if not exists insurance_update_reviewed_at timestamptz;

create index if not exists idx_leads_insurance_update_review_status
  on public.leads (insurance_update_review_status);

create index if not exists idx_leads_insurance_update_requested_at
  on public.leads (insurance_update_requested_at);
