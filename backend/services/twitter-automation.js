const { TwitterAccount, TwitterLead, AutomationTask, TwitterCommunity } = require('../models');
const adsPowerController = require('./adspower-controller');

/**
 * Twitter Automation Service
 * Handles follow/unfollow, mass DM, community scraping
 */
class TwitterAutomation {
  constructor() {
    this.activeSessions = new Map(); // Track running automation sessions
  }

  /**
   * TOOL #1: Follow/Unfollow Automation
   * (This will integrate with your Chrome extension)
   */
  async runFollowCampaign(accountId, targetNiche, maxFollows = null) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Check if account can follow more today
      const remainingFollows = account.limits.maxFollowsPerDay - account.today.follows;
      if (remainingFollows <= 0) {
        return { success: false, error: 'Daily follow limit reached' };
      }

      const followCount = maxFollows ? Math.min(maxFollows, remainingFollows) : remainingFollows;

      console.log(`🔄 Starting follow campaign for ${account.username} (${followCount} follows)`);

      // Find target users (from communities, hashtags, etc.)
      const targets = await this.findTargetUsers(targetNiche, followCount);

      // Create tasks for each follow
      const tasks = [];
      for (const target of targets) {
        const task = await AutomationTask.create({
          taskType: 'follow',
          accountId: account._id,
          targetUsername: target.username,
          priority: 5,
          scheduledFor: new Date(Date.now() + Math.random() * 30 * 60 * 1000) // Stagger over 30 min
        });
        tasks.push(task);
      }

      console.log(`✅ Created ${tasks.length} follow tasks for ${account.username}`);

      return {
        success: true,
        tasksCreated: tasks.length,
        targets: targets.map(t => t.username)
      };

    } catch (error) {
      console.error('Error in follow campaign:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * TOOL #2: Mass DM Automation
   * Sends DMs to new followers or community members
   */
  async runMassDMCampaign(accountId, options = {}) {
    try {
      const account = await TwitterAccount.findById(accountId).populate('linkedChatAccounts');
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Check limits
      const remainingDMs = account.limits.maxDMsPerDay - account.today.dms;
      if (remainingDMs <= 0) {
        return { success: false, error: 'Daily DM limit reached' };
      }

      console.log(`💬 Starting mass DM campaign for ${account.username}`);

      // Get DM targets based on strategy
      let targets = [];
      
      if (options.strategy === 'new_followers') {
        targets = await this.getNewFollowers(accountId, remainingDMs);
      } else if (options.strategy === 'community_members') {
        targets = await this.getCommunityMembers(account.niche, remainingDMs);
      } else {
        return { success: false, error: 'No DM strategy specified' };
      }

      if (targets.length === 0) {
        return { success: false, error: 'No targets found' };
      }

      // Generate DM message
      const chatAccount = account.linkedChatAccounts[0];
      const message = this.generateDMMessage(account.niche, chatAccount?.username);

      // Create DM tasks
      const tasks = [];
      for (const target of targets) {
        const task = await AutomationTask.create({
          taskType: 'send_dm',
          accountId: account._id,
          targetUsername: target,
          messageContent: message,
          priority: 7,
          scheduledFor: new Date(Date.now() + Math.random() * 60 * 60 * 1000) // Stagger over 1 hour
        });
        tasks.push(task);

        // Create lead record
        await TwitterLead.create({
          username: target,
          sourceAccount: account._id,
          chatAccount: chatAccount?._id,
          niche: account.niche,
          status: 'dm_sent',
          discoveryMethod: options.strategy === 'new_followers' ? 'follow' : 'community_scrape',
          firstDMDate: new Date()
        });
      }

      console.log(`✅ Created ${tasks.length} mass DM tasks for ${account.username}`);

      return {
        success: true,
        tasksCreated: tasks.length,
        message,
        targets
      };

    } catch (error) {
      console.error('Error in mass DM campaign:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Scrape Twitter Communities for target users
   */
  async scrapeCommunity(communityId, niche, maxUsers = 50) {
    try {
      const community = await TwitterCommunity.findOne({ communityId });
      if (!community || community.status !== 'active') {
        console.log(`⚠️  Community ${communityId} not active for scraping`);
        return { success: false, error: 'Community not active' };
      }

      console.log(`🔍 Scraping community: ${community.name} (${niche})`);

      // Launch browser (use any available account's profile or create temp profile)
      // For now, we'll return mock data
      // In production, you'd use Puppeteer to scrape actual community members

      const mockUsers = await this.mockCommunityScrape(community.name, maxUsers);

      // Update community stats
      community.lastScraped = new Date();
      community.totalLeadsGenerated += mockUsers.length;
      await community.save();

      console.log(`✅ Scraped ${mockUsers.length} users from ${community.name}`);

      return {
        success: true,
        users: mockUsers,
        communityName: community.name
      };

    } catch (error) {
      console.error('Error scraping community:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a single automation task
   */
  async executeTask(taskId) {
    try {
      const task = await AutomationTask.findById(taskId).populate('accountId');
      if (!task || task.status !== 'pending') {
        return { success: false, error: 'Task not found or not pending' };
      }

      const account = task.accountId;

      // Check if account is available
      if (!['active', 'warming_up'].includes(account.status)) {
        task.status = 'cancelled';
        task.errorMessage = `Account ${account.status}`;
        await task.save();
        return { success: false, error: `Account ${account.status}` };
      }

      // Mark as in progress
      task.status = 'in_progress';
      task.attempts += 1;
      await task.save();

      console.log(`⚙️  Executing ${task.taskType} task for ${account.username} → ${task.targetUsername}`);

      // Execute based on task type
      let result;
      switch (task.taskType) {
        case 'follow':
          result = await this.performFollow(account, task.targetUsername);
          break;
        case 'unfollow':
          result = await this.performUnfollow(account, task.targetUsername);
          break;
        case 'send_dm':
          result = await this.performSendDM(account, task.targetUsername, task.messageContent);
          break;
        case 'like':
          result = await this.performLike(account, task.targetUrl);
          break;
        default:
          result = { success: false, error: 'Unknown task type' };
      }

      // Update task based on result
      if (result.success) {
        task.status = 'completed';
        task.executedAt = new Date();

        // Update account stats
        await this.updateAccountStats(account, task.taskType);

        console.log(`✅ Task completed: ${task.taskType} for ${account.username}`);
      } else {
        if (task.attempts >= task.maxAttempts) {
          task.status = 'failed';
          task.errorMessage = result.error;
          console.log(`❌ Task failed permanently: ${result.error}`);
        } else {
          task.status = 'pending';
          task.scheduledFor = new Date(Date.now() + 30 * 60 * 1000); // Retry in 30 min
          console.log(`⏳ Task rescheduled for retry (attempt ${task.attempts}/${task.maxAttempts})`);
        }
      }

      await task.save();

      return result;

    } catch (error) {
      console.error('Error executing task:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform follow action via browser automation
   */
  async performFollow(account, targetUsername) {
    try {
      // Launch browser
      const session = await adsPowerController.launchProfile(account.adsPowerProfileId);
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      // Navigate to user's profile
      await page.goto(`https://twitter.com/${targetUsername}`, { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 4000);

      // Click follow button
      const followBtn = await page.$('[data-testid*="follow"]');
      if (!followBtn) {
        throw new Error('Follow button not found');
      }

      await followBtn.click();
      await this.humanDelay(1000, 2000);

      // Schedule unfollow for 3 days later
      await AutomationTask.create({
        taskType: 'unfollow',
        accountId: account._id,
        targetUsername,
        scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        priority: 3
      });

      return { success: true };

    } catch (error) {
      console.error(`Follow error for ${targetUsername}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform unfollow action
   */
  async performUnfollow(account, targetUsername) {
    try {
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      await page.goto(`https://twitter.com/${targetUsername}`, { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      const unfollowBtn = await page.$('[data-testid*="unfollow"]');
      if (!unfollowBtn) {
        // Already unfollowed or user not found
        return { success: true };
      }

      await unfollowBtn.click();
      await this.humanDelay(500, 1000);

      // Confirm unfollow
      const confirmBtn = await page.$('[data-testid="confirmationSheetConfirm"]');
      if (confirmBtn) {
        await confirmBtn.click();
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform send DM action
   */
  async performSendDM(account, targetUsername, message) {
    try {
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      // Navigate to messages
      await page.goto('https://twitter.com/messages', { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      // Click "New message" button
      const newMsgBtn = await page.$('[data-testid="NewDM_Button"]');
      if (newMsgBtn) {
        await newMsgBtn.click();
        await this.humanDelay(1000, 2000);
      }

      // Type username
      const searchInput = await page.$('[data-testid="searchPeople"]');
      if (searchInput) {
        await searchInput.type(targetUsername, { delay: 100 });
        await this.humanDelay(1000, 2000);

        // Click on the user
        const userOption = await page.$('[data-testid="TypeaheadUser"]');
        if (userOption) {
          await userOption.click();
          await this.humanDelay(500, 1000);
        }
      }

      // Type message
      const messageBox = await page.$('[data-testid="dmComposerTextInput"]');
      if (messageBox) {
        await messageBox.type(message, { delay: 50 });
        await this.humanDelay(1000, 2000);

        // Send
        const sendBtn = await page.$('[data-testid="dmComposerSendButton"]');
        if (sendBtn) {
          await sendBtn.click();
        }
      }

      // Update lead status
      await TwitterLead.findOneAndUpdate(
        { username: targetUsername, sourceAccount: account._id },
        { status: 'dm_sent', firstDMDate: new Date() }
      );

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform like action
   */
  async performLike(account, tweetUrl) {
    try {
      const page = await adsPowerController.getPage(account.adsPowerProfileId);

      await page.goto(tweetUrl, { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      const likeBtn = await page.$('[data-testid="like"]');
      if (likeBtn) {
        await likeBtn.click();
        await this.humanDelay(500, 1000);
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update account daily stats
   */
  async updateAccountStats(account, taskType) {
    // Reset daily stats if new day
    const today = new Date().toDateString();
    const lastReset = account.today.lastResetDate ? account.today.lastResetDate.toDateString() : null;

    if (today !== lastReset) {
      account.today = {
        follows: 0,
        unfollows: 0,
        dms: 0,
        likes: 0,
        tweets: 0,
        lastResetDate: new Date()
      };
    }

    // Increment stat
    switch (taskType) {
      case 'follow':
        account.today.follows++;
        if (account.role === 'traffic') {
          account.totalLeadsGenerated++;
        }
        break;
      case 'unfollow':
        account.today.unfollows++;
        break;
      case 'send_dm':
        account.today.dms++;
        break;
      case 'like':
        account.today.likes++;
        break;
    }

    account.lastActiveDate = new Date();
    await account.save();
  }

  /**
   * Find target users based on niche
   */
  async findTargetUsers(niche, count) {
    // In production, this would scrape Twitter
    // For now, return mock data
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push({
        username: `${niche}_user_${Math.floor(Math.random() * 100000)}`
      });
    }
    return users;
  }

  /**
   * Get new followers for an account
   */
  async getNewFollowers(accountId, limit) {
    // Mock implementation
    // In production, scrape actual followers
    return [`follower_${Date.now()}`];
  }

  /**
   * Get community members
   */
  async getCommunityMembers(niche, limit) {
    const community = await TwitterCommunity.findOne({ niche, status: 'active' });
    if (!community) {
      return [];
    }

    // Mock data
    const members = [];
    for (let i = 0; i < Math.min(limit, 50); i++) {
      members.push(`${niche}_member_${Math.floor(Math.random() * 100000)}`);
    }

    return members;
  }

  /**
   * Mock community scrape
   */
  async mockCommunityScrape(communityName, maxUsers) {
    const users = [];
    for (let i = 0; i < maxUsers; i++) {
      users.push(`community_user_${Math.floor(Math.random() * 100000)}`);
    }
    return users;
  }

  /**
   * Generate DM message based on niche
   */
  generateDMMessage(niche, chatAccountUsername) {
    const templates = {
      soccer: `Hey! Your take on that match was wild 😂 I'm way more active on my main @${chatAccountUsername} - let's debate there! ⚽`,
      politics: `Bro your political takes are insane 💀 DM me on my main @${chatAccountUsername} - let's argue about it 🗳️`,
      gaming: `Your gameplay is trash 😂 1v1 me - I'm more active on @${chatAccountUsername} 🎮`,
      drama: `OMG did you see what happened?? All the tea on my main @${chatAccountUsername} ☕`,
      fitness: `Your form is terrible 😅 Follow my main @${chatAccountUsername} for real fitness tips 💪`,
      crypto: `That crypto take aged like milk 📉 More alpha on my main @${chatAccountUsername} 🚀`
    };

    return templates[niche] || `Hey! I'm way more active on @${chatAccountUsername} - follow me there! 💕`;
  }

  /**
   * Human-like delay
   */
  async humanDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = new TwitterAutomation();

