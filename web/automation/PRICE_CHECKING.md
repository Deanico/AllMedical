# Multi-Supplier Price Checking & Auto-Ordering System

This system automatically checks prices across multiple suppliers and selects the cheapest option for each order.

## Features

✅ **Automated Price Checking**: Scrapes prices from multiple supplier websites  
✅ **Price History Tracking**: Stores all price changes with timestamps  
✅ **Smart Supplier Selection**: Automatically orders from cheapest supplier  
✅ **Multi-Supplier Support**: Teststripz, RapidRx USA, Diabetic Warehouse, etc.

---

## Setup

### 1. Run Database Migration

```bash
# In Supabase SQL Editor, run:
web/add-price-tracking.sql
```

This creates:
- `product_suppliers` table - maps products to suppliers with prices
- `price_history` table - tracks price changes over time
- Helper functions to find cheapest suppliers
- Views for price comparison

### 2. Configure Product-Supplier Mappings

In the **Products** tab of your admin dashboard:
1. Select a product
2. Add supplier mappings with their SKU codes
3. The system will check prices for all mapped products

**OR** add them manually in SQL:

```sql
-- Example: Add Omnipod 5 to Teststripz
INSERT INTO product_suppliers (product_id, supplier_id, price, supplier_sku, url)
SELECT 
  p.id,
  s.id,
  89.99,
  'OP5-FL2P-10PK',
  'https://shop.teststripz.com/products/omnipod-5-10pk'
FROM products p, suppliers s
WHERE p.sku = 'OP5-FL2P-10PK'
  AND s.name = 'Teststripz';
```

---

## Usage

### Check Prices

Run the price checker to update all product prices:

```bash
cd web/automation
npm run check-prices
```

**What it does:**
- Visits each supplier website
- Searches for products by SKU
- Extracts current prices
- Updates database with latest prices
- Records price history

**Schedule it:** Run daily/weekly using Task Scheduler (Windows) or cron (Linux/Mac)

```bash
# Example: Windows Task Scheduler - Run daily at 2 AM
schtasks /create /tn "Check Diabetes Prices" /tr "npm --prefix C:\path\to\AllMedical\web\automation run check-prices" /sc daily /st 02:00
```

### View Price Comparisons

Query the database to see price comparisons:

```sql
-- See cheapest supplier for each product
SELECT * FROM product_best_prices;

-- Compare all suppliers for a specific product
SELECT * FROM product_price_comparison
WHERE product_name LIKE '%Omnipod%';

-- Price history for a product
SELECT 
  p.name,
  s.name as supplier,
  ph.price,
  ph.checked_at
FROM price_history ph
JOIN product_suppliers ps ON ps.id = ph.product_supplier_id
JOIN products p ON p.id = ps.product_id
JOIN suppliers s ON s.id = ps.supplier_id
WHERE p.name LIKE '%Dexcom G7%'
ORDER BY ph.checked_at DESC
LIMIT 20;
```

### Automatic Supplier Selection

When you mark a client as shipped, the system automatically:

1. **Fetches client's assigned products**
2. **Queries cheapest supplier** for each product
3. **Creates pending order** with best prices
4. **Routes to correct supplier** when automation runs

**Example output:**
```
Creating pending order for Anna Henson Sikes...
  → Omnipod 5 Pods (10-pack): $89.99 (cheapest - Teststripz)
  → Dexcom G7 Sensors: $259.00 (cheapest - RapidRx USA)
✅ Created pending order
```

---

## Adding New Suppliers

### 1. Add Supplier to Database

```sql
INSERT INTO suppliers (name, website, notes)
VALUES ('New Supplier', 'https://newsupplier.com', 'Great prices on Libre sensors');
```

### 2. Create Price Checker Function

In `price-checker.js`, add a new function:

```javascript
async checkNewSupplier(product, supplierSku) {
  try {
    console.log(`   Checking New Supplier for: ${product.name}`);
    
    await this.page.goto('https://newsupplier.com');
    await this.page.fill('input[type="search"]', supplierSku);
    await this.page.press('input[type="search"]', 'Enter');
    await this.page.waitForLoadState('networkidle');
    
    const priceText = await this.page.locator('.price').first().textContent();
    const match = priceText.match(/[\d,]+\.?\d*/);
    const price = match ? parseFloat(match[0].replace(',', '')) : null;
    
    if (price) {
      console.log(`   ✅ Found: $${price.toFixed(2)}`);
    }
    
    return { price, inStock: true };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { price: null, inStock: false };
  }
}
```

### 3. Add to Router

In `checkAllPrices()`, add the routing logic:

```javascript
} else if (mapping.suppliers.name === 'New Supplier') {
  priceData = await this.checkNewSupplier(mapping.products, mapping.supplier_sku);
}
```

### 4. Create Automation Script (Optional)

Copy `teststripz-automation.js` and customize for the new supplier:
```bash
cp teststripz-automation.js newsupplier-automation.js
```

Update selectors, login flow, and checkout process.

---

## Monitoring & Alerts

### Price Alerts

Get notified when prices drop:

```sql
-- Products with price drops > $10 in last 24 hours
SELECT 
  p.name,
  s.name as supplier,
  ph_old.price as old_price,
  ph_new.price as new_price,
  ph_new.price - ph_old.price as change
FROM price_history ph_new
JOIN price_history ph_old ON ph_old.product_supplier_id = ph_new.product_supplier_id
JOIN product_suppliers ps ON ps.id = ph_new.product_supplier_id
JOIN products p ON p.id = ps.product_id
JOIN suppliers s ON s.id = ps.supplier_id
WHERE ph_new.checked_at > NOW() - INTERVAL '24 hours'
  AND ph_old.checked_at < NOW() - INTERVAL '7 days'
  AND ph_new.price < ph_old.price - 10
ORDER BY change ASC;
```

### Price Trends

```sql
-- Average price trend for a product
SELECT 
  DATE(checked_at) as date,
  AVG(price) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM price_history ph
JOIN product_suppliers ps ON ps.id = ph.product_supplier_id
JOIN products p ON p.id = ps.product_id
WHERE p.name LIKE '%Omnipod 5%'
  AND checked_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(checked_at)
ORDER BY date DESC;
```

---

## Troubleshooting

### Price checker finds no products

**Problem:** Supplier website changed layout or search doesn't work.

**Solution:**
1. Run in non-headless mode: Set `HEADLESS=false` in `.env`
2. Watch the browser to see what's happening
3. Update selectors in price-checker.js

### Prices not updating

**Problem:** Database permissions or network issues.

**Solution:**
1. Check Supabase connection in terminal output
2. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
3. Check website is accessible (not blocking bots)

### Orders go to wrong supplier

**Problem:** Price data is stale or missing.

**Solution:**
1. Run `npm run check-prices` to refresh
2. Check `product_suppliers` table has recent `last_checked_at`
3. Verify `in_stock` is true for available products

---

## Best Practices

1. **Check prices regularly** - Daily or weekly depending on volatility
2. **Review price history** - Monitor for unusual spikes or drops
3. **Keep supplier_sku accurate** - Wrong SKU = wrong product = wrong price
4. **Monitor automation logs** - Check for errors or failed price checks
5. **Update selectors** - Websites change, selectors need maintenance

---

## Next Steps

- **Phase 1 (Current):** Manual price checking, auto-select cheapest ✅
- **Phase 2:** Scheduled price checking (cron/Task Scheduler)
- **Phase 3:** Multi-supplier order splitting (order from multiple suppliers in one batch)
- **Phase 4:** Price alert notifications (email/SMS when prices drop)

