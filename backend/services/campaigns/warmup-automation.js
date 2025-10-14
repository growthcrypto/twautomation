const { WarmupConfig, TwitterAccount } = require('../../models');
const twitterAutomationEngine = require('../twitter-automation-engine');

/**
 * Warmup Automation
 * Gradually increases activity for new accounts (7-day ramp-up)
 */
class WarmupAutomation {
  constructor() {
    this.runningWarmups = new Map();
  }

  async startWarmup(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      // Get default warmup config
      let config = await WarmupConfig.findOne({ enabled: true });
      
      if (!config) {
        // Use default 7-day schedule
        config = await this.getDefaultWarmupConfig();
      }

      console.log(`🌱 Starting warmup for @${account.username} (Day ${account.warmupPhase.day})`);

      const state = {
        accountId,
        account,
        config,
        currentDay: account.warmupPhase.day
      };

      this.runningWarmups.set(accountId.toString(), state);
      this.executeWarmupDay(state);

      return { success: true, day: state.currentDay };

    } catch (error) {
      console.error('Error starting warmup:', error.message);
      return { success: false, error: error.message };
    }
  }

  async executeWarmupDay(state) {
    const accountIdStr = state.accountId.toString();

    if (!this.runningWarmups.has(accountIdStr)) return;

    try {
      const account = await TwitterAccount.findById(state.accountId);
      const daySchedule = this.getDaySchedule(state.config, state.currentDay);

      if (!daySchedule) {
        // Warmup complete!
        account.status = 'active';
        account.warmupPhase.completed = true;
        account.warmupPhase.day = 7;
        await account.save();

        console.log(`🎉 Warmup complete for @${account.username}!`);
        this.runningWarmups.delete(accountIdStr);
        return;
      }

      console.log(`📅 Day ${state.currentDay} warmup for @${account.username}`);
      console.log(`   Actions: ${JSON.stringify(daySchedule.actions)}`);

      // Execute day's actions
      await this.executeDayActions(state, daySchedule.actions);

      // Progress to next day
      state.currentDay++;
      account.warmupPhase.day = state.currentDay;
      await account.save();

      // Schedule next day (24 hours from now)
      setTimeout(() => this.executeWarmupDay(state), 24 * 60 * 60 * 1000);

    } catch (error) {
      console.error('Error executing warmup day:', error.message);
      // Retry tomorrow
      setTimeout(() => this.executeWarmupDay(state), 24 * 60 * 60 * 1000);
    }
  }

  async executeDayActions(state, actions) {
    const page = await require('../twitter-session-manager').getPage(state.accountId);

    // Profile views
    if (actions.profileViews) {
      const count = this.randomBetween(actions.profileViews.min, actions.profileViews.max);
      for (let i = 0; i < count; i++) {
        await twitterAutomationEngine.viewProfile(page, `user_${Math.random()}`, { min: 2, max: 5 });
        await this.sleep(this.randomBetween(30, 60) * 1000);
      }
    }

    // Feed scrolling
    if (actions.scrollFeed) {
      const count = this.randomBetween(actions.scrollFeed.min, actions.scrollFeed.max);
      for (let i = 0; i < count; i++) {
        const duration = this.randomBetween(actions.scrollFeed.duration.min, actions.scrollFeed.duration.max);
        await twitterAutomationEngine.scrollFeed(page, duration);
        await this.sleep(this.randomBetween(60, 120) * 1000);
      }
    }

    // Likes (random tweets from feed)
    if (actions.likes) {
      const count = this.randomBetween(actions.likes.min, actions.likes.max);
      for (let i = 0; i < count; i++) {
        await twitterAutomationEngine.likeRecentTweet(page);
        await this.sleep(this.randomBetween(20, 60) * 1000);
      }
    }

    // Follows (would use follow campaign logic)
    // DMs (would use mass DM logic)
    // For warmup, we do minimal follows/DMs

    console.log(`✅ Completed day ${state.currentDay} actions`);
  }

  getDaySchedule(config, day) {
    return config.schedule.find(s => s.day === day);
  }

  async getDefaultWarmupConfig() {
    // Default 7-day warmup schedule
    return {
      schedule: [
        { day: 1, actions: { profileViews: { min: 10, max: 20 }, scrollFeed: { min: 5, max: 10, duration: { min: 30, max: 60 } }, likes: { min: 5, max: 15 } } },
        { day: 2, actions: { profileViews: { min: 15, max: 25 }, scrollFeed: { min: 10, max: 15, duration: { min: 30, max: 90 } }, likes: { min: 10, max: 20 } } },
        { day: 3, actions: { profileViews: { min: 20, max: 30 }, scrollFeed: { min: 15, max: 20, duration: { min: 30, max: 120 } }, likes: { min: 20, max: 40 } } },
        { day: 4, actions: { profileViews: { min: 20, max: 30 }, likes: { min: 20, max: 40 } } },
        { day: 5, actions: { profileViews: { min: 30, max: 50 }, likes: { min: 50, max: 100 } } },
        { day: 6, actions: { profileViews: { min: 30, max: 50 }, likes: { min: 50, max: 100 } } },
        { day: 7, actions: { profileViews: { min: 50, max: 80 }, likes: { min: 100, max: 200 } } }
      ]
    };
  }

  stopWarmup(accountId) {
    this.runningWarmups.delete(accountId.toString());
    return { success: true };
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new WarmupAutomation();

