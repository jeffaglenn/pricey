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

### Retailer Management
```bash
# List all configured retailers with success rates
node index.js retailers

# Add a new retailer configuration
node index.js add-retailer -n "Store Name" -d "domain.com" -p "price,selectors" -t "title,selectors"

# Test retailer detection for a URL
node index.js test-retailer <product-url>
```

### Web Dashboard
```bash
# Start the modern web dashboard (development)
npm run api    # Terminal 1 - API server
npm run web    # Terminal 2 - Web dev server

# Visit: http://localhost:5173
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

### Current Configurations
- **Amazon** (amazon.com) - 10 price + 8 title selectors, 3s delay, handles deal prices and variants
- **Target** (target.com) - 8 price + 7 title selectors, 2s delay, data-test attribute selectors  
- **Walmart** (walmart.com) - 10 price + 8 title selectors, 2.5s delay, requires Firefox fallback for bot detection
- **Best Buy** (bestbuy.com) - 4 price + 4 title selectors, standard configuration
- **Generic** - 20 price + 16 title universal selectors for unknown retailers

### Features
- **Automatic detection** - Identifies retailer from URL patterns
- **CLI management commands** - Add, list, and test retailer configurations
- **Database-backed configs** - JSONB storage for flexible retailer settings
- **Success rate tracking** - Real-time analytics showing selector performance per retailer

## Web Dashboard

### Modern Interface
- **Real-time Analytics** - Overview cards showing total products, active retailers, success rates
- **Live Product Scraping** - Add product URLs directly from the web interface
- **Retailer Management** - View all configured retailers with success rate tracking
- **Recent Activity** - Table of latest scraped products with retailer information
- **Auto-refresh** - Dashboard updates every 30 seconds automatically

### Technology Stack
- **Frontend**: Vite + Tailwind CSS + Alpine.js (modern vanilla approach)
- **Backend**: Express.js API reusing existing database classes
- **Development**: Hot reload dev server with API proxy
- **Production**: Optimized static builds with tree-shaking

### Project Structure
```
/pricey/
├── api/
│   └── server.js          # Express API backend
├── web/
│   ├── src/              # Vite frontend source
│   ├── package.json      # Frontend dependencies  
│   └── vite.config.js    # Build configuration
├── database-pg.js        # Shared backend classes
├── retailer-manager.js   # (at project root)
└── scraper.js
```

## Architecture

### CLI Components
- **`index.js`** - CLI interface with scraping, retailer management, and diagnostic commands
- **`scraper.js`** - Multi-browser scraping with anti-detection
- **`database-pg.js`** - PostgreSQL database operations  
- **`retailer-manager.js`** - Retailer detection and configuration management
- **`retry-handler.js`** - Intelligent error classification and retry logic
- **`browser-manager.js`** - Multi-browser management (Safari/Firefox/Chrome)
- **`fingerprint-randomizer.js`** - Advanced browser fingerprint randomization

### Web Components  
- **`api/server.js`** - Express REST API server
- **`web/src/dashboard.js`** - Alpine.js reactive dashboard components
- **`web/src/api.js`** - Frontend API communication layer
- **`web/index.html`** - Modern Tailwind CSS dashboard interface

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

## Recent Updates (January 2025)

### ✅ Completed Features
- **Retailer Management System** - CLI commands for adding, listing, and testing retailer configurations
- **Major Retailer Configurations** - Amazon, Target, Walmart, Best Buy with custom selectors and success rate tracking
- **Modern Web Dashboard** - Vite + Tailwind + Alpine.js interface with real-time analytics
- **Express REST API** - Backend server reusing existing database classes with full CRUD operations
- **Project Restructure** - Clean `api/` and `web/` organization with optimized development workflow

## Future Enhancements

### Near-term
- **Price History Tracking** - Store price changes over time with trend analysis
- **Notification System** - Alerts for price drops and availability changes
- **Enhanced Analytics** - Detailed performance metrics and success rate breakdowns
- **More Retailers** - Additional retailer-specific configurations (Home Depot, Dick's, etc.)

### Long-term
- **Production Deployment** - Single server mode with built static files
- **User Authentication** - Multi-user support with secure login system
- **Automated Monitoring** - Scheduled price checks with email/SMS notifications
- **API Authentication** - Rate limiting and API key management for programmatic access

### High-Volume Scenarios
- Proxy rotation support (for users scraping >10 requests/hour)
- Concurrent multi-product monitoring
- Enterprise-grade rate limiting bypass

*Note: Current implementation targets casual price monitoring (1-2 requests/hour) and doesn't require proxy infrastructure.*

## Legal Note

This scraper is for educational and personal use purposes. Always respect robots.txt, terms of service, and rate limits. Consider using official APIs when available. The multi-browser retry system and respectful timing are designed to minimize server load.