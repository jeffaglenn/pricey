# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pricey is a CLI-based product price scraper that uses Playwright with WebKit/Safari for anti-detection. It stores scraped product data in a PostgreSQL database with database-driven retailer configurations for flexible, scalable scraping.

## Development Commands

```bash
# Install dependencies (includes Playwright browsers and PostgreSQL client)
npm install

# Set up PostgreSQL database
psql -c "CREATE DATABASE pricey;" postgres
psql -d pricey -f schema.sql

# Run the CLI tool
node index.js <command>

# Make globally available (optional)
npm link

# Test scraping (development)
node index.js scrape "https://example-retailer.com/product"

# Debug mode (shows fingerprint randomization)
node index.js scrape --debug "https://example-retailer.com/product"

# Diagnostic commands
node index.js failures     # Show recent failures with error analysis
node index.js stats        # Show success rates and performance metrics
node index.js list         # List all scraped products with retailer info
```

## Architecture

### Core Components
- **`index.js`** - CLI interface using Commander.js with commands: `scrape`, `list`, `check`, `failures`, `stats`
- **`scraper.js`** - ProductScraper class using Playwright WebKit with extensive anti-detection techniques
- **`fingerprint-randomizer.js`** - FingerprintRandomizer class for browser fingerprint randomization
- **`database-pg.js`** - Database class wrapping PostgreSQL operations for product and retailer storage
- **`retailer-manager.js`** - RetailerManager class for database-backed retailer detection and configuration
- **`retry-handler.js`** - RetryHandler class for intelligent error classification and retry strategies
- **`browser-manager.js`** - BrowserManager class for multi-browser retry logic (Safari → Firefox → Chrome)

### Data Flow
1. CLI command parsed → Database and ProductScraper instances created
2. RetailerManager detects retailer from URL → loads database-backed configuration
3. Browser launched with retailer-specific settings and fingerprint randomization
4. Multiple extraction strategies: retailer-specific selectors, JSON-LD, script mining, API interception
5. Data validated and saved to PostgreSQL with retailer relationship
6. Scraping attempts logged for analytics (success/failure, error types, performance metrics)

### Database Schema
```sql
-- Users for future multi-user UI support
users (id SERIAL PRIMARY KEY, username, email, created_at, updated_at)

-- Retailer configurations with JSONB for flexible settings
retailers (id, name, domain, url_patterns JSONB, config JSONB, created_by, is_active)

-- Retailer-specific selectors with fallback chains
retailer_selectors (id, retailer_id, selector_type, selectors JSONB, success_rate, total_attempts)

-- Products with retailer relationship
products (id, title, price, url UNIQUE, retailer_id, raw_data JSONB, scraped_at, created_at)

-- Analytics for all scraping attempts
scrape_attempts (id, retailer_id, product_id, url, success, error_type, browser_used, response_time)
```

## Anti-Detection Strategy

### Browser Fingerprint Randomization
Uses `FingerprintRandomizer` class to randomize browser properties on each session:
- **Context-level**: User agent, viewport, locale, timezone, geolocation, headers
- **JavaScript-level**: Screen properties, hardware info, WebGL, canvas, audio context
- **Dynamic properties**: CPU cores, memory, touch points, plugin configurations
- **Timing randomization**: Subtle Date.now() and performance timing variations

### Multi-Browser Retry Strategy
- **Progressive browser switching**: Safari → Firefox → Chrome on failures
- **3-second delays**: Respectful retry timing between attempts
- **Error classification**: Intelligent retry decisions based on error type
- **Browser-specific fingerprinting**: Each browser gets appropriate randomization

### Safari-Specific Spoofing
- WebKit engine (less targeted than Chrome)
- Navigator properties (webdriver removal, platform, vendor)
- Safari-specific window.safari object
- Apple-specific WebGL identifiers
- Human-like delays and realistic headers

## Price Extraction Methods

The scraper uses database-driven extraction strategies:
1. **Retailer-specific selectors**: Custom CSS selectors per retailer loaded from database
2. **Generic fallback selectors**: 20 price + 16 title selectors for unknown retailers
3. **JSON-LD structured data**: Schema.org product markup parsing
4. **Script mining**: Regular expressions to find prices in JavaScript variables
5. **API interception**: Network request monitoring for product APIs

## Retailer Management System

### Retailer Detection
- **URL pattern matching**: Detects retailer from domain and URL patterns
- **Database-backed configs**: Flexible retailer configurations stored in PostgreSQL
- **Caching**: Performance optimization for repeated retailer lookups
- **Generic fallback**: Universal selectors when no specific retailer config exists

### Configuration Storage
- **JSONB flexibility**: Store complex selector arrays, headers, delays as JSON
- **Success rate tracking**: Monitor which selectors work best per retailer
- **Fallback chains**: Multiple selector strategies per retailer with priority ordering
- **UI-ready design**: Supports future web interface for retailer management

## Key Patterns

- **Error handling**: Each component handles failures gracefully with detailed error classification
- **Resource cleanup**: Browser contexts and database connections properly closed in finally blocks  
- **Data validation**: Title and price required before database storage
- **URL uniqueness**: Products identified by URL, existing entries updated on re-scrape
- **Analytics tracking**: All scraping attempts logged for performance monitoring and debugging
- **Intelligent retries**: Different retry strategies based on error type classification

## Dependencies

- **commander**: CLI framework for argument parsing
- **playwright**: Browser automation (WebKit, Firefox, Chromium engines)
- **pg**: PostgreSQL database client for scalable data storage

## Development Notes

- **PostgreSQL database** required - schema auto-created on first connection
- Runs in headless mode by default (use `-v` flag for visible browser)
- **Multi-browser retry**: Safari → Firefox → Chrome with 3-second delays between attempts
- **Retailer detection**: Automatically detects retailer from URL and loads appropriate configuration
- **Generic fallback**: Uses universal selectors when no retailer-specific config exists
- **Error classification**: Intelligent failure analysis (parsing, bot_detection, network, etc.)
- **Analytics tracking**: All scraping attempts logged with success rates and performance metrics
- **Fingerprint randomization**: Unique browser signature per session with debug mode (`--debug`)
- **Diagnostic tools**: `failures` and `stats` commands for troubleshooting and monitoring
- No external APIs or services required - fully self-contained with PostgreSQL
- Best performance on macOS for Safari spoofing authenticity
- **UI-ready architecture**: Database design supports future web interface
- **Proxy support** available as future enhancement for high-volume scenarios (>10 requests/hour)

## Diagnostic Features

### Debug Mode
Use `--debug` flag to see detailed fingerprint randomization:
- User agent and viewport variations
- Hardware specifications (CPU, memory, screen)
- WebGL vendor/renderer information
- Plugin configurations and geolocation data

### Failure Analysis
**`node index.js failures`** - Recent scraping failures with error analysis:
- Error classification (parsing, bot_detection, network, navigation)
- Retailer and browser information
- Detailed error messages and timestamps

### Performance Analytics
**`node index.js stats`** - Success rates and performance metrics:
- Overall success rate over last 30 days
- Error type breakdown with percentages  
- Per-retailer performance statistics

### Error Types
- **`parsing`**: Selectors didn't find title/price (need retailer-specific config)
- **`bot_detection`**: Site is blocking the scraper (403/blocked errors)
- **`navigation`**: Network/DNS issues (site unreachable)
- **`network`**: Connection timeouts
- **`unknown`**: Other unclassified errors

## Configuration Management

### Generic Selectors
- **Price selectors**: 20 universal CSS selectors (`.price`, `[class*="price"]`, `.sale-price`, etc.)
- **Title selectors**: 16 universal CSS selectors (`h1`, `h2`, `.product-title`, `[class*="title"]`, etc.)
- **Cleaned up**: Removed site-specific selectors to create cleaner fallback behavior

### Retailer-Specific Configs
- **Future expansion**: Ready to add custom selectors for Dick's, Amazon, Target, etc.
- **Database-driven**: Easy to add new retailers without code changes
- **Success rate tracking**: Monitor and optimize selector performance over time
- **Priority-based**: Multiple selector strategies with fallback chains per retailer