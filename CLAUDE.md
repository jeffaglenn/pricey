# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pricey is a CLI-based product price scraper that uses Playwright with WebKit/Safari for anti-detection. It stores scraped product data in a local SQLite database.

## Development Commands

```bash
# Install dependencies (includes Playwright browsers)
npm install

# Run the CLI tool
node index.js <command>

# Make globally available (optional)
npm link

# Test scraping (development)
node index.js scrape "https://example-retailer.com/product"
```

## Architecture

### Core Components
- **`index.js`** - CLI interface using Commander.js with three main commands: `scrape`, `list`, `check`
- **`scraper.js`** - ProductScraper class using Playwright WebKit with extensive anti-detection techniques
- **`database.js`** - Database class wrapping SQLite operations for product storage

### Data Flow
1. CLI command parsed → ProductScraper and Database instances created
2. WebKit browser launched with Safari spoofing → product page scraped
3. Multiple extraction strategies: DOM selectors, JSON-LD, script mining, API interception
4. Data validated and saved to SQLite with INSERT OR REPLACE (URL as unique key)

### Database Schema
```sql
products (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  price REAL,
  url TEXT NOT NULL UNIQUE,
  scraped_at TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Anti-Detection Strategy

Uses WebKit instead of Chrome with comprehensive Safari spoofing:
- Navigator properties (webdriver removal, platform, vendor, plugins)
- WebGL fingerprint spoofing (Apple GPU identifiers)
- Safari-specific window.safari object
- Human-like delays (4-6 seconds) and realistic headers
- Non-headless mode for better success rates

## Price Extraction Methods

The scraper uses multiple fallback strategies:
1. **DOM selectors**: 30+ price selectors covering major e-commerce sites
2. **JSON-LD structured data**: Schema.org product markup
3. **Script mining**: Regular expressions to find prices in JavaScript variables
4. **API interception**: Network request monitoring for product APIs

## Key Patterns

- **Error handling**: Each component handles failures gracefully and returns null/meaningful errors
- **Resource cleanup**: Browser contexts and database connections properly closed in finally blocks  
- **Data validation**: Title and price required before database storage
- **URL uniqueness**: Products identified by URL, existing entries updated on re-scrape

## Dependencies

- **commander**: CLI framework for argument parsing
- **playwright**: Browser automation (WebKit engine specifically)
- **sqlite3**: Local database storage

## Development Notes

- Database auto-created on first run as `products.db`
- Runs in non-headless mode for debugging and better success rates
- WebKit/Safari engine chosen for better anti-bot evasion than Chrome
- No external APIs or services required - fully self-contained
- Best performance on macOS for Safari spoofing authenticity