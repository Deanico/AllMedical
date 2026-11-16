-- Record qualification and removal events without retaining patient details.
-- Existing removals and missing qualification dates cannot be reconstructed.
BEGIN;

LOCK TABLE public.leads IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.client_growth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id uuid NOT NULL,
  change smallint NOT NULL CHECK (change IN (-1, 1)),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_growth_events_occurred_at
  ON public.client_growth_events (occurred_at, id);

ALTER TABLE public.client_growth_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_growth_events FROM anon, authenticated;
GRANT SELECT ON public.client_growth_events TO authenticated;
DROP POLICY IF EXISTS "Admins read client growth events" ON public.client_growth_events;
CREATE POLICY "Admins read client growth events" ON public.client_growth_events
  FOR SELECT TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

-- Only currently qualified leads with a known qualification date can be backfilled.
INSERT INTO public.client_growth_events (lead_id, change, occurred_at)
SELECT l.id, 1, l.qualified_at
FROM public.leads l
WHERE l.stage = 'qualified'
  AND l.qualified_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_growth_events e WHERE e.lead_id = l.id AND e.change = 1
  );

CREATE OR REPLACE FUNCTION public.record_client_growth_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'qualified' THEN
      NEW.qualified_at := COALESCE(NEW.qualified_at, now());
      INSERT INTO public.client_growth_events (lead_id, change, occurred_at)
      VALUES (NEW.id, 1, NEW.qualified_at);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage IS DISTINCT FROM 'qualified' AND NEW.stage = 'qualified' THEN
      NEW.qualified_at := now();
      INSERT INTO public.client_growth_events (lead_id, change, occurred_at)
      VALUES (NEW.id, 1, NEW.qualified_at);
    ELSIF OLD.stage = 'qualified' AND NEW.stage IS DISTINCT FROM 'qualified' THEN
      INSERT INTO public.client_growth_events (lead_id, change, occurred_at)
      VALUES (OLD.id, -1, now());
    END IF;
    RETURN NEW;
  ELSE
    IF OLD.stage = 'qualified' THEN
      INSERT INTO public.client_growth_events (lead_id, change, occurred_at)
      VALUES (OLD.id, -1, now());
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_client_growth_event() FROM PUBLIC;
DROP TRIGGER IF EXISTS record_client_growth_event ON public.leads;
CREATE TRIGGER record_client_growth_event
  BEFORE INSERT OR UPDATE OF stage OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.record_client_growth_event();

COMMIT;
