import { api } from './api.js';

// Main Alpine.js dashboard component
export function dashboard() {
  return {
    // State
    loading: false,
    scraping: false,
    activeTab: 'products',
    lastUpdated: '',
    
    // Data
    stats: {
      totalProducts: 0,
      activeRetailers: 0,
      successRate: 0,
      recentAttempts: 0
    },
    products: [],
    retailers: [],
    
    // Forms
    scrapeUrl: '',
    scrapeResult: null,
    
    // Initialize component
    async init() {
      console.log('🚀 Pricey Dashboard initialized (Vite + Alpine.js)');
      await this.refreshData();
      
      // Auto-refresh every 30 seconds
      setInterval(() => {
        this.refreshData();
      }, 30000);
    },
    
    // Refresh all data
    async refreshData() {
      this.loading = true;
      
      try {
        // Load all data in parallel
        const [dashboardData, productsData, retailersData] = await Promise.all([
          api.getDashboard(),
          api.getProducts(20),
          api.getRetailers()
        ]);
        
        // Update state
        this.stats = dashboardData;
        this.products = productsData;
        this.retailers = retailersData;
        
        this.lastUpdated = this.formatDate(new Date());
        
        console.log('📊 Dashboard data refreshed', {
          stats: this.stats,
          productsCount: this.products.length,
          retailersCount: this.retailers.length
        });
        
      } catch (error) {
        console.error('❌ Failed to refresh dashboard data:', error);
        this.showError('Failed to load dashboard data: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    
    // Scrape a product
    async scrapeProduct() {
      if (!this.scrapeUrl.trim()) {
        this.showError('Please enter a valid URL');
        return;
      }
      
      this.scraping = true;
      this.scrapeResult = null;
      
      try {
        console.log('🚀 Starting scrape for:', this.scrapeUrl);
        
        const result = await api.scrapeProduct(this.scrapeUrl.trim());
        
        this.scrapeResult = result;
        
        if (result.success) {
          console.log('✅ Scrape successful:', result.product);
          
          // Add new product to the list at the top
          this.products.unshift({
            id: result.product.id,
            title: result.product.title,
            price: result.product.price,
            url: result.product.url,
            retailer_name: result.product.retailer,
            scraped_at: new Date().toISOString()
          });
          
          // Update stats
          this.stats.totalProducts++;
          
          // Clear the form
          this.scrapeUrl = '';
          
          // Auto-hide success message after 5 seconds
          setTimeout(() => {
            this.scrapeResult = null;
          }, 5000);
        }
        
      } catch (error) {
        console.error('❌ Scrape failed:', error);
        this.scrapeResult = {
          success: false,
          error: error.message
        };
      } finally {
        this.scraping = false;
      }
    },
    
    // Format date for display (uses system timezone)
    formatDate(dateInput) {
      if (!dateInput) return 'Unknown';

      // Convert to Date object if it's a string (handles UTC timestamps from database)
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

      if (isNaN(date.getTime())) return 'Invalid date';

      // Check if date is today (in local timezone)
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      // Options for formatting in local timezone
      const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };

      const dateTimeOptions = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };

      if (isToday) {
        // Show only time for today (e.g., "3:45 PM")
        return date.toLocaleTimeString('en-US', timeOptions);
      } else {
        // Show date and time for other days (e.g., "Nov 24, 3:45 PM")
        return date.toLocaleString('en-US', dateTimeOptions);
      }
    },
    
    // Show error message (could be enhanced with toast notifications)
    showError(message) {
      console.error('🚨 Error:', message);
      alert('Error: ' + message); // Simple for now, could be enhanced with better UI
    },
    
    // Switch tabs
    switchTab(tab) {
      this.activeTab = tab;
      console.log('📑 Switched to tab:', tab);
    }
  };
}