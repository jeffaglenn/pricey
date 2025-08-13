// API helper functions
class API {
  constructor() {
    this.baseURL = '/api';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Get dashboard overview statistics
  async getDashboard() {
    return this.request('/dashboard');
  }

  // Get recent products
  async getProducts(limit = 20) {
    return this.request(`/products?limit=${limit}`);
  }

  // Get all retailers
  async getRetailers() {
    return this.request('/retailers');
  }

  // Scrape a product
  async scrapeProduct(url) {
    return this.request('/scrape', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // Add a new retailer
  async addRetailer(retailerData) {
    return this.request('/retailers', {
      method: 'POST',
      body: JSON.stringify(retailerData),
    });
  }

  // Test retailer detection
  async testRetailer(url, expectedDomain = 'auto') {
    return this.request('/test-retailer', {
      method: 'POST',
      body: JSON.stringify({ url, expectedDomain }),
    });
  }
}

export const api = new API();