# TestStripz 90-Day Fulfillment Strategy

## Overview
This document explains the fulfillment pack sizes and cart quantities for TestStripz vendor to optimize for 3-month (90-day) supply planning.

## Product Mappings

### 1. Dexcom G7 Sensors (10-day)
- **fulfillment_pack_size:** 3 (3-pack product)
- **standard_90_day_quantity:** 9 sensors
- **cart_quantity_for_90_days:** 3 packs
- **Usage Pattern:** Patient changes sensor every 10 days
  - 90 days ÷ 10 days/sensor = 9 sensors needed
  - 9 sensors ÷ 3 per pack = 3 packs to order
- **Product URL:** https://shop.teststripz.com/products/dexcom-g7-sensor-3-pack?variant=43582075011262
- **Unit Price:** $91.65 per pack

### 2. Dexcom G7 Sensors (15-day)
- **fulfillment_pack_size:** 6 (6-pack product)
- **standard_90_day_quantity:** 6 sensors
- **cart_quantity_for_90_days:** 1 pack
- **Usage Pattern:** Patient wears 2 sensors simultaneously (dual wear strategy)
  - 90 days ÷ 2/day average = ~45 sensor-days coverage
  - 6 sensors × 15 days per sensor = 90 days coverage with 2 simultaneous
- **Product URL:** https://shop.teststripz.com/products/dexcom-g7-sensor-15-day-6-pack?_pos=7&_sid=7ed8cac01&_ss=r&variant=46671393521854
- **Unit Price:** $133.34 per pack

### 3. Omnipod 5 Pods
- **fulfillment_pack_size:** 20 (20-pack product)
- **standard_90_day_quantity:** 40 pods
- **cart_quantity_for_90_days:** 2 packs
- **Usage Pattern:** Average consumption ~1.3 pods per day
  - 90 days × 1.3 pods/day ≈ 40 pods needed (conservative estimate)
  - 40 pods ÷ 20 per pack = 2 packs to order
- **Product URL:** https://shop.teststripz.com/products/omnipod-5-pods-20-pack?_pos=5&_sid=391b369e6&_ss=r
- **Unit Price:** $184.99 per pack

## Schema Implementation

### New Columns in `product_vendor_pricing`
```sql
ALTER TABLE product_vendor_pricing
  ADD COLUMN fulfillment_pack_size INTEGER,
  ADD COLUMN cart_quantity_for_90_days INTEGER,
  ADD COLUMN fulfillment_notes TEXT;
```

### Usage in AdminDashboard / Order Flow
When a client needs a 90-day supply of a TestStripz product:
1. Look up the product in `product_vendor_pricing`
2. Use `cart_quantity_for_90_days` to determine order quantity
3. Use `fulfillment_pack_size` to verify pack integrity
4. Display `fulfillment_notes` for reference in UI

Example query:
```sql
SELECT
  p.name AS product,
  pvp.fulfillment_pack_size,
  pvp.cart_quantity_for_90_days,
  pvp.fulfillment_notes,
  pvp.price,
  (pvp.price * pvp.cart_quantity_for_90_days) AS total_90_day_cost
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE v.name = 'TestStripz'
  AND p.name IN (
    'Dexcom G7 Sensors (10-day)',
    'Dexcom G7 Sensors (15-day)',
    'Omnipod 5 Pods (Dexcom G6)',  -- or other Omnipod 5 variants
    'Omnipod 5 Pods (Libre 2 Plus)',
    'Omnipod 5 Pods (Libre 2 Plus 10pk)',
    'Omnipod DASH Pods'  -- Note: DASH excluded from cart_qty logic
  );
```

## Migration File
Location: `web/add-teststripz-fulfillment-rules.sql`

## Future Enhancement
Consider adding similar mappings for other vendors as their 90-day strategies are defined.
