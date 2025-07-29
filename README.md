# Pricey - Advanced Product Price Scraper

A powerful CLI tool for scraping product prices from e-commerce websites using multi-browser anti-detection and database-driven retailer configurations.

## Prerequisites

- **Node.js** (v16 or higher)
- **PostgreSQL** (for database storage)

## Installation

```bash
# Install dependencies
npm install

# Set up PostgreSQL database
psql -c "CREATE DATABASE pricey;" postgres
psql -d pricey -f schema.sql
```

## Commands

### Core Scraping
```bash
# Scrape a product
node index.js scrape <product-url>

# Enable debug mode to see fingerprint randomization
node index.js scrape --debug <product-url>

# Run browser in visible mode (default: headless)
node index.js scrape -v <product-url>
```

### Product Management
```bash
# List all scraped products with retailer information
node index.js list

# Check if a URL has been scraped before
node index.js check <product-url>
```

### Diagnostic Tools
```bash
# Show recent scraping failures with error analysis
node index.js failures

# Show recent failures (limit to 5)
node index.js failures -n 5

# Show success rates and performance statistics
node index.js stats
```

### Help
```bash
node index.js --help
```

## Examples

```bash
# Basic scraping
node index.js scrape "https://www.patagonia.com/product/mens-jacket/123"

# Debug mode with visible browser
node index.js scrape --debug -v "https://www.target.com/p/product/456"

# Check recent failures and their causes
node index.js failures

# View performance statistics
node index.js stats

# List all products with retailer information
node index.js list
```

## Features

### Anti-Detection System
- **Multi-browser retry** - Safari → Firefox → Chrome progression on failures
- **Advanced fingerprint randomization** - Unique browser signature per session
- **Intelligent error classification** - Distinguishes between bot detection, network issues, and parsing problems
- **3-second retry delays** - Respectful timing between attempts

### Database-Driven Architecture
- **PostgreSQL storage** - Scalable database with retailer configurations
- **Retailer detection** - Automatic identification and configuration loading
- **Generic fallback** - 20 price + 16 title universal selectors for unknown retailers
- **Analytics tracking** - Complete logging of all scraping attempts with performance metrics

### Browser Detection Evasion

#### Context-Level Randomization
- **Dynamic User Agents** - Rotates Safari, Firefox, and Chrome versions
- **Viewport Randomization** - Different screen resolutions each session
- **Geolocation Spoofing** - Random GPS coordinates within major cities
- **Language/Timezone Variation** - Changes locale and timezone per session

#### JavaScript-Level Randomization  
- **Hardware Fingerprinting** - Randomizes CPU cores, memory, screen properties
- **WebGL Spoofing** - Varies GPU vendor and renderer information
- **Canvas Fingerprinting** - Adds noise to canvas rendering
- **Audio Context Randomization** - Modifies audio processing fingerprints
- **Plugin Randomization** - Varies browser plugin configurations

#### Safari-Specific Evasion
- Uses WebKit engine (less targeted than Chrome)
- Spoofs Safari-specific properties and window objects
- Removes automation indicators
- Realistic browsing behavior patterns

## Failure Analysis

The system classifies failures into specific error types for easier troubleshooting:

- **`parsing`** - Selectors didn't find title/price (need retailer-specific config)
- **`bot_detection`** - Site is actively blocking the scraper (403/blocked errors)
- **`navigation`** - Network/DNS issues (site unreachable)
- **`network`** - Connection timeouts
- **`unknown`** - Other unclassified errors

Use `node index.js failures` to see detailed error analysis and `node index.js stats` for performance metrics.

## Retailer System

### Current Status
- **Generic retailer** - Universal selectors work across most e-commerce sites
- **Automatic detection** - Identifies retailer from URL patterns
- **Database-backed configs** - Easy to add retailer-specific configurations
- **Success rate tracking** - Monitors selector performance over time

### Future Expansion
Ready to add retailer-specific configurations for:
- Dick's Sporting Goods
- Amazon (handle dynamic loading, variants)
- Target (bypass bot detection)
- Best Buy (handle stock availability)
- Walmart (price display variations)
- Home Depot (professional vs consumer pricing)

## Architecture

### Core Components
- **`index.js`** - CLI interface with all commands
- **`scraper.js`** - Multi-browser scraping with anti-detection
- **`database-pg.js`** - PostgreSQL database operations  
- **`retailer-manager.js`** - Retailer detection and configuration management
- **`retry-handler.js`** - Intelligent error classification and retry logic
- **`browser-manager.js`** - Multi-browser management (Safari/Firefox/Chrome)
- **`fingerprint-randomizer.js`** - Advanced browser fingerprint randomization

### Database Schema
- **retailers** - Retailer configurations with JSONB settings
- **retailer_selectors** - CSS selectors with success rate tracking
- **products** - Scraped products with retailer relationships
- **scrape_attempts** - Complete analytics for all scraping attempts
- **users** - Multi-user support for future UI

## Performance Monitoring

### Success Rate Tracking
```bash
# View overall statistics
node index.js stats

# Output example:
📊 Scraping Statistics (Last 30 Days)
Total Attempts: 25
Successful: 18 (72.00%)
Failed: 7 (28%)

🔍 Failure Breakdown:
   parsing: 4 (57.14%)
   bot_detection: 2 (28.57%)
   network: 1 (14.29%)

🏪 Retailer Performance:
   Generic: 18/25 (72.00%)
```

### Failure Analysis
```bash
# View recent failures with details
node index.js failures

# Output example:
❌ Recent failures (2):

1. dickssportinggoods.com
   Error Type: parsing
   Retailer: Generic
   Browser: N/A
   When: 7/28/2025, 10:00:51 PM
   Details: Incomplete product data - missing title or price, may indicate site blocking or selector issues
```

## Future Enhancements

### Near-term
- CLI commands for adding custom retailers
- Retailer-specific selector configurations
- Price history tracking and notifications
- Enhanced success rate analytics

### Long-term
- Web interface for retailer management
- Multi-user support with authentication
- Automated price drop alerts
- API endpoints for programmatic access

### High-Volume Scenarios
- Proxy rotation support (for users scraping >10 requests/hour)
- Concurrent multi-product monitoring
- Enterprise-grade rate limiting bypass

*Note: Current implementation targets casual price monitoring (1-2 requests/hour) and doesn't require proxy infrastructure.*

## Legal Note

This scraper is for educational and personal use purposes. Always respect robots.txt, terms of service, and rate limits. Consider using official APIs when available. The multi-browser retry system and respectful timing are designed to minimize server load.