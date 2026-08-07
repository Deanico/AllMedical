-- Make next_ship_date nullable in client_products
-- Products can now be added to patients without an initial ship date.
-- A ship date is set later, and the next date auto-advances after each order is marked ordered.

BEGIN;

ALTER TABLE client_products
  ALTER COLUMN next_ship_date DROP NOT NULL;

-- Drop the index that required next_ship_date for the calendar query (it used .not('is', null)),
-- and recreate it without the NOT NULL constraint effect. The calendar already filters
-- WHERE next_ship_date IS NOT NULL in the app query, so no index change is needed.

-- Confirm: existing NOT NULL rows are unchanged; new rows may have next_ship_date = NULL.

COMMIT;
