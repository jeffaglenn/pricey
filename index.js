#!/usr/bin/env node

const { Command } = require('commander');
const ProductScraper = require('./scraper');
const Database = require('./database-pg');
const RetailerManager = require('./retailer-manager');

const program = new Command();

program
  .name('pricey')
  .description('Simple product price scraper')
  .version('1.0.0');

program
  .command('scrape')
  .description('Scrape a product from a URL')
  .argument('<url>', 'Product URL to scrape')
  .option('-d, --debug', 'Show detailed fingerprint randomization info')
  .option('-v, --no-headless', 'Run browser in visible mode (default: headless)')
  .action(async (url, options) => {
    const db = new Database();
    let scraper = null;
    
    try {
      console.log(`Scraping product from: ${url}`);
      await db.init();
      
      scraper = new ProductScraper({
        database: db,
        showFingerprint: options.debug,
        headless: options.headless
      });
      const productData = await scraper.scrapeProduct(url);

      if (productData && productData.title && productData.price) {
        const productId = await db.saveProduct(productData);
        console.log('✅ Product scraped successfully:');
        console.log(`   Title: ${productData.title}`);
        console.log(`   Price: $${productData.price}`);
        console.log(`   Saved with ID: ${productId}`);
      } else {
        console.log('❌ Failed to scrape product - could not find title or price');
        if (productData) {
          console.log('Raw data found:', productData);
        }
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      if (scraper) {
        await scraper.close();
      }
      await db.close();
    }
  });

program
  .command('list')
  .description('List all scraped products')
  .action(async () => {
    const db = new Database();

    try {
      await db.init();
      const products = await db.getAllProducts();

      if (products.length === 0) {
        console.log('No products found. Use "pricey scrape <url>" to add some!');
        return;
      }

      console.log(`\n📦 Found ${products.length} products:\n`);
      products.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   Price: $${product.price || 'N/A'}`);
        console.log(`   Retailer: ${product.retailer_name || 'Unknown'}`);
        console.log(`   URL: ${product.url}`);
        console.log(`   Scraped: ${new Date(product.scraped_at).toLocaleString()}`);
        console.log();
      });

    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program
  .command('check')
  .description('Check if a URL has been scraped before')
  .argument('<url>', 'Product URL to check')
  .action(async (url) => {
    const db = new Database();

    try {
      await db.init();
      const product = await db.getProductByUrl(url);

      if (product) {
        console.log('✅ Product already in database:');
        console.log(`   Title: ${product.title}`);
        console.log(`   Price: $${product.price || 'N/A'}`);
        console.log(`   Retailer: ${product.retailer_name || 'Unknown'}`);
        console.log(`   Last scraped: ${new Date(product.scraped_at).toLocaleString()}`);
      } else {
        console.log('❌ Product not found in database');
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program
  .command('failures')
  .description('Show recent scraping failures with error analysis')
  .option('-n, --limit <number>', 'Number of failures to show', '10')
  .action(async (options) => {
    const db = new Database();
    
    try {
      await db.init();
      const pool = db.getPool();
      
      const result = await pool.query(`
        SELECT 
          sa.url,
          sa.error_type,
          sa.error_message,
          sa.browser_used,
          sa.attempted_at,
          r.name as retailer_name
        FROM scrape_attempts sa
        LEFT JOIN retailers r ON sa.retailer_id = r.id
        WHERE sa.success = false
        ORDER BY sa.attempted_at DESC
        LIMIT $1
      `, [parseInt(options.limit)]);
      
      if (result.rows.length === 0) {
        console.log('✅ No recent failures found!');
        return;
      }
      
      console.log(`\n❌ Recent failures (${result.rows.length}):\n`);
      
      result.rows.forEach((failure, index) => {
        const domain = new URL(failure.url).hostname.replace(/^www\./, '');
        console.log(`${index + 1}. ${domain}`);
        console.log(`   Error Type: ${failure.error_type || 'unknown'}`);
        console.log(`   Retailer: ${failure.retailer_name || 'Unknown'}`);
        console.log(`   Browser: ${failure.browser_used || 'N/A'}`);
        console.log(`   When: ${new Date(failure.attempted_at).toLocaleString()}`);
        console.log(`   Details: ${failure.error_message}`);
        console.log(`   URL: ${failure.url.substring(0, 80)}${failure.url.length > 80 ? '...' : ''}`);
        console.log();
      });
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program
  .command('stats')
  .description('Show scraping success rates and error statistics')
  .action(async () => {
    const db = new Database();
    
    try {
      await db.init();
      const pool = db.getPool();
      
      // Overall stats
      const overallResult = await pool.query(`
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(*) FILTER (WHERE success = true) as successful,
          COUNT(*) FILTER (WHERE success = false) as failed,
          ROUND(
            (COUNT(*) FILTER (WHERE success = true) * 100.0) / COUNT(*), 2
          ) as success_rate
        FROM scrape_attempts
        WHERE attempted_at > NOW() - INTERVAL '30 days'
      `);
      
      // Error type breakdown
      const errorResult = await pool.query(`
        SELECT 
          error_type,
          COUNT(*) as count,
          ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM scrape_attempts WHERE success = false AND attempted_at > NOW() - INTERVAL '30 days'), 2) as percentage
        FROM scrape_attempts 
        WHERE success = false 
        AND attempted_at > NOW() - INTERVAL '30 days'
        AND error_type IS NOT NULL
        GROUP BY error_type 
        ORDER BY count DESC
      `);
      
      // Retailer performance
      const retailerResult = await pool.query(`
        SELECT 
          r.name,
          COUNT(*) as attempts,
          COUNT(*) FILTER (WHERE sa.success = true) as successful,
          ROUND(
            (COUNT(*) FILTER (WHERE sa.success = true) * 100.0) / COUNT(*), 2
          ) as success_rate
        FROM scrape_attempts sa
        LEFT JOIN retailers r ON sa.retailer_id = r.id
        WHERE sa.attempted_at > NOW() - INTERVAL '30 days'
        GROUP BY r.id, r.name
        ORDER BY attempts DESC
      `);
      
      const stats = overallResult.rows[0];
      
      console.log('\n📊 Scraping Statistics (Last 30 Days)\n');
      console.log(`Total Attempts: ${stats.total_attempts}`);
      console.log(`Successful: ${stats.successful} (${stats.success_rate}%)`);
      console.log(`Failed: ${stats.failed} (${100 - stats.success_rate}%)`);
      
      if (errorResult.rows.length > 0) {
        console.log('\n🔍 Failure Breakdown:');
        errorResult.rows.forEach(error => {
          console.log(`   ${error.error_type}: ${error.count} (${error.percentage}%)`);
        });
      }
      
      if (retailerResult.rows.length > 0) {
        console.log('\n🏪 Retailer Performance:');
        retailerResult.rows.forEach(retailer => {
          console.log(`   ${retailer.name}: ${retailer.successful}/${retailer.attempts} (${retailer.success_rate}%)`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program
  .command('retailers')
  .description('List all configured retailers')
  .action(async () => {
    const db = new Database();
    
    try {
      await db.init();
      const retailerManager = new RetailerManager(db);
      const retailers = await retailerManager.listRetailers();
      
      if (retailers.length === 0) {
        console.log('No retailers configured.');
        return;
      }
      
      console.log(`\n🏪 Configured retailers (${retailers.length}):\n`);
      
      retailers.forEach((retailer, index) => {
        console.log(`${index + 1}. ${retailer.name}`);
        console.log(`   Domain: ${retailer.domain}`);
        console.log(`   Selectors: ${retailer.selector_count || 0}`);
        console.log(`   Success Rate: ${retailer.avg_success_rate ? Math.round(retailer.avg_success_rate) + '%' : 'No data'}`);
        console.log(`   Status: ${retailer.is_active ? '✅ Active' : '❌ Inactive'}`);
        console.log();
      });
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program
  .command('add-retailer')
  .description('Add a new retailer configuration')
  .requiredOption('-n, --name <name>', 'Retailer name')
  .requiredOption('-d, --domain <domain>', 'Retailer domain')
  .option('-p, --price-selectors <selectors>', 'Comma-separated price selectors')
  .option('-t, --title-selectors <selectors>', 'Comma-separated title selectors')
  .option('--url-patterns <patterns>', 'Comma-separated URL patterns (regex)')
  .action(async (options) => {
    const db = new Database();
    
    try {
      await db.init();
      const retailerManager = new RetailerManager(db);
      
      const retailerData = {
        name: options.name,
        domain: options.domain,
        urlPatterns: options.urlPatterns ? options.urlPatterns.split(',').map(p => p.trim()) : [],
        priceSelectors: options.priceSelectors ? options.priceSelectors.split(',').map(s => s.trim()) : [],
        titleSelectors: options.titleSelectors ? options.titleSelectors.split(',').map(s => s.trim()) : []
      };
      
      const retailerId = await retailerManager.addRetailer(retailerData);
      console.log(`✅ Added retailer: ${options.name} (ID: ${retailerId})`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program
  .command('test-retailer')
  .description('Test retailer detection and selectors')
  .argument('<url>', 'URL to test retailer detection against')
  .option('-r, --retailer <domain>', 'Expected retailer domain (use "auto" for auto-detection)')
  .action(async (url, options) => {
    const db = new Database();
    
    try {
      await db.init();
      const retailerManager = new RetailerManager(db);
      
      const result = await retailerManager.testRetailer(options.retailer || 'auto', url);
      
      if (result.success) {
        console.log('✅ Retailer detection test successful:');
        console.log(`   Retailer: ${result.retailer}`);
        console.log(`   Domain: ${result.domain}`);
        console.log(`   Price Selectors: ${result.selectors.price.length}`);
        console.log(`   Title Selectors: ${result.selectors.title.length}`);
        if (result.config.delay) {
          console.log(`   Delay: ${result.config.delay}ms`);
        }
      } else {
        console.log('❌ Retailer detection test failed:');
        console.log(`   Message: ${result.message}`);
        if (result.matched_retailer) {
          console.log(`   Matched: ${result.matched_retailer}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await db.close();
    }
  });

program.parse();