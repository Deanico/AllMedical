import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Configuration
const CONFIG = {
  headless: process.env.HEADLESS === 'true',
  autoSubmit: process.env.AUTO_SUBMIT === 'true',
  timeout: parseInt(process.env.TIMEOUT) || 30000,
  testMode: process.argv.includes('--test')
};

class TeststripzAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
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
      await this.page.waitForSelector('#CustomerEmail', { timeout: 10000 });
      
      console.log('   Found login form');
      
      // Fill in credentials
      await this.page.fill('#CustomerEmail', process.env.TESTSTRIPZ_EMAIL);
      await this.page.fill('#CustomerPassword', process.env.TESTSTRIPZ_PASSWORD);
      
      console.log('   Filled credentials');
      
      // Click login button (submit form)
      await this.page.click('button[type="submit"], input[type="submit"]');
      
      console.log('   Clicked submit button');
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle');
      
      // Check if we're logged in (look for account link or logout button)
      const loggedIn = await this.page.locator('a:has-text("Log Out"), a:has-text("Account")').count() > 0;
      
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
      await this.page.click('#SVGDoc');
      await this.page.waitForTimeout(1000);
      
      // Click checkout button in cart dropdown
      await this.page.click('#slidedown-cart > div.has-items > div.actions > button:nth-child(2)');
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
        await this.page.click('button:has-text("Continue to payment"), button[type="submit"]');
        
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
      await this.page.waitForSelector('#TextField0', { timeout: 10000 });
      
      // Split name into first and last
      const nameParts = client.name.split(' ');
      const firstName = nameParts[0] || client.name;
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Fill in shipping details
      await this.page.fill('#TextField0', firstName);
      await this.page.fill('#TextField1', lastName);
      await this.page.fill('#shipping-address1', client.address_line1);
      await this.page.fill('#TextField3', client.city);
      
      // State is a dropdown
      await this.page.selectOption('#Select1', client.state);
      
      await this.page.fill('#TextField4', client.zip_code);
      
      // Phone is optional
      if (client.phone) {
        await this.page.fill('#TextField5', client.phone);
      }
      
      console.log('   ✅ Address filled');
    } catch (error) {
      throw new Error(`Could not fill address: ${error.message}`);
    }
  }

  async addProductToCart(item) {
    console.log(`   🛒 Adding: ${item.products.name} (Qty: ${item.quantity})`);
    
    try {
      // Search for product by SKU or name - use input[type="search"] to avoid matching body#search
      await this.page.waitForSelector('input[type="search"]', { timeout: 5000 });
      
      const searchTerm = item.products.sku || item.products.name;
      await this.page.fill('input[type="search"]', searchTerm);
      await this.page.press('input[type="search"]', 'Enter');
      
      console.log(`      Searching for: ${searchTerm}`);
      
      // Wait for search results
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(1000);
      
      // Click on first product result (look for any product link)
      const firstProduct = await this.page.locator('.product-item a, .grid-product a, a[href*="/products/"]').first();
      await firstProduct.click();
      
      console.log(`      Clicked product`);
      
      // Wait for product page to load
      await this.page.waitForLoadState('networkidle');
      
      // Set quantity
      await this.page.waitForSelector('#quantity', { timeout: 5000 });
      await this.page.fill('#quantity', item.quantity.toString());
      
      console.log(`      Set quantity to ${item.quantity}`);
      
      // Add to cart
      await this.page.click('#AddToCartText');
      
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
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
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
