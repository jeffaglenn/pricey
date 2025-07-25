const { webkit } = require('playwright');

class ProductScraper {
  constructor() {
    this.browser = null;
  }

  async init() {
    this.browser = await webkit.launch({
      headless: true
      // WebKit/Safari has minimal configuration options
      // Most stealth techniques are handled in the page context
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrapeProduct(url) {
    if (!this.browser) {
      await this.init();
    }

    const contextOptions = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { longitude: 12.492507, latitude: 41.889938 },
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    };

    const context = await this.browser.newContext(contextOptions);

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
      // Safari/WebKit stealth techniques
      await page.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Safari-specific spoofing
        Object.defineProperty(navigator, 'platform', {
          get: () => 'MacIntel'
        });

        // Spoof Safari plugins
        const safariPlugins = [
          { name: 'WebKit built-in PDF', filename: 'WebKit built-in PDF' },
          { name: 'PDF Viewer', filename: 'pdf.js' },
          { name: 'Chrome PDF Viewer', filename: 'pdf' }
        ];

        Object.defineProperty(navigator, 'plugins', {
          get: () => safariPlugins
        });

        // Spoof Safari vendor
        Object.defineProperty(navigator, 'vendor', {
          get: () => 'Apple Computer, Inc.'
        });

        // Remove Chrome-specific properties
        delete window.chrome;

        // Spoof WebGL for Safari
        const getParameter = WebGLRenderingContext.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Apple Inc.';
          }
          if (parameter === 37446) {
            return 'Apple GPU';
          }
          return getParameter(parameter);
        };

        // Safari-specific properties
        Object.defineProperty(window, 'safari', {
          value: {
            pushNotification: {
              toString: () => '[object SafariRemoteNotification]'
            }
          }
        });
      });

      // Try multiple navigation strategies
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (error) {
        console.log('First attempt failed, trying with load event...');
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      }

      // Add random delays to mimic human behavior
      await page.waitForTimeout(Math.random() * 2000 + 4000);

      // Check if we got blocked
      const pageTitle = await page.title();
      if (pageTitle.includes('Access Denied') || pageTitle.includes('Blocked') || pageTitle.includes('403')) {
        console.log('⚠️  Site is blocking the scraper. Try a different site or use headless: false for manual testing.');
        return null;
      }

      const productData = await page.evaluate(() => {
        const selectors = {
          price: [
            '[data-test="product-price"]',
            '[data-test="product-price-value"]',
            '[data-testid="price"]',
            'span[data-test*="price"]',
            'div[data-test*="price"]',
            '.h-display-xs',
            '.h-text-red',
            '.h-text-lg',
            '[class*="Price"]',
            '.price',
            '[class*="price"]',
            '[id*="price"]',
            '.a-price-whole',
            '.notranslate',
            '.our-price-1',
            '[data-fs-element="price"]',
            '.our-price',
            '.price-display',
            '.sale-price',
            '.current-price',
            '.details-our-price',
            '.section-title',
            '.variant-price',
            '.final-price-red-color',
            '.price-digit',
            '.productNameComponent',
            '[data-qaid="pdpProductPriceSale"]',
            '.priceToPay',
            '#pdpPrice'
          ],
          title: [
            '[data-test="product-title"]',
            'h1[data-test]',
            'h1',
            '[data-testid="product-title"]',
            '.product-title',
            '[class*="title"]',
            '#productTitle',
            '#product-title'
          ]
        };

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

        const title = findElement(selectors.title, 'title');
        const price = findElement(selectors.price, 'price') || findJsonData();

        return {
          title: title?.replace(/This item is not available.*$/i, '').trim(),
          price: price,
          url: window.location.href
        };
      });

      const priceMatch = productData.price?.match(/[\d,]+\.?\d*/);
      const cleanPrice = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

      return {
        ...productData,
        price: cleanPrice,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping product:', error.message);
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }
}

module.exports = ProductScraper;