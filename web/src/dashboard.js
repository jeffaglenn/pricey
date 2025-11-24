import { api } from './api.js';

// Main Alpine.js dashboard component
export function dashboard() {
  return {
    // State
    scraping: false,
    rescrapingId: null, // Track which product is being re-scraped
    activeTab: 'products',

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

    // Edit modal state
    editModalOpen: false,
    editingProduct: null,
    editForm: {
      title: '',
      threshold_price: ''
    },
    
    // Initialize component
    async init() {
      console.log('🚀 Pricey Dashboard initialized (Vite + Alpine.js)');
      await this.loadData();
    },

    // Load initial data
    async loadData() {
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

        console.log('📊 Dashboard data loaded', {
          stats: this.stats,
          productsCount: this.products.length,
          retailersCount: this.retailers.length
        });

      } catch (error) {
        console.error('❌ Failed to load dashboard data:', error);
        this.showError('Failed to load dashboard data: ' + error.message);
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
            scraped_at: result.product.scraped_at
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
    
    // Open edit modal
    openEditModal(product) {
      this.editingProduct = product;
      this.editForm.title = product.title;
      this.editForm.threshold_price = product.threshold_price || '';
      this.editModalOpen = true;
    },

    // Close edit modal
    closeEditModal() {
      this.editModalOpen = false;
      this.editingProduct = null;
      this.editForm.title = '';
      this.editForm.threshold_price = '';
    },

    // Save product edits
    async saveProduct() {
      if (!this.editForm.title.trim()) {
        this.showError('Title cannot be empty');
        return;
      }

      try {
        console.log('💾 Updating product:', this.editingProduct.id);

        const updateData = {
          title: this.editForm.title.trim(),
          threshold_price: this.editForm.threshold_price || null
        };

        const result = await api.updateProduct(this.editingProduct.id, updateData);

        // Update in local array
        const index = this.products.findIndex(p => p.id === this.editingProduct.id);
        if (index !== -1) {
          this.products[index].title = this.editForm.title.trim();
          this.products[index].threshold_price = this.editForm.threshold_price || null;
        }

        console.log('✅ Product updated successfully');

        this.closeEditModal();

      } catch (error) {
        console.error('❌ Failed to update product:', error);
        this.showError('Failed to update product: ' + error.message);
      }
    },

    // Delete product from modal
    async deleteProductFromModal() {
      const confirmed = confirm(`Are you sure you want to delete "${this.editingProduct.title}"?`);

      if (!confirmed) {
        return;
      }

      try {
        console.log('🗑️ Deleting product:', this.editingProduct.id);

        await api.deleteProduct(this.editingProduct.id);

        // Remove from local array
        this.products = this.products.filter(p => p.id !== this.editingProduct.id);

        // Update stats
        this.stats.totalProducts--;

        console.log('✅ Product deleted successfully');

        this.closeEditModal();

      } catch (error) {
        console.error('❌ Failed to delete product:', error);
        this.showError('Failed to delete product: ' + error.message);
      }
    },

    // Delete a product (from table)
    async deleteProduct(product) {
      // Confirm deletion
      const confirmed = confirm(`Are you sure you want to delete "${product.title}"?`);

      if (!confirmed) {
        return;
      }

      try {
        console.log('🗑️ Deleting product:', product.id);

        await api.deleteProduct(product.id);

        // Remove from local array
        this.products = this.products.filter(p => p.id !== product.id);

        // Update stats
        this.stats.totalProducts--;

        console.log('✅ Product deleted successfully');

      } catch (error) {
        console.error('❌ Failed to delete product:', error);
        this.showError('Failed to delete product: ' + error.message);
      }
    },

    // Re-scrape a product to get updated price
    async rescrapeProduct(product) {
      try {
        this.rescrapingId = product.id;
        console.log('🔄 Re-scraping product:', product.id);

        const result = await api.rescrapeProduct(product.id);

        if (result.success) {
          // Update product in local array with new price data
          const index = this.products.findIndex(p => p.id === product.id);
          if (index !== -1) {
            this.products[index].price = result.product.price;
            this.products[index].title = result.product.title;
            this.products[index].scraped_at = result.product.scraped_at;
          }

          console.log('✅ Product re-scraped successfully. New price:', result.product.price);
        }

      } catch (error) {
        console.error('❌ Failed to re-scrape product:', error);
        this.showError('Failed to re-scrape product: ' + error.message);
      } finally {
        this.rescrapingId = null;
      }
    },

    // Extract root domain from URL (e.g., "https://www.amazon.com/product/123" -> "amazon.com")
    getRootDomain(url) {
      try {
        const urlObj = new URL(url);
        let hostname = urlObj.hostname;

        // Remove www. prefix if present
        hostname = hostname.replace(/^www\./, '');

        return hostname;
      } catch (error) {
        console.error('Failed to parse URL:', url, error);
        return url; // Return original if parsing fails
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