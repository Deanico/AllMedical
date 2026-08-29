-- Records the versioned legal acknowledgement made during patient portal registration.
-- Run this in the Supabase SQL Editor after add-client-portal-access-tracking.sql.

alter table if exists public.leads
  add column if not exists portal_terms_accepted_at timestamptz,
  add column if not exists portal_terms_version text,
  add column if not exists portal_privacy_notice_version text,
  add column if not exists portal_auth_user_id uuid;

create index if not exists idx_leads_portal_terms_accepted_at
  on public.leads (portal_terms_accepted_at);

create index if not exists idx_leads_portal_auth_user_id
  on public.leads (portal_auth_user_id);