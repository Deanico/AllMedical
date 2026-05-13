-- Seed: TestStripz pump-supplies pricing into product_vendor_pricing
-- Safe behavior:
-- - No hardcoded UUIDs
-- - Matches vendor by vendors.name = 'TestStripz'
-- - Matches products by products.name using ILIKE patterns
-- - Inserts only when (product_id, vendor_id) does not already exist
-- - Uses ON CONFLICT (product_id, vendor_id) DO NOTHING
-- - Does not delete or overwrite existing data

BEGIN;

WITH vendor_match AS (
	SELECT v.id AS vendor_id
	FROM vendors v
	WHERE v.name = 'TestStripz'
	LIMIT 1
),
rule_matches AS (
	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		7.995::numeric(10,4) AS unit_price,
		10 AS rule_priority
	FROM products p
	WHERE p.category = 'infusion_set'
		AND p.name ILIKE '%autosoft%xc%'
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		7.995::numeric(10,4) AS unit_price,
		20 AS rule_priority
	FROM products p
	WHERE p.category = 'infusion_set'
		AND p.name ILIKE '%autosoft%90%'
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		214.9500::numeric(10,4) AS unit_price,
		55 AS rule_priority
	FROM products p
	WHERE p.category = 'pod'
		AND p.name = 'Omnipod 5 Pods (Dexcom G6)'
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		2.4975::numeric(10,4) AS unit_price,
		30 AS rule_priority
	FROM products p
	WHERE p.category IN ('cartridge', 'reservoir')
		AND (
			p.name ILIKE '%t:slim%x2%cartridge%'
			OR p.name ILIKE '%t slim%x2%cartridge%'
			OR p.name ILIKE '%tslim%x2%cartridge%'
		)
		AND (
			p.name ILIKE '%20 count%'
			OR p.name ILIKE '%20ct%'
			OR p.name ILIKE '%20-pack%'
			OR p.name ILIKE '%20 pack%'
		)
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		2.9950::numeric(10,4) AS unit_price,
		40 AS rule_priority
	FROM products p
	WHERE p.category IN ('cartridge', 'reservoir')
		AND (
			p.name ILIKE '%t:slim%x2%cartridge%'
			OR p.name ILIKE '%t slim%x2%cartridge%'
			OR p.name ILIKE '%tslim%x2%cartridge%'
		)
		AND (
			p.name ILIKE '%10 count%'
			OR p.name ILIKE '%10ct%'
			OR p.name ILIKE '%10-pack%'
			OR p.name ILIKE '%10 pack%'
		)
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		4.9950::numeric(10,4) AS unit_price,
		50 AS rule_priority
	FROM products p
	WHERE p.category IN ('cartridge', 'reservoir')
		AND p.name ILIKE '%mobi%cartridge%'
		AND (
			p.name ILIKE '%10 pack%'
			OR p.name ILIKE '%10-pack%'
			OR p.name ILIKE '%10ct%'
			OR p.name ILIKE '%10 count%'
		)
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		10.9950::numeric(10,4) AS unit_price,
		60 AS rule_priority
	FROM products p
	WHERE p.category = 'infusion_set'
		AND (p.name ILIKE '%quick-set%' OR p.name ILIKE '%quick set%')
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		11.9950::numeric(10,4) AS unit_price,
		70 AS rule_priority
	FROM products p
	WHERE p.category = 'infusion_set'
		AND (p.name ILIKE '%mio advance%' OR p.name ILIKE '%minimed%mio advance%')
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		7.9950::numeric(10,4) AS unit_price,
		80 AS rule_priority
	FROM products p
	WHERE p.category = 'infusion_set'
		AND p.name ILIKE '%mio%'
		AND p.name NOT ILIKE '%advance%'
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		1.1475::numeric(10,4) AS unit_price,
		90 AS rule_priority
	FROM products p
	WHERE p.category = 'reservoir'
		AND p.name ILIKE '%reservoir%3ml%'
		AND (
			p.name ILIKE '%2 boxes%'
			OR p.name ILIKE '%2 box%'
			OR p.name ILIKE '%two boxes%'
			OR p.name ILIKE '%2bx%'
		)
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'

	UNION ALL

	SELECT
		p.id AS product_id,
		p.name AS product_name,
		p.category,
		1.9950::numeric(10,4) AS unit_price,
		100 AS rule_priority
	FROM products p
	WHERE p.category = 'reservoir'
		AND p.name ILIKE '%reservoir%3ml%'
		AND p.name NOT ILIKE '%2 boxes%'
		AND p.name NOT ILIKE '%2 box%'
		AND p.name NOT ILIKE '%two boxes%'
		AND p.name NOT ILIKE '%2bx%'
		AND p.name NOT ILIKE '%damaged%'
		AND p.name NOT ILIKE '%minor%'
		AND p.name NOT ILIKE '%open box%'
		AND p.name NOT ILIKE '%used%'
		AND p.name NOT ILIKE '%refurb%'
),
deduped_matches AS (
	SELECT
		rm.product_id,
		rm.product_name,
		rm.unit_price,
		LOWER(TRIM(rm.product_name)) AS product_name_key,
		ROW_NUMBER() OVER (
			PARTITION BY rm.product_id
			ORDER BY rm.rule_priority ASC, rm.product_name ASC
		) AS rn
	FROM rule_matches rm
),
canonical_name_matches AS (
	SELECT
		dm.product_id,
		dm.product_name,
		dm.unit_price,
		dm.product_name_key,
		ROW_NUMBER() OVER (
			PARTITION BY dm.product_name_key
			ORDER BY dm.product_id
		) AS name_rn
	FROM deduped_matches dm
	WHERE dm.rn = 1
),
rows_to_insert AS (
	SELECT
		cnm.product_id,
		vm.vendor_id,
		cnm.unit_price
	FROM canonical_name_matches cnm
	CROSS JOIN vendor_match vm
	WHERE cnm.name_rn = 1
)
INSERT INTO product_vendor_pricing (
	product_id,
	vendor_id,
	price,
	is_available,
	last_updated
)
SELECT
	rti.product_id,
	rti.vendor_id,
	rti.unit_price,
	true,
	NOW()
FROM rows_to_insert rti
ON CONFLICT (product_id, vendor_id) DO NOTHING;

COMMIT;

-- Verification (read-only)
SELECT DISTINCT ON (LOWER(TRIM(p.name)))
	p.name AS product_name,
	v.name AS vendor_name,
	pvp.price
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE v.name = 'TestStripz'
	AND p.category IN ('infusion_set', 'reservoir', 'cartridge', 'pod')
	AND (
		p.name ILIKE '%autosoft%'
		OR p.name ILIKE '%t:slim%'
		OR p.name ILIKE '%t slim%'
		OR p.name ILIKE '%tslim%'
		OR p.name ILIKE '%mobi%'
		OR p.name ILIKE '%minimed%'
		OR p.name ILIKE '%omnipod%'
		OR p.name ILIKE '%quick-set%'
		OR p.name ILIKE '%mio%'
		OR p.name ILIKE '%reservoir%'
	)
ORDER BY LOWER(TRIM(p.name)), p.name;
