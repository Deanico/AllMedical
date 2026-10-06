-- Adds detailed billing ledger storage for patient profiles (Billing tab)
-- Tracks individual line items (date of service, HCPCS code, billed/allowed/paid/deductible amounts)
-- so staff can review a patient's billing history in one place instead of the claims portal.

create table if not exists public.client_billing_records (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  date_of_service date,
  hcpcs_code text,
  billed_amount numeric,
  allowed_amount numeric,
  paid_amount numeric,
  deductible_amount numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_client_billing_records_lead_id on public.client_billing_records(lead_id);
create index if not exists idx_client_billing_records_date_of_service on public.client_billing_records(date_of_service desc);

alter table public.client_billing_records enable row level security;

drop policy if exists "Allow all operations on client_billing_records" on public.client_billing_records;
create policy "Allow all operations on client_billing_records" on public.client_billing_records
  for all
  using (true)
  with check (true);

create trigger update_client_billing_records_updated_at
  before update on public.client_billing_records
  for each row
  execute function update_updated_at_column();
