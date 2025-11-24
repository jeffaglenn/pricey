const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('../database-pg');
const RetailerManager = require('../retailer-manager');
const ProductScraper = require('../scraper');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory (Vite build output)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// API Routes

// Dashboard overview stats
app.get('/api/dashboard', async (req, res) => {
  const db = new Database();
  
  try {
    await db.init();
    const pool = db.getPool();
    
    // Get overview statistics with separate queries
    const [productsResult, retailersResult, attemptsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total_products FROM products'),
      pool.query('SELECT COUNT(*) as active_retailers FROM retailers WHERE is_active = true AND domain != \'generic\''),
      pool.query(`
        SELECT 
          COUNT(*) as recent_attempts,
          COUNT(*) FILTER (WHERE success = true) as recent_successes,
          ROUND(
            CASE 
              WHEN COUNT(*) > 0 
              THEN (COUNT(*) FILTER (WHERE success = true) * 100.0) / COUNT(*)
              ELSE 0 
            END, 1
          ) as success_rate
        FROM scrape_attempts 
        WHERE attempted_at > NOW() - INTERVAL '7 days'
      `)
    ]);
    
    const stats = {
      total_products: productsResult.rows[0]?.total_products || 0,
      active_retailers: retailersResult.rows[0]?.active_retailers || 0,
      recent_attempts: attemptsResult.rows[0]?.recent_attempts || 0,
      recent_successes: attemptsResult.rows[0]?.recent_successes || 0,
      success_rate: attemptsResult.rows[0]?.success_rate || 0
    };
    
    res.json({
      totalProducts: parseInt(stats.total_products) || 0,
      activeRetailers: parseInt(stats.active_retailers) || 0,
      recentSuccesses: parseInt(stats.recent_successes) || 0,
      recentAttempts: parseInt(stats.recent_attempts) || 0,
      successRate: parseFloat(stats.success_rate) || 0
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  } finally {
    await db.close();
  }
});

// Get recent products
app.get('/api/products', async (req, res) => {
  const db = new Database();
  
  try {
    await db.init();
    const limit = parseInt(req.query.limit) || 20;
    const products = await db.getAllProducts(limit);
    
    res.json(products);
    
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  } finally {
    await db.close();
  }
});

// Get all retailers
app.get('/api/retailers', async (req, res) => {
  const db = new Database();
  
  try {
    await db.init();
    const retailerManager = new RetailerManager(db);
    const retailers = await retailerManager.listRetailers();
    
    res.json(retailers);
    
  } catch (error) {
    console.error('Retailers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch retailers' });
  } finally {
    await db.close();
  }
});

// Trigger product scrape
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  const db = new Database();
  let scraper = null;
  
  try {
    await db.init();
    
    scraper = new ProductScraper({
      database: db,
      showFingerprint: false,
      headless: true
    });
    
    const productData = await scraper.scrapeProduct(url);
    
    if (productData && productData.title && productData.price) {
      const productId = await db.saveProduct(productData);
      
      res.json({
        success: true,
        product: {
          id: productId,
          title: productData.title,
          price: productData.price,
          url: productData.url,
          retailer: productData.retailer_name
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to scrape product - could not find title or price'
      });
    }
    
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
    await db.close();
  }
});

// Add new retailer
app.post('/api/retailers', async (req, res) => {
  const { name, domain, urlPatterns, priceSelectors, titleSelectors } = req.body;
  
  if (!name || !domain) {
    return res.status(400).json({ error: 'Name and domain are required' });
  }
  
  const db = new Database();
  
  try {
    await db.init();
    const retailerManager = new RetailerManager(db);
    
    const retailerData = {
      name,
      domain,
      urlPatterns: urlPatterns || [],
      priceSelectors: priceSelectors || [],
      titleSelectors: titleSelectors || []
    };
    
    const retailerId = await retailerManager.addRetailer(retailerData);
    
    res.json({
      success: true,
      retailerId,
      message: `Added retailer: ${name}`
    });
    
  } catch (error) {
    console.error('Add retailer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await db.close();
  }
});

// Test retailer detection
app.post('/api/test-retailer', async (req, res) => {
  const { url, expectedDomain } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  const db = new Database();
  
  try {
    await db.init();
    const retailerManager = new RetailerManager(db);
    
    const result = await retailerManager.testRetailer(expectedDomain || 'auto', url);
    
    res.json(result);
    
  } catch (error) {
    console.error('Test retailer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await db.close();
  }
});

// Catch-all route: serve index.html for any non-API routes (SPA support)
// Using a regex pattern to avoid Express 5 wildcard issues
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Dashboard not built yet. Run `npm run build` first.');
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Pricey Dashboard running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
});