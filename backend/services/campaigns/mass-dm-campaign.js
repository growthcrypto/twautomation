const { MassDMConfig, TwitterAccount, TwitterLead } = require('../../models');
const twitterAutomationEngine = require('../twitter-automation-engine');
const moment = require('moment-timezone');

/**
 * Mass DM Campaign Executor
 * Template system, A/B testing, personalization
 */
class MassDMCampaign {
  constructor() {
    this.runningCampaigns = new Map();
  }

  async startCampaign(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId).populate('linkedChatAccounts');
      if (!account) throw new Error('Account not found');

      const config = await MassDMConfig.findOne({
        accountIds: accountId,
        enabled: true
      });

      if (!config) {
        return { success: false, reason: 'no_config' };
      }

      console.log(`💬 Starting Mass DM campaign for @${account.username}`);

      const state = {
        accountId,
        account,
        config,
        dmsToday: 0,
        dmsSinceBreak: 0,
        isOnBreak: false,
        breakUntil: null,
        lastActionTime: null,
        contactedUsers: new Set()
      };

      this.runningCampaigns.set(accountId.toString(), state);
      this.executeCampaignLoop(state);

      return { success: true, config: config.name };

    } catch (error) {
      console.error('Error starting Mass DM campaign:', error.message);
      return { success: false, error: error.message };
    }
  }

  async executeCampaignLoop(state) {
    const accountIdStr = state.accountId.toString();

    if (!this.runningCampaigns.has(accountIdStr)) return;

    try {
      // Check active hours
      if (!this.isWithinActiveHours(state.config.activeHours)) {
        setTimeout(() => this.executeCampaignLoop(state), 60 * 1000);
        return;
      }

      // Check break
      if (state.isOnBreak) {
        if (Date.now() < state.breakUntil) {
          setTimeout(() => this.executeCampaignLoop(state), 60 * 1000);
          return;
        }
        state.isOnBreak = false;
        state.dmsSinceBreak = 0;
      }

      // Check daily limit
      const account = await TwitterAccount.findById(state.accountId);
      if (account.today.dms >= state.config.maxDMsPerDay) {
        console.log(`📊 Daily DM limit reached`);
        setTimeout(() => this.executeCampaignLoop(state), 60 * 60 * 1000);
        return;
      }

      // Respect delay
      if (state.lastActionTime) {
        const timeSince = Date.now() - state.lastActionTime;
        const minDelay = state.config.delayBetweenDMs.min * 1000;
        if (timeSince < minDelay) {
          setTimeout(() => this.executeCampaignLoop(state), minDelay - timeSince);
          return;
        }
      }

      // Execute DM
      await this.executeDMAction(state);

      // Check for break
      if (state.config.breaks.enabled && state.dmsSinceBreak >= state.config.breaks.afterActions) {
        this.takeBreak(state);
      }

      // Next action
      const delay = this.randomBetween(
        state.config.delayBetweenDMs.min * 1000,
        state.config.delayBetweenDMs.max * 1000
      );
      setTimeout(() => this.executeCampaignLoop(state), delay);

    } catch (error) {
      console.error('Error in Mass DM loop:', error.message);
      setTimeout(() => this.executeCampaignLoop(state), 60 * 1000);
    }
  }

  async executeDMAction(state) {
    try {
      // Get target
      const target = await this.getNextTarget(state);
      if (!target) {
        console.log('No more DM targets available');
        return;
      }

      // Check filters
      if (state.config.skipIfAlreadyContacted && state.contactedUsers.has(target)) {
        return;
      }

      // Personalize message
      const message = await this.generatePersonalizedMessage(state, target);
      
      // Send DM
      const result = await twitterAutomationEngine.sendDM(
        state.accountId,
        target,
        message,
        state.config
      );

      if (result.success) {
        state.dmsToday++;
        state.dmsSinceBreak++;
        state.lastActionTime = Date.now();
        state.contactedUsers.add(target);

        // Update account
        const account = await TwitterAccount.findById(state.accountId);
        account.today.dms++;
        account.lastActiveDate = new Date();
        await account.save();

        // Track which template was used (A/B testing)
        const templateUsed = state.lastTemplateUsed;
        if (templateUsed) {
          await MassDMConfig.findByIdAndUpdate(state.config._id, {
            $inc: { [`messageTemplates.${templateUsed.index}.timesSent`]: 1 }
          });
        }

        // Create lead
        const chatAccount = state.account.linkedChatAccounts[0];
        await TwitterLead.create({
          username: target,
          sourceAccount: state.accountId,
          chatAccount: chatAccount?._id,
          niche: state.account.niche,
          status: 'dm_sent',
          discoveryMethod: 'dm',
          firstDMDate: new Date()
        });

        console.log(`✅ DM sent to @${target} (${state.dmsToday} today)`);
      }

    } catch (error) {
      console.error('Error executing DM:', error.message);
    }
  }

  async getNextTarget(state) {
    const source = this.selectSourceByWeight(state.config.targetSources);
    if (!source) return null;

    let targets = [];

    switch (source.type) {
      case 'community_members':
        const communityResult = await twitterAutomationEngine.scrapeCommunityMembers(
          state.accountId,
          source.value,
          20
        );
        targets = communityResult.success ? communityResult.usernames : [];
        break;

      case 'new_followers':
        // Would need to implement follower checking
        targets = [];
        break;

      case 'hashtag_users':
        const hashtagResult = await twitterAutomationEngine.scrapeHashtagUsers(
          state.accountId,
          source.value,
          20
        );
        targets = hashtagResult.success ? hashtagResult.usernames : [];
        break;
    }

    // Filter out already contacted
    targets = targets.filter(t => !state.contactedUsers.has(t));

    return targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : null;
  }

  async generatePersonalizedMessage(state, targetUsername) {
    // Select template (A/B testing - weighted random)
    const template = this.selectTemplateByWeight(state.config.messageTemplates);
    state.lastTemplateUsed = template;

    let message = template.template;

    // Get chat account to link to
    const chatAccount = state.account.linkedChatAccounts[0];
    const chatUsername = chatAccount?.username || 'MainAccount';

    // Replace variables
    message = message.replace('{chat_account}', chatUsername);
    message = message.replace('{name}', targetUsername);

    // Personalization: extract topic from bio (if enabled)
    if (state.config.personalization.extractTopicFromBio) {
      const topic = await this.extractTopicFromProfile(state.accountId, targetUsername);
      if (topic) {
        message = message.replace('{topic}', topic);
      } else {
        message = message.replace('{topic}', state.account.niche);
      }
    } else {
      message = message.replace('{topic}', state.account.niche);
    }

    return message;
  }

  async extractTopicFromProfile(accountId, username) {
    try {
      // This would scrape the user's bio and extract relevant topics
      // For now, return niche as fallback
      return null;
    } catch {
      return null;
    }
  }

  selectTemplateByWeight(templates) {
    const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < templates.length; i++) {
      random -= templates[i].weight;
      if (random <= 0) {
        return { ...templates[i].toObject(), index: i };
      }
    }

    return { ...templates[0].toObject(), index: 0 };
  }

  selectSourceByWeight(sources) {
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const source of sources) {
      random -= source.weight;
      if (random <= 0) return source;
    }

    return sources[0];
  }

  takeBreak(state) {
    const breakDuration = this.randomBetween(
      state.config.breaks.breakDuration.min * 1000,
      state.config.breaks.breakDuration.max * 1000
    );
    state.isOnBreak = true;
    state.breakUntil = Date.now() + breakDuration;
    console.log(`☕ Taking break for ${Math.ceil(breakDuration / 1000 / 60)} minutes`);
  }

  isWithinActiveHours(activeHours) {
    const now = moment().tz(activeHours.timezone);
    const currentTime = now.format('HH:mm');
    return currentTime >= activeHours.start && currentTime <= activeHours.end;
  }

  stopCampaign(accountId) {
    const accountIdStr = accountId.toString();
    if (this.runningCampaigns.has(accountIdStr)) {
      this.runningCampaigns.delete(accountIdStr);
      return { success: true };
    }
    return { success: false };
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = new MassDMCampaign();

