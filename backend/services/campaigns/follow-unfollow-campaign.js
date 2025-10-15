const { FollowUnfollowConfig, TwitterAccount, AutomationTask } = require('../../models');
const twitterAutomationEngine = require('../twitter-automation-engine');
const { incrementDailyCounter } = require('../../utils/account-helpers');
const moment = require('moment-timezone');

/**
 * Follow/Unfollow Campaign Executor
 * Respects all config options: timing, breaks, active hours, etc.
 */
class FollowUnfollowCampaign {
  constructor() {
    this.runningCampaigns = new Map(); // accountId -> campaign state
  }

  /**
   * Start campaign for an account
   */
  async startCampaign(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get config for this account
      const config = await FollowUnfollowConfig.findOne({
        accountIds: accountId,
        enabled: true
      });

      if (!config) {
        console.log(`⚠️  No active Follow/Unfollow config for account ${account.username}`);
        return { success: false, reason: 'no_config' };
      }

      console.log(`🚀 Starting Follow/Unfollow campaign for @${account.username}`);

      // Initialize campaign state
      const state = {
        accountId,
        config,
        actionsToday: 0,
        actionsSinceBreak: 0,
        isOnBreak: false,
        breakUntil: null,
        lastActionTime: null
      };

      this.runningCampaigns.set(accountId.toString(), state);

      // Start execution loop
      this.executeCampaignLoop(state);

      return { success: true, config: config.name };

    } catch (error) {
      console.error('Error starting campaign:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Main campaign execution loop
   */
  async executeCampaignLoop(state) {
    const accountIdStr = state.accountId.toString();

    // Check if campaign should still run
    if (!this.runningCampaigns.has(accountIdStr)) {
      console.log(`⏹️  Campaign stopped for account ${accountIdStr}`);
      return;
    }

    try {
      // Check if within active hours
      if (!this.isWithinActiveHours(state.config.activeHours)) {
        console.log(`⏰ Outside active hours, waiting...`);
        setTimeout(() => this.executeCampaignLoop(state), 60 * 1000); // Check again in 1 min
        return;
      }

      // Check if on break
      if (state.isOnBreak) {
        const now = Date.now();
        if (now < state.breakUntil) {
          const remainingMin = Math.ceil((state.breakUntil - now) / 1000 / 60);
          console.log(`☕ On break for ${remainingMin} more minutes...`);
          setTimeout(() => this.executeCampaignLoop(state), 60 * 1000);
          return;
        } else {
          // Break over
          state.isOnBreak = false;
          state.actionsSinceBreak = 0;
          console.log(`✅ Break over, resuming campaign`);
        }
      }

      // Check daily limit
      const account = await TwitterAccount.findById(state.accountId);
      if (account.today.follows >= state.config.maxFollowsPerDay) {
        console.log(`📊 Daily follow limit reached (${account.today.follows}/${state.config.maxFollowsPerDay})`);
        setTimeout(() => this.executeCampaignLoop(state), 60 * 60 * 1000); // Check again in 1 hour
        return;
      }

      // Respect delay between actions
      if (state.lastActionTime) {
        const timeSinceLastAction = Date.now() - state.lastActionTime;
        const minDelay = state.config.delayBetweenFollows.min * 1000;
        
        if (timeSinceLastAction < minDelay) {
          const waitTime = minDelay - timeSinceLastAction;
          setTimeout(() => this.executeCampaignLoop(state), waitTime);
          return;
        }
      }

      // Execute follow action
      await this.executeFollowAction(state);

      // Check if should take break
      if (state.config.breaks.enabled) {
        if (state.actionsSinceBreak >= state.config.breaks.afterActions) {
          this.takeBreak(state);
        }
      }

      // Schedule next action
      const delay = this.randomBetween(
        state.config.delayBetweenFollows.min * 1000,
        state.config.delayBetweenFollows.max * 1000
      );

      setTimeout(() => this.executeCampaignLoop(state), delay);

    } catch (error) {
      console.error('Error in campaign loop:', error.message);
      
      // Retry after delay
      setTimeout(() => this.executeCampaignLoop(state), 60 * 1000);
    }
  }

  /**
   * Execute a single follow action
   */
  async executeFollowAction(state) {
    try {
      // Get target user to follow
      const target = await this.getNextTarget(state);
      
      if (!target) {
        console.log(`⚠️  No more targets available`);
        return;
      }

      // Execute follow
      const result = await twitterAutomationEngine.follow(
        state.accountId,
        target,
        state.config
      );

      if (result.success) {
        // Update stats
        state.actionsToday++;
        state.actionsSinceBreak++;
        state.lastActionTime = Date.now();

        // Update account stats atomically (prevents race conditions)
        await incrementDailyCounter(state.accountId, 'follows');

        // Schedule unfollow (if follow-back checker enabled)
        if (state.config.followBackChecker.enabled) {
          await AutomationTask.create({
            taskType: 'unfollow',
            accountId: state.accountId,
            targetUsername: target,
            scheduledFor: new Date(Date.now() + state.config.followBackChecker.checkAfterDays * 24 * 60 * 60 * 1000),
            priority: 3
          });
        }

        console.log(`✅ Follow action successful (${state.actionsToday} today)`);

      } else {
        console.log(`⚠️  Follow action failed: ${result.reason || result.error}`);
      }

    } catch (error) {
      console.error('Error executing follow action:', error.message);
    }
  }

  /**
   * Get next target to follow
   */
  async getNextTarget(state) {
    try {
      // Select source based on weights
      const source = this.selectSourceByWeight(state.config.targetSources);
      
      if (!source) return null;

      let targets = [];

      switch (source.type) {
        case 'community':
          const communityResult = await twitterAutomationEngine.scrapeCommunityMembers(
            state.accountId,
            source.value,
            10
          );
          targets = communityResult.success ? communityResult.usernames : [];
          break;

        case 'hashtag':
          const hashtagResult = await twitterAutomationEngine.scrapeHashtagUsers(
            state.accountId,
            source.value,
            10
          );
          targets = hashtagResult.success ? hashtagResult.usernames : [];
          break;

        case 'follower_scrape':
          const followerResult = await twitterAutomationEngine.scrapeFollowers(
            state.accountId,
            source.value,
            10
          );
          targets = followerResult.success ? followerResult.usernames : [];
          break;
      }

      // Pick random target
      return targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : null;

    } catch (error) {
      console.error('Error getting next target:', error.message);
      return null;
    }
  }

  /**
   * Select source by weight
   */
  selectSourceByWeight(sources) {
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const source of sources) {
      random -= source.weight;
      if (random <= 0) {
        return source;
      }
    }

    return sources[0];
  }

  /**
   * Take a break
   */
  takeBreak(state) {
    const breakDuration = this.randomBetween(
      state.config.breaks.breakDuration.min * 1000,
      state.config.breaks.breakDuration.max * 1000
    );

    state.isOnBreak = true;
    state.breakUntil = Date.now() + breakDuration;

    console.log(`☕ Taking break for ${Math.ceil(breakDuration / 1000 / 60)} minutes`);
  }

  /**
   * Check if within active hours
   */
  isWithinActiveHours(activeHours) {
    const now = moment().tz(activeHours.timezone);
    const currentTime = now.format('HH:mm');
    
    return currentTime >= activeHours.start && currentTime <= activeHours.end;
  }

  /**
   * Stop campaign
   */
  stopCampaign(accountId) {
    const accountIdStr = accountId.toString();
    
    if (this.runningCampaigns.has(accountIdStr)) {
      this.runningCampaigns.delete(accountIdStr);
      console.log(`⏹️  Stopped Follow/Unfollow campaign for account ${accountId}`);
      return { success: true };
    }

    return { success: false, reason: 'campaign_not_running' };
  }

  /**
   * Get campaign status
   */
  getCampaignStatus(accountId) {
    const state = this.runningCampaigns.get(accountId.toString());
    
    if (!state) {
      return { running: false };
    }

    return {
      running: true,
      actionsToday: state.actionsToday,
      actionsSinceBreak: state.actionsSinceBreak,
      isOnBreak: state.isOnBreak,
      breakUntil: state.breakUntil,
      configName: state.config.name
    };
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = new FollowUnfollowCampaign();

