const express = require('express');
const router = express.Router();
const { TwitterAccount, TwitterLead, AutomationTask } = require('../models');

/**
 * Extension API Routes
 * For your Chrome extensions to communicate with the backend
 */

// ==============================================
// EXTENSION AUTHENTICATION
// ==============================================

/**
 * Extension authenticates with account credentials
 */
router.post('/auth', async (req, res) => {
  try {
    const { username, extensionId } = req.body;

    const account = await TwitterAccount.findOne({ username });
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Return account info + token
    res.json({
      success: true,
      accountId: account._id,
      role: account.role,
      niche: account.niche,
      limits: account.limits,
      today: account.today
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================
// ACTION REPORTING
// ==============================================

/**
 * Extension reports: "I just followed someone"
 */
router.post('/action/follow', async (req, res) => {
  try {
    const { accountId, targetUsername, success, errorMessage } = req.body;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    if (success) {
      // Update stats
      account.today.follows++;
      account.totalLeadsGenerated++;
      account.lastActiveDate = new Date();
      await account.save();

      // Find and complete the task (if it exists)
      await AutomationTask.findOneAndUpdate(
        { accountId, targetUsername, taskType: 'follow', status: 'pending' },
        { status: 'completed', executedAt: new Date() }
      );

      // Schedule unfollow
      await AutomationTask.create({
        taskType: 'unfollow',
        accountId,
        targetUsername,
        scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        priority: 3
      });

      console.log(`✅ ${account.username} followed @${targetUsername}`);
    } else {
      // Record failure
      account.health.failureCount++;
      await account.save();

      await AutomationTask.findOneAndUpdate(
        { accountId, targetUsername, taskType: 'follow', status: 'pending' },
        { 
          status: 'failed',
          errorMessage,
          executedAt: new Date()
        }
      );

      console.log(`❌ ${account.username} failed to follow @${targetUsername}: ${errorMessage}`);
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Extension reports: "I just unfollowed someone"
 */
router.post('/action/unfollow', async (req, res) => {
  try {
    const { accountId, targetUsername, success } = req.body;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    if (success) {
      account.today.unfollows++;
      account.lastActiveDate = new Date();
      await account.save();

      await AutomationTask.findOneAndUpdate(
        { accountId, targetUsername, taskType: 'unfollow', status: 'pending' },
        { status: 'completed', executedAt: new Date() }
      );
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Extension reports: "I just sent a DM"
 */
router.post('/action/dm', async (req, res) => {
  try {
    const { accountId, targetUsername, messageContent, success, errorMessage } = req.body;

    const account = await TwitterAccount.findById(accountId).populate('linkedChatAccounts');
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    if (success) {
      // Update stats
      account.today.dms++;
      account.lastActiveDate = new Date();
      await account.save();

      // Complete task
      await AutomationTask.findOneAndUpdate(
        { accountId, targetUsername, taskType: 'send_dm', status: 'pending' },
        { status: 'completed', executedAt: new Date() }
      );

      // Update or create lead
      let lead = await TwitterLead.findOne({
        username: targetUsername,
        sourceAccount: accountId
      });

      if (!lead) {
        lead = new TwitterLead({
          username: targetUsername,
          sourceAccount: accountId,
          chatAccount: account.linkedChatAccounts[0]?._id,
          niche: account.niche,
          status: 'dm_sent',
          discoveryMethod: 'dm',
          firstDMDate: new Date()
        });
      } else {
        lead.status = 'dm_sent';
        lead.firstDMDate = lead.firstDMDate || new Date();
        lead.lastInteractionDate = new Date();
        lead.messageCount++;
      }

      await lead.save();

      console.log(`✅ ${account.username} sent DM to @${targetUsername}`);
    } else {
      account.health.failureCount++;
      await account.save();

      console.log(`❌ ${account.username} failed to DM @${targetUsername}: ${errorMessage}`);
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Extension reports: "Someone replied to my DM"
 */
router.post('/action/dm-reply-received', async (req, res) => {
  try {
    const { accountId, fromUsername, messageContent } = req.body;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Update lead status
    let lead = await TwitterLead.findOne({
      username: fromUsername,
      $or: [
        { sourceAccount: accountId },
        { chatAccount: accountId }
      ]
    });

    if (!lead) {
      // New inbound lead
      lead = new TwitterLead({
        username: fromUsername,
        sourceAccount: accountId,
        chatAccount: accountId,
        niche: account.niche,
        status: 'in_conversation',
        discoveryMethod: 'dm',
        conversationStartDate: new Date()
      });
    } else {
      lead.status = 'in_conversation';
      lead.conversationStartDate = lead.conversationStartDate || new Date();
      lead.lastInteractionDate = new Date();
      lead.messageCount++;
    }

    await lead.save();

    console.log(`💬 ${account.username} received reply from @${fromUsername}`);

    res.json({ 
      success: true,
      lead: {
        id: lead._id,
        status: lead.status,
        messageCount: lead.messageCount
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================
// AI CHAT EXTENSION INTEGRATION
// ==============================================

/**
 * AI Chat Extension asks: "Should I reply to this conversation?"
 */
router.post('/chat/should-reply', async (req, res) => {
  try {
    const { accountId, fanUsername } = req.body;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Check daily DM limit
    if (account.today.dms >= account.limits.maxDMsPerDay) {
      return res.json({
        shouldReply: false,
        reason: 'Daily DM limit reached'
      });
    }

    // Check lead status
    const lead = await TwitterLead.findOne({
      username: fanUsername,
      chatAccount: accountId
    });

    if (!lead) {
      return res.json({
        shouldReply: true,
        isNewLead: true
      });
    }

    // Check if we already sent OF link recently
    if (lead.status === 'link_sent') {
      const hoursSinceLinkSent = (Date.now() - lead.ofLinkSentDate) / (1000 * 60 * 60);
      
      if (hoursSinceLinkSent < 24) {
        return res.json({
          shouldReply: false,
          reason: 'OF link sent recently, wait 24h before follow-up'
        });
      } else {
        return res.json({
          shouldReply: true,
          suggestedAction: 'follow_up',
          suggestedMessage: 'Hey! Did you check out my OF? 😊'
        });
      }
    }

    // Check conversation count
    if (lead.messageCount >= 15) {
      return res.json({
        shouldReply: true,
        suggestedAction: 'send_of_link',
        message: 'Time to send OF link (15+ messages exchanged)'
      });
    }

    return res.json({
      shouldReply: true,
      lead: {
        status: lead.status,
        messageCount: lead.messageCount,
        engagementScore: lead.engagementScore
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * AI Chat Extension reports: "I sent a message in conversation"
 */
router.post('/chat/message-sent', async (req, res) => {
  try {
    const { accountId, fanUsername, messageContent } = req.body;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Update stats
    account.today.dms++;
    account.lastActiveDate = new Date();
    await account.save();

    // Update lead
    let lead = await TwitterLead.findOne({
      username: fanUsername,
      chatAccount: accountId
    });

    if (!lead) {
      lead = new TwitterLead({
        username: fanUsername,
        chatAccount: accountId,
        sourceAccount: accountId,
        niche: account.niche,
        status: 'in_conversation',
        conversationStartDate: new Date()
      });
    }

    lead.messageCount++;
    lead.lastInteractionDate = new Date();
    lead.lastMessage = messageContent;

    // Check if OF link was sent
    const containsOFLink = messageContent.toLowerCase().includes('onlyfans.com') || 
                           messageContent.toLowerCase().includes('of.com');
    
    if (containsOFLink) {
      lead.status = 'link_sent';
      lead.ofLinkSentDate = new Date();
      console.log(`🔗 ${account.username} sent OF link to @${fanUsername}`);
    }

    await lead.save();

    res.json({ success: true, lead: { id: lead._id, status: lead.status } });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * AI Chat Extension reports: "User converted to OF"
 */
router.post('/chat/conversion', async (req, res) => {
  try {
    const { accountId, fanUsername, ofUsername, revenue } = req.body;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Update lead
    const lead = await TwitterLead.findOneAndUpdate(
      { username: fanUsername, chatAccount: accountId },
      {
        status: 'converted',
        converted: true,
        convertedDate: new Date(),
        ofUsername,
        revenue: revenue || 0
      },
      { new: true }
    );

    if (lead) {
      // Update account stats
      account.totalConversions++;
      account.revenueAttributed += revenue || 0;
      await account.save();

      // Update source account stats (if different)
      if (lead.sourceAccount && lead.sourceAccount.toString() !== accountId.toString()) {
        await TwitterAccount.findByIdAndUpdate(lead.sourceAccount, {
          $inc: { totalConversions: 1, revenueAttributed: revenue || 0 }
        });
      }

      console.log(`🎉 CONVERSION: ${account.username} converted @${fanUsername} to OF ($${revenue})`);
    }

    res.json({ success: true, lead });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================
// TASK FETCHING (for extensions that want to execute tasks)
// ==============================================

/**
 * Extension asks: "Give me the next task to execute"
 */
router.get('/tasks/next/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    const task = await AutomationTask.findOne({
      accountId,
      status: 'pending',
      scheduledFor: { $lte: new Date() }
    })
    .sort({ priority: -1, scheduledFor: 1 })
    .limit(1);

    if (!task) {
      return res.json({ success: true, task: null, message: 'No pending tasks' });
    }

    res.json({
      success: true,
      task: {
        id: task._id,
        type: task.taskType,
        targetUsername: task.targetUsername,
        targetUrl: task.targetUrl,
        messageContent: task.messageContent,
        priority: task.priority
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Extension reports: "Task completed"
 */
router.post('/tasks/complete', async (req, res) => {
  try {
    const { taskId, success, errorMessage } = req.body;

    const task = await AutomationTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (success) {
      task.status = 'completed';
      task.executedAt = new Date();
    } else {
      task.attempts++;
      if (task.attempts >= task.maxAttempts) {
        task.status = 'failed';
        task.errorMessage = errorMessage;
      } else {
        task.status = 'pending';
        task.scheduledFor = new Date(Date.now() + 30 * 60 * 1000); // Retry in 30 min
      }
    }

    await task.save();

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================
// ACCOUNT STATUS
// ==============================================

/**
 * Extension gets account status and limits
 */
router.get('/account/:accountId/status', async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    res.json({
      success: true,
      account: {
        username: account.username,
        role: account.role,
        niche: account.niche,
        status: account.status,
        limits: account.limits,
        today: account.today,
        health: account.health
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

