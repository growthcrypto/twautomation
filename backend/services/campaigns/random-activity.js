const { RandomActivityConfig } = require('../../models');
const twitterAutomationEngine = require('../twitter-automation-engine');
const twitterSessionManager = require('../twitter-session-manager');

/**
 * Random Activity Generator
 * Makes accounts look human with natural behavior
 */
class RandomActivity {
  constructor() {
    this.runningActivities = new Map();
  }

  async startRandomActivity(accountId) {
    try {
      const config = await RandomActivityConfig.findOne({
        accountIds: accountId,
        enabled: true
      });

      if (!config) {
        return { success: false, reason: 'no_config' };
      }

      console.log(`🎲 Starting random activity for account ${accountId}`);

      const state = {
        accountId,
        config,
        activitiesToday: {}
      };

      this.runningActivities.set(accountId.toString(), state);
      this.executeRandomActivityLoop(state);

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeRandomActivityLoop(state) {
    const accountIdStr = state.accountId.toString();

    if (!this.runningActivities.has(accountIdStr)) return;

    try {
      // Pick a random activity to perform
      const activity = this.selectRandomActivity(state.config);

      if (activity) {
        await this.performActivity(state, activity);
      }

      // Schedule next activity (random interval)
      const nextActivityIn = this.randomBetween(10, 30) * 60 * 1000; // 10-30 minutes
      setTimeout(() => this.executeRandomActivityLoop(state), nextActivityIn);

    } catch (error) {
      console.error('Error in random activity loop:', error.message);
      setTimeout(() => this.executeRandomActivityLoop(state), 30 * 60 * 1000);
    }
  }

  selectRandomActivity(config) {
    const activities = [];

    if (config.profileBrowsing?.enabled) activities.push('profileBrowsing');
    if (config.feedScrolling?.enabled) activities.push('feedScrolling');
    if (config.randomLikes?.enabled) activities.push('randomLikes');
    if (config.randomRetweets?.enabled) activities.push('randomRetweets');
    if (config.searchActivity?.enabled) activities.push('searchActivity');
    if (config.checkNotifications?.enabled) activities.push('checkNotifications');

    if (activities.length === 0) return null;

    return activities[Math.floor(Math.random() * activities.length)];
  }

  async performActivity(state, activityType) {
    const page = await twitterSessionManager.getPage(state.accountId);
    const config = state.config;

    try {
      switch (activityType) {
        case 'profileBrowsing':
          await this.profileBrowsing(page, config.profileBrowsing);
          break;

        case 'feedScrolling':
          await this.feedScrolling(page, config.feedScrolling);
          break;

        case 'randomLikes':
          await this.randomLikes(page, config.randomLikes);
          break;

        case 'randomRetweets':
          await this.randomRetweets(page, config.randomRetweets);
          break;

        case 'searchActivity':
          await this.searchActivity(page, config.searchActivity);
          break;

        case 'checkNotifications':
          await this.checkNotifications(page, config.checkNotifications);
          break;
      }

      console.log(`✅ Performed random activity: ${activityType}`);

    } catch (error) {
      console.error(`Error performing ${activityType}:`, error.message);
    }
  }

  async profileBrowsing(page, config) {
    const scrollTime = this.randomBetween(config.scrollTime.min, config.scrollTime.max);
    
    // Navigate to random profile (would need a list of profiles to browse)
    await page.goto('https://twitter.com/explore', { waitUntil: 'networkidle2' });
    
    // Click on first profile
    const profileLink = await page.$('[data-testid="UserCell"] a');
    if (profileLink) {
      await profileLink.click();
      await this.sleep(2000);

      // Scroll the profile
      for (let i = 0; i < scrollTime; i++) {
        await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
        await this.sleep(1000);
      }

      // Maybe click on tabs
      if (config.clickOnTabs?.enabled && Math.random() * 100 < config.clickOnTabs.probability) {
        const tabs = config.clickOnTabs.tabs || ['Tweets', 'Replies', 'Media'];
        const randomTab = tabs[Math.floor(Math.random() * tabs.length)];
        
        const tabLink = await page.$(`a[href*="/${randomTab.toLowerCase()}"]`);
        if (tabLink) {
          await tabLink.click();
          await this.sleep(2000);
        }
      }
    }
  }

  async feedScrolling(page, config) {
    await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
    
    const duration = this.randomBetween(config.duration.min, config.duration.max);
    const scrolls = Math.floor(duration / 3);

    for (let i = 0; i < scrolls; i++) {
      await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 300));
      await this.sleep(this.randomBetween(2000, 4000));

      // Stop to "read"
      if (config.stopToRead?.enabled && Math.random() * 100 < config.stopToRead.probability) {
        const stopDuration = this.randomBetween(
          config.stopToRead.duration.min * 1000,
          config.stopToRead.duration.max * 1000
        );
        await this.sleep(stopDuration);
      }
    }
  }

  async randomLikes(page, config) {
    await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
    
    // Like first tweet
    const likeBtn = await page.$('[data-testid="like"]');
    if (likeBtn) {
      await likeBtn.click();
      await this.sleep(1000);
    }
  }

  async randomRetweets(page, config) {
    await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
    
    const retweetBtn = await page.$('[data-testid="retweet"]');
    if (retweetBtn) {
      await retweetBtn.click();
      await this.sleep(1000);

      // Confirm retweet
      const confirmBtn = await page.$('[data-testid="retweetConfirm"]');
      if (confirmBtn) {
        await confirmBtn.click();
      }
    }
  }

  async searchActivity(page, config) {
    const searches = config.searches || ['{niche} news', 'trending'];
    const search = searches[Math.floor(Math.random() * searches.length)];

    await page.goto(`https://twitter.com/search?q=${encodeURIComponent(search)}`, { 
      waitUntil: 'networkidle2' 
    });

    const browseDuration = this.randomBetween(
      config.browseResults.duration.min * 1000,
      config.browseResults.duration.max * 1000
    );

    await this.sleep(browseDuration);
  }

  async checkNotifications(page, config) {
    await page.goto('https://twitter.com/notifications', { waitUntil: 'networkidle2' });
    await this.sleep(this.randomBetween(5000, 15000));

    // Maybe click on a notification
    if (Math.random() * 100 < config.clickOn.probability) {
      const notification = await page.$('[data-testid="notification"]');
      if (notification) {
        await notification.click();
        await this.sleep(this.randomBetween(5000, 10000));
      }
    }
  }

  stopRandomActivity(accountId) {
    this.runningActivities.delete(accountId.toString());
    return { success: true };
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RandomActivity();

