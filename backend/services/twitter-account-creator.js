const { TwitterAccount, ResourcePool } = require('../models');
const adsPowerController = require('./adspower-controller');
const phoneService = require('./phone-service');
const cookieManager = require('./cookie-manager');
const axios = require('axios');

/**
 * Twitter Account Creator
 * FULLY AUTOMATED account creation with branding
 */
class TwitterAccountCreator {
  
  /**
   * Create a complete Twitter account from scratch
   */
  async createAccount(config) {
    const { role, niche, linkedChatAccountUsername } = config;

    console.log(`🤖 Creating ${role} account for ${niche}...`);

    try {
      // STEP 1: Get resources
      const resources = await this.getResources(niche, role, linkedChatAccountUsername);
      if (!resources.success) {
        throw new Error(resources.error);
      }

      console.log(`✅ Resources acquired`);

      // STEP 2: Create AdsPower profile
      const username = resources.username;
      const profileResult = await adsPowerController.createProfile({
        username,
        niche,
        proxy: resources.proxy
      });

      if (!profileResult.success) {
        throw new Error(`AdsPower profile creation failed: ${profileResult.error}`);
      }

      console.log(`✅ AdsPower profile created: ${profileResult.profileId}`);

      // STEP 3: Save to database
      const account = new TwitterAccount({
        username,
        email: resources.email,
        password: resources.password,
        phoneNumber: resources.phoneNumber,
        role,
        niche,
        status: 'creating',
        adsPowerProfileId: profileResult.profileId,
        proxyId: resources.proxy?._id,
        bio: resources.bio,
        profilePicUrl: resources.profilePic
      });

      await account.save();

      // STEP 4: Perform Twitter signup
      const signupResult = await this.performCompleteSignup(account, resources);

      if (signupResult.success) {
        account.status = 'warming_up';
        account.warmupPhase.day = 1;
        await account.save();

        console.log(`🎉 Account created successfully: ${username}`);

        return {
          success: true,
          accountId: account._id,
          username: account.username
        };
      } else {
        account.status = 'failed';
        account.notes = `Creation failed: ${signupResult.error}`;
        await account.save();

        throw new Error(signupResult.error);
      }

    } catch (error) {
      console.error(`❌ Account creation failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all resources needed for account creation
   */
  async getResources(niche, role, linkedChatUsername) {
    try {
      const pool = await ResourcePool.findOne();
      if (!pool) {
        return { success: false, error: 'Resource pool not initialized. Upload resources first.' };
      }

      // Get email
      const email = pool.emails.find(e => !e.used);
      if (!email) {
        return { success: false, error: 'No available emails. Add more to resource pool.' };
      }

      // Get phone number
      const phoneResult = await phoneService.getNumber('twitter');
      if (!phoneResult.success) {
        return { success: false, error: 'Failed to get phone number from 5sim' };
      }

      // Get profile picture
      const profilePic = pool.profilePictures.find(p => p.niche === niche && !p.used);
      if (!profilePic) {
        return { success: false, error: `No profile pictures for ${niche}. Upload some first.` };
      }

      // Get bio template
      const bioTemplate = pool.bioTemplates.find(t => t.niche === niche && t.role === role);
      let bio = bioTemplate ? bioTemplate.template : `${niche} enthusiast`;
      
      // Replace variables
      if (linkedChatUsername) {
        bio = bio.replace('{chat_account}', linkedChatUsername);
      }

      // Generate username
      const username = await this.generateUsername(niche, role, pool);

      // Mark resources as used
      email.used = true;
      profilePic.used = true;
      await pool.save();

      return {
        success: true,
        username,
        email: email.address,
        emailPassword: email.password,
        password: this.generatePassword(),
        phoneNumber: phoneResult.number,
        phoneActivationId: phoneResult.activationId,
        profilePic: profilePic.url,
        bio,
        proxy: null // Would get from proxy pool
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform complete Twitter signup
   */
  async performCompleteSignup(account, resources) {
    try {
      const session = await adsPowerController.launchProfile(account.adsPowerProfileId);
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      console.log(`📝 Starting Twitter signup for ${account.username}...`);

      // Navigate to signup
      await page.goto('https://twitter.com/i/flow/signup', { waitUntil: 'networkidle2', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Fill name
      await page.waitForSelector('input[name="name"]', { timeout: 10000 });
      await this.typeHuman(page, 'input[name="name"]', account.username);
      
      // Click next
      await page.click('[role="button"]:has-text("Next")');
      await this.humanDelay(2000, 3000);

      // Fill email
      const emailInput = await page.$('input[name="email"]');
      if (emailInput) {
        await this.typeHuman(page, emailInput, resources.email);
      }

      // Fill phone
      const phoneInput = await page.$('input[name="phone_number"]');
      if (phoneInput) {
        await this.typeHuman(page, phoneInput, resources.phoneNumber);
      }

      await page.click('[role="button"]:has-text("Next")');
      await this.humanDelay(3000, 5000);

      // Handle captcha if present
      const hasCaptcha = await page.$('iframe[src*="recaptcha"]');
      if (hasCaptcha) {
        console.log(`🤖 Solving captcha...`);
        const solved = await this.solveCaptcha(page);
        if (!solved) {
          return { success: false, error: 'Captcha solving failed' };
        }
      }

      // Get SMS code
      console.log(`📱 Waiting for SMS code...`);
      const smsCode = await this.waitForSMS(resources.phoneActivationId);
      if (!smsCode) {
        return { success: false, error: 'SMS code not received' };
      }

      // Enter SMS code
      const codeInput = await page.$('input[name="verification_code"]');
      if (codeInput) {
        await this.typeHuman(page, codeInput, smsCode);
        await page.click('[role="button"]:has-text("Next")');
        await this.humanDelay(3000, 5000);
      }

      // Set password
      const passwordInput = await page.$('input[name="password"]');
      if (passwordInput) {
        await this.typeHuman(page, passwordInput, resources.password);
        await page.click('[role="button"]:has-text("Next")');
        await this.humanDelay(3000, 5000);
      }

      // Skip optional steps
      for (let i = 0; i < 5; i++) {
        const skipBtn = await page.$('[data-testid="ocfSkipButton"]');
        if (skipBtn) {
          await skipBtn.click();
          await this.humanDelay(1000, 2000);
        }
      }

      // Set bio and profile pic
      await this.setupProfile(page, resources.bio, resources.profilePic);

      // Extract cookies
      await cookieManager.extractCookies(account._id);

      console.log(`✅ Signup complete for ${account.username}!`);

      return { success: true };

    } catch (error) {
      console.error(`Error in signup:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async solveCaptcha(page) {
    const apiKey = process.env.TWOCAPTCHA_API_KEY;
    if (!apiKey) return false;

    try {
      const siteKey = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha"]');
        return iframe ? new URL(iframe.src).searchParams.get('k') : null;
      });

      if (!siteKey) return false;

      const res = await axios.get('http://2captcha.com/in.php', {
        params: { key: apiKey, method: 'userrecaptcha', googlekey: siteKey, pageurl: page.url(), json: 1 }
      });

      if (res.data.status !== 1) return false;

      const taskId = res.data.request;

      for (let i = 0; i < 24; i++) {
        await this.humanDelay(5000, 5000);
        const result = await axios.get('http://2captcha.com/res.php', {
          params: { key: apiKey, action: 'get', id: taskId, json: 1 }
        });

        if (result.data.status === 1) {
          await page.evaluate((token) => {
            document.getElementById('g-recaptcha-response').innerHTML = token;
          }, result.data.request);
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  async waitForSMS(activationId) {
    for (let i = 0; i < 60; i++) {
      await this.humanDelay(5000, 5000);
      const result = await phoneService.getSMSCode(activationId);
      if (result.success) return result.code;
    }
    return null;
  }

  async setupProfile(page, bio, profilePicUrl) {
    try {
      await page.goto('https://twitter.com/settings/profile', { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      const bioInput = await page.$('textarea[name="description"]');
      if (bioInput) {
        await bioInput.click();
        await bioInput.type(bio, { delay: 50 });
        
        const saveBtn = await page.$('[data-testid="Profile_Save_Button"]');
        if (saveBtn) await saveBtn.click();
        
        await this.humanDelay(2000, 3000);
      }
    } catch (error) {
      console.log('Profile setup error:', error.message);
    }
  }

  async generateUsername(niche, role, pool) {
    const patterns = pool.usernamePatterns.find(p => p.niche === niche && p.role === role);
    if (patterns && patterns.patterns.length > 0) {
      const pattern = patterns.patterns[Math.floor(Math.random() * patterns.patterns.length)];
      return pattern.replace('{rand}', Math.floor(Math.random() * 10000));
    }
    return `${niche}_${role}_${Math.floor(Math.random() * 10000)}`;
  }

  generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }

  typeHuman(page, selector, text) {
    return page.type(selector, text, { delay: Math.floor(Math.random() * 50) + 50 });
  }

  humanDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = new TwitterAccountCreator();

