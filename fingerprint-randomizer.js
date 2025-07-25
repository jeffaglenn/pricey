/**
 * Browser Fingerprint Randomization Module
 * Generates randomized browser properties to evade detection
 */

class FingerprintRandomizer {
  constructor() {
    this.macVersions = ['10_15_7', '11_7_10', '12_6_8', '13_6_7', '14_5'];
    this.safariVersions = ['16.6', '17.0', '17.1', '17.2', '17.3'];
    this.webkitVersions = ['537.36', '605.1.15', '618.2.12'];
    this.timezones = [
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Toronto', 'Europe/London', 'Europe/Paris', 'Australia/Sydney'
    ];
    this.languages = ['en-US', 'en-GB', 'en-CA', 'fr-FR', 'de-DE', 'es-ES'];
    this.screenResolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 2560, height: 1440 },
      { width: 1680, height: 1050 }
    ];
  }

  /**
   * Generate randomized context options for Playwright
   */
  generateContextOptions() {
    const macVersion = this.randomChoice(this.macVersions);
    const safariVersion = this.randomChoice(this.safariVersions);
    const webkitVersion = this.randomChoice(this.webkitVersions);
    const timezone = this.randomChoice(this.timezones);
    const language = this.randomChoice(this.languages);
    const resolution = this.randomChoice(this.screenResolutions);

    // Add some randomness to viewport
    const viewportWidth = resolution.width + this.randomInt(-100, 100);
    const viewportHeight = resolution.height + this.randomInt(-50, 50);

    return {
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Version/${safariVersion} Safari/${webkitVersion}`,
      viewport: { 
        width: Math.max(1024, viewportWidth), 
        height: Math.max(768, viewportHeight) 
      },
      locale: language,
      timezoneId: timezone,
      permissions: ['geolocation'],
      geolocation: this.generateRandomGeolocation(),
      extraHTTPHeaders: this.generateRandomHeaders(language),
      colorScheme: this.randomChoice(['light', 'dark', 'no-preference']),
      reducedMotion: this.randomChoice(['reduce', 'no-preference']),
      forcedColors: this.randomChoice(['active', 'none'])
    };
  }

  /**
   * Get fingerprint details for logging
   */
  getLastFingerprintDetails() {
    return this.lastFingerprint || {};
  }

  /**
   * Generate browser fingerprint randomization script
   */
  generateFingerprintScript() {
    const screenRes = this.randomChoice(this.screenResolutions);
    const colorDepth = this.randomChoice([24, 32]);
    const hardwareConcurrency = this.randomChoice([4, 8, 12, 16]);
    const deviceMemory = this.randomChoice([4, 8, 16, 32]);
    const maxTouchPoints = this.randomChoice([0, 1, 5, 10]);
    const webglVendor = this.randomChoice(['Apple Inc.', 'Apple Computer, Inc.']);
    const webglRenderer = this.randomChoice(['Apple GPU', 'Apple M1', 'Apple M2', 'AMD Radeon Pro 5500M']);
    const plugins = this.generateRandomPlugins();

    // Store details for logging
    this.lastFingerprint = {
      screenRes,
      colorDepth,
      hardwareConcurrency,
      deviceMemory,
      maxTouchPoints,
      webglVendor,
      webglRenderer,
      pluginCount: plugins.length
    };

    return `
      // Screen properties randomization
      Object.defineProperty(screen, 'width', { get: () => ${screenRes.width} });
      Object.defineProperty(screen, 'height', { get: () => ${screenRes.height} });
      Object.defineProperty(screen, 'availWidth', { get: () => ${screenRes.width} });
      Object.defineProperty(screen, 'availHeight', { get: () => ${screenRes.height - 23} });
      Object.defineProperty(screen, 'colorDepth', { get: () => ${colorDepth} });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${colorDepth} });

      // Hardware properties
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${hardwareConcurrency} });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => ${deviceMemory} });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => ${maxTouchPoints} });

      // Remove automation indicators
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      delete window.chrome;

      // Canvas fingerprint randomization
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const result = originalToDataURL.apply(this, args);
        // Add subtle noise to canvas data
        const noise = Math.random() * 0.00001;
        return result.replace(/data:image\\/png;base64,/, \`data:image/png;base64,\${noise}\`);
      };

      // WebGL fingerprint randomization
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        const randomVendors = ['Apple Inc.', 'Apple Computer, Inc.'];
        const randomRenderers = [
          'Apple GPU', 'Apple M1', 'Apple M2', 'AMD Radeon Pro 5500M',
          'Intel Iris Pro Graphics 6200', 'NVIDIA GeForce GTX 1650'
        ];

        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return '${webglVendor}';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return '${webglRenderer}';
        }
        return getParameter.call(this, parameter);
      };

      // Audio context fingerprint randomization
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
        AudioContext.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.call(this);
          const originalGetFrequencyData = analyser.getFrequencyData;
          analyser.getFrequencyData = function(array) {
            originalGetFrequencyData.call(this, array);
            // Add slight randomization to audio data
            for (let i = 0; i < array.length; i++) {
              array[i] += Math.random() * 0.1;
            }
          };
          return analyser;
        };
      }

      // Randomize plugin list
      const plugins = ${JSON.stringify(plugins)};
      Object.defineProperty(navigator, 'plugins', {
        get: () => plugins
      });

      // Battery API randomization (if available)
      if ('getBattery' in navigator) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = function() {
          return originalGetBattery.call(this).then(battery => {
            Object.defineProperty(battery, 'level', { 
              get: () => ${(Math.random() * 0.5 + 0.5).toFixed(2)} 
            });
            Object.defineProperty(battery, 'charging', { 
              get: () => ${Math.random() > 0.5} 
            });
            return battery;
          });
        };
      }

      // Date/Time randomization (subtle)
      const originalDate = Date;
      Date = function(...args) {
        if (args.length === 0) {
          // Add random milliseconds offset (-5 to +5 seconds)
          const offset = ${this.randomInt(-5000, 5000)};
          return new originalDate(originalDate.now() + offset);
        }
        return new originalDate(...args);
      };
      Object.setPrototypeOf(Date, originalDate);
      Object.defineProperty(Date, 'now', {
        value: () => originalDate.now() + ${this.randomInt(-1000, 1000)}
      });
    `;
  }

  /**
   * Generate random geolocation
   */
  generateRandomGeolocation() {
    const locations = [
      { longitude: -74.006, latitude: 40.7128 }, // New York
      { longitude: -118.2437, latitude: 34.0522 }, // Los Angeles  
      { longitude: -87.6298, latitude: 41.8781 }, // Chicago
      { longitude: -122.4194, latitude: 37.7749 }, // San Francisco
      { longitude: -71.0589, latitude: 42.3601 }, // Boston
    ];
    
    const baseLocation = this.randomChoice(locations);
    
    // Add random offset within ~10km
    return {
      longitude: baseLocation.longitude + (Math.random() - 0.5) * 0.1,
      latitude: baseLocation.latitude + (Math.random() - 0.5) * 0.1
    };
  }

  /**
   * Generate randomized HTTP headers
   */
  generateRandomHeaders(language) {
    const acceptLanguages = {
      'en-US': 'en-US,en;q=0.9',
      'en-GB': 'en-GB,en;q=0.9,en-US;q=0.8',
      'fr-FR': 'fr-FR,fr;q=0.9,en;q=0.8',
      'de-DE': 'de-DE,de;q=0.9,en;q=0.8',
      'es-ES': 'es-ES,es;q=0.9,en;q=0.8'
    };

    return {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': acceptLanguages[language] || acceptLanguages['en-US'],
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': this.randomChoice(['none', 'same-origin', 'cross-site']),
      'Sec-Fetch-User': '?1',
      'Cache-Control': this.randomChoice(['max-age=0', 'no-cache', 'no-store']),
      'DNT': Math.random() > 0.5 ? '1' : undefined // Do Not Track
    };
  }

  /**
   * Generate random Safari-like plugins
   */
  generateRandomPlugins() {
    const basePlugins = [
      { name: 'WebKit built-in PDF', filename: 'WebKit built-in PDF' },
      { name: 'PDF Viewer', filename: 'pdf.js' },
      { name: 'Chrome PDF Viewer', filename: 'pdf' }
    ];

    const optionalPlugins = [
      { name: 'QuickTime Plugin', filename: 'QuickTime Plugin.plugin' },
      { name: 'Java Applet Plug-in', filename: 'JavaAppletPlugin.plugin' },
      { name: 'Silverlight Plug-In', filename: 'Silverlight.plugin' }
    ];

    // Randomly include optional plugins
    const plugins = [...basePlugins];
    optionalPlugins.forEach(plugin => {
      if (Math.random() > 0.5) {
        plugins.push(plugin);
      }
    });

    return plugins;
  }

  /**
   * Utility methods
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomFloat(min, max, decimals = 2) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  }
}

module.exports = FingerprintRandomizer;