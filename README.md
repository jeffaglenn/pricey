# Pricey - Simple Product Price Scraper

A minimal CLI tool for scraping product prices from e-commerce websites using Safari/WebKit browser engine.

## Usage

### Scrape a product
```bash
node index.js scrape <product-url>

# Enable debug mode to see fingerprint randomization
node index.js scrape --debug <product-url>
```


### List all scraped products
```bash
node index.js list
```

### Check if a URL has been scraped
```bash
node index.js check <product-url>
```

### Help
```bash
node index.js --help
```

## Examples

```bash
# Scrape a product
node index.js scrape "https://www.target.com/p/lego-product/123"

# Scrape with debug output (shows fingerprint randomization)
node index.js scrape --debug "https://www.target.com/p/lego-product/123"

# List all products
node index.js list

# Check if already scraped
node index.js check "https://www.target.com/p/lego-product/123"
```

## Features

- **Safari/WebKit engine** - Better success rate against bot detection
- **Advanced fingerprint randomization** - Randomizes browser properties on each session
- **Multi-layer anti-detection** - Navigator spoofing, WebGL masking, canvas randomization
- **SQLite database** - Local storage with price history
- **Multiple price extraction methods** - DOM selectors + JSON data parsing
- **Polite scraping** - Random delays and realistic browser behavior
- **Debug mode** - Optional detailed logging of randomization techniques

## Browser Detection Evasion

### Context-Level Randomization
- **Dynamic User Agents** - Rotates Safari versions and macOS versions
- **Viewport Randomization** - Different screen resolutions each session
- **Geolocation Spoofing** - Random GPS coordinates within major cities
- **Language/Timezone Variation** - Changes locale and timezone per session

### JavaScript-Level Randomization  
- **Hardware Fingerprinting** - Randomizes CPU cores, memory, screen properties
- **WebGL Spoofing** - Varies GPU vendor and renderer information
- **Canvas Fingerprinting** - Adds noise to canvas rendering
- **Audio Context Randomization** - Modifies audio processing fingerprints
- **Plugin Randomization** - Varies browser plugin configurations

### Safari-Specific Evasion
- Uses WebKit engine (less targeted than Chrome)
- Spoofs Safari-specific properties and window objects
- Removes automation indicators
- Realistic browsing behavior patterns


## Next Steps

- Price history tracking and notifications
- Web interface for monitoring
- Support for more e-commerce sites
- Automated price drop alerts

## Legal Note

This scraper is for educational purposes. Always respect robots.txt, terms of service, and rate limits. Consider using official APIs when available.