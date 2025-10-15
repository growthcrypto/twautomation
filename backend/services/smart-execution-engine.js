const { TwitterAccount } = require('../models');
const followUnfollowCampaign = require('./campaigns/follow-unfollow-campaign');
const massDMCampaign = require('./campaigns/mass-dm-campaign');
const aiChatMonitor = require('./campaigns/ai-chat-monitor');
const warmupAutomation = require('./campaigns/warmup-automation');
const randomActivity = require('./campaigns/random-activity');
const twitterSessionManager = require('./twitter-session-manager');
const browserSessionManager = require('./browser-session-manager');
const healthMonitor = require('./health-monitor');

/**
 * Smart Execution Engine
 * Orchestrates all campaigns, manages sessions, respects quotas
 */
class SmartExecutionEngine {
  constructor() {
    this.isRunning = false;
    this.managedAccounts = new Set();
    this.checkInterval = null;
  }

  /**
   * Start the execution engine
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Execution engine already running');
      return { success: false, reason: 'already_running' };
    }

    console.log('🚀 Starting Smart Execution Engine...');
    this.isRunning = true;

    // Start browser session manager
    browserSessionManager.start();

    // Start health monitor
    healthMonitor.start();

    // Get all active accounts with populated fields (prevent N+1 queries)
    const accounts = await TwitterAccount.find({
      status: { $in: ['active', 'warming_up'] }
    })
    .populate('proxyId')
    .populate('linkedChatAccounts')
    .lean(); // Convert to plain objects for better performance

    console.log(`📊 Found ${accounts.length} accounts to manage`);

    // Start campaigns for each account
    for (const account of accounts) {
      await this.startAccountCampaigns(account);
    }

    // Periodic check (every 5 minutes)
    this.checkInterval = setInterval(async () => {
      await this.periodicCheck();
    }, 5 * 60 * 1000);

    console.log('✅ Smart Execution Engine started');

    return { success: true, accountsManaged: accounts.length };
  }

  /**
   * Start all appropriate campaigns for an account
   */
  async startAccountCampaigns(account) {
    const accountId = account._id;

    try {
      console.log(`🎯 Starting campaigns for @${account.username} (${account.role}, ${account.status})`);

      // Open browser session
      await twitterSessionManager.getSession(accountId);

      // Based on status, start appropriate campaigns
      if (account.status === 'warming_up') {
        // Warmup phase
        await warmupAutomation.startWarmup(accountId);

      } else if (account.status === 'active') {
        // Full campaigns based on role
        if (account.role === 'traffic') {
          // Traffic accounts: Follow/Unfollow + Mass DM
          await followUnfollowCampaign.startCampaign(accountId);
          await massDMCampaign.startCampaign(accountId);

        } else if (account.role === 'chat') {
          // Chat accounts: AI Chat Monitor
          await aiChatMonitor.startMonitor(accountId);
        }

        // Random activity for all active accounts
        await randomActivity.startRandomActivity(accountId);
      }

      this.managedAccounts.add(accountId.toString());

      console.log(`✅ Campaigns started for @${account.username}`);

    } catch (error) {
      console.error(`❌ Error starting campaigns for @${account.username}:`, error.message);
    }
  }

  /**
   * Stop campaigns for an account
   */
  async stopAccountCampaigns(accountId) {
    try {
      console.log(`⏹️  Stopping campaigns for account ${accountId}`);

      // Stop all campaigns
      followUnfollowCampaign.stopCampaign(accountId);
      massDMCampaign.stopCampaign(accountId);
      aiChatMonitor.stopMonitor(accountId);
      warmupAutomation.stopWarmup(accountId);
      randomActivity.stopRandomActivity(accountId);

      // Close browser session
      await twitterSessionManager.closeSession(accountId);

      this.managedAccounts.delete(accountId.toString());

      console.log(`✅ Campaigns stopped for account ${accountId}`);

    } catch (error) {
      console.error(`Error stopping campaigns for ${accountId}:`, error.message);
    }
  }

  /**
   * Periodic check (every 5 minutes)
   */
  async periodicCheck() {
    try {
      console.log('\n🔍 Periodic check...');

      // Get all accounts (with populated fields to avoid N+1 queries)
      const accounts = await TwitterAccount.find({
        status: { $in: ['active', 'warming_up', 'rate_limited'] }
      })
      .populate('proxyId')
      .lean();

      for (const account of accounts) {
        const accountIdStr = account._id.toString();

        // Check if account should be managed
        if (account.status === 'active' || account.status === 'warming_up') {
          // If not currently managed, start campaigns
          if (!this.managedAccounts.has(accountIdStr)) {
            console.log(`🆕 New account detected: @${account.username}`);
            await this.startAccountCampaigns(account);
          }

          // Check if quotas met (close browser to save resources)
          const quotasMet = await this.checkQuotasMet(account);
          if (quotasMet) {
            console.log(`📊 Quotas met for @${account.username}, closing browser`);
            await this.stopAccountCampaigns(account._id);
          }

        } else if (account.status === 'rate_limited') {
          // Rate limited, stop campaigns temporarily
          if (this.managedAccounts.has(accountIdStr)) {
            console.log(`⏸️  Rate limited: @${account.username}, pausing`);
            await this.stopAccountCampaigns(account._id);
          }
        }
      }

      // Check for banned accounts
      const bannedAccounts = await TwitterAccount.find({ status: 'banned' }).lean();
      for (const account of bannedAccounts) {
        if (this.managedAccounts.has(account._id.toString())) {
          console.log(`🚫 Banned account detected: @${account.username}, stopping`);
          await this.stopAccountCampaigns(account._id);
        }
      }

      console.log(`✅ Periodic check complete (${this.managedAccounts.size} active accounts)\n`);

    } catch (error) {
      console.error('Error in periodic check:', error.message);
    }
  }

  /**
   * Check if account has met daily quotas
   */
  async checkQuotasMet(account) {
    // Reset daily stats if new day
    const today = new Date().toDateString();
    const lastReset = account.today.lastResetDate ? account.today.lastResetDate.toDateString() : null;

    if (today !== lastReset) {
      // New day, reset
      account.today = {
        follows: 0,
        unfollows: 0,
        dms: 0,
        likes: 0,
        tweets: 0,
        lastResetDate: new Date()
      };
      await account.save();
      return false;
    }

    // Check if all quotas met
    const followsMet = account.today.follows >= account.limits.maxFollowsPerDay;
    const dmsMet = account.today.dms >= account.limits.maxDMsPerDay;
    const likesMet = account.today.likes >= account.limits.maxLikesPerDay;

    if (account.role === 'traffic') {
      return followsMet && dmsMet;
    } else if (account.role === 'chat') {
      return dmsMet;
    }

    return false;
  }

  /**
   * Stop the execution engine
   */
  async stop() {
    if (!this.isRunning) {
      return { success: false, reason: 'not_running' };
    }

    console.log('🛑 Stopping Smart Execution Engine...');

    this.isRunning = false;

    // Clear interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Stop all account campaigns
    const accountIds = Array.from(this.managedAccounts);
    for (const accountId of accountIds) {
      await this.stopAccountCampaigns(accountId);
    }

    // Stop health monitor
    healthMonitor.stop();

    // Stop browser session manager
    await browserSessionManager.stop();

    // Close all sessions
    await twitterSessionManager.closeAllSessions();

    console.log('✅ Smart Execution Engine stopped');

    return { success: true };
  }

  /**
   * Add a new account to management
   */
  async addAccount(accountId) {
    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    await this.startAccountCampaigns(account);

    return { success: true };
  }

  /**
   * Remove account from management
   */
  async removeAccount(accountId) {
    await this.stopAccountCampaigns(accountId);
    return { success: true };
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      managedAccounts: this.managedAccounts.size,
      accounts: Array.from(this.managedAccounts),
      activeSessions: twitterSessionManager.getActiveSessionsCount()
    };
  }
}

module.exports = new SmartExecutionEngine();

