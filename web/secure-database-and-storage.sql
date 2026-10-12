-- Locks down the database and file storage.
-- Run once in the Supabase SQL Editor. Re-run it after applying any other schema script,
-- because older scripts recreate open "allow all" policies.
--
-- Result:
--   * Admins (auth app_metadata role = 'admin') keep full access.
--   * The public website can only INSERT new leads.
--   * Portal clients can read their own records and update only their own contact details.
--   * Patient document buckets become private (opened through short-lived signed links).

-- 1. Admin check --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- 2. Remove every existing public-schema policy -------------------------------
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END $$;

-- 3. Row level security + admin-only access on every table --------------------
DO $$
DECLARE
  table_row RECORD;
BEGIN
  FOR table_row IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> 'patient_sms_messages'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_row.table_name);
    EXECUTE format(
      'CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      table_row.table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.patient_sms_messages ENABLE ROW LEVEL SECURITY;

-- 4. Views must respect the caller's permissions ------------------------------
DO $$
DECLARE
  view_row RECORD;
BEGIN
  FOR view_row IN
    SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', view_row.schemaname, view_row.viewname);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not secure view %.%: %', view_row.schemaname, view_row.viewname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 5. Anonymous visitors: no table access except submitting a lead -------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

GRANT INSERT ON public.leads TO anon;

CREATE POLICY "Website can submit new leads" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (COALESCE(stage, 'new') = 'new' AND qualified_at IS NULL);

DO $$
BEGIN
  IF to_regclass('public.contact_submissions') IS NOT NULL THEN
    EXECUTE 'GRANT INSERT ON public.contact_submissions TO anon';
    EXECUTE 'CREATE POLICY "Website can submit contact forms" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;
END $$;

-- 6. Client portal: own records only ------------------------------------------
CREATE POLICY "Clients read own lead" ON public.leads
  FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Clients update own lead" ON public.leads
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Clients read own client_products" ON public.client_products
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = client_products.lead_id));

CREATE POLICY "Clients read own pending_orders" ON public.pending_orders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = pending_orders.lead_id));

CREATE POLICY "Clients read own pending_order_items" ON public.pending_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pending_orders o WHERE o.id = pending_order_items.pending_order_id));

CREATE POLICY "Clients read products they receive" ON public.products
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.client_products cp WHERE cp.product_id = products.id)
    OR EXISTS (SELECT 1 FROM public.pending_order_items poi WHERE poi.product_id = products.id)
  );

-- Clients may only change contact details and portal acceptance fields on their own lead.
CREATE OR REPLACE FUNCTION public.restrict_client_lead_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  changed_key TEXT;
  allowed_keys TEXT[] := ARRAY[
    'name', 'phone', 'address_line1', 'city', 'state', 'zip_code',
    'portal_accepted_at', 'portal_terms_accepted_at', 'portal_terms_version',
    'portal_privacy_notice_version', 'portal_auth_user_id',
    'pending_insurance_provider', 'pending_insurance_member_id', 'pending_insurance_group_number',
    'insurance_update_requested_at', 'insurance_update_review_status',
    'updated_at'
  ];
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'authenticated' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  FOR changed_key IN
    SELECT n.key
    FROM jsonb_each(to_jsonb(NEW)) n
    LEFT JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value
  LOOP
    IF NOT (changed_key = ANY (allowed_keys)) THEN
      RAISE EXCEPTION 'Not allowed to change %', changed_key USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF to_jsonb(NEW) ->> 'portal_auth_user_id' IS DISTINCT FROM to_jsonb(OLD) ->> 'portal_auth_user_id'
     AND to_jsonb(NEW) ->> 'portal_auth_user_id' IS DISTINCT FROM auth.uid()::TEXT THEN
    RAISE EXCEPTION 'Not allowed to change portal_auth_user_id' USING ERRCODE = '42501';
  END IF;

  IF to_jsonb(NEW) ->> 'insurance_update_review_status' IS DISTINCT FROM to_jsonb(OLD) ->> 'insurance_update_review_status'
     AND to_jsonb(NEW) ->> 'insurance_update_review_status' IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Not allowed to change insurance_update_review_status' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_client_lead_updates_trigger ON public.leads;
CREATE TRIGGER restrict_client_lead_updates_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_client_lead_updates();

-- 7. Storage: private buckets, admin-only access -------------------------------
UPDATE storage.buckets
SET public = false
WHERE id IN ('insurance-cards', 'client-claims', 'physician-orders', 'treatment-records');

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~ '(insurance-cards|client-claims|physician-orders|treatment-records)'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', policy_row.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admins manage patient documents" ON storage.objects;
CREATE POLICY "Admins manage patient documents" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('insurance-cards', 'client-claims', 'physician-orders', 'treatment-records')
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id IN ('insurance-cards', 'client-claims', 'physician-orders', 'treatment-records')
    AND public.is_admin()
  );
