-- Adds portal access tracking fields for client onboarding status
-- Status logic:
-- 1) Not Invited: portal_invited_at is null and portal_accepted_at is null
-- 2) Invited: portal_invited_at is set and portal_accepted_at is null
-- 3) Accepted (Created): portal_accepted_at is set

alter table if exists public.leads
  add column if not exists portal_invited_at timestamptz,
  add column if not exists portal_accepted_at timestamptz;

create index if not exists idx_leads_portal_invited_at
  on public.leads (portal_invited_at);

create index if not exists idx_leads_portal_accepted_at
  on public.leads (portal_accepted_at);
