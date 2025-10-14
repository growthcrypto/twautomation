const { TwitterAccount, TwitterSession } = require('../models');
const adsPowerController = require('./adspower-controller');
const axios = require('axios');

/**
 * Twitter Session Manager
 * Handles login, session persistence, cookie management
 * NO EXTENSION DEPENDENCY - Pure browser automation
 */
class TwitterSessionManager {
  constructor() {
    this.activeSessions = new Map(); // accountId -> { browser, page, session }
    this.twoC

aptchaApiKey = process.env.TWOCAPTCHA_API_KEY;
  }

  /**
   * Get or create session for an account
   * Returns: { browser, page, session, isLoggedIn }
   */
  async getSession(accountId) {
    // Check if already has active session
    if (this.activeSessions.has(accountId.toString())) {
      const cached = this.activeSessions.get(accountId.toString());
      
      // Verify session is still valid
      if (await this.isSessionValid(cached.page)) {
        console.log(`✅ Using cached session for account ${accountId}`);
        return cached;
      } else {
        console.log(`⚠️  Cached session expired for account ${accountId}, re-logging in...`);
        await this.closeSession(accountId);
      }
    }

    // Create new session
    return await this.createSession(accountId);
  }

  /**
   * Create new session (launch browser, login to Twitter)
   */
  async createSession(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId).populate('proxyId');
      if (!account) {
        throw new Error('Account not found');
      }

      console.log(`🚀 Creating session for @${account.username}...`);

      // Launch browser via AdsPower
      const browserSession = await adsPowerController.launchProfile(account.adsPowerProfileId, {
        headless: process.env.HEADLESS_MODE === 'true' ? 1 : 0
      });

      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      // Try to restore session from cookies
      let session = await TwitterSession.findOne({ accountId });
      let isLoggedIn = false;

      if (session && session.cookies) {
        console.log(`🍪 Restoring cookies for @${account.username}...`);
        
        // Set cookies
        await page.setCookie(...session.cookies);
        
        // Navigate to Twitter
        await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Check if still logged in
        isLoggedIn = await this.isSessionValid(page);
        
        if (isLoggedIn) {
          console.log(`✅ Session restored for @${account.username}`);
        } else {
          console.log(`⚠️  Cookies expired, performing fresh login...`);
        }
      }

      // If not logged in, perform login
      if (!isLoggedIn) {
        isLoggedIn = await this.loginToTwitter(page, account);
        
        if (isLoggedIn) {
          // Save cookies
          const cookies = await page.cookies();
          
          if (!session) {
            session = new TwitterSession({ accountId });
          }
          
          session.cookies = cookies;
          session.isLoggedIn = true;
          session.lastLoginDate = new Date();
          session.status = 'active';
          session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          
          await session.save();
          
          console.log(`✅ Login successful for @${account.username}, cookies saved`);
        }
      }

      // Update account
      account.lastActiveDate = new Date();
      await account.save();

      // Cache session
      const sessionObj = {
        browser: browserSession.browser,
        page,
        session,
        isLoggedIn,
        accountId,
        username: account.username
      };

      this.activeSessions.set(accountId.toString(), sessionObj);

      return sessionObj;

    } catch (error) {
      console.error(`❌ Error creating session for account ${accountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Login to Twitter
   */
  async loginToTwitter(page, account) {
    try {
      console.log(`🔐 Logging in to Twitter as @${account.username}...`);

      // Navigate to login page
      await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Enter username/email
      await page.waitForSelector('input[autocomplete="username"]', { timeout: 10000 });
      await this.typeHuman(page, 'input[autocomplete="username"]', account.username);
      await this.humanDelay(500, 1000);

      // Click Next
      await page.keyboard.press('Enter');
      await this.humanDelay(3000, 5000);

      // Sometimes Twitter asks for email/phone verification
      const needsVerification = await page.$('input[data-testid="ocfEnterTextTextInput"]');
      if (needsVerification) {
        console.log(`📧 Twitter requesting verification (email/phone)...`);
        
        // Try email first
        if (account.email) {
          await this.typeHuman(page, 'input[data-testid="ocfEnterTextTextInput"]', account.email);
          await page.keyboard.press('Enter');
          await this.humanDelay(2000, 3000);
        } else if (account.phoneNumber) {
          await this.typeHuman(page, 'input[data-testid="ocfEnterTextTextInput"]', account.phoneNumber);
          await page.keyboard.press('Enter');
          await this.humanDelay(2000, 3000);
        } else {
          throw new Error('Twitter requesting verification but no email/phone on file');
        }
      }

      // Enter password
      await page.waitForSelector('input[autocomplete="current-password"]', { timeout: 10000 });
      await this.typeHuman(page, 'input[autocomplete="current-password"]', account.password);
      await this.humanDelay(500, 1000);

      // Submit
      await page.keyboard.press('Enter');
      await this.humanDelay(5000, 8000);

      // Check for captcha
      const hasCaptcha = await page.$('iframe[src*="captcha"]') || await page.$('[data-testid="captcha"]');
      if (hasCaptcha) {
        console.log(`🤖 Captcha detected, solving...`);
        const solved = await this.solveCaptcha(page);
        if (!solved) {
          throw new Error('Failed to solve captcha');
        }
        await this.humanDelay(3000, 5000);
      }

      // Verify login successful
      const isLoggedIn = await this.isSessionValid(page);

      if (!isLoggedIn) {
        // Check for error messages
        const errorElement = await page.$('[data-testid="error-detail"]');
        if (errorElement) {
          const errorText = await page.evaluate(el => el.textContent, errorElement);
          throw new Error(`Login failed: ${errorText}`);
        }
        throw new Error('Login failed: Unknown error');
      }

      console.log(`✅ Successfully logged in as @${account.username}`);
      return true;

    } catch (error) {
      console.error(`❌ Login error for @${account.username}:`, error.message);
      return false;
    }
  }

  /**
   * Check if session is valid (user is logged in)
   */
  async isSessionValid(page) {
    try {
      // Check for elements that only appear when logged in
      const loggedInIndicators = [
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[data-testid="AppTabBar_Home_Link"]',
        '[aria-label="Home"]'
      ];

      for (const selector of loggedInIndicators) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          return true;
        } catch {
          continue;
        }
      }

      return false;

    } catch {
      return false;
    }
  }

  /**
   * Solve captcha using 2captcha
   */
  async solveCaptcha(page) {
    if (!this.twoCaptchaApiKey) {
      console.log('⚠️  2captcha API key not configured, manual captcha solving required');
      console.log('   Waiting 60 seconds for manual solving...');
      await this.humanDelay(60000, 60000);
      return true;
    }

    try {
      // Get site key
      const siteKey = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha"]');
        if (iframe) {
          const src = iframe.getAttribute('src');
          const match = src.match(/k=([^&]+)/);
          return match ? match[1] : null;
        }
        return null;
      });

      if (!siteKey) {
        console.log('⚠️  Could not extract captcha site key');
        return false;
      }

      console.log(`🔑 Captcha site key: ${siteKey}`);

      // Submit to 2captcha
      const submitResponse = await axios.get('http://2captcha.com/in.php', {
        params: {
          key: this.twoCaptchaApiKey,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: page.url(),
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(`2captcha submit failed: ${submitResponse.data.request}`);
      }

      const taskId = submitResponse.data.request;
      console.log(`⏳ Waiting for captcha solution (ID: ${taskId})...`);

      // Poll for result
      let attempts = 0;
      while (attempts < 60) {  // 5 minutes max
        await this.humanDelay(5000, 5000);

        const resultResponse = await axios.get('http://2captcha.com/res.php', {
          params: {
            key: this.twoCaptchaApiKey,
            action: 'get',
            id: taskId,
            json: 1
          }
        });

        if (resultResponse.data.status === 1) {
          const solution = resultResponse.data.request;
          console.log(`✅ Captcha solved!`);

          // Inject solution
          await page.evaluate((token) => {
            document.getElementById('g-recaptcha-response').innerHTML = token;
          }, solution);

          // Submit form
          await page.evaluate(() => {
            document.querySelector('form').submit();
          });

          return true;
        }

        if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2captcha error: ${resultResponse.data.request}`);
        }

        attempts++;
      }

      throw new Error('Captcha solving timeout');

    } catch (error) {
      console.error(`❌ Captcha solving error:`, error.message);
      return false;
    }
  }

  /**
   * Close session
   */
  async closeSession(accountId) {
    const accountIdStr = accountId.toString();
    
    if (this.activeSessions.has(accountIdStr)) {
      const session = this.activeSessions.get(accountIdStr);
      
      try {
        await adsPowerController.closeProfile(session.accountId);
      } catch (error) {
        console.error(`Error closing session:`, error.message);
      }

      this.activeSessions.delete(accountIdStr);
      console.log(`🔒 Closed session for account ${accountId}`);
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions() {
    console.log(`🔒 Closing ${this.activeSessions.size} active sessions...`);
    
    const promises = Array.from(this.activeSessions.keys()).map(accountId =>
      this.closeSession(accountId)
    );

    await Promise.all(promises);
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  /**
   * Human-like typing
   */
  async typeHuman(page, selector, text) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await element.click();
    await this.humanDelay(100, 300);

    for (const char of text) {
      await element.type(char, { delay: Math.floor(Math.random() * 100) + 50 });
    }
  }

  /**
   * Human-like delay
   */
  async humanDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get page for account (shortcut)
   */
  async getPage(accountId) {
    const session = await this.getSession(accountId);
    return session.page;
  }

  /**
   * Check if account has active session
   */
  hasActiveSession(accountId) {
    return this.activeSessions.has(accountId.toString());
  }
}

module.exports = new TwitterSessionManager();

