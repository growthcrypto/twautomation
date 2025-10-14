const { TwitterAccount, BanDetectionLog, AutomationTask } = require('../models');
const accountLifecycle = require('./account-lifecycle');
const adsPowerController = require('./adspower-controller');

/**
 * Health Monitoring & Ban Detection System
 * Runs periodic checks on all accounts
 */
class HealthMonitor {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  /**
   * Start monitoring (runs every 30 minutes)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Health monitor is already running');
      return;
    }

    console.log('🏥 Starting health monitor...');
    this.isRunning = true;

    // Run immediately
    this.runHealthChecks();

    // Then run every 30 minutes
    const intervalMinutes = parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES) || 30;
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, intervalMinutes * 60 * 1000);

    console.log(`✅ Health monitor started (checking every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.isRunning = false;
      console.log('🛑 Health monitor stopped');
    }
  }

  /**
   * Run health checks on all active accounts
   */
  async runHealthChecks() {
    console.log('\n🏥 Running health checks...');

    try {
      // Get all active and warming_up accounts
      const accounts = await TwitterAccount.find({
        status: { $in: ['active', 'warming_up', 'rate_limited'] }
      });

      console.log(`   Checking ${accounts.length} accounts...`);

      for (const account of accounts) {
        await this.checkAccount(account);
        await this.sleep(2000); // Small delay between checks
      }

      console.log('✅ Health checks complete\n');

    } catch (error) {
      console.error('❌ Error during health checks:', error.message);
    }
  }

  /**
   * Check individual account health
   */
  async checkAccount(account) {
    try {
      // CHECK #1: Action Success Rate
      const actionCheck = await this.checkActionSuccessRate(account);
      
      // CHECK #2: Recent Task Failures
      const taskCheck = await this.checkRecentTaskFailures(account);

      // CHECK #3: Engagement Drop (for active accounts)
      const engagementCheck = account.status === 'active' 
        ? await this.checkEngagementDrop(account)
        : { status: 'ok' };

      // Determine overall health status
      const issues = [];
      let severity = null;

      if (actionCheck.status === 'critical') {
        issues.push('high_fail_rate');
        severity = 'banned';
      } else if (actionCheck.status === 'warning') {
        issues.push('moderate_fail_rate');
        severity = severity || 'shadowbanned';
      }

      if (taskCheck.consecutiveFailures > 5) {
        issues.push('consecutive_failures');
        severity = severity || 'rate_limited';
      }

      if (engagementCheck.status === 'warning') {
        issues.push('engagement_drop');
        severity = severity || 'shadowbanned';
      }

      // Update account health
      account.health.lastHealthCheck = new Date();
      account.health.warningFlags = issues;

      if (issues.length > 0) {
        console.log(`⚠️  ${account.username}: ${issues.join(', ')}`);

        // Take action based on severity
        if (severity === 'banned') {
          await this.handleBannedAccount(account);
        } else if (severity === 'shadowbanned') {
          await this.handleShadowbannedAccount(account);
        } else if (severity === 'rate_limited') {
          await this.handleRateLimited(account);
        }

      } else {
        // Account is healthy
        if (account.status === 'rate_limited') {
          // Recovered from rate limit
          console.log(`✅ ${account.username}: Recovered from rate limit`);
          account.status = account.warmupPhase.completed ? 'active' : 'warming_up';
        }
      }

      await account.save();

    } catch (error) {
      console.error(`Error checking ${account.username}:`, error.message);
    }
  }

  /**
   * Check action success rate over last 50 tasks
   */
  async checkActionSuccessRate(account) {
    try {
      const recentTasks = await AutomationTask.find({
        accountId: account._id,
        status: { $in: ['completed', 'failed'] }
      })
      .sort({ executedAt: -1 })
      .limit(50);

      if (recentTasks.length < 10) {
        return { status: 'ok', successRate: 100 };
      }

      const successCount = recentTasks.filter(t => t.status === 'completed').length;
      const successRate = (successCount / recentTasks.length) * 100;

      account.health.actionSuccessRate = successRate;

      if (successRate < 30) {
        return { status: 'critical', successRate };
      } else if (successRate < 60) {
        return { status: 'warning', successRate };
      } else {
        return { status: 'ok', successRate };
      }

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Check for consecutive task failures
   */
  async checkRecentTaskFailures(account) {
    try {
      const recentTasks = await AutomationTask.find({
        accountId: account._id,
        status: 'failed'
      })
      .sort({ executedAt: -1 })
      .limit(10);

      let consecutiveFailures = 0;
      const latestTasks = await AutomationTask.find({
        accountId: account._id,
        status: { $in: ['completed', 'failed'] }
      })
      .sort({ executedAt: -1 })
      .limit(20);

      for (const task of latestTasks) {
        if (task.status === 'failed') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      account.health.failureCount = consecutiveFailures;

      return {
        consecutiveFailures,
        status: consecutiveFailures > 5 ? 'critical' : 'ok'
      };

    } catch (error) {
      return { consecutiveFailures: 0, status: 'error' };
    }
  }

  /**
   * Check for engagement drops (potential shadowban)
   */
  async checkEngagementDrop(account) {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      if (!account.lastActiveDate || account.lastActiveDate < yesterday) {
        return {
          status: 'warning',
          reason: 'No activity in 24 hours'
        };
      }

      // If account has generated leads before, check if rate has dropped
      if (account.totalLeadsGenerated > 20) {
        // Check leads generated in last 3 days
        const { TwitterLead } = require('../models');
        const recentLeads = await TwitterLead.countDocuments({
          sourceAccount: account._id,
          createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
        });

        // If no leads in 3 days, might be shadowbanned
        if (recentLeads === 0 && account.role === 'traffic') {
          return {
            status: 'warning',
            reason: 'No leads generated in 3 days'
          };
        }
      }

      return { status: 'ok' };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Handle banned account
   */
  async handleBannedAccount(account) {
    console.log(`🚫 ${account.username} is BANNED`);

    // Update status
    account.status = 'banned';
    account.bannedDate = new Date();

    // Log the ban
    await BanDetectionLog.create({
      accountId: account._id,
      detectionMethod: 'action_failure_rate',
      severity: 'banned',
      evidence: {
        failureRate: account.health.actionSuccessRate,
        consecutiveFailures: account.health.failureCount
      },
      actionTaken: 'account_replaced'
    });

    // Pause all pending tasks for this account
    await AutomationTask.updateMany(
      { accountId: account._id, status: 'pending' },
      { status: 'cancelled' }
    );

    // Auto-replace if enabled
    if (process.env.AUTO_RECOVERY_ENABLED === 'true') {
      console.log(`🤖 Triggering auto-replacement for ${account.username}...`);
      
      // Don't await - let it run in background
      accountLifecycle.replaceAccount(account._id)
        .then(result => {
          if (result.success) {
            console.log(`✅ Auto-replacement successful: ${result.newUsername}`);
          } else {
            console.error(`❌ Auto-replacement failed: ${result.error}`);
          }
        });
    } else {
      console.log(`⚠️  Auto-recovery disabled. Manual replacement required.`);
    }
  }

  /**
   * Handle shadowbanned account
   */
  async handleShadowbannedAccount(account) {
    console.log(`👻 ${account.username} is likely SHADOWBANNED`);

    account.status = 'shadowbanned';

    await BanDetectionLog.create({
      accountId: account._id,
      detectionMethod: 'engagement_drop',
      severity: 'shadowbanned',
      evidence: {
        warningFlags: account.health.warningFlags
      },
      actionTaken: 'paused'
    });

    // Pause tasks temporarily
    await AutomationTask.updateMany(
      { accountId: account._id, status: 'pending', scheduledFor: { $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      { $set: { scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
    );

    console.log(`⏸️  Paused ${account.username} for 24 hours to recover`);
  }

  /**
   * Handle rate limited account
   */
  async handleRateLimited(account) {
    console.log(`⏱️  ${account.username} is RATE LIMITED`);

    account.status = 'rate_limited';

    // Reduce limits temporarily
    account.limits.maxFollowsPerDay = Math.floor(account.limits.maxFollowsPerDay * 0.5);
    account.limits.maxDMsPerDay = Math.floor(account.limits.maxDMsPerDay * 0.5);
    account.limits.maxLikesPerDay = Math.floor(account.limits.maxLikesPerDay * 0.5);

    console.log(`📉 Reduced limits for ${account.username} by 50%`);
  }

  /**
   * Utility: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual check for a specific account
   */
  async checkAccountManually(accountId) {
    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    await this.checkAccount(account);

    return {
      success: true,
      account: {
        username: account.username,
        status: account.status,
        health: account.health,
        warningFlags: account.health.warningFlags
      }
    };
  }
}

module.exports = new HealthMonitor();

