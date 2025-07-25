# Pricey - Simple Product Price Scraper

A minimal CLI tool for scraping product prices from e-commerce websites using Safari/WebKit browser engine.

## Usage

### Scrape a product
```bash
node index.js scrape <product-url>
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

# List all products
node index.js list

# Check if already scraped
node index.js check "https://www.target.com/p/lego-product/123"
```

## Features

- **Safari/WebKit engine** - Better success rate against bot detection
- **Advanced stealth techniques** - Navigator spoofing, WebGL masking
- **SQLite database** - Local storage with price history
- **Multiple price extraction methods** - DOM selectors + JSON data parsing
- **Polite scraping** - Random delays and realistic browser behavior

## Browser Detection Evasion

- Uses Safari/WebKit (less targeted than Chrome)
- Spoofs Safari-specific properties and plugins
- Removes automation indicators
- Randomized delays and realistic user behavior


## Next Steps

- Price history tracking and notifications
- Web interface for monitoring
- Support for more e-commerce sites
- Automated price drop alerts

## Legal Note

This scraper is for educational purposes. Always respect robots.txt, terms of service, and rate limits. Consider using official APIs when available.