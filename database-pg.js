const { Pool } = require('pg');

class Database {
  constructor(options = {}) {
    // Default PostgreSQL connection config
    this.config = {
      host: options.host || process.env.PGHOST || 'localhost',
      port: options.port || process.env.PGPORT || 5432,
      database: options.database || process.env.PGDATABASE || 'pricey',
      user: options.user || process.env.PGUSER || process.env.USER,
      password: options.password || process.env.PGPASSWORD || '',
      ssl: options.ssl || process.env.PGSSL || false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
    
    this.pool = null;
  }

  async init() {
    try {
      this.pool = new Pool(this.config);
      
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('Connected to PostgreSQL database');
      await this.createTables();
      return true;
    } catch (error) {
      console.error('Database connection failed:', error.message);
      throw error;
    }
  }

  async createTables() {
    // Check if tables exist, if not run the schema
    try {
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'products'
        );
      `);
      
      if (!result.rows[0].exists) {
        console.log('Tables not found, creating schema...');
        // Note: In production, you'd run schema.sql separately
        // For now, we'll just create the essential tables
        await this.createEssentialTables();
      } else {
        console.log('Database tables verified');
      }
    } catch (error) {
      console.error('Error checking/creating tables:', error.message);
      throw error;
    }
  }

  async createEssentialTables() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create retailers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS retailers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          domain VARCHAR(255) NOT NULL UNIQUE,
          url_patterns JSONB NOT NULL DEFAULT '[]'::JSONB,
          config JSONB NOT NULL DEFAULT '{}'::JSONB,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        );
      `);

      // Create retailer_selectors table
      await client.query(`
        CREATE TABLE IF NOT EXISTS retailer_selectors (
          id SERIAL PRIMARY KEY,
          retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
          selector_type VARCHAR(50) NOT NULL,
          selectors JSONB NOT NULL DEFAULT '[]'::JSONB,
          success_rate DECIMAL(5,2) DEFAULT 0,
          total_attempts INTEGER DEFAULT 0,
          successful_attempts INTEGER DEFAULT 0,
          last_tested TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        );
      `);

      // Create products table (compatible with existing structure)
      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          price DECIMAL(10,2),
          url TEXT NOT NULL UNIQUE,
          retailer_id INTEGER REFERENCES retailers(id),
          raw_data JSONB,
          scraped_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create scrape_attempts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scrape_attempts (
          id SERIAL PRIMARY KEY,
          retailer_id INTEGER REFERENCES retailers(id),
          product_id INTEGER REFERENCES products(id),
          url TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          error_message TEXT,
          error_type VARCHAR(50),
          browser_used VARCHAR(20),
          response_time INTEGER,
          selectors_tried JSONB,
          attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_retailers_domain ON retailers(domain);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_products_retailer_id ON products(retailer_id);');

      // Insert default data if not exists
      const userResult = await client.query('SELECT id FROM users WHERE username = $1', ['cli-user']);
      let userId;
      
      if (userResult.rows.length === 0) {
        const insertUser = await client.query(
          'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id',
          ['cli-user', 'cli@local']
        );
        userId = insertUser.rows[0].id;
      } else {
        userId = userResult.rows[0].id;
      }

      // Insert generic retailer if not exists
      const retailerResult = await client.query('SELECT id FROM retailers WHERE domain = $1', ['generic']);
      
      if (retailerResult.rows.length === 0) {
        const insertRetailer = await client.query(`
          INSERT INTO retailers (name, domain, url_patterns, config, created_by) 
          VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [
          'Generic',
          'generic',
          JSON.stringify(['.*']),
          JSON.stringify({
            headers: {},
            delays: { navigation: 3000, extraction: 2000 },
            custom_scripts: []
          }),
          userId
        ]);

        const retailerId = insertRetailer.rows[0].id;

        // Insert generic selectors
        await client.query(`
          INSERT INTO retailer_selectors (retailer_id, selector_type, selectors) VALUES ($1, $2, $3)
        `, [retailerId, 'price', JSON.stringify([
          '.ProductPricing>span', '[data-test="product-price"]', '[data-test="product-price-value"]',
          '[data-testid="price"]', 'span[data-test*="price"]', 'div[data-test*="price"]',
          '.h-display-xs', '.h-text-red', '.h-text-lg', '[class*="Price"]', '.price',
          '[class*="price"]', '[id*="price"]', '.a-price-whole', '.notranslate',
          '.our-price-1', '[data-fs-element="price"]', '.our-price', '.price-display',
          '.sale-price', '.current-price', '.details-our-price', '.section-title',
          '.variant-price', '.final-price-red-color', '.price-digit', '.productNameComponent',
          '[data-qaid="pdpProductPriceSale"]', '.priceToPay', '#pdpPrice', '[data-qa="productName"]', '.sales'
        ])]);

        await client.query(`
          INSERT INTO retailer_selectors (retailer_id, selector_type, selectors) VALUES ($1, $2, $3)
        `, [retailerId, 'title', JSON.stringify([
          '[data-test="product-title"]', 'h1[data-test]', 'h1', '[data-testid="product-title"]',
          '.product-title', '[class*="title"]', '#productTitle', '#product-title'
        ])]);
      }

      await client.query('COMMIT');
      console.log('Essential database tables created and initialized');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Backward compatible product methods
  async saveProduct(productData) {
    const { title, price, url, retailerId = null } = productData;

    try {
      const result = await this.pool.query(`
        INSERT INTO products (title, price, url, scraped_at, retailer_id)
        VALUES ($1, $2, $3, NOW(), $4)
        ON CONFLICT (url)
        DO UPDATE SET
          title = EXCLUDED.title,
          price = EXCLUDED.price,
          scraped_at = NOW(),
          retailer_id = EXCLUDED.retailer_id,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [title, price, url, retailerId]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving product:', error.message);
      throw error;
    }
  }

  async getAllProducts() {
    try {
      const result = await this.pool.query(`
        SELECT p.*, r.name as retailer_name 
        FROM products p 
        LEFT JOIN retailers r ON p.retailer_id = r.id 
        ORDER BY p.created_at DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error getting products:', error.message);
      throw error;
    }
  }

  async getProductByUrl(url) {
    try {
      const result = await this.pool.query(`
        SELECT p.*, r.name as retailer_name 
        FROM products p 
        LEFT JOIN retailers r ON p.retailer_id = r.id 
        WHERE p.url = $1
      `, [url]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting product by URL:', error.message);
      throw error;
    }
  }

  // New retailer-specific methods
  async getRetailerByDomain(domain) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM retailers 
        WHERE domain = $1 AND is_active = true
      `, [domain]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting retailer by domain:', error.message);
      throw error;
    }
  }

  async getRetailerSelectors(retailerId, selectorType = null) {
    try {
      let query = `
        SELECT * FROM retailer_selectors 
        WHERE retailer_id = $1 AND is_active = true
      `;
      const params = [retailerId];
      
      if (selectorType) {
        query += ' AND selector_type = $2';
        params.push(selectorType);
      }
      
      query += ' ORDER BY success_rate DESC, id ASC';
      
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting retailer selectors:', error.message);
      throw error;
    }
  }

  async recordScrapeAttempt(attemptData) {
    const {
      retailerId,
      productId = null,
      url,
      success,
      errorMessage = null,
      errorType = null,
      browserUsed = null,
      responseTime = null,
      selectorsTried = null
    } = attemptData;

    try {
      const result = await this.pool.query(`
        INSERT INTO scrape_attempts 
        (retailer_id, product_id, url, success, error_message, error_type, browser_used, response_time, selectors_tried)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [retailerId, productId, url, success, errorMessage, errorType, browserUsed, responseTime, 
          selectorsTried ? JSON.stringify(selectorsTried) : null]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error recording scrape attempt:', error.message);
      throw error;
    }
  }

  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
        console.log('Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database:', error.message);
      throw error;
    }
  }

  // Utility method to get pool for advanced queries
  getPool() {
    return this.pool;
  }
}

module.exports = Database;