# Teststripz Shipping Automation

Browser automation for placing orders on Teststripz.com using Playwright.

## Setup

### 1. Install Dependencies

```bash
cd web/automation
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
TESTSTRIPZ_EMAIL=your_teststripz_account@email.com
TESTSTRIPZ_PASSWORD=your_password

# Settings
HEADLESS=false        # Set to true to hide browser
AUTO_SUBMIT=false     # Set to true to skip manual review
TIMEOUT=30000         # Timeout for page loads (ms)
```

### 3. Customize Selectors

**IMPORTANT**: Before running, you need to update the CSS selectors in `teststripz-automation.js` to match Teststripz's actual website structure.

Open `teststripz-automation.js` and update these sections:

- `login()` method - Login form selectors
- `fillShippingAddress()` - Shipping form field names
- `addProductToCart()` - Product search and cart selectors
- `submitOrder()` - Checkout button selectors

### 4. Test Mode

Always test first with test mode enabled:

```bash
npm test
```

This will:
- ✅ Login to Teststripz
- ✅ Fetch pending orders
- ✅ Fill in forms
- ✅ Show preview
- ❌ NOT submit actual orders

## Usage

### Run Automation (Production)

```bash
npm run place-orders
```

This will:
1. Login to Teststripz
2. Fetch all pending orders from database
3. For each order:
   - Fill shipping address
   - Add products to cart
   - **PAUSE for your review**
   - Submit order (after you press Enter)
   - Update database with tracking info

### Settings

**Manual Review (Recommended):**
```env
AUTO_SUBMIT=false
HEADLESS=false
```
- Shows browser window
- Pauses before submission
- You confirm each order

**Fully Automated:**
```env
AUTO_SUBMIT=true
HEADLESS=true
```
- Runs in background
- Submits automatically
- Only use after extensive testing

## How It Works

### 1. Fetch Pending Orders

Queries Supabase for orders with `status = 'pending'`:
```sql
SELECT * FROM pending_orders
WHERE status = 'pending'
ORDER BY ship_date ASC
```

### 2. For Each Order:

- Opens Teststripz website
- Logs in with your credentials
- Navigates to checkout
- Fills shipping address from database
- Searches for each product by SKU/name
- Adds to cart with correct quantity
- Shows order summary
- Waits for your confirmation (unless AUTO_SUBMIT=true)
- Submits order
- Captures tracking number from confirmation
- Updates database:
  ```sql
  UPDATE pending_orders
  SET status = 'ordered',
      order_placed_at = NOW(),
      tracking_number = '...'
  WHERE id = order_id
  ```

### 3. Results Summary

Shows summary of all processed orders with success/failure status.

## Troubleshooting

### Selectors Not Working

Teststripz may have updated their website. To find correct selectors:

1. Run in test mode: `npm test`
2. When it fails, the browser stays open
3. Right-click elements → Inspect
4. Copy the correct CSS selector
5. Update `teststripz-automation.js`

### Login Failing

- Verify credentials in `.env`
- Check if Teststripz requires 2FA (may need manual first login)
- Website may have CAPTCHA (requires manual intervention)

### Products Not Found

- Ensure product SKUs in database match Teststripz's SKUs
- Try searching by product name instead
- Update search logic in `addProductToCart()`

### Tracking Number Not Captured

- Check confirmation page HTML structure
- Update regex pattern in `submitOrder()`
- Manually enter tracking numbers in Shipping Queue tab

## Customization

### File Structure

```
web/automation/
├── package.json                 # Dependencies
├── .env                        # Your credentials (DO NOT COMMIT)
├── .env.example               # Template
├── teststripz-automation.js   # Main automation script
└── README.md                  # This file
```

### Adding More Suppliers

Copy `teststripz-automation.js` and create:
- `diabetic-warehouse-automation.js`
- `diabetic-overstock-automation.js`
- etc.

Update:
- Website URL
- Login flow
- Form selectors
- Product search logic

### Advanced Features

You can extend the automation to:
- **Handle multiple payment methods**
- **Apply discount codes automatically**
- **Compare prices across suppliers**
- **Bulk order optimization** (combine multiple client orders)
- **Inventory checks before ordering**
- **Email notifications on completion**

## Security Notes

⚠️ **IMPORTANT**:

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use strong passwords** - Consider a password manager
3. **Enable 2FA** on supplier accounts (may require manual login)
4. **Restrict access** - Only run on trusted computers
5. **Review orders** - Always review before submitting (AUTO_SUBMIT=false)

For production, consider:
- Encrypted credential storage
- Running on a secure server
- Logging all automation actions
- Alerting on failures

## Support

If automation fails:
1. Check error messages in console
2. Verify selectors are current
3. Test in manual mode (`HEADLESS=false`)
4. Inspect browser console for errors
5. Update selectors as needed

Common issues:
- Website changed layout → Update selectors
- Login issues → Check credentials
- CAPTCHA → May need manual first login
- Timeout → Increase `TIMEOUT` in `.env`
