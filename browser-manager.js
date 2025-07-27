/**
 * Browser Manager - Handles multiple browser engines for retry strategies
 * Progressively switches from Safari → Firefox → Chrome on failures
 */

const { webkit, firefox, chromium } = require('playwright');

class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.browsers = new Map(); // Store browser instances
    this.browserOrder = ['safari', 'firefox', 'chrome'];
    this.fingerprintRandomizer = options.fingerprintRandomizer;
  }

  /**
   * Get the appropriate browser engine for the attempt number
   */
  getBrowserType(attempt = 0) {
    const index = Math.min(attempt, this.browserOrder.length - 1);
    return this.browserOrder[index];
  }

  /**
   * Get browser engine instance
   */
  async getBrowser(browserType) {
    if (this.browsers.has(browserType)) {
      return this.browsers.get(browserType);
    }

    let browser;
    let launchOptions = { headless: this.headless };

    switch (browserType) {
      case 'safari':
        browser = await webkit.launch(launchOptions);
        break;
      case 'firefox':
        browser = await firefox.launch(launchOptions);
        break;
      case 'chrome':
        browser = await chromium.launch(launchOptions);
        break;
      default:
        throw new Error(`Unknown browser type: ${browserType}`);
    }

    this.browsers.set(browserType, browser);
    return browser;
  }

  /**
   * Generate browser-specific context options
   */
  generateContextOptions(browserType, attempt = 0) {
    const baseOptions = this.fingerprintRandomizer.generateContextOptions();

    switch (browserType) {
      case 'safari':
        return this.getSafariOptions(baseOptions, attempt);
      case 'firefox':
        return this.getFirefoxOptions(baseOptions, attempt);
      case 'chrome':
        return this.getChromeOptions(baseOptions, attempt);
      default:
        return baseOptions;
    }
  }

  /**
   * Safari/WebKit specific options
   */
  getSafariOptions(baseOptions, attempt) {
    const safariVersions = ['17.0', '17.1', '17.2', '17.3'];
    const webkitVersions = ['605.1.15', '618.2.12', '618.3.7'];
    const macVersions = ['10_15_7', '11_7_10', '12_6_8', '13_6_7', '14_5'];

    const safariVersion = this.randomChoice(safariVersions);
    const webkitVersion = this.randomChoice(webkitVersions);
    const macVersion = this.randomChoice(macVersions);

    return {
      ...baseOptions,
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Version/${safariVersion} Safari/${webkitVersion}`,
      extraHTTPHeaders: {
        ...baseOptions.extraHTTPHeaders,
        'sec-ch-ua': `"Safari";v="${safariVersion}", "WebKit";v="${webkitVersion}"`,
        'sec-ch-ua-platform': '"macOS"',
        'sec-ch-ua-mobile': '?0'
      }
    };
  }

  /**
   * Firefox specific options
   */
  getFirefoxOptions(baseOptions, attempt) {
    const firefoxVersions = ['119.0', '120.0', '121.0', '122.0'];
    const geckoVersions = ['20100101'];

    const firefoxVersion = this.randomChoice(firefoxVersions);
    const geckoVersion = this.randomChoice(geckoVersions);

    return {
      ...baseOptions,
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${firefoxVersion}) Gecko/${geckoVersion} Firefox/${firefoxVersion}`,
      extraHTTPHeaders: {
        ...baseOptions.extraHTTPHeaders,
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
      }
    };
  }

  /**
   * Chrome specific options
   */
  getChromeOptions(baseOptions, attempt) {
    const chromeVersions = ['119.0.6045.199', '120.0.6099.109', '121.0.6167.85'];
    const chromeVersion = this.randomChoice(chromeVersions);
    const majorVersion = chromeVersion.split('.')[0];

    return {
      ...baseOptions,
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      extraHTTPHeaders: {
        ...baseOptions.extraHTTPHeaders,
        'sec-ch-ua': `"Google Chrome";v="${majorVersion}", "Chromium";v="${majorVersion}", "Not=A?Brand";v="99"`,
        'sec-ch-ua-platform': '"macOS"',
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1'
      }
    };
  }

  /**
   * Generate browser-specific fingerprint script
   */
  generateFingerprintScript(browserType, attempt = 0) {
    const baseScript = this.fingerprintRandomizer.generateFingerprintScript();
    
    switch (browserType) {
      case 'safari':
        return this.getSafariScript(baseScript);
      case 'firefox':
        return this.getFirefoxScript(baseScript);
      case 'chrome':
        return this.getChromeScript(baseScript);
      default:
        return baseScript;
    }
  }

  /**
   * Safari-specific fingerprint script
   */
  getSafariScript(baseScript) {
    return baseScript + `
      // Safari-specific properties
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel'
      });

      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Apple Computer, Inc.'
      });

      Object.defineProperty(window, 'safari', {
        value: {
          pushNotification: {
            toString: () => '[object SafariRemoteNotification]'
          }
        }
      });

      // Remove Chrome-specific properties
      delete window.chrome;
      delete navigator.webkitTemporaryStorage;
      delete navigator.webkitPersistentStorage;
    `;
  }

  /**
   * Firefox-specific fingerprint script
   */
  getFirefoxScript(baseScript) {
    return baseScript + `
      // Firefox-specific properties
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel'
      });

      Object.defineProperty(navigator, 'vendor', {
        get: () => ''
      });

      Object.defineProperty(navigator, 'buildID', {
        get: () => '20${new Date().getFullYear()}0101'
      });

      // Remove Safari and Chrome properties
      delete window.safari;
      delete window.chrome;
      delete navigator.webkitTemporaryStorage;
      delete navigator.webkitPersistentStorage;

      // Firefox-specific WebGL
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Mozilla';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'Mozilla Firefox';
        }
        return getParameter.call(this, parameter);
      };
    `;
  }

  /**
   * Chrome-specific fingerprint script
   */
  getChromeScript(baseScript) {
    return baseScript + `
      // Chrome-specific properties
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel'
      });

      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.'
      });

      // Chrome object
      Object.defineProperty(window, 'chrome', {
        value: {
          runtime: {
            onConnect: undefined,
            onMessage: undefined
          }
        }
      });

      // Remove Safari properties
      delete window.safari;

      // Chrome-specific WebGL
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Google Inc. (Apple)';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)';
        }
        return getParameter.call(this, parameter);
      };
    `;
  }

  /**
   * Close all browser instances
   */
  async closeAll() {
    const closingPromises = [];
    for (const [type, browser] of this.browsers) {
      console.log(`Closing ${type} browser...`);
      closingPromises.push(browser.close());
    }
    
    if (closingPromises.length > 0) {
      await Promise.all(closingPromises);
    }
    
    this.browsers.clear();
  }

  /**
   * Utility method
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
}

module.exports = BrowserManager;