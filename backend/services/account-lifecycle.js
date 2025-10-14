const { TwitterAccount, ResourcePool, Proxy, BanDetectionLog } = require('../models');
const adsPowerController = require('./adspower-controller');
const phoneService = require('./phone-service');
const fs = require('fs').promises;
const path = require('path');

class AccountLifecycleManager {
  constructor() {
    this.warmupSchedules = {
      day1: { follows: 10, likes: 20, dms: 0 },
      day2: { follows: 10, likes: 20, dms: 0 },
      day3: { follows: 20, likes: 50, dms: 5 },
      day4: { follows: 20, likes: 50, dms: 5 },
      day5: { follows: 50, likes: 100, dms: 10 },
      day6: { follows: 50, likes: 100, dms: 10 },
      day7: { follows: 100, likes: 200, dms: 20 }
    };
  }

  /**
   * AUTO-CREATE NEW TWITTER ACCOUNT
   * This is the magic - fully automated account creation
   */
  async createNewAccount(config) {
    const { role, niche, linkedChatAccountId } = config;

    console.log(`🤖 Starting auto-creation for ${role} account (${niche})...`);

    try {
      // STEP 1: Get resources from pool
      const resources = await this.getResourcesFromPool(niche, role);
      if (!resources.success) {
        throw new Error(`Failed to get resources: ${resources.error}`);
      }

      console.log(`✅ Resources acquired: ${resources.email}, ${resources.phoneNumber}`);

      // STEP 2: Assign proxy
      const proxy = await this.assignProxy();
      if (!proxy) {
        throw new Error('No available proxies');
      }

      console.log(`✅ Proxy assigned: ${proxy.host}:${proxy.port}`);

      // STEP 3: Create AdsPower profile
      const username = await this.generateUsername(niche, role);
      const profileResult = await adsPowerController.createProfile({
        username,
        niche,
        proxy: {
          type: proxy.type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password
        }
      });

      if (!profileResult.success) {
        throw new Error(`Failed to create browser profile: ${profileResult.error}`);
      }

      console.log(`✅ Browser profile created: ${profileResult.profileId}`);

      // STEP 4: Create database record
      const account = new TwitterAccount({
        username,
        email: resources.email,
        password: resources.generatedPassword,
        phoneNumber: resources.phoneNumber,
        role,
        niche,
        status: 'creating',
        adsPowerProfileId: profileResult.profileId,
        proxyId: proxy._id,
        bio: resources.bio,
        profilePicUrl: resources.profilePic,
        linkedChatAccounts: role === 'traffic' && linkedChatAccountId ? [linkedChatAccountId] : []
      });

      await account.save();

      console.log(`✅ Account record created in database: ${username}`);

      // STEP 5: Launch browser and create Twitter account
      const creationResult = await this.performTwitterSignup(account, resources);
      
      if (creationResult.success) {
        account.status = 'warming_up';
        account.warmupPhase.day = 1;
        await account.save();

        console.log(`🎉 Account ${username} created successfully! Entering warmup phase.`);

        return {
          success: true,
          accountId: account._id,
          username: account.username
        };
      } else {
        // Cleanup on failure
        account.status = 'archived';
        account.notes = `Creation failed: ${creationResult.error}`;
        await account.save();

        throw new Error(creationResult.error);
      }

    } catch (error) {
      console.error(`❌ Auto-creation failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get resources from the pool (email, phone, profile pic, bio)
   */
  async getResourcesFromPool(niche, role) {
    try {
      const pool = await ResourcePool.findOne();
      if (!pool) {
        return { success: false, error: 'Resource pool not initialized' };
      }

      // Get unused email
      const email = pool.emails.find(e => !e.used);
      if (!email) {
        return { success: false, error: 'No available emails' };
      }

      // Get phone number from service
      const phoneResult = await phoneService.getNumber('twitter');
      if (!phoneResult.success) {
        return { success: false, error: 'Failed to get phone number' };
      }

      // Get unused profile picture for this niche
      const profilePic = pool.profilePictures.find(
        p => p.niche === niche && !p.used
      );
      if (!profilePic) {
        return { success: false, error: `No available profile pics for ${niche}` };
      }

      // Get bio template
      const bioTemplate = pool.bioTemplates.find(
        t => t.niche === niche && t.role === role
      );
      if (!bioTemplate) {
        return { success: false, error: `No bio template for ${niche} ${role}` };
      }

      // Mark as used
      email.used = true;
      profilePic.used = true;
      await pool.save();

      // Generate bio from template
      const bio = this.generateBio(bioTemplate, role);

      return {
        success: true,
        email: email.address,
        emailPassword: email.password,
        phoneNumber: phoneResult.number,
        phoneActivationId: phoneResult.activationId,
        profilePic: profilePic.url,
        bio,
        generatedPassword: this.generatePassword()
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform Twitter signup automation
   */
  async performTwitterSignup(account, resources) {
    let browser;
    try {
      // Launch browser
      const session = await adsPowerController.launchProfile(account.adsPowerProfileId);
      browser = session.browser;
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      // Navigate to Twitter signup
      await page.goto('https://twitter.com/i/flow/signup', { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      // Fill in name/email
      await page.waitForSelector('input[autocomplete="name"]', { timeout: 10000 });
      await this.typeHuman(page, 'input[autocomplete="name"]', account.username);
      await this.humanDelay(500, 1000);

      // NOTE: This is a simplified version. Full implementation would handle:
      // - Email input
      // - Phone verification
      // - Captcha solving (manual or via API like 2captcha)
      // - Profile setup
      // - Bio/pic upload

      console.log(`⏸️  Twitter signup initiated for ${account.username}`);
      console.log(`   Manual step required: Complete captcha and phone verification`);
      console.log(`   Phone number: ${resources.phoneNumber}`);
      console.log(`   Once verified, account will enter warmup phase`);

      // For now, we'll mark it as needing manual completion
      return {
        success: true,
        needsManualVerification: true,
        phoneNumber: resources.phoneNumber
      };

    } catch (error) {
      console.error(`Error during Twitter signup:`, error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      // Don't close browser - leave it open for manual verification
      // await adsPowerController.closeProfile(account.adsPowerProfileId);
    }
  }

  /**
   * Replace a banned account with a new one
   */
  async replaceAccount(bannedAccountId) {
    try {
      const bannedAccount = await TwitterAccount.findById(bannedAccountId);
      if (!bannedAccount) {
        throw new Error('Banned account not found');
      }

      console.log(`🔄 Replacing banned account: ${bannedAccount.username}`);

      // Create new account with same role/niche
      const newAccountResult = await this.createNewAccount({
        role: bannedAccount.role,
        niche: bannedAccount.niche,
        linkedChatAccountId: bannedAccount.linkedChatAccounts[0]
      });

      if (newAccountResult.success) {
        // Log the replacement
        await BanDetectionLog.findOneAndUpdate(
          { accountId: bannedAccountId, resolvedAt: null },
          {
            actionTaken: 'account_replaced',
            replacementAccountId: newAccountResult.accountId,
            resolvedAt: new Date()
          }
        );

        // Archive the banned account
        bannedAccount.status = 'archived';
        bannedAccount.notes = `Replaced by ${newAccountResult.username}`;
        await bannedAccount.save();

        console.log(`✅ Account replaced: ${bannedAccount.username} → ${newAccountResult.username}`);

        return {
          success: true,
          oldAccount: bannedAccount.username,
          newAccountId: newAccountResult.accountId,
          newUsername: newAccountResult.username
        };
      } else {
        throw new Error(newAccountResult.error);
      }

    } catch (error) {
      console.error(`❌ Failed to replace account:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Progress account through warmup phase
   */
  async progressWarmup(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account || account.status !== 'warming_up') {
        return { success: false, error: 'Account not in warmup phase' };
      }

      const currentDay = account.warmupPhase.day;
      const nextDay = currentDay + 1;

      if (nextDay > 7) {
        // Warmup complete!
        account.status = 'active';
        account.warmupPhase.completed = true;
        account.activatedDate = new Date();
        
        // Set full limits
        account.limits.maxFollowsPerDay = parseInt(process.env.MAX_FOLLOWS_PER_DAY) || 100;
        account.limits.maxDMsPerDay = parseInt(process.env.MAX_DMS_PER_DAY) || 50;
        account.limits.maxLikesPerDay = parseInt(process.env.MAX_LIKES_PER_DAY) || 200;

        await account.save();

        console.log(`🎉 ${account.username} completed warmup! Now ACTIVE.`);

        return {
          success: true,
          status: 'completed',
          account: account.username
        };
      }

      // Set limits for next day
      const schedule = this.warmupSchedules[`day${nextDay}`];
      account.warmupPhase.day = nextDay;
      account.limits.maxFollowsPerDay = schedule.follows;
      account.limits.maxDMsPerDay = schedule.dms;
      account.limits.maxLikesPerDay = schedule.likes;

      await account.save();

      console.log(`📅 ${account.username} progressed to warmup day ${nextDay}`);

      return {
        success: true,
        status: 'progressed',
        day: nextDay,
        limits: schedule
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign an available proxy to an account
   */
  async assignProxy() {
    try {
      // Find proxy with available slots
      const proxy = await Proxy.findOne({
        status: 'active',
        $expr: { $lt: [{ $size: '$assignedAccounts' }, '$maxAccountsPerProxy'] }
      });

      return proxy;
    } catch (error) {
      console.error('Error assigning proxy:', error);
      return null;
    }
  }

  /**
   * Generate username based on niche and role
   */
  async generateUsername(niche, role) {
    const pool = await ResourcePool.findOne();
    if (!pool) {
      // Fallback username generation
      const random = Math.floor(Math.random() * 10000);
      return `${niche}_${role}_${random}`;
    }

    const patterns = pool.usernamePatterns.find(
      p => p.niche === niche && p.role === role
    );

    if (!patterns || patterns.patterns.length === 0) {
      const random = Math.floor(Math.random() * 10000);
      return `${niche}_${role}_${random}`;
    }

    // Pick random pattern
    const pattern = patterns.patterns[Math.floor(Math.random() * patterns.patterns.length)];
    
    // Replace {rand} with random number
    const random = Math.floor(Math.random() * 10000);
    return pattern.replace('{rand}', random);
  }

  /**
   * Generate bio from template
   */
  generateBio(bioTemplate, role) {
    let bio = bioTemplate.template;
    
    // Replace variables
    // Example: "⚽ Hot takes | Main: {chat_account}" → "⚽ Hot takes | Main: @ChatAcct_Soccer_1"
    // For now, return template as-is (you'll need to pass chat account name)
    
    return bio;
  }

  /**
   * Generate secure password
   */
  generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }

  /**
   * Human-like typing
   */
  async typeHuman(page, selector, text) {
    await page.type(selector, text, { delay: Math.floor(Math.random() * 50) + 50 });
  }

  /**
   * Human-like delay
   */
  async humanDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = new AccountLifecycleManager();

