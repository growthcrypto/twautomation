const { FollowUnfollowConfig, TwitterAccount, AutomationTask } = require('../../models');
const twitterAutomationEngine = require('../twitter-automation-engine');
const liveFollowEngine = require('../live-follow-engine');
const { incrementDailyCounter } = require('../../utils/account-helpers');
const actionCoordinator = require('../action-coordinator');
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

      // Execute follow action with lock (prevents race conditions with other campaigns)
      await actionCoordinator.executeWithLock(
        state.accountId,
        'Follow/Unfollow',
        async () => await this.executeFollowAction(state)
      );

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
   * Execute follow session (batch of follows with live scrolling)
   */
  async executeFollowAction(state) {
    try {
      // Select source based on weights
      const source = this.selectSourceByWeight(state.config.targetSources);
      
      if (!source) {
        console.log(`⚠️  No target sources configured`);
        return;
      }

      // Calculate how many to follow in this session
      const account = await TwitterAccount.findById(state.accountId);
      const remainingToday = state.config.maxFollowsPerDay - (account.today.follows || 0);
      
      if (remainingToday <= 0) {
        console.log(`📊 Daily follow limit reached`);
        return;
      }

      // Follow 3-8 users per session (more human-like than one at a time)
      const batchSize = Math.min(
        this.randomBetween(3, 8),
        remainingToday
      );

      console.log(`🎯 Starting follow session: ${batchSize} follows from ${source.type}`);

      let result;

      switch (source.type) {
        case 'community':
          result = await liveFollowEngine.followFromCommunity(
            state.accountId,
            source.value,
            batchSize,
            {
              ...state.config,
              randomSkipProbability: state.config.humanization?.randomSkip || 20,
              inspectProfileProbability: state.config.humanization?.inspectProfile || 30,
              delayBetweenFollows: state.config.delayBetweenFollows || { min: 3, max: 8 }
            }
          );
          break;

        case 'hashtag':
          result = await liveFollowEngine.followFromHashtag(
            state.accountId,
            source.value,
            batchSize,
            {
              ...state.config,
              randomSkipProbability: state.config.humanization?.randomSkip || 20,
              delayBetweenFollows: state.config.delayBetweenFollows || { min: 3, max: 8 }
            }
          );
          break;

        default:
          console.log(`⚠️  Unknown source type: ${source.type}`);
          return;
      }

      if (result.success && result.followedCount > 0) {
        // Update stats
        state.actionsToday += result.followedCount;
        state.actionsSinceBreak += result.followedCount;
        state.lastActionTime = Date.now();

        // Update account stats
        for (let i = 0; i < result.followedCount; i++) {
          await incrementDailyCounter(state.accountId, 'follows');
        }

        console.log(`✅ Follow session complete (${result.followedCount} follows, ${state.actionsToday} today)`);

      } else {
        console.log(`⚠️  Follow session failed or found no users`);
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

