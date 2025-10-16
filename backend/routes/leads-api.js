const express = require('express');
const router = express.Router();
const { TwitterLead, TwitterAccount } = require('../models');

// ==============================================
// LEAD MANAGEMENT API
// ==============================================

/**
 * Get all leads with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      niche, 
      sourceAccount, 
      chatAccount,
      page = 1, 
      limit = 50,
      sortBy = 'lastInteractionDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (niche) filter.niche = niche;
    if (sourceAccount) filter.sourceAccount = sourceAccount;
    if (chatAccount) filter.chatAccount = chatAccount;

    // Get leads
    const leads = await TwitterLead.find(filter)
      .populate('sourceAccount', 'username')
      .populate('chatAccount', 'username')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await TwitterLead.countDocuments(filter);

    res.json({
      success: true,
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get single lead by ID or username
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    // Try to find by ID first, then username
    let lead = await TwitterLead.findById(identifier)
      .populate('sourceAccount')
      .populate('chatAccount');

    if (!lead) {
      lead = await TwitterLead.findOne({ username: identifier })
        .populate('sourceAccount')
        .populate('chatAccount');
    }

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, lead });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update lead status manually
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      'new_lead',
      'dm_sent',
      'in_conversation',
      'link_sent',
      'converted',
      'ghosted',
      'not_interested'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const update = { status, lastInteractionDate: new Date() };
    if (notes) update.notes = notes;

    const lead = await TwitterLead.findByIdAndUpdate(id, update, { new: true })
      .populate('sourceAccount', 'username')
      .populate('chatAccount', 'username');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    console.log(`📊 Lead @${lead.username} status updated to: ${status}`);

    res.json({ success: true, lead });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mark lead as converted (MANUAL CONVERSION TRACKING)
 */
router.post('/:id/convert', async (req, res) => {
  try {
    const { id } = req.params;
    const { revenue, ofUsername, notes } = req.body;

    const lead = await TwitterLead.findById(id)
      .populate('sourceAccount')
      .populate('chatAccount');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Update lead
    lead.status = 'converted';
    lead.converted = true;
    lead.convertedDate = new Date();
    lead.revenue = revenue || 0;
    if (ofUsername) lead.ofUsername = ofUsername;
    if (notes) lead.notes = notes;
    await lead.save();

    // Update source account stats
    if (lead.sourceAccount) {
      lead.sourceAccount.totalConversions = (lead.sourceAccount.totalConversions || 0) + 1;
      lead.sourceAccount.revenueAttributed = (lead.sourceAccount.revenueAttributed || 0) + (revenue || 0);
      await lead.sourceAccount.save();
    }

    // Update chat account stats
    if (lead.chatAccount && lead.chatAccount._id.toString() !== lead.sourceAccount?._id.toString()) {
      lead.chatAccount.totalConversions = (lead.chatAccount.totalConversions || 0) + 1;
      lead.chatAccount.revenueAttributed = (lead.chatAccount.revenueAttributed || 0) + (revenue || 0);
      await lead.chatAccount.save();
    }

    console.log(`🎉 CONVERSION: @${lead.username} converted! Revenue: $${revenue || 0}`);

    res.json({ 
      success: true, 
      lead,
      message: `Lead converted! Revenue: $${revenue || 0}` 
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete lead
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await TwitterLead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    console.log(`🗑️  Deleted lead @${lead.username}`);

    res.json({ success: true, message: 'Lead deleted' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================================
// ANALYTICS API
// ==============================================

/**
 * Get analytics overview
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const { timeframe = '7d', sourceAccount, chatAccount, niche } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    // Build filter
    const filter = { firstContactDate: { $gte: startDate } };
    if (sourceAccount) filter.sourceAccount = sourceAccount;
    if (chatAccount) filter.chatAccount = chatAccount;
    if (niche) filter.niche = niche;

    // Get all leads in timeframe
    const allLeads = await TwitterLead.find(filter);

    // Calculate metrics
    const totalLeads = allLeads.length;
    const dmsSent = allLeads.filter(l => l.firstDMDate).length;
    const repliesReceived = allLeads.filter(l => l.status === 'in_conversation' || 
                                                    l.status === 'link_sent' || 
                                                    l.status === 'converted').length;
    const linksSent = allLeads.filter(l => l.status === 'link_sent' || 
                                           l.status === 'converted').length;
    const conversions = allLeads.filter(l => l.status === 'converted').length;
    const totalRevenue = allLeads.reduce((sum, l) => sum + (l.revenue || 0), 0);

    // Calculate rates
    const replyRate = dmsSent > 0 ? ((repliesReceived / dmsSent) * 100).toFixed(1) : 0;
    const conversionRate = linksSent > 0 ? ((conversions / linksSent) * 100).toFixed(1) : 0;
    const avgRevenuePerConversion = conversions > 0 ? (totalRevenue / conversions).toFixed(2) : 0;

    // Status breakdown
    const statusBreakdown = {
      new_lead: allLeads.filter(l => l.status === 'new_lead').length,
      dm_sent: allLeads.filter(l => l.status === 'dm_sent').length,
      in_conversation: allLeads.filter(l => l.status === 'in_conversation').length,
      link_sent: allLeads.filter(l => l.status === 'link_sent').length,
      converted: allLeads.filter(l => l.status === 'converted').length,
      ghosted: allLeads.filter(l => l.status === 'ghosted').length,
      not_interested: allLeads.filter(l => l.status === 'not_interested').length
    };

    // Top performers
    const topSourceAccounts = await TwitterLead.aggregate([
      { $match: filter },
      { $match: { status: 'converted' } },
      { $group: {
        _id: '$sourceAccount',
        conversions: { $sum: 1 },
        revenue: { $sum: '$revenue' }
      }},
      { $sort: { conversions: -1 } },
      { $limit: 5 }
    ]);

    // Populate account usernames
    for (const item of topSourceAccounts) {
      const account = await TwitterAccount.findById(item._id, 'username');
      item.username = account?.username || 'Unknown';
    }

    res.json({
      success: true,
      timeframe,
      analytics: {
        overview: {
          totalLeads,
          dmsSent,
          repliesReceived,
          linksSent,
          conversions,
          totalRevenue: parseFloat(totalRevenue.toFixed(2))
        },
        rates: {
          replyRate: parseFloat(replyRate),
          conversionRate: parseFloat(conversionRate),
          avgRevenuePerConversion: parseFloat(avgRevenuePerConversion)
        },
        statusBreakdown,
        topSourceAccounts
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get conversion funnel data
 */
router.get('/analytics/funnel', async (req, res) => {
  try {
    const { sourceAccount, chatAccount, niche, timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    // Build filter
    const filter = { firstContactDate: { $gte: startDate } };
    if (sourceAccount) filter.sourceAccount = sourceAccount;
    if (chatAccount) filter.chatAccount = chatAccount;
    if (niche) filter.niche = niche;

    const allLeads = await TwitterLead.find(filter);

    // Build funnel
    const funnel = [
      { stage: 'Leads Found', count: allLeads.length, dropoff: 0 },
      { stage: 'DMs Sent', count: allLeads.filter(l => l.firstDMDate).length, dropoff: 0 },
      { stage: 'Replies Received', count: allLeads.filter(l => l.conversationStartDate).length, dropoff: 0 },
      { stage: 'Links Sent', count: allLeads.filter(l => l.ofLinkSentDate).length, dropoff: 0 },
      { stage: 'Conversions', count: allLeads.filter(l => l.convertedDate).length, dropoff: 0 }
    ];

    // Calculate dropoff percentages
    for (let i = 1; i < funnel.length; i++) {
      if (funnel[i - 1].count > 0) {
        funnel[i].dropoff = ((1 - (funnel[i].count / funnel[i - 1].count)) * 100).toFixed(1);
      }
    }

    res.json({ success: true, funnel });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

