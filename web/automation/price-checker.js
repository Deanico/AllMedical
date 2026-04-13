import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const SUPPORTED_SUPPLIERS = new Set([
  'teststripz',
  'rapidrx usa',
  'diabetic warehouse'
]);

class PriceChecker {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 Starting price checker...');
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.TIMEOUT || '30000')
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(parseInt(process.env.TIMEOUT || '30000'));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Check prices on Teststripz
  async checkTeststripz(product, supplierSku) {
    try {
      console.log(`   Checking Teststripz for: ${product.name}`);
      console.log(`   → URL: https://shop.teststripz.com/products/${supplierSku}`);
      
      // Navigate directly to product page
      const productUrl = `https://shop.teststripz.com/products/${supplierSku}`;
      await this.page.goto(productUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
      
      // Extract price using #ProductPrice selector
      const priceSelectors = [
        '#ProductPrice',
        '.price',
        '.product-price',
        '.money'
      ];
      
      let price = null;
      for (const selector of priceSelectors) {
        try {
          const priceText = await this.page.locator(selector).first().textContent({ timeout: 2000 });
          if (priceText) {
            const match = priceText.match(/[\d,]+\.?\d*/);
            if (match) {
              price = parseFloat(match[0].replace(',', ''));
              if (price > 0) break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (price) {
        console.log(`   ✅ Found: $${price.toFixed(2)}`);
      } else {
        console.log(`   ⚠️  Could not extract price`);
      }
      
      return { price, inStock: true };
    } catch (error) {
      console.error(`   ❌ Error checking Teststripz:`, error.message);
      return { price: null, inStock: false };
    }
  }

  // Check prices on RapidRx USA
  async checkRapidRx(product, supplierSku) {
    try {
      console.log(`   Checking RapidRx USA for: ${product.name}`);
      console.log(`   → URL: https://rapidrxusa.com/products/${supplierSku}`);
      
      // Navigate directly to product page
      const productUrl = `https://rapidrxusa.com/products/${supplierSku}`;
      await this.page.goto(productUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
      
      // Extract sale price (or regular price if no sale)
      const priceSelectors = [
        '.price__sale .price-item--sale',
        '.price__sale span',
        '.price__regular .price-item--regular',
        '.product__price span',
        '[class*="price"]'
      ];
      
      let price = null;
      for (const selector of priceSelectors) {
        try {
          const priceText = await this.page.locator(selector).first().textContent({ timeout: 2000 });
          if (priceText) {
            const match = priceText.match(/[\d,]+\.?\d*/);
            if (match) {
              price = parseFloat(match[0].replace(',', ''));
              if (price > 0) break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (price) {
        console.log(`   ✅ Found: $${price.toFixed(2)}`);
      } else {
        console.log(`   ⚠️  Could not extract price`);
      }
      
      return { price, inStock: true };
    } catch (error) {
      console.error(`   ❌ Error checking RapidRx:`, error.message);
      return { price: null, inStock: false };
    }
  }

  // Check prices on Diabetic Warehouse
  async checkDiabeticWarehouse(product, supplierSku) {
    try {
      console.log(`   Checking Diabetic Warehouse for: ${product.name}`);
      
      await this.page.goto('https://diabeticwarehouse.org');
      
      // Search
      const searchSelector = '#search, input[name="q"]';
      await this.page.fill(searchSelector, supplierSku);
      await this.page.press(searchSelector, 'Enter');
      await this.page.waitForLoadState('networkidle');
      
      // Extract price
      let price = null;
      const priceSelectors = ['.price', '.product-price', '[class*="price"]'];
      
      for (const selector of priceSelectors) {
        try {
          const priceText = await this.page.locator(selector).first().textContent({ timeout: 2000 });
          if (priceText) {
            const match = priceText.match(/[\d,]+\.?\d*/);
            if (match) {
              price = parseFloat(match[0].replace(',', ''));
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (price) {
        console.log(`   ✅ Found: $${price.toFixed(2)}`);
      } else {
        console.log(`   ⚠️  Could not extract price`);
      }
      
      return { price, inStock: true };
    } catch (error) {
      console.error(`   ❌ Error checking Diabetic Warehouse:`, error.message);
      return { price: null, inStock: false };
    }
  }

  // Update price in database
  async updatePrice(productSupplierId, price, inStock) {
    try {
      // Update product_suppliers table
      const { error: updateError } = await supabase
        .from('product_suppliers')
        .update({
          price: price,
          in_stock: inStock,
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', productSupplierId);

      if (updateError) throw updateError;

      // Add to price history
      if (price !== null) {
        const { error: historyError } = await supabase
          .from('price_history')
          .insert([{
            product_supplier_id: productSupplierId,
            price: price,
            in_stock: inStock,
            checked_at: new Date().toISOString()
          }]);

        if (historyError) {
          console.warn('     Warning: Could not save price history:', historyError.message);
        }
      }

      console.log(`     💾 Updated database`);
    } catch (error) {
      console.error(`     ❌ Database update failed:`, error.message);
    }
  }

  // Main function to check all products
  async checkAllPrices() {
    console.log('📋 Fetching products to check...');
    
    // Get all product-supplier mappings
    const { data: mappings, error } = await supabase
      .from('product_suppliers')
      .select(`
        id,
        supplier_sku,
        products (
          id,
          name,
          sku
        ),
        suppliers (
          id,
          name,
          website
        )
      `)
      .not('supplier_sku', 'is', null);

    if (error) {
      console.error('❌ Error fetching products:', error);
      return;
    }

    console.log(`✅ Found ${mappings.length} product-supplier mappings to check\n`);

    const supplierCoverage = (mappings || []).reduce((acc, mapping) => {
      const supplierName = mapping.suppliers?.name || 'Unknown Supplier';
      acc[supplierName] = (acc[supplierName] || 0) + 1;
      return acc;
    }, {});

    console.log('🏷️ Supplier coverage:');
    Object.entries(supplierCoverage).forEach(([supplierName, count]) => {
      const normalized = supplierName.toLowerCase();
      const supported = SUPPORTED_SUPPLIERS.has(normalized);
      console.log(`   - ${supplierName}: ${count} mapping(s) ${supported ? '✅' : '⚠️ unsupported checker'}`);
    });

    const results = {
      checked: 0,
      updated: 0,
      failed: 0,
      skipped: 0
    };

    for (const mapping of mappings) {
      console.log(`\n📦 ${mapping.products.name} @ ${mapping.suppliers.name}`);
      console.log(`   SKU: ${mapping.supplier_sku}`);
      
      let priceData = { price: null, inStock: false };
      
      // Route to appropriate supplier checker
      const supplierName = mapping.suppliers?.name || '';
      const normalizedSupplierName = supplierName.toLowerCase();

      if (normalizedSupplierName === 'teststripz') {
        priceData = await this.checkTeststripz(mapping.products, mapping.supplier_sku);
      } else if (normalizedSupplierName === 'rapidrx usa') {
        priceData = await this.checkRapidRx(mapping.products, mapping.supplier_sku);
      } else if (normalizedSupplierName === 'diabetic warehouse') {
        priceData = await this.checkDiabeticWarehouse(mapping.products, mapping.supplier_sku);
      } else {
        console.warn(`   ⚠️  No checker implemented for supplier: ${supplierName}. Skipping.`);
        results.skipped++;
        continue;
      }
      
      results.checked++;
      
      if (priceData.price !== null) {
        await this.updatePrice(mapping.id, priceData.price, priceData.inStock);
        results.updated++;
      } else {
        results.failed++;
      }
      
      // Small delay between checks to be polite
      try {
        await this.page.waitForTimeout(2000);
      } catch (e) {
        console.log('   ⚠️  Browser closed, stopping checks');
        break;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 PRICE CHECK SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Checked: ${results.checked}`);
    console.log(`💾 Updated: ${results.updated}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log('='.repeat(50));
  }
}

// Run the price checker
async function main() {
  const checker = new PriceChecker();
  
  try {
    await checker.init();
    await checker.checkAllPrices();
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await checker.close();
  }
}

main();
