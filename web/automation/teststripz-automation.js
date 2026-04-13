import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Configuration
const CONFIG = {
  headless: process.env.HEADLESS === 'true',
  autoSubmit: process.env.AUTO_SUBMIT === 'true',
  timeout: parseInt(process.env.TIMEOUT) || 30000,
  testMode: process.argv.includes('--test')
};

const SELECTORS = {
  loginEmail: ['#CustomerEmail', 'input[name="customer[email]"]', 'input[type="email"]'],
  loginPassword: ['#CustomerPassword', 'input[name="customer[password]"]', 'input[type="password"]'],
  loginSubmit: ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Sign In")'],
  accountIndicator: ['a:has-text("Log Out")', 'a:has-text("Account")', 'a[href*="/account"]'],
  searchInput: ['input[type="search"]', 'input[name="q"]', '#Search', '#search'],
  productResult: ['.product-item a', '.grid-product a', 'a[href*="/products/"]'],
  quantityInput: ['#quantity', 'input[name="quantity"]', 'input[type="number"]'],
  addToCartButton: ['#AddToCartText', 'button:has-text("Add to cart")', 'button[name="add"]'],
  cartButton: ['#SVGDoc', 'a[href*="/cart"]', 'button[aria-label*="cart" i]'],
  checkoutButton: ['#slidedown-cart > div.has-items > div.actions > button:nth-child(2)', 'a[href*="/checkout"]', 'button:has-text("Checkout")'],
  shippingFirstName: ['#TextField0', 'input[name="firstName"]', 'input[name="checkout[shipping_address][first_name]"]'],
  shippingLastName: ['#TextField1', 'input[name="lastName"]', 'input[name="checkout[shipping_address][last_name]"]'],
  shippingAddress1: ['#shipping-address1', 'input[name="address1"]', 'input[name="checkout[shipping_address][address1]"]'],
  shippingCity: ['#TextField3', 'input[name="city"]', 'input[name="checkout[shipping_address][city]"]'],
  shippingState: ['#Select1', 'select[name="provinceCode"]', 'select[name="checkout[shipping_address][province]"]'],
  shippingZip: ['#TextField4', 'input[name="postalCode"]', 'input[name="checkout[shipping_address][zip]"]'],
  shippingPhone: ['#TextField5', 'input[name="phone"]', 'input[name="checkout[shipping_address][phone]"]'],
  continueToPayment: ['button:has-text("Continue to payment")', 'button[type="submit"]']
};

class TeststripzAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async getFirstVisibleLocator(selectors) {
    for (const selector of selectors) {
      const locator = this.page.locator(selector).first();
      if (await locator.count() > 0) {
        return locator;
      }
    }

    return null;
  }

  async fillFirstAvailable(selectors, value, fieldName) {
    const locator = await this.getFirstVisibleLocator(selectors);
    if (!locator) {
      throw new Error(`Could not find input for ${fieldName}`);
    }

    await locator.fill(value ?? '');
  }

  async clickFirstAvailable(selectors, fieldName) {
    const locator = await this.getFirstVisibleLocator(selectors);
    if (!locator) {
      throw new Error(`Could not find element for ${fieldName}`);
    }

    await locator.click();
  }

  async waitForAnySelector(selectors, timeout = 10000) {
    const endAt = Date.now() + timeout;

    while (Date.now() < endAt) {
      for (const selector of selectors) {
        if (await this.page.locator(selector).count() > 0) {
          return selector;
        }
      }

      await this.page.waitForTimeout(250);
    }

    throw new Error(`Timed out waiting for selectors: ${selectors.join(', ')}`);
  }

  async updateOrder(orderId, updates) {
    const { error } = await supabase
      .from('pending_orders')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      throw new Error(`Failed to update order ${orderId}: ${error.message}`);
    }
  }

  async init() {
    console.log('🚀 Starting Teststripz automation...');
    this.browser = await chromium.launch({ 
      headless: CONFIG.headless,
      slowMo: 100 // Slow down actions for visibility
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(CONFIG.timeout);
  }

  async login() {
    console.log('🔐 Logging into Teststripz...');
    
    try {
      await this.page.goto('https://shop.teststripz.com/account/login', { waitUntil: 'networkidle' });
      
      // Wait for login form to appear
      await this.waitForAnySelector(SELECTORS.loginEmail, 15000);
      
      console.log('   Found login form');
      
      // Fill in credentials
      await this.fillFirstAvailable(SELECTORS.loginEmail, process.env.TESTSTRIPZ_EMAIL, 'login email');
      await this.fillFirstAvailable(SELECTORS.loginPassword, process.env.TESTSTRIPZ_PASSWORD, 'login password');
      
      console.log('   Filled credentials');
      
      // Click login button (submit form)
      await this.clickFirstAvailable(SELECTORS.loginSubmit, 'login submit button');
      
      console.log('   Clicked submit button');
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle');
      
      // Check if we're logged in (look for account link or logout button)
      const loggedIn = await this.getFirstVisibleLocator(SELECTORS.accountIndicator);
      
      if (!loggedIn) {
        throw new Error('Login may have failed - could not verify logged in state');
      }
      
      console.log('✅ Login successful');
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw new Error('Could not login to Teststripz. Please check credentials and website structure.');
    }
  }

  async getPendingOrders() {
    console.log('📋 Fetching pending orders from database...');
    
    const { data: orders, error } = await supabase
      .from('pending_orders')
      .select(`
        *,
        leads (
          id,
          name,
          address_line1,
          city,
          state,
          zip_code,
          phone
        ),
        pending_order_items (
          id,
          quantity,
          products (
            id,
            name,
            category,
            sku,
            manufacturer
          )
        )
      `)
      .eq('status', 'pending')
      .order('ship_date', { ascending: true });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Found ${orders?.length || 0} pending orders`);
    return orders || [];
  }

  async placeOrder(order) {
    console.log(`\n📦 Processing order for ${order.leads.name}...`);
    console.log(`   Ship date: ${order.ship_date}`);
    console.log(`   Items: ${order.pending_order_items.length}`);

    try {
      // Add products to cart first
      for (const item of order.pending_order_items) {
        await this.addProductToCart(item);
      }

      console.log('\n   🛒 All items added to cart');
      
      // Click cart icon to view cart
      await this.clickFirstAvailable(SELECTORS.cartButton, 'cart button');
      await this.page.waitForTimeout(1000);
      
      // Click checkout button in cart dropdown
      await this.clickFirstAvailable(SELECTORS.checkoutButton, 'checkout button');
      await this.page.waitForLoadState('networkidle');
      
      console.log('   💳 Navigated to checkout');

      // Fill shipping address
      await this.fillShippingAddress(order.leads);

      // Show summary and wait for confirmation
      await this.showOrderSummary(order);

      if (!CONFIG.autoSubmit) {
        console.log('\n⏸️  PAUSED FOR REVIEW');
        console.log('Please review the shipping info in the browser window.');
        console.log('When ready, you can:');
        console.log('  1. Continue to payment manually');
        console.log('  2. Or press Enter here to let automation click "Continue to Payment"');
        console.log('  3. Or press Ctrl+C to cancel');
        
        await this.waitForUserConfirmation();
      }

      // In test mode, stop here
      if (CONFIG.testMode) {
        console.log('🧪 TEST MODE - Stopped at checkout. Review the form!');
        console.log('   Browser will stay open for 30 seconds...');
        await this.page.waitForTimeout(30000);
        return { success: true, tracking: 'TEST-12345', testMode: true };
      } else {
        // Click continue to payment (user will handle payment manually)
        console.log('   ➡️  Clicking "Continue to Payment"...');
        await this.clickFirstAvailable(SELECTORS.continueToPayment, 'continue to payment button');
        
        console.log('   ⏸️  STOPPED - Please complete payment manually');
        console.log('   Browser will remain open. Press Enter when order is complete...');
        await this.waitForUserConfirmation();
        
        return { success: true, tracking: null, manual: true };
      }

    } catch (error) {
      console.error(`❌ Error placing order for ${order.leads.name}:`, error.message);
      console.error('Full error:', error);
      return { success: false, error: error.message };
    }
  }

  async fillShippingAddress(client) {
    console.log('   📫 Filling shipping address...');
    
    try {
      // Wait for shipping form to load
      await this.waitForAnySelector(SELECTORS.shippingFirstName, 15000);
      
      // Split name into first and last
      const nameParts = client.name.split(' ');
      const firstName = nameParts[0] || client.name;
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Fill in shipping details
      await this.fillFirstAvailable(SELECTORS.shippingFirstName, firstName, 'shipping first name');
      await this.fillFirstAvailable(SELECTORS.shippingLastName, lastName, 'shipping last name');
      await this.fillFirstAvailable(SELECTORS.shippingAddress1, client.address_line1 || '', 'shipping address line 1');
      await this.fillFirstAvailable(SELECTORS.shippingCity, client.city || '', 'shipping city');
      
      // State is a dropdown
      const stateLocator = await this.getFirstVisibleLocator(SELECTORS.shippingState);
      if (!stateLocator) {
        throw new Error('Could not find shipping state dropdown');
      }
      await stateLocator.selectOption(client.state || '');
      
      await this.fillFirstAvailable(SELECTORS.shippingZip, client.zip_code || '', 'shipping zip');
      
      // Phone is optional
      if (client.phone) {
        await this.fillFirstAvailable(SELECTORS.shippingPhone, client.phone, 'shipping phone');
      }
      
      console.log('   ✅ Address filled');
    } catch (error) {
      throw new Error(`Could not fill address: ${error.message}`);
    }
  }

  async addProductToCart(item) {
    console.log(`   🛒 Adding: ${item.products.name} (Qty: ${item.quantity})`);
    
    try {
      // Search for product by SKU or name
      await this.waitForAnySelector(SELECTORS.searchInput, 10000);
      const searchInput = await this.getFirstVisibleLocator(SELECTORS.searchInput);
      if (!searchInput) {
        throw new Error('Could not find search input');
      }
      
      const searchTerm = item.products.sku || item.products.name;
      await searchInput.fill('');
      await searchInput.fill(searchTerm);
      await searchInput.press('Enter');
      
      console.log(`      Searching for: ${searchTerm}`);
      
      // Wait for search results
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(1000);
      
      // Click on first product result (look for any product link)
      await this.waitForAnySelector(SELECTORS.productResult, 15000);
      const firstProduct = await this.getFirstVisibleLocator(SELECTORS.productResult);
      if (!firstProduct) {
        throw new Error(`No product results found for ${searchTerm}`);
      }
      await firstProduct.click();
      
      console.log(`      Clicked product`);
      
      // Wait for product page to load
      await this.page.waitForLoadState('networkidle');
      
      // Set quantity
      await this.waitForAnySelector(SELECTORS.quantityInput, 10000);
      await this.fillFirstAvailable(SELECTORS.quantityInput, item.quantity.toString(), 'product quantity');
      
      console.log(`      Set quantity to ${item.quantity}`);
      
      // Add to cart
      await this.clickFirstAvailable(SELECTORS.addToCartButton, 'add to cart button');
      
      // Wait for cart to update
      await this.page.waitForTimeout(2000);
      
      console.log(`   ✅ Added to cart`);
    } catch (error) {
      throw new Error(`Could not add ${item.products.name} to cart: ${error.message}`);
    }
  }

  async showOrderSummary(order) {
    console.log('\n📋 ORDER SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`Client: ${order.leads.name}`);
    console.log(`Address: ${order.leads.address_line1}, ${order.leads.city}, ${order.leads.state} ${order.leads.zip_code}`);
    console.log('\nProducts:');
    order.pending_order_items.forEach(item => {
      console.log(`  - ${item.products.name} × ${item.quantity}`);
    });
    console.log('─'.repeat(50));
  }

  async waitForUserConfirmation() {
    return new Promise((resolve) => {
      if (!process.stdin.isTTY) {
        setTimeout(resolve, 1000);
        return;
      }

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    });
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }
}

// Main execution
async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY in web/automation/.env');
  }

  if (!process.env.TESTSTRIPZ_EMAIL || !process.env.TESTSTRIPZ_PASSWORD) {
    throw new Error('Missing Teststripz credentials. Set TESTSTRIPZ_EMAIL and TESTSTRIPZ_PASSWORD in web/automation/.env');
  }

  const automation = new TeststripzAutomation();
  
  try {
    await automation.init();
    
    // Login
    await automation.login();
    
    // Get pending orders
    const orders = await automation.getPendingOrders();
    
    if (orders.length === 0) {
      console.log('✨ No pending orders to process!');
      return;
    }

    console.log(`\n🎯 Processing ${orders.length} order(s)...`);
    
    // Process each order
    const results = [];
    for (const order of orders) {
      const result = await automation.placeOrder(order);
      results.push({ order: order.leads.name, ...result });

      if (result.success && !result.testMode) {
        try {
          await automation.updateOrder(order.id, {
            status: 'ordered',
            order_placed_at: new Date().toISOString(),
            notes: 'Ordered by teststripz automation'
          });
        } catch (updateError) {
          console.warn(`⚠️  Order placed but DB status update failed for ${order.leads.name}: ${updateError.message}`);
        }
      }

      if (!result.success) {
        try {
          await automation.updateOrder(order.id, {
            notes: `Automation error: ${result.error}`
          });
        } catch (updateError) {
          console.warn(`⚠️  Failed to save automation error note for ${order.leads.name}: ${updateError.message}`);
        }
      }
      
      // Wait between orders
      if (orders.indexOf(order) < orders.length - 1) {
        console.log('\n⏳ Waiting 3 seconds before next order...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 AUTOMATION SUMMARY');
    console.log('='.repeat(50));
    results.forEach((r, i) => {
      const status = r.success ? '✅' : '❌';
      console.log(`${status} ${r.order}: ${r.success ? (r.testMode ? 'TEST MODE' : `Tracking: ${r.tracking || 'N/A'}`) : r.error}`);
    });
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Automation failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await automation.close();
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = import.meta.url.slice(7).replace(/\//g, '\\');
  const scriptPath = process.argv[1]?.replace(/\//g, '\\');
  
  if (modulePath.endsWith(scriptPath) || process.argv[1]?.includes('teststripz-automation')) {
    console.log('Starting automation script...');
    main().catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
  }
}
