/**
 * Shared Helper Utilities
 * Common functions used across multiple services
 */

/**
 * Generate random number between min and max (inclusive)
 */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Human-like delay (random between min and max milliseconds)
 */
async function humanDelay(min, max) {
  const delay = randomBetween(min, max);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Type text with human-like delays
 * @param {Page} page - Puppeteer page object
 * @param {string} selector - CSS selector for input element
 * @param {string} text - Text to type
 * @param {number} delayPerChar - Optional delay per character (ms)
 */
async function typeHuman(page, selector, text, delayPerChar = null) {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  await element.click();
  await humanDelay(100, 300);

  for (const char of text) {
    const delay = delayPerChar || randomBetween(50, 150);
    await element.type(char, { delay });
  }
}

/**
 * Type text into an element (direct element reference)
 */
async function typeHumanElement(page, element, text, delayPerChar = null) {
  await element.click();
  await humanDelay(100, 300);

  for (const char of text) {
    const delay = delayPerChar || randomBetween(50, 150);
    await element.type(char, { delay });
  }
}

/**
 * Random sample from array
 */
function randomSample(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Capitalize first letter of string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get nested value from object using dot notation
 * e.g., getNestedValue(obj, 'user.profile.name')
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
  return obj;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format currency
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Calculate percentage
 */
function calculatePercentage(part, whole) {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100 * 100) / 100; // 2 decimal places
}

/**
 * Parse time string (e.g., "2h 30m" -> milliseconds)
 */
function parseTimeString(str) {
  let ms = 0;
  const hours = str.match(/(\d+)h/);
  const minutes = str.match(/(\d+)m/);
  const seconds = str.match(/(\d+)s/);
  
  if (hours) ms += parseInt(hours[1]) * 60 * 60 * 1000;
  if (minutes) ms += parseInt(minutes[1]) * 60 * 1000;
  if (seconds) ms += parseInt(seconds[1]) * 1000;
  
  return ms;
}

/**
 * Format milliseconds to human readable
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Sanitize username (remove @ if present)
 */
function sanitizeUsername(username) {
  return username.replace(/^@/, '');
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

module.exports = {
  randomBetween,
  humanDelay,
  typeHuman,
  typeHumanElement,
  randomSample,
  capitalize,
  getNestedValue,
  setNestedValue,
  sleep,
  retryWithBackoff,
  chunkArray,
  formatNumber,
  formatCurrency,
  calculatePercentage,
  parseTimeString,
  formatDuration,
  sanitizeUsername,
  isEmpty,
  deepClone,
  debounce,
  throttle
};

