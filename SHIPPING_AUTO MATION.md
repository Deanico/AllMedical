# Automated Shipping System

## Overview

The automated shipping system helps manage product fulfillment by:
- Maintaining a structured product catalog
- Tracking which products each client receives
- Automatically generating pending orders when clients are due for shipment
- Providing a centralized queue for reviewing and placing orders

## Database Setup

First, run the SQL migration to create the necessary tables:

```bash
# In Supabase SQL Editor, run:
web/add-products-system.sql
```

This creates:
- **products** - Your product catalog
- **suppliers** - Websites where you purchase products
- **product_suppliers** - Links products to suppliers with pricing
- **client_products** - Tracks which products each client receives
- **pending_orders** - Queue of orders that need to be placed
- **pending_order_items** - Individual products in each order

The migration also pre-populates:
- 4 suppliers (Teststripz, Diabetic Warehouse, Diabetic Overstock, Total Diabetes Supply)
- 5 products (G7 Sensors, Omnipod 5, Libre 2 Plus, Libre 3 Plus, Pump Tubing)

## Workflow

### 1. Set Up Product Catalog

Go to the **Products** tab:
- Review the pre-loaded products (G7, Omnipods, Libre sensors, etc.)
- Add any additional products you ship
- Edit product details as needed

### 2. Assign Products to Clients

In the **Clients** tab:
1. Select a client
2. Scroll to the "Assigned Products" section
3. Click "+ Add Product"
4. Select:
   - Which product they receive
   - Quantity per shipment
   - Shipping frequency (30 days, 90 days, etc.)

### 3. Mark Shipments

When you ship to a client:
1. Click "Mark Shipped" on the client
2. Select duration (1 month, 3 months, end of month)
3. **Automatic**: The system creates a pending order for their next shipment

### 4. Review Pending Orders

Go to the **Shipping Queue** tab:
- See all upcoming shipments sorted by date
- Each order shows:
  - Client name and address
  - Products needed and quantities
  - Recommended supplier (if configured)
  - Ship date

### 5. Place Orders

For each pending order, you can:
- **✓ Review Order** - Mark as reviewed and ready
- **📦 Mark Shipped** - Enter tracking number when sent
- **✕ Cancel** - Cancel if needed

The order details are pre-filled so you can quickly copy information to the supplier website.

## Automation Details

### Auto-Generated Orders

When you mark a client as shipped, the system:
1. Calculates next ship date based on shipping duration
2. Looks up the client's assigned products
3. Creates a pending order with all products and quantities
4. Adds it to the Shipping Queue

### Next Ship Date Calculation

- **1 Month**: 30 days from ship date
- **3 Months**: 90 days from ship date  
- **End of Month**: Last day of next month

### Order Queue

Orders in "pending" or "reviewed" status appear in the Shipping Queue. Once marked "shipped" or "cancelled", they're removed from the queue.

## Supplier Management

### Adding Suppliers

You can add more suppliers directly in Supabase:

```sql
INSERT INTO suppliers (name, website, notes)
VALUES ('Supplier Name', 'https://example.com', 'Notes about this supplier');
```

### Linking Products to Suppliers

Track which suppliers carry which products:

```sql
INSERT INTO product_suppliers (product_id, supplier_id, price, is_preferred)
VALUES 
  ('product-uuid', 'supplier-uuid', 299.99, true);
```

Set `is_preferred = true` for your go-to supplier for each product.

## Browser Automation (Available Now!) 🤖

### Teststripz Automation

Browser automation for Teststripz is now available in `web/automation/`.

**Features:**
- ✅ Auto-login to Teststripz
- ✅ Fetches pending orders from database
- ✅ Fills shipping addresses automatically
- ✅ Searches and adds products to cart
- ✅ Pauses for manual review before submission
- ✅ Captures tracking numbers
- ✅ Updates database automatically

**Quick Start:**
```bash
cd web/automation
npm install
cp .env.example .env
# Edit .env with your Teststripz credentials
npm test  # Always test first!
npm run place-orders  # Run for real
```

**How It Works:**
1. Pulls pending orders from your database
2. Opens Teststripz in browser (visible window)
3. Logs in with your credentials
4. For each order:
   - Fills shipping address
   - Searches for products by SKU
   - Adds correct quantities to cart
   - **Pauses for you to review**
   - Submits after you press Enter
5. Updates database with tracking info

**Important:** You'll need to customize CSS selectors to match Teststripz's actual website. See `web/automation/README.md` for details.

### Adding More Suppliers

The automation framework is ready to expand:
1. Copy `teststripz-automation.js` to `new-supplier-automation.js`
2. Update website URL and selectors
3. Add script to `package.json`
4. Test and deploy

---

## Future Enhancements

### Email Ordering (Phase 3)

### Email Ordering (Phase 2)

For suppliers that accept email orders:
- Auto-generate order emails
- Pre-fill all client/product details
- Review and send with one click

### Inventory Tracking (Phase 3)

- Track your on-hand inventory
- Alert when stock is low
- Suggest bulk ordering opportunities

## Tips

1. **Start Simple**: Assign products to a few clients first to test the workflow
2. **Product Naming**: Use consistent names (e.g., "Dexcom G7 Sensors" not "G7", "g7 sensors", etc.)
3. **Supplier Notes**: Add notes about each supplier (pricing, shipping speed, best for which products)
4. **Regular Reviews**: Check the Shipping Queue daily to stay ahead of due dates
5. **Address Validation**: Ensure client addresses are complete before products are assigned

## Troubleshooting

**Orders not auto-generating?**
- Verify the client has assigned products
- Check that shipping duration is set
- Confirm date_shipped is recorded

**Products not showing in Clients tab?**
- Refresh the page
- Check that products are marked as "active" in database
- Verify client_products entries exist for that client

**Pending orders missing?**
- Check order status (only "pending" and "reviewed" show in queue)
- Verify ship_date is in the future

## Database Queries

Useful queries for managing the system:

```sql
-- See all client product assignments
SELECT 
  l.name,
  p.name as product,
  cp.quantity,
  cp.frequency_days
FROM client_products cp
JOIN leads l ON l.id = cp.lead_id
JOIN products p ON p.id = cp.product_id
WHERE cp.active = true;

-- View upcoming orders
SELECT 
  po.ship_date,
  l.name,
  po.status,
  COUNT(poi.id) as item_count
FROM pending_orders po
JOIN leads l ON l.id = po.lead_id
LEFT JOIN pending_order_items poi ON poi.pending_order_id = po.id
WHERE po.status IN ('pending', 'reviewed')
GROUP BY po.id, po.ship_date, l.name, po.status
ORDER BY po.ship_date;

-- Find clients without product assignments
SELECT 
  l.name,
  l.insurance,
  l.date_shipped
FROM leads l
WHERE l.stage = 'qualified'
  AND NOT EXISTS (
    SELECT 1 FROM client_products cp 
    WHERE cp.lead_id = l.id AND cp.active = true
  );
```

## Support

For issues or enhancement requests, document:
- What you were trying to do
- What happened vs. what you expected
- Any error messages
- Screenshots if applicable
