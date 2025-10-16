const { AIChatConfig, TwitterAccount, TwitterLead } = require('../../models');
const twitterAutomationEngine = require('../twitter-automation-engine');
const actionCoordinator = require('../action-coordinator');
const axios = require('axios');
const moment = require('moment-timezone');

/**
 * AI Chat Monitor
 * Monitors DMs, calls AI API, sends replies, converts to OF
 */
class AIChatMonitor {
  constructor() {
    this.runningMonitors = new Map();
  }

  async startMonitor(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      const config = await AIChatConfig.findOne({
        accountIds: accountId,
        enabled: true
      });

      if (!config) {
        return { success: false, reason: 'no_config' };
      }

      console.log(`🤖 Starting AI Chat Monitor for @${account.username}`);

      const state = {
        accountId,
        account,
        config,
        conversationsToday: 0,
        activeConversations: new Map() // username -> conversation state
      };

      this.runningMonitors.set(accountId.toString(), state);
      this.executeMonitorLoop(state);

      return { success: true, config: config.name };

    } catch (error) {
      console.error('Error starting AI Chat Monitor:', error.message);
      return { success: false, error: error.message };
    }
  }

  async executeMonitorLoop(state) {
    const accountIdStr = state.accountId.toString();

    if (!this.runningMonitors.has(accountIdStr)) return;

    try {
      // Check active hours
      if (!this.isWithinActiveHours(state.config.activeHours)) {
        setTimeout(() => this.executeMonitorLoop(state), 5 * 60 * 1000); // Check every 5 min
        return;
      }

      // Check for new DMs with lock (prevents race conditions with other campaigns)
      await actionCoordinator.executeWithLock(
        state.accountId,
        'AI Chat Monitor',
        async () => await this.checkAndRespondToDMs(state)
      );

      // Next check in 30-60 seconds
      const nextCheck = this.randomBetween(30, 60) * 1000;
      setTimeout(() => this.executeMonitorLoop(state), nextCheck);

    } catch (error) {
      console.error('Error in AI Chat Monitor loop:', error.message);
      setTimeout(() => this.executeMonitorLoop(state), 60 * 1000);
    }
  }

  async checkAndRespondToDMs(state) {
    try {
      // Get new DMs
      const dmsResult = await twitterAutomationEngine.checkNewDMs(state.accountId);
      
      if (!dmsResult.success || dmsResult.messages.length === 0) {
        return;
      }

      console.log(`📬 Found ${dmsResult.messages.length} new messages`);

      for (const dm of dmsResult.messages) {
        await this.handleDM(state, dm);
      }

    } catch (error) {
      console.error('Error checking DMs:', error.message);
    }
  }

  async handleDM(state, dm) {
    try {
      const { username, message } = dm;

      // Get or create lead
      let lead = await TwitterLead.findOne({
        username,
        chatAccount: state.accountId
      });

      if (!lead) {
        // New conversation
        lead = await TwitterLead.create({
          username,
          chatAccount: state.accountId,
          sourceAccount: state.accountId,
          niche: state.account.niche,
          status: 'in_conversation',
          conversationStartDate: new Date(),
          messageCount: 0
        });

        state.conversationsToday++;
      }

      // Check daily limit
      if (state.conversationsToday >= state.config.maxConversationsPerDay) {
        console.log(`📊 Daily conversation limit reached`);
        return;
      }

      // Check conversation limits
      if (lead.messageCount >= state.config.maxMessagesPerConversation) {
        console.log(`⚠️  Max messages reached for @${username}`);
        return;
      }

      // Check quality filters
      if (await this.shouldSkipConversation(state.config, lead, message)) {
        console.log(`⛔ Skipping conversation with @${username} (quality filter)`);
        return;
      }

      // Update lead
      lead.messageCount++;
      lead.lastInteractionDate = new Date();

      // Check if should send OF link
      const shouldSendLink = this.shouldSendOFLink(state.config, lead, message);

      let reply;

      if (shouldSendLink) {
        // Send OF link
        reply = this.generateOFLinkMessage(state.config, lead);
        lead.status = 'link_sent';
        lead.ofLinkSentDate = new Date();
        console.log(`🔗 Sending OF link to @${username}`);

      } else {
        // Get AI response
        reply = await this.getAIResponse(state.config, lead, message);
      }

      await lead.save();

      // Simulate typing delay
      const responseDelay = this.randomBetween(
        state.config.responseDelay.min * 1000,
        state.config.responseDelay.max * 1000
      );

      await this.sleep(responseDelay);

      // Send reply
      const result = await twitterAutomationEngine.replyToDM(
        state.accountId,
        username,
        reply,
        state.config
      );

      if (result.success) {
        console.log(`✅ Replied to @${username}`);
        
        // Update account stats
        const account = await TwitterAccount.findById(state.accountId);
        account.today.dms++;
        account.totalConversations++;
        await account.save();
      }

    } catch (error) {
      console.error(`Error handling DM from @${dm.username}:`, error.message);
    }
  }

  async getAIResponse(config, lead, userMessage) {
    try {
      // Build context
      const context = {
        fanUsername: lead.username,
        messageCount: lead.messageCount,
        userMessage,
        niche: lead.niche,
        personality: config.personality
      };

      // Call AI API
      const response = await axios.post(
        config.aiProvider.apiUrl,
        {
          messages: [
            {
              role: 'system',
              content: config.personality.customInstructions || `You are a ${config.personality.style} person discussing ${lead.niche}. ${config.personality.tone} tone.`
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          model: config.aiProvider.model || 'gpt-4',
          max_tokens: 150
        },
        {
          headers: {
            'Authorization': `Bearer ${config.aiProvider.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;

    } catch (error) {
      console.error('Error calling AI API:', error.message);
      
      // Fallback response
      return "Haha for real! What else you thinking about?";
    }
  }

  shouldSendOFLink(config, lead, message) {
    // Check triggers
    for (const trigger of config.strategy.sendLinkTriggers) {
      switch (trigger.type) {
        case 'message_count':
          if (lead.messageCount >= trigger.value) {
            return true;
          }
          break;

        case 'ai_detected_buying_signal':
          const keywords = trigger.value || ['how much', 'link', 'onlyfans', 'subscribe', 'content'];
          const lowerMessage = message.toLowerCase();
          if (keywords.some(kw => lowerMessage.includes(kw))) {
            return true;
          }
          break;

        case 'high_engagement':
          if (lead.engagementScore && lead.engagementScore >= trigger.value) {
            return true;
          }
          break;
      }
    }

    return false;
  }

  generateOFLinkMessage(config, lead) {
    const templates = config.ofLinkMessage.templates;
    const template = config.ofLinkMessage.randomize
      ? templates[Math.floor(Math.random() * templates.length)]
      : templates[0];

    const ofLink = lead.chatAccount?.ofLink || 'onlyfans.com/yourlink';

    return template.replace('{of_link}', ofLink);
  }

  async shouldSkipConversation(config, lead, message) {
    const filters = config.skipConversations;

    // Time waster check
    if (filters.ifTimeWaster?.enabled) {
      if (lead.messageCount >= filters.ifTimeWaster.detectAfterMessages) {
        if (lead.engagementScore < filters.ifTimeWaster.noEngagementThreshold) {
          return true;
        }
      }
    }

    // Rude check
    if (filters.ifRude?.enabled) {
      const lowerMessage = message.toLowerCase();
      const rudeKeywords = filters.ifRude.rudeKeywords || [];
      if (rudeKeywords.some(kw => lowerMessage.includes(kw))) {
        return true;
      }
    }

    return false;
  }

  isWithinActiveHours(activeHours) {
    const now = moment().tz(activeHours.timezone);
    const currentTime = now.format('HH:mm');
    return currentTime >= activeHours.start && currentTime <= activeHours.end;
  }

  stopMonitor(accountId) {
    const accountIdStr = accountId.toString();
    if (this.runningMonitors.has(accountIdStr)) {
      this.runningMonitors.delete(accountIdStr);
      console.log(`⏹️  Stopped AI Chat Monitor for account ${accountId}`);
      return { success: true };
    }
    return { success: false };
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AIChatMonitor();

