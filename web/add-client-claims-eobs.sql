-- Adds claim/EOB storage for patient profiles (Claims & EOBs tab)

create table if not exists public.client_claims (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  claim_number text,
  date_of_service date,
  record_type text default 'claim' check (record_type in ('claim', 'eob')),
  billed_amount numeric,
  allowed_amount numeric,
  paid_amount numeric,
  patient_responsibility numeric,
  status text default 'submitted' check (status in ('submitted', 'pending', 'paid', 'denied', 'appealed')),
  file_url text,
  file_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_client_claims_lead_id on public.client_claims(lead_id);

alter table public.client_claims enable row level security;

drop policy if exists "Allow all operations on client_claims" on public.client_claims;
create policy "Allow all operations on client_claims" on public.client_claims
  for all
  using (true)
  with check (true);

create trigger update_client_claims_updated_at
  before update on public.client_claims
  for each row
  execute function update_updated_at_column();

-- Storage bucket for uploaded claim/EOB files
insert into storage.buckets (id, name, public)
values ('client-claims', 'client-claims', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload to client-claims" on storage.objects;
drop policy if exists "Anyone can view client-claims" on storage.objects;
drop policy if exists "Anyone can update client-claims" on storage.objects;
drop policy if exists "Anyone can delete client-claims" on storage.objects;

create policy "Anyone can upload to client-claims"
on storage.objects for insert
with check (bucket_id = 'client-claims');

create policy "Anyone can view client-claims"
on storage.objects for select
using (bucket_id = 'client-claims');

create policy "Anyone can update client-claims"
on storage.objects for update
using (bucket_id = 'client-claims');

create policy "Anyone can delete client-claims"
on storage.objects for delete
using (bucket_id = 'client-claims');
