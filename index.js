#!/usr/bin/env node

const { Command } = require('commander');
const ProductScraper = require('./scraper');
const Database = require('./database');

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
  .action(async (url, options) => {
    const scraper = new ProductScraper({ showFingerprint: options.debug });
    const db = new Database();

    try {
      console.log(`Scraping product from: ${url}`);

      await db.init();
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
      await scraper.close();
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

program.parse();