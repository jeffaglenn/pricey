/**
 * RetailerManager - Handles retailer detection and configuration management
 * Provides database-backed retailer-specific scraping configurations
 */

class RetailerManager {
  constructor(database) {
    this.db = database;
    this.cache = new Map(); // Cache retailer configs for performance
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Detect retailer from URL and return configuration
   * @param {string} url - Product URL to analyze
   * @returns {Object} Retailer configuration or generic fallback
   */
  async detectRetailer(url) {
    try {
      const domain = this.extractDomain(url);
      
      // Check cache first
      const cacheKey = `retailer:${domain}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Try exact domain match first
      let retailer = await this.db.getRetailerByDomain(domain);
      
      // If no exact match, try pattern matching
      if (!retailer) {
        retailer = await this.findRetailerByPattern(url);
      }
      
      // Fallback to generic if no match
      if (!retailer) {
        retailer = await this.db.getRetailerByDomain('generic');
      }

      if (!retailer) {
        throw new Error('No retailer configuration found, including generic fallback');
      }

      // Load complete configuration
      const config = await this.loadRetailerConfig(retailer);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: config,
        timestamp: Date.now()
      });

      return config;
      
    } catch (error) {
      console.error('Error detecting retailer:', error.message);
      throw error;
    }
  }

  /**
   * Extract domain from URL
   * @param {string} url - Full URL
   * @returns {string} Domain name
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch (error) {
      console.error('Invalid URL:', url);
      return 'unknown';
    }
  }

  /**
   * Find retailer by URL pattern matching
   * @param {string} url - URL to match against patterns
   * @returns {Object|null} Matching retailer or null
   */
  async findRetailerByPattern(url) {
    try {
      const pool = this.db.getPool();
      const result = await pool.query(`
        SELECT * FROM retailers 
        WHERE is_active = true 
        AND domain != 'generic'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(url_patterns) AS pattern
          WHERE $1 ~ pattern
        )
        ORDER BY 
          CASE WHEN domain = $2 THEN 1 ELSE 2 END,
          char_length(domain) DESC
        LIMIT 1
      `, [url, this.extractDomain(url)]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error in pattern matching:', error.message);
      return null;
    }
  }

  /**
   * Load complete retailer configuration including selectors
   * @param {Object} retailer - Basic retailer record
   * @returns {Object} Complete configuration
   */
  async loadRetailerConfig(retailer) {
    try {
      // Get all selectors for this retailer
      const selectors = await this.db.getRetailerSelectors(retailer.id);
      
      // Organize selectors by type
      const selectorsByType = {};
      selectors.forEach(selector => {
        if (!selectorsByType[selector.selector_type]) {
          selectorsByType[selector.selector_type] = [];
        }
        selectorsByType[selector.selector_type].push({
          id: selector.id,
          selectors: selector.selectors,
          success_rate: selector.success_rate,
          last_tested: selector.last_tested
        });
      });

      return {
        id: retailer.id,
        name: retailer.name,
        domain: retailer.domain,
        url_patterns: retailer.url_patterns,
        config: retailer.config,
        selectors: selectorsByType,
        created_at: retailer.created_at,
        is_active: retailer.is_active
      };
    } catch (error) {
      console.error('Error loading retailer config:', error.message);
      throw error;
    }
  }

  /**
   * Get selectors for a specific type (price, title, etc.)
   * @param {Object} retailerConfig - Complete retailer configuration
   * @param {string} selectorType - Type of selector needed
   * @returns {Array} Array of CSS selectors in priority order
   */
  getSelectorsForType(retailerConfig, selectorType) {
    if (!retailerConfig.selectors || !retailerConfig.selectors[selectorType]) {
      return [];
    }

    // Return all selectors flattened from the highest success rate selector group
    const selectorGroups = retailerConfig.selectors[selectorType];
    if (selectorGroups.length === 0) return [];

    // Use the highest success rate group, or first if no success rates
    const bestGroup = selectorGroups.sort((a, b) => b.success_rate - a.success_rate)[0];
    return bestGroup.selectors || [];
  }

  /**
   * Add a new retailer configuration
   * @param {Object} retailerData - Retailer configuration data
   * @returns {number} New retailer ID
   */
  async addRetailer(retailerData) {
    const {
      name,
      domain,
      urlPatterns = [],
      config = {},
      priceSelectors = [],
      titleSelectors = [],
      userId = null
    } = retailerData;

    const client = await this.db.getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Insert retailer
      const retailerResult = await client.query(`
        INSERT INTO retailers (name, domain, url_patterns, config, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [name, domain, JSON.stringify(urlPatterns), JSON.stringify(config), userId]);

      const retailerId = retailerResult.rows[0].id;

      // Insert price selectors
      if (priceSelectors.length > 0) {
        await client.query(`
          INSERT INTO retailer_selectors (retailer_id, selector_type, selectors)
          VALUES ($1, $2, $3)
        `, [retailerId, 'price', JSON.stringify(priceSelectors)]);
      }

      // Insert title selectors
      if (titleSelectors.length > 0) {
        await client.query(`
          INSERT INTO retailer_selectors (retailer_id, selector_type, selectors)
          VALUES ($1, $2, $3)
        `, [retailerId, 'title', JSON.stringify(titleSelectors)]);
      }

      await client.query('COMMIT');
      
      // Clear cache for this domain
      this.cache.delete(`retailer:${domain}`);
      
      console.log(`✅ Added retailer: ${name} (${domain})`);
      return retailerId;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List all active retailers
   * @returns {Array} Array of retailer configurations
   */
  async listRetailers() {
    try {
      const pool = this.db.getPool();
      const result = await pool.query(`
        SELECT 
          r.*,
          COUNT(rs.id) as selector_count,
          AVG(rs.success_rate) as avg_success_rate
        FROM retailers r
        LEFT JOIN retailer_selectors rs ON r.id = rs.retailer_id AND rs.is_active = true
        WHERE r.is_active = true
        GROUP BY r.id
        ORDER BY r.name
      `);

      return result.rows;
    } catch (error) {
      console.error('Error listing retailers:', error.message);
      throw error;
    }
  }

  /**
   * Test retailer selectors against a URL
   * @param {string} domain - Retailer domain
   * @param {string} testUrl - URL to test against
   * @returns {Object} Test results
   */
  async testRetailer(domain, testUrl) {
    try {
      const retailerConfig = await this.detectRetailer(testUrl);
      
      if (retailerConfig.domain !== domain && domain !== 'auto') {
        return {
          success: false,
          message: `URL matched ${retailerConfig.domain}, not ${domain}`,
          matched_retailer: retailerConfig.name
        };
      }

      return {
        success: true,
        retailer: retailerConfig.name,
        domain: retailerConfig.domain,
        selectors: {
          price: this.getSelectorsForType(retailerConfig, 'price'),
          title: this.getSelectorsForType(retailerConfig, 'title')
        },
        config: retailerConfig.config
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Update selector success rates after scraping attempts
   * @param {number} retailerId - Retailer ID
   * @param {string} selectorType - Type of selector
   * @param {boolean} success - Whether the scraping was successful
   */
  async updateSelectorStats(retailerId, selectorType, success) {
    try {
      const pool = this.db.getPool();
      await pool.query(`
        UPDATE retailer_selectors 
        SET 
          total_attempts = total_attempts + 1,
          successful_attempts = successful_attempts + $1,
          success_rate = CASE 
            WHEN total_attempts + 1 > 0 
            THEN ((successful_attempts + $1) * 100.0) / (total_attempts + 1)
            ELSE 0 
          END,
          last_tested = CURRENT_TIMESTAMP
        WHERE retailer_id = $2 AND selector_type = $3
      `, [success ? 1 : 0, retailerId, selectorType]);
      
      // Clear cache for this retailer
      const retailer = await this.db.getRetailerByDomain('retailer_id_' + retailerId);
      if (retailer) {
        this.cache.delete(`retailer:${retailer.domain}`);
      }
    } catch (error) {
      console.error('Error updating selector stats:', error.message);
    }
  }

  /**
   * Clear the retailer cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = RetailerManager;