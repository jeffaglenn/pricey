-- PostgreSQL Schema for Pricey Price Scraper
-- Run this file to create the initial database schema

-- Users table for future UI multi-user support
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retailers with JSONB configuration support
CREATE TABLE retailers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE,
    url_patterns JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of URL patterns to match
    config JSONB NOT NULL DEFAULT '{}'::JSONB, -- Headers, delays, custom settings
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Retailer-specific selectors with fallback chains
CREATE TABLE retailer_selectors (
    id SERIAL PRIMARY KEY,
    retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    selector_type VARCHAR(50) NOT NULL, -- 'price', 'title', 'availability', etc.
    selectors JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of selectors in priority order
    success_rate DECIMAL(5,2) DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 100),
    total_attempts INTEGER DEFAULT 0,
    successful_attempts INTEGER DEFAULT 0,
    last_tested TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Products table with retailer relationship
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    price DECIMAL(10,2),
    url TEXT NOT NULL UNIQUE,
    retailer_id INTEGER REFERENCES retailers(id),
    raw_data JSONB, -- Store raw scraped data for debugging
    scraped_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraping attempts for analytics and debugging
CREATE TABLE scrape_attempts (
    id SERIAL PRIMARY KEY,
    retailer_id INTEGER REFERENCES retailers(id),
    product_id INTEGER REFERENCES products(id),
    url TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_type VARCHAR(50), -- 'network', 'parsing', 'bot_detection', etc.
    browser_used VARCHAR(20), -- 'safari', 'firefox', 'chrome'
    response_time INTEGER, -- milliseconds
    selectors_tried JSONB, -- Which selectors were attempted
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_retailers_domain ON retailers(domain);
CREATE INDEX idx_retailers_active ON retailers(is_active);
CREATE INDEX idx_retailer_selectors_retailer_id ON retailer_selectors(retailer_id);
CREATE INDEX idx_retailer_selectors_type ON retailer_selectors(selector_type);
CREATE INDEX idx_products_url ON products(url);
CREATE INDEX idx_products_retailer_id ON products(retailer_id);
CREATE INDEX idx_products_scraped_at ON products(scraped_at);
CREATE INDEX idx_scrape_attempts_retailer_id ON scrape_attempts(retailer_id);
CREATE INDEX idx_scrape_attempts_attempted_at ON scrape_attempts(attempted_at);
CREATE INDEX idx_scrape_attempts_success ON scrape_attempts(success);

-- JSONB indexes for efficient querying
CREATE INDEX idx_retailers_url_patterns ON retailers USING GIN (url_patterns);
CREATE INDEX idx_retailers_config ON retailers USING GIN (config);
CREATE INDEX idx_retailer_selectors_selectors ON retailer_selectors USING GIN (selectors);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retailers_updated_at BEFORE UPDATE ON retailers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retailer_selectors_updated_at BEFORE UPDATE ON retailer_selectors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update selector success rates
CREATE OR REPLACE FUNCTION update_selector_success_rate()
RETURNS TRIGGER AS $$
BEGIN
    -- Update success rate when scrape_attempts are inserted
    UPDATE retailer_selectors 
    SET 
        success_rate = CASE 
            WHEN total_attempts + 1 > 0 
            THEN ((successful_attempts + CASE WHEN NEW.success THEN 1 ELSE 0 END) * 100.0) / (total_attempts + 1)
            ELSE 0 
        END,
        total_attempts = total_attempts + 1,
        successful_attempts = successful_attempts + CASE WHEN NEW.success THEN 1 ELSE 0 END,
        last_tested = NEW.attempted_at
    WHERE retailer_id = NEW.retailer_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update success rates
CREATE TRIGGER update_selector_stats AFTER INSERT ON scrape_attempts 
    FOR EACH ROW EXECUTE FUNCTION update_selector_success_rate();

-- Insert default generic retailer for fallback
INSERT INTO retailers (name, domain, url_patterns, config) VALUES 
('Generic', 'generic', '[".*"]'::JSONB, '{
    "headers": {},
    "delays": {
        "navigation": 3000,
        "extraction": 2000
    },
    "custom_scripts": []
}'::JSONB);

-- Insert generic selectors (current hard-coded selectors from scraper.js)
INSERT INTO retailer_selectors (retailer_id, selector_type, selectors) 
SELECT 
    r.id,
    'price',
    '[
        ".ProductPricing>span",
        "[data-test=\"product-price\"]",
        "[data-test=\"product-price-value\"]",
        "[data-testid=\"price\"]",
        "span[data-test*=\"price\"]",
        "div[data-test*=\"price\"]",
        ".h-display-xs",
        ".h-text-red",
        ".h-text-lg",
        "[class*=\"Price\"]",
        ".price",
        "[class*=\"price\"]",
        "[id*=\"price\"]",
        ".a-price-whole",
        ".notranslate",
        ".our-price-1",
        "[data-fs-element=\"price\"]",
        ".our-price",
        ".price-display",
        ".sale-price",
        ".current-price",
        ".details-our-price",
        ".section-title",
        ".variant-price",
        ".final-price-red-color",
        ".price-digit",
        ".productNameComponent",
        "[data-qaid=\"pdpProductPriceSale\"]",
        ".priceToPay",
        "#pdpPrice",
        "[data-qa=\"productName\"]",
        ".sales"
    ]'::JSONB
FROM retailers r WHERE r.domain = 'generic';

INSERT INTO retailer_selectors (retailer_id, selector_type, selectors) 
SELECT 
    r.id,
    'title',
    '[
        "[data-test=\"product-title\"]",
        "h1[data-test]",
        "h1",
        "[data-testid=\"product-title\"]",
        ".product-title",
        "[class*=\"title\"]",
        "#productTitle",
        "#product-title"
    ]'::JSONB
FROM retailers r WHERE r.domain = 'generic';

-- Create a default user for CLI usage
INSERT INTO users (username, email) VALUES ('cli-user', 'cli@local');

COMMENT ON TABLE users IS 'User accounts for future UI multi-user support';
COMMENT ON TABLE retailers IS 'Retailer configurations with JSONB for flexible settings';
COMMENT ON TABLE retailer_selectors IS 'CSS selectors for each retailer with fallback chains';
COMMENT ON TABLE products IS 'Scraped product data with retailer relationship';
COMMENT ON TABLE scrape_attempts IS 'Analytics and debugging data for all scraping attempts';