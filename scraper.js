const FingerprintRandomizer = require('./fingerprint-randomizer');
const RetryHandler = require('./retry-handler');
const BrowserManager = require('./browser-manager');
const RetailerManager = require('./retailer-manager');

class ProductScraper {
  constructor(options = {}) {
    this.database = options.database; // Injected database instance
    this.retailerManager = new RetailerManager(this.database);
    this.fingerprintRandomizer = new FingerprintRandomizer();
    this.browserManager = new BrowserManager({
      headless: options.headless !== false,
      fingerprintRandomizer: this.fingerprintRandomizer
    });
    this.retryHandler = new RetryHandler({
      maxRetries: options.maxRetries || 2, // Reduced since we have 3 browsers
      baseDelay: options.baseDelay || 3000 // Updated to 3 seconds
    });
    this.showFingerprint = options.showFingerprint || false; // Default to false
  }

  async close() {
    await this.browserManager.closeAll();
  }

  async scrapeProduct(url) {
    let retailerConfig = null;
    let startTime = Date.now();
    
    try {
      // Detect retailer configuration
      retailerConfig = await this.retailerManager.detectRetailer(url);
      console.log(`🏪 Detected retailer: ${retailerConfig.name} (${retailerConfig.domain})`);
      
      return await this.retryHandler.execute(async (attempt) => {
        return await this._scrapeProductAttempt(url, attempt, retailerConfig);
      });
    } catch (error) {
      console.error('❌ All browser attempts failed:', error.message);
      
      // Record failed attempt
      if (retailerConfig) {
        await this.database.recordScrapeAttempt({
          retailerId: retailerConfig.id,
          url: url,
          success: false,
          errorMessage: error.message,
          errorType: this._classifyError(error.message),
          responseTime: Date.now() - startTime
        });
      }
      
      return null;
    }
  }

  async _scrapeProductAttempt(url, attempt = 0, retailerConfig) {
    const startTime = Date.now();
    
    // Get browser type for this attempt
    const browserType = this.browserManager.getBrowserType(attempt);
    const browser = await this.browserManager.getBrowser(browserType);

    if (attempt > 0) {
      console.log(`🔄 Attempt ${attempt + 1} using ${browserType.toUpperCase()} for ${url}`);
    } else {
      console.log(`🔍 Scraping with ${browserType.toUpperCase()}: ${url}`);
    }

    // Generate browser-specific context options
    const contextOptions = this.browserManager.generateContextOptions(browserType, attempt);

    // Log randomized fingerprint details
    if (this.showFingerprint) {
      console.log('\n🎭 Randomized Browser Fingerprint:');
      console.log(`   User Agent: ${contextOptions.userAgent}`);
      console.log(`   Viewport: ${contextOptions.viewport.width}x${contextOptions.viewport.height}`);
      console.log(`   Locale: ${contextOptions.locale}`);
      console.log(`   Timezone: ${contextOptions.timezoneId}`);
      console.log(`   Geolocation: ${contextOptions.geolocation.latitude.toFixed(4)}, ${contextOptions.geolocation.longitude.toFixed(4)}`);
      console.log(`   Color Scheme: ${contextOptions.colorScheme}`);
      console.log('   Headers:', Object.keys(contextOptions.extraHTTPHeaders).join(', '));
      console.log('');
    }

    const context = await browser.newContext(contextOptions);

    const page = await context.newPage();
    let apiData = null;

    // Intercept network requests to find API calls
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('api') && url.includes('product') && response.status() === 200) {
        try {
          const json = await response.json();
          if (json.data && json.data.product && json.data.product.price) {
            console.log('Found price in API response:', json.data.product.price);
            apiData = json.data.product;
          }
        } catch (e) {}
      }
    });

    try {
      // Apply browser-specific fingerprint
      const fingerprintScript = this.browserManager.generateFingerprintScript(browserType, attempt);
      await page.addInitScript(fingerprintScript);

      // Log detailed fingerprint information
      if (this.showFingerprint) {
        const fpDetails = this.fingerprintRandomizer.getLastFingerprintDetails();
        console.log(`🔧 ${browserType.toUpperCase()} Fingerprint Randomization:`);
        console.log(`   Screen Resolution: ${fpDetails.screenRes.width}x${fpDetails.screenRes.height}`);
        console.log(`   Color Depth: ${fpDetails.colorDepth}-bit`);
        console.log(`   CPU Cores: ${fpDetails.hardwareConcurrency}`);
        console.log(`   Device Memory: ${fpDetails.deviceMemory}GB`);
        console.log(`   Touch Points: ${fpDetails.maxTouchPoints}`);
        console.log(`   WebGL Vendor: ${fpDetails.webglVendor}`);
        console.log(`   WebGL Renderer: ${fpDetails.webglRenderer}`);
        console.log(`   Browser Plugins: ${fpDetails.pluginCount} plugins`);
        console.log('');
      }

      // Navigate with retry logic
      const retry = this.retryHandler.createScrapingRetry();
      await retry.navigation(async (attempt) => {
        const waitUntil = attempt === 0 ? 'domcontentloaded' : 'load';
        const timeout = 15000 + (attempt * 5000); // Increase timeout on retries
        
        if (attempt > 0) {
          console.log(`   Navigation attempt ${attempt + 1} using '${waitUntil}' strategy`);
        }
        
        await page.goto(url, { waitUntil, timeout });
      });

      // Add random delays to mimic human behavior
      await page.waitForTimeout(Math.random() * 2000 + 4000);

      // Check if we got blocked
      const pageTitle = await page.title();
      if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked') || pageTitle.includes('403')) {
        throw new Error('Access denied - site is blocking the scraper');
      }

      // Get retailer-specific selectors
      const priceSelectors = this.retailerManager.getSelectorsForType(retailerConfig, 'price');
      const titleSelectors = this.retailerManager.getSelectorsForType(retailerConfig, 'title');
      
      // Extract product data with retry logic
      const productData = await retry.extraction(async (attempt) => {
        if (attempt > 0) {
          console.log(`   Data extraction attempt ${attempt + 1}`);
          // Add extra wait time on retries in case page is still loading
          await page.waitForTimeout(2000);
        }

        return await page.evaluate((selectorConfig) => {

        const findElement = (selectors, type) => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return null;
        };

        const findJsonData = () => {
          // Look for JSON-LD structured data
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of jsonLdScripts) {
            try {
              const data = JSON.parse(script.textContent);
              if (data.offers && data.offers.price) {
                return data.offers.price;
              }
            } catch (e) {}
          }

          // Look for embedded data in script tags
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.textContent || '';

            // Look for price in various data patterns
            const pricePatterns = [
              /"price":\s*"?\$?([0-9,]+\.?\d*)"?/,
              /"current_retail":\s*"?\$?([0-9,]+\.?\d*)"?/,
              /"list_price":\s*"?\$?([0-9,]+\.?\d*)"?/,
              /"sale_price":\s*"?\$?([0-9,]+\.?\d*)"?/
            ];

            for (const pattern of pricePatterns) {
              const match = content.match(pattern);
              if (match) {
                return `$${match[1]}`;
              }
            }
          }

          return null;
        };

        const title = findElement(selectorConfig.title, 'title');
        const price = findElement(selectorConfig.price, 'price') || findJsonData();

          return {
            title: title?.replace(/This item is not available.*$/i, '').trim(),
            price: price,
            url: window.location.href
          };
        }, { price: priceSelectors, title: titleSelectors });
      });

      // Validate extracted data - require both title and price for valid product
      if (!productData || !productData.title || !productData.price) {
        throw new Error('Incomplete product data - missing title or price, may indicate site blocking or selector issues');
      }

      const priceMatch = productData.price?.match(/[\d,]+\.?\d*/);
      const cleanPrice = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

      // Record successful attempt
      const responseTime = Date.now() - startTime;
      await this.database.recordScrapeAttempt({
        retailerId: retailerConfig.id,
        url: url,
        success: true,
        browserUsed: browserType,
        responseTime: responseTime
      });

      // Update selector success rates
      await this.retailerManager.updateSelectorStats(retailerConfig.id, 'price', true);
      await this.retailerManager.updateSelectorStats(retailerConfig.id, 'title', true);

      return {
        ...productData,
        price: cleanPrice,
        retailerId: retailerConfig.id,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      // Let the retry handler manage the error and browser switching
      throw error;
    } finally {
      await page.close();
      await context.close();
    }
  }

  /**
   * Classify error type for analytics
   * @param {string} message - Error message
   * @returns {string} Error type
   */
  _classifyError(message) {
    const msg = message.toLowerCase();
    
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('connection')) {
      return 'network';
    }
    if (msg.includes('blocked') || msg.includes('access denied') || msg.includes('403')) {
      return 'bot_detection';
    }
    if (msg.includes('incomplete product data') || msg.includes('missing title or price')) {
      return 'parsing';
    }
    if (msg.includes('navigation') || msg.includes('page.goto')) {
      return 'navigation';
    }
    
    return 'unknown';
  }
}

module.exports = ProductScraper;