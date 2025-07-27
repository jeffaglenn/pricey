/**
 * Enhanced Retry Handler with Exponential Backoff
 * Handles different types of scraping errors with appropriate retry strategies
 */

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter !== false; // Add randomness by default
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options for this specific attempt
   * @returns {Promise} Result of successful execution
   */
  async execute(fn, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        
        if (attempt > 0) {
          console.log(`✅ Retry successful on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        const errorType = this.classifyError(error);
        const shouldRetry = this.shouldRetry(errorType, attempt);
        
        if (!shouldRetry) {
          console.log(`❌ Non-retryable error: ${error.message}`);
          throw error;
        }

        const delay = this.calculateDelay(attempt, errorType);
        console.log(`⚠️  Attempt ${attempt + 1} failed: ${error.message}`);
        console.log(`   Retrying in ${delay}ms... (${maxRetries - attempt} attempts remaining)`);
        
        await this.sleep(delay);
      }
    }

    console.log(`❌ All retry attempts exhausted. Final error: ${lastError.message}`);
    throw lastError;
  }

  /**
   * Classify error types for different retry strategies
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network/timeout errors - should retry
    if (message.includes('timeout') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('enotfound')) {
      return 'network';
    }

    // Rate limiting - should retry with longer delay
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')) {
      return 'rate_limit';
    }

    // Server errors (5xx) - should retry
    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('server error')) {
      return 'server_error';
    }

    // Bot detection - should retry with different strategy
    if (message.includes('blocked') ||
        message.includes('access denied') ||
        message.includes('403') ||
        message.includes('cloudflare') ||
        message.includes('captcha')) {
      return 'bot_detection';
    }

    // Navigation/page load errors - should retry
    if (message.includes('navigation') ||
        message.includes('page.goto') ||
        message.includes('net::') ||
        stack.includes('page.goto')) {
      return 'navigation';
    }

    // Parsing/selector errors - might be temporary DOM issues
    if (message.includes('waiting for selector') ||
        message.includes('element not found') ||
        message.includes('no element')) {
      return 'parsing';
    }

    // Client errors (4xx except 429) - usually don't retry
    if (message.includes('400') ||
        message.includes('401') ||
        message.includes('404') ||
        message.includes('client error')) {
      return 'client_error';
    }

    // Unknown errors - conservative retry
    return 'unknown';
  }

  /**
   * Determine if we should retry based on error type and attempt number
   */
  shouldRetry(errorType, attempt) {
    switch (errorType) {
      case 'network':
      case 'server_error':
      case 'navigation':
        return true; // Always retry these

      case 'rate_limit':
        return attempt < 2; // Limited retries for rate limiting

      case 'bot_detection':
        return attempt < 1; // Only one retry for bot detection

      case 'parsing':
        return attempt < 2; // Limited retries for parsing issues

      case 'unknown':
        return attempt < 1; // Conservative retry for unknown errors

      case 'client_error':
      default:
        return false; // Don't retry client errors
    }
  }

  /**
   * Calculate delay with exponential backoff based on error type
   */
  calculateDelay(attempt, errorType) {
    let baseDelay = this.baseDelay;

    // Adjust base delay based on error type
    switch (errorType) {
      case 'rate_limit':
        baseDelay = 5000; // 5 seconds for rate limiting
        break;
      case 'bot_detection':
        baseDelay = 10000; // 10 seconds for bot detection
        break;
      case 'server_error':
        baseDelay = 2000; // 2 seconds for server errors
        break;
      case 'network':
      case 'navigation':
        baseDelay = 1000; // 1 second for network issues
        break;
      default:
        baseDelay = this.baseDelay;
    }

    // Calculate exponential backoff
    let delay = baseDelay * Math.pow(this.backoffMultiplier, attempt);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }

    return Math.floor(delay);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for specific scraping operations
   */
  createScrapingRetry(options = {}) {
    return {
      // Retry page navigation
      navigation: (fn) => this.execute(fn, { 
        maxRetries: options.navigationRetries || 2,
        ...options 
      }),

      // Retry data extraction
      extraction: (fn) => this.execute(fn, { 
        maxRetries: options.extractionRetries || 1,
        ...options 
      }),

      // Retry network requests
      network: (fn) => this.execute(fn, { 
        maxRetries: options.networkRetries || 3,
        ...options 
      })
    };
  }
}

module.exports = RetryHandler;