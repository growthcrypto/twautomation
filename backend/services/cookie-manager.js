const { TwitterAccount, TwitterSession } = require('../models');
const adsPowerController = require('./adspower-controller');

/**
 * Cookie Manager
 * Extracts and manages Twitter session cookies from AdsPower browsers
 */
class CookieManager {
  
  /**
   * Extract cookies from an AdsPower browser profile
   * Call this after manually logging into Twitter in AdsPower
   */
  async extractCookies(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      if (!account.adsPowerProfileId) {
        return { success: false, error: 'No AdsPower profile linked to this account' };
      }

      console.log(`🍪 Extracting cookies for @${account.username}...`);

      // Launch the AdsPower profile
      const session = await adsPowerController.launchProfile(account.adsPowerProfileId);
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      // Navigate to Twitter to ensure cookies are loaded
      await page.goto('https://twitter.com/home', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait a bit for all cookies to be set
      await this.sleep(2000);

      // Extract all cookies
      const cookies = await page.cookies();

      if (cookies.length === 0) {
        return { success: false, error: 'No cookies found. Make sure you are logged into Twitter in this AdsPower profile.' };
      }

      // Check for Twitter auth cookies (verify login)
      const hasAuthToken = cookies.some(c => c.name === 'auth_token');
      const hasCt0 = cookies.some(c => c.name === 'ct0');

      if (!hasAuthToken || !hasCt0) {
        return { 
          success: false, 
          error: 'Twitter auth cookies not found. Please login to Twitter in this AdsPower profile first.' 
        };
      }

      // Save cookies to database
      let twitterSession = await TwitterSession.findOne({ accountId });
      
      if (!twitterSession) {
        twitterSession = new TwitterSession({ accountId });
      }

      twitterSession.cookies = cookies;
      twitterSession.isLoggedIn = true;
      twitterSession.lastLoginDate = new Date();
      twitterSession.status = 'active';
      twitterSession.expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
      
      await twitterSession.save();

      console.log(`✅ Extracted ${cookies.length} cookies for @${account.username}`);
      console.log(`   Valid until: ${twitterSession.expiresAt.toLocaleDateString()}`);

      // Close browser (optional - leave open if you want)
      // await adsPowerController.closeProfile(account.adsPowerProfileId);

      return {
        success: true,
        cookieCount: cookies.length,
        expiresAt: twitterSession.expiresAt,
        message: `Cookies extracted successfully! Valid for 60 days.`
      };

    } catch (error) {
      console.error('❌ Error extracting cookies:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load cookies into a browser
   */
  async loadCookies(accountId, page) {
    try {
      const session = await TwitterSession.findOne({ accountId });
      
      if (!session || !session.cookies || session.cookies.length === 0) {
        return { success: false, error: 'No cookies found for this account' };
      }

      // Check if cookies expired
      if (session.expiresAt && new Date() > session.expiresAt) {
        return { success: false, error: 'Cookies expired. Please extract new cookies.' };
      }

      // Set cookies
      await page.setCookie(...session.cookies);

      console.log(`✅ Loaded ${session.cookies.length} cookies for account ${accountId}`);

      return { success: true };

    } catch (error) {
      console.error('Error loading cookies:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test if cookies are still valid
   */
  async testCookies(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      const session = await TwitterSession.findOne({ accountId });

      if (!session || !session.cookies) {
        return { valid: false, reason: 'No cookies found' };
      }

      // Open browser
      const browserSession = await adsPowerController.launchProfile(account.adsPowerProfileId);
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      // Load cookies
      await page.setCookie(...session.cookies);

      // Navigate to Twitter
      await page.goto('https://twitter.com/home', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Check if logged in
      const isLoggedIn = await this.isLoggedIn(page);

      if (isLoggedIn) {
        // Update session
        session.lastActivityDate = new Date();
        await session.save();

        return { valid: true, message: 'Cookies are valid!' };
      } else {
        // Mark as expired
        session.status = 'expired';
        await session.save();

        return { valid: false, reason: 'Cookies expired. Please re-login.' };
      }

    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Check if logged into Twitter
   */
  async isLoggedIn(page) {
    try {
      await page.waitForSelector('[data-testid="SideNav_AccountSwitcher_Button"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cookie status for an account
   */
  async getCookieStatus(accountId) {
    try {
      const session = await TwitterSession.findOne({ accountId });

      if (!session || !session.cookies) {
        return {
          hasCookies: false,
          status: 'No cookies',
          message: 'Extract cookies first'
        };
      }

      const now = new Date();
      const daysUntilExpiry = session.expiresAt 
        ? Math.ceil((session.expiresAt - now) / (1000 * 60 * 60 * 24))
        : 0;

      if (daysUntilExpiry <= 0) {
        return {
          hasCookies: true,
          status: 'Expired',
          message: 'Cookies expired. Re-login needed.',
          daysUntilExpiry: 0
        };
      }

      if (daysUntilExpiry <= 7) {
        return {
          hasCookies: true,
          status: 'Expiring Soon',
          message: `Expires in ${daysUntilExpiry} days`,
          daysUntilExpiry
        };
      }

      return {
        hasCookies: true,
        status: 'Valid',
        message: `Valid for ${daysUntilExpiry} days`,
        daysUntilExpiry
      };

    } catch (error) {
      return {
        hasCookies: false,
        status: 'Error',
        message: error.message
      };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new CookieManager();

