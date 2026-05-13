-- Read-only audit: product naming variants and canonical mapping
-- Purpose: audit only, no schema/data changes
-- Scope: Dexcom G6/G7, Autosoft XC/90/30, T-Slim/Mobi cartridges,
--        Quick-set, Mio/Mio Advance, Paradigm/Extended reservoirs

-- ============================================================================
-- 1) Detailed product audit with proposed canonical name + linkage flags
-- ============================================================================
WITH scoped_products AS (
  SELECT
    p.id AS product_id,
    p.name AS current_name,
    COALESCE(to_jsonb(p) ->> 'brand', p.manufacturer, to_jsonb(p) ->> 'manufacturer') AS brand,
    p.category,
    to_jsonb(p) ->> 'subcategory' AS subcategory,
    to_jsonb(p) ->> 'tubing_length' AS tubing_length,
    to_jsonb(p) ->> 'cannula_size' AS cannula_size,
    p.sku,
    p.active,
    EXISTS (
      SELECT 1
      FROM client_products cp
      WHERE cp.product_id = p.id
    ) AS linked_to_client_products,
    EXISTS (
      SELECT 1
      FROM product_vendor_pricing pvp
      WHERE pvp.product_id = p.id
    ) AS linked_to_product_vendor_pricing,
    LOWER(p.name) AS n
  FROM products p
  WHERE
    p.name ILIKE '%dexcom%g6%'
    OR p.name ILIKE '%dexcom%g7%'
    OR p.name ILIKE '%autosoft%xc%'
    OR p.name ILIKE '%autosoft%90%'
    OR p.name ILIKE '%autosoft%30%'
    OR p.name ILIKE '%t:slim%'
    OR p.name ILIKE '%t-slim%'
    OR p.name ILIKE '%tslim%'
    OR p.name ILIKE '%mobi%cartridge%'
    OR p.name ILIKE '%quick-set%'
    OR p.name ILIKE '%quick set%'
    OR p.name ILIKE '%mio%'
    OR p.name ILIKE '%paradigm%reservoir%'
    OR p.name ILIKE '%extended%reservoir%'
),
parsed AS (
  SELECT
    sp.*,
    NULLIF((regexp_match(sp.current_name, '(\d+(?:\.\d+)?)\s*mm'))[1], '') AS mm,
    NULLIF((regexp_match(sp.current_name, '\d+\s*mm\s+(\d+)'))[1], '') AS tubing_in,
    CASE
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%transmitter%' THEN 'dexcom_g6_transmitter'
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%sensor%' THEN 'dexcom_g6_sensor'
      WHEN sp.n LIKE '%dexcom%g7%' AND sp.n LIKE '%sensor%' THEN 'dexcom_g7_sensor'
      WHEN sp.n LIKE '%autosoft%xc%' THEN 'autosoft_xc'
      WHEN sp.n LIKE '%autosoft%90%' THEN 'autosoft_90'
      WHEN sp.n LIKE '%autosoft%30%' THEN 'autosoft_30'
      WHEN (sp.n LIKE '%t:slim%' OR sp.n LIKE '%t-slim%' OR sp.n LIKE '%tslim%') AND sp.n LIKE '%cartridge%' THEN 't_slim_cartridge'
      WHEN sp.n LIKE '%mobi%' AND sp.n LIKE '%cartridge%' THEN 'mobi_cartridge'
      WHEN sp.n LIKE '%quick-set%' OR sp.n LIKE '%quick set%' THEN 'quick_set'
      WHEN sp.n LIKE '%mio advance%' THEN 'mio_advance'
      WHEN sp.n LIKE '%mio%' THEN 'mio'
      WHEN sp.n LIKE '%paradigm%' AND sp.n LIKE '%reservoir%' THEN 'paradigm_reservoir'
      WHEN sp.n LIKE '%extended%' AND sp.n LIKE '%reservoir%' THEN 'extended_reservoir'
      ELSE 'other'
    END AS family
  FROM scoped_products sp
),
canonicalized AS (
  SELECT
    p.*,
    CASE
      WHEN p.family = 'dexcom_g6_sensor' AND (p.n LIKE '%3-pack%' OR p.n LIKE '%3 pack%' OR p.n LIKE '%(3)%' OR p.sku ILIKE '%3pk%')
        THEN 'Dexcom G6 Sensor (3-pack)'
      WHEN p.family = 'dexcom_g6_sensor'
        THEN 'Dexcom G6 Sensor (1)'
      WHEN p.family = 'dexcom_g6_transmitter'
        THEN 'Dexcom G6 Transmitter'

      WHEN p.family = 'dexcom_g7_sensor' AND (p.n LIKE '%15-day%' OR p.n LIKE '%15 day%')
        THEN 'Dexcom G7 Sensors (15-day)'
      WHEN p.family = 'dexcom_g7_sensor' AND (p.n LIKE '%10-day%' OR p.n LIKE '%10 day%')
        THEN 'Dexcom G7 Sensors (10-day)'
      WHEN p.family = 'dexcom_g7_sensor'
        THEN 'Dexcom G7 Sensor'

      WHEN p.family = 'autosoft_xc'
        THEN 'Autosoft XC ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'autosoft_90'
        THEN 'Autosoft 90 ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'autosoft_30'
        THEN 'Autosoft 30 ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')

      WHEN p.family = 'quick_set'
        THEN 'Quick-set ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'mio_advance'
        THEN 'Mio Advance ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'mio'
        THEN 'Mio ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')

      WHEN p.family = 't_slim_cartridge'
        THEN 'T-Slim Cartridge 3mL (10ct)'
      WHEN p.family = 'mobi_cartridge'
        THEN 'Tandem Mobi Cartridge 2mL (10ct)'

      WHEN p.family = 'paradigm_reservoir' AND p.n LIKE '%1.8%'
        THEN 'Medtronic Paradigm Reservoir 1.8mL (10ct)'
      WHEN p.family = 'paradigm_reservoir'
        THEN 'Medtronic Paradigm Reservoir 3mL (10ct)'
      WHEN p.family = 'extended_reservoir'
        THEN 'Medtronic Extended Reservoir 3mL (10ct)'

      ELSE p.current_name
    END AS proposed_canonical_name
  FROM parsed p
)
SELECT
  c.product_id,
  c.current_name,
  c.proposed_canonical_name,
  c.brand,
  c.category,
  c.subcategory,
  c.tubing_length,
  c.cannula_size,
  c.linked_to_client_products,
  c.linked_to_product_vendor_pricing,
  c.family,
  c.sku,
  c.active
FROM canonicalized c
ORDER BY c.family, c.proposed_canonical_name, c.current_name;

-- ============================================================================
-- 2) Likely duplicate/variant clusters (same proposed canonical)
-- ============================================================================
WITH scoped_products AS (
  SELECT p.id, p.name, p.category, p.manufacturer, p.sku, LOWER(p.name) AS n
  FROM products p
  WHERE
    p.name ILIKE '%dexcom%g6%'
    OR p.name ILIKE '%dexcom%g7%'
    OR p.name ILIKE '%autosoft%'
    OR p.name ILIKE '%t:slim%'
    OR p.name ILIKE '%t-slim%'
    OR p.name ILIKE '%tslim%'
    OR p.name ILIKE '%mobi%cartridge%'
    OR p.name ILIKE '%quick%set%'
    OR p.name ILIKE '%mio%'
    OR p.name ILIKE '%paradigm%reservoir%'
    OR p.name ILIKE '%extended%reservoir%'
),
parsed AS (
  SELECT
    sp.*,
    NULLIF((regexp_match(sp.name, '(\d+(?:\.\d+)?)\s*mm'))[1], '') AS mm,
    NULLIF((regexp_match(sp.name, '\d+\s*mm\s+(\d+)'))[1], '') AS tubing_in,
    CASE
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%transmitter%' THEN 'dexcom_g6_transmitter'
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%sensor%' THEN 'dexcom_g6_sensor'
      WHEN sp.n LIKE '%dexcom%g7%' AND sp.n LIKE '%sensor%' THEN 'dexcom_g7_sensor'
      WHEN sp.n LIKE '%autosoft%xc%' THEN 'autosoft_xc'
      WHEN sp.n LIKE '%autosoft%90%' THEN 'autosoft_90'
      WHEN sp.n LIKE '%autosoft%30%' THEN 'autosoft_30'
      WHEN (sp.n LIKE '%t:slim%' OR sp.n LIKE '%t-slim%' OR sp.n LIKE '%tslim%') AND sp.n LIKE '%cartridge%' THEN 't_slim_cartridge'
      WHEN sp.n LIKE '%mobi%' AND sp.n LIKE '%cartridge%' THEN 'mobi_cartridge'
      WHEN sp.n LIKE '%quick-set%' OR sp.n LIKE '%quick set%' THEN 'quick_set'
      WHEN sp.n LIKE '%mio advance%' THEN 'mio_advance'
      WHEN sp.n LIKE '%mio%' THEN 'mio'
      WHEN sp.n LIKE '%paradigm%' AND sp.n LIKE '%reservoir%' THEN 'paradigm_reservoir'
      WHEN sp.n LIKE '%extended%' AND sp.n LIKE '%reservoir%' THEN 'extended_reservoir'
      ELSE 'other'
    END AS family
  FROM scoped_products sp
),
canon AS (
  SELECT
    p.*,
    CASE
      WHEN p.family = 'dexcom_g6_sensor' AND (p.n LIKE '%3-pack%' OR p.n LIKE '%3 pack%' OR p.n LIKE '%(3)%' OR p.sku ILIKE '%3pk%') THEN 'Dexcom G6 Sensor (3-pack)'
      WHEN p.family = 'dexcom_g6_sensor' THEN 'Dexcom G6 Sensor (1)'
      WHEN p.family = 'dexcom_g6_transmitter' THEN 'Dexcom G6 Transmitter'
      WHEN p.family = 'dexcom_g7_sensor' AND (p.n LIKE '%15-day%' OR p.n LIKE '%15 day%') THEN 'Dexcom G7 Sensors (15-day)'
      WHEN p.family = 'dexcom_g7_sensor' AND (p.n LIKE '%10-day%' OR p.n LIKE '%10 day%') THEN 'Dexcom G7 Sensors (10-day)'
      WHEN p.family = 'dexcom_g7_sensor' THEN 'Dexcom G7 Sensor'
      WHEN p.family = 'autosoft_xc' THEN 'Autosoft XC ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'autosoft_90' THEN 'Autosoft 90 ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'autosoft_30' THEN 'Autosoft 30 ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'quick_set' THEN 'Quick-set ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'mio_advance' THEN 'Mio Advance ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 'mio' THEN 'Mio ' || COALESCE(p.mm || 'mm', '?mm') || ' ' || COALESCE(p.tubing_in || '"', '?"')
      WHEN p.family = 't_slim_cartridge' THEN 'T-Slim Cartridge 3mL (10ct)'
      WHEN p.family = 'mobi_cartridge' THEN 'Tandem Mobi Cartridge 2mL (10ct)'
      WHEN p.family = 'paradigm_reservoir' AND p.n LIKE '%1.8%' THEN 'Medtronic Paradigm Reservoir 1.8mL (10ct)'
      WHEN p.family = 'paradigm_reservoir' THEN 'Medtronic Paradigm Reservoir 3mL (10ct)'
      WHEN p.family = 'extended_reservoir' THEN 'Medtronic Extended Reservoir 3mL (10ct)'
      ELSE p.name
    END AS proposed_canonical_name
  FROM parsed p
)
SELECT
  c.proposed_canonical_name,
  c.family,
  COUNT(*) AS variant_count,
  COUNT(DISTINCT c.category) AS distinct_categories,
  COUNT(DISTINCT COALESCE(c.manufacturer, '')) AS distinct_manufacturers,
  STRING_AGG(c.name, ' | ' ORDER BY c.name) AS variant_names
FROM canon c
GROUP BY c.proposed_canonical_name, c.family
HAVING COUNT(*) > 1
ORDER BY variant_count DESC, c.proposed_canonical_name;

-- ============================================================================
-- 3) Duplicate-looking products that are NOT safe to merge automatically
-- ============================================================================
WITH base AS (
  SELECT
    p.id,
    p.name,
    p.category,
    COALESCE(p.manufacturer, to_jsonb(p) ->> 'brand') AS brand,
    p.sku,
    LOWER(p.name) AS n,
    NULLIF((regexp_match(p.name, '(\d+(?:\.\d+)?)\s*mm'))[1], '') AS mm,
    NULLIF((regexp_match(p.name, '\d+\s*mm\s+(\d+)'))[1], '') AS tubing_in
  FROM products p
  WHERE
    p.name ILIKE '%dexcom%g6%'
    OR p.name ILIKE '%dexcom%g7%'
    OR p.name ILIKE '%autosoft%'
    OR p.name ILIKE '%t:slim%'
    OR p.name ILIKE '%t-slim%'
    OR p.name ILIKE '%tslim%'
    OR p.name ILIKE '%mobi%cartridge%'
    OR p.name ILIKE '%quick%set%'
    OR p.name ILIKE '%mio%'
    OR p.name ILIKE '%paradigm%reservoir%'
    OR p.name ILIKE '%extended%reservoir%'
),
risk_groups AS (
  SELECT
    CASE
      WHEN n LIKE '%autosoft%xc%' THEN 'autosoft_xc'
      WHEN n LIKE '%autosoft%90%' THEN 'autosoft_90'
      WHEN n LIKE '%autosoft%30%' THEN 'autosoft_30'
      WHEN n LIKE '%quick%set%' THEN 'quick_set'
      WHEN n LIKE '%mio advance%' THEN 'mio_advance'
      WHEN n LIKE '%mio%' THEN 'mio'
      WHEN n LIKE '%paradigm%reservoir%' THEN 'paradigm_reservoir'
      WHEN n LIKE '%extended%reservoir%' THEN 'extended_reservoir'
      WHEN (n LIKE '%t:slim%' OR n LIKE '%t-slim%' OR n LIKE '%tslim%') AND n LIKE '%cartridge%' THEN 't_slim_cartridge'
      WHEN n LIKE '%mobi%' AND n LIKE '%cartridge%' THEN 'mobi_cartridge'
      WHEN n LIKE '%dexcom%g6%sensor%' THEN 'dexcom_g6_sensor'
      WHEN n LIKE '%dexcom%g6%transmitter%' THEN 'dexcom_g6_transmitter'
      WHEN n LIKE '%dexcom%g7%sensor%' THEN 'dexcom_g7_sensor'
      ELSE 'other'
    END AS family,
    *
  FROM base
)
SELECT
  family,
  COUNT(*) AS rows_in_family,
  COUNT(DISTINCT category) AS distinct_categories,
  COUNT(DISTINCT COALESCE(brand, '')) AS distinct_brands,
  COUNT(DISTINCT COALESCE(mm, '')) AS distinct_cannula_mm,
  COUNT(DISTINCT COALESCE(tubing_in, '')) AS distinct_tubing_in,
  CASE
    WHEN COUNT(DISTINCT category) > 1 THEN 'RISK: category mismatch inside family'
    WHEN COUNT(DISTINCT COALESCE(brand, '')) > 1 THEN 'RISK: brand/manufacturer mismatch inside family'
    WHEN family IN ('autosoft_xc','autosoft_90','autosoft_30','quick_set','mio_advance','mio')
         AND (COUNT(DISTINCT COALESCE(mm, '')) > 1 OR COUNT(DISTINCT COALESCE(tubing_in, '')) > 1)
         THEN 'RISK: multiple cannula/tubing specs (likely true variants, not duplicates)'
    WHEN family IN ('paradigm_reservoir') AND COUNT(DISTINCT COALESCE(mm, '')) > 1
         THEN 'RISK: mixed reservoir capacities'
    ELSE 'Needs manual review'
  END AS merge_risk_reason,
  STRING_AGG(name, ' | ' ORDER BY name) AS names_in_group
FROM risk_groups
GROUP BY family
HAVING COUNT(*) > 1
ORDER BY family;

-- ============================================================================
-- 4) Recommended canonical naming map (current -> canonical)
-- ============================================================================
WITH scoped_products AS (
  SELECT
    p.id,
    p.name AS current_name,
    p.category,
    COALESCE(to_jsonb(p) ->> 'brand', p.manufacturer) AS brand,
    p.sku,
    LOWER(p.name) AS n,
    NULLIF((regexp_match(p.name, '(\d+(?:\.\d+)?)\s*mm'))[1], '') AS mm,
    NULLIF((regexp_match(p.name, '\d+\s*mm\s+(\d+)'))[1], '') AS tubing_in
  FROM products p
  WHERE
    p.name ILIKE '%dexcom%g6%'
    OR p.name ILIKE '%dexcom%g7%'
    OR p.name ILIKE '%autosoft%'
    OR p.name ILIKE '%t:slim%'
    OR p.name ILIKE '%t-slim%'
    OR p.name ILIKE '%tslim%'
    OR p.name ILIKE '%mobi%cartridge%'
    OR p.name ILIKE '%quick%set%'
    OR p.name ILIKE '%mio%'
    OR p.name ILIKE '%paradigm%reservoir%'
    OR p.name ILIKE '%extended%reservoir%'
),
mapped AS (
  SELECT
    sp.id AS product_id,
    sp.current_name,
    sp.brand,
    sp.category,
    sp.sku,
    CASE
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%transmitter%' THEN 'Dexcom G6 Transmitter'
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%sensor%' AND (sp.n LIKE '%3-pack%' OR sp.n LIKE '%3 pack%' OR sp.n LIKE '%(3)%' OR sp.sku ILIKE '%3pk%') THEN 'Dexcom G6 Sensor (3-pack)'
      WHEN sp.n LIKE '%dexcom%g6%' AND sp.n LIKE '%sensor%' THEN 'Dexcom G6 Sensor (1)'
      WHEN sp.n LIKE '%dexcom%g7%' AND sp.n LIKE '%sensor%' AND (sp.n LIKE '%15-day%' OR sp.n LIKE '%15 day%') THEN 'Dexcom G7 Sensors (15-day)'
      WHEN sp.n LIKE '%dexcom%g7%' AND sp.n LIKE '%sensor%' AND (sp.n LIKE '%10-day%' OR sp.n LIKE '%10 day%') THEN 'Dexcom G7 Sensors (10-day)'
      WHEN sp.n LIKE '%dexcom%g7%' AND sp.n LIKE '%sensor%' THEN 'Dexcom G7 Sensor'
      WHEN sp.n LIKE '%autosoft%xc%' THEN 'Autosoft XC ' || COALESCE(sp.mm || 'mm', '?mm') || ' ' || COALESCE(sp.tubing_in || '"', '?"')
      WHEN sp.n LIKE '%autosoft%90%' THEN 'Autosoft 90 ' || COALESCE(sp.mm || 'mm', '?mm') || ' ' || COALESCE(sp.tubing_in || '"', '?"')
      WHEN sp.n LIKE '%autosoft%30%' THEN 'Autosoft 30 ' || COALESCE(sp.mm || 'mm', '?mm') || ' ' || COALESCE(sp.tubing_in || '"', '?"')
      WHEN sp.n LIKE '%quick%set%' THEN 'Quick-set ' || COALESCE(sp.mm || 'mm', '?mm') || ' ' || COALESCE(sp.tubing_in || '"', '?"')
      WHEN sp.n LIKE '%mio advance%' THEN 'Mio Advance ' || COALESCE(sp.mm || 'mm', '?mm') || ' ' || COALESCE(sp.tubing_in || '"', '?"')
      WHEN sp.n LIKE '%mio%' THEN 'Mio ' || COALESCE(sp.mm || 'mm', '?mm') || ' ' || COALESCE(sp.tubing_in || '"', '?"')
      WHEN (sp.n LIKE '%t:slim%' OR sp.n LIKE '%t-slim%' OR sp.n LIKE '%tslim%') AND sp.n LIKE '%cartridge%' THEN 'T-Slim Cartridge 3mL (10ct)'
      WHEN sp.n LIKE '%mobi%' AND sp.n LIKE '%cartridge%' THEN 'Tandem Mobi Cartridge 2mL (10ct)'
      WHEN sp.n LIKE '%paradigm%reservoir%' AND sp.n LIKE '%1.8%' THEN 'Medtronic Paradigm Reservoir 1.8mL (10ct)'
      WHEN sp.n LIKE '%paradigm%reservoir%' THEN 'Medtronic Paradigm Reservoir 3mL (10ct)'
      WHEN sp.n LIKE '%extended%reservoir%' THEN 'Medtronic Extended Reservoir 3mL (10ct)'
      ELSE sp.current_name
    END AS proposed_canonical_name,
    CASE
      WHEN sp.n LIKE '%autosoft%' AND (sp.mm IS NULL OR sp.tubing_in IS NULL) THEN 'medium'
      WHEN sp.n LIKE '%quick%set%' AND (sp.mm IS NULL OR sp.tubing_in IS NULL) THEN 'medium'
      WHEN sp.n LIKE '%mio%' AND (sp.mm IS NULL OR sp.tubing_in IS NULL) THEN 'medium'
      ELSE 'high'
    END AS mapping_confidence
  FROM scoped_products sp
)
SELECT
  m.product_id,
  m.current_name,
  m.proposed_canonical_name,
  m.brand,
  m.category,
  m.sku,
  m.mapping_confidence
FROM mapped m
ORDER BY m.proposed_canonical_name, m.current_name;

-- ============================================================================
-- 5) Bare-name duplicates: linkage check before any cleanup
--    These are entries whose names contain no mm/tubing spec and have NULL SKU.
--    Shows whether they are safe to delete (no clients, no vendor pricing attached).
-- ============================================================================
SELECT
  p.id                                                        AS product_id,
  p.name                                                      AS current_name,
  p.sku,
  p.active,
  EXISTS (
    SELECT 1 FROM client_products cp WHERE cp.product_id = p.id
  )                                                           AS linked_to_client_products,
  EXISTS (
    SELECT 1 FROM product_vendor_pricing pvp WHERE pvp.product_id = p.id
  )                                                           AS linked_to_vendor_pricing,
  (
    SELECT COUNT(*) FROM client_products cp WHERE cp.product_id = p.id
  )                                                           AS client_product_count,
  (
    SELECT COUNT(*) FROM product_vendor_pricing pvp WHERE pvp.product_id = p.id
  )                                                           AS vendor_pricing_count,
  -- Find the preferred (spec'd) replacement in the same family by matching SKU prefix pattern
  (
    SELECT p2.name
    FROM products p2
    WHERE p2.name ILIKE p.name || '%mm%'
      AND p2.id <> p.id
      AND p2.sku IS NOT NULL
    ORDER BY p2.name
    LIMIT 1
  )                                                           AS example_replacement_name
FROM products p
WHERE
  p.sku IS NULL
  AND (
    p.name ILIKE 'Autosoft 90'
    OR p.name ILIKE 'Autosoft XC'
    OR p.name ILIKE 'Autosoft 30'
    OR p.name ILIKE 'Quick-set'
    OR p.name ILIKE 'Quick set'
    OR p.name ILIKE 'Mio'
    OR p.name ILIKE 'Mio Advance'
  )
ORDER BY p.name;
