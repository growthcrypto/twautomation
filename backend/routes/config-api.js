const express = require('express');
const router = express.Router();
const {
  FollowUnfollowConfig,
  MassDMConfig,
  AIChatConfig,
  WarmupConfig,
  RandomActivityConfig,
  TestingCohort,
  TwitterAccount
} = require('../models');

// ============================================
// FOLLOW/UNFOLLOW CONFIG
// ============================================

router.get('/follow-unfollow', async (req, res) => {
  try {
    const configs = await FollowUnfollowConfig.find().populate('accountIds', 'username role');
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/follow-unfollow', async (req, res) => {
  try {
    const config = await FollowUnfollowConfig.create(req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/follow-unfollow/:id', async (req, res) => {
  try {
    const config = await FollowUnfollowConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/follow-unfollow/:id', async (req, res) => {
  try {
    await FollowUnfollowConfig.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MASS DM CONFIG
// ============================================

router.get('/mass-dm', async (req, res) => {
  try {
    const configs = await MassDMConfig.find().populate('accountIds', 'username role');
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mass-dm', async (req, res) => {
  try {
    const config = await MassDMConfig.create(req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/mass-dm/:id', async (req, res) => {
  try {
    const config = await MassDMConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mass-dm/:id', async (req, res) => {
  try {
    await MassDMConfig.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AI CHAT CONFIG
// ============================================

router.get('/ai-chat', async (req, res) => {
  try {
    const configs = await AIChatConfig.find().populate('accountIds', 'username role');
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ai-chat', async (req, res) => {
  try {
    const config = await AIChatConfig.create(req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/ai-chat/:id', async (req, res) => {
  try {
    const config = await AIChatConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/ai-chat/:id', async (req, res) => {
  try {
    await AIChatConfig.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WARMUP CONFIG
// ============================================

router.get('/warmup', async (req, res) => {
  try {
    const configs = await WarmupConfig.find();
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/warmup/:id', async (req, res) => {
  try {
    const config = await WarmupConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/warmup', async (req, res) => {
  try {
    const config = await WarmupConfig.create(req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/warmup/:id', async (req, res) => {
  try {
    const config = await WarmupConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/warmup/:id', async (req, res) => {
  try {
    await WarmupConfig.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get warmup templates
router.get('/warmup/templates/presets', async (req, res) => {
  try {
    const templates = {
      conservative_30day: {
        name: "Conservative 30-Day Warmup",
        description: "Slow and steady, minimal activity for maximum safety",
        totalDays: 30,
        schedule: [
          // Week 1: Ultra minimal
          { day: 1, actions: { scrollFeed: { min: 1, max: 2, duration: { min: 30, max: 60 }}, likes: { min: 0, max: 2 }, follows: { min: 0, max: 0 }}},
          { day: 2, actions: { scrollFeed: { min: 1, max: 2, duration: { min: 30, max: 60 }}, likes: { min: 1, max: 3 }, follows: { min: 0, max: 0 }}},
          { day: 3, actions: { scrollFeed: { min: 1, max: 3, duration: { min: 30, max: 90 }}, likes: { min: 2, max: 5 }, follows: { min: 0, max: 1 }}},
          { day: 4, actions: { scrollFeed: { min: 2, max: 3, duration: { min: 30, max: 90 }}, likes: { min: 3, max: 6 }, follows: { min: 0, max: 1 }}},
          { day: 5, actions: { scrollFeed: { min: 2, max: 4, duration: { min: 45, max: 120 }}, likes: { min: 4, max: 8 }, follows: { min: 1, max: 2 }}},
          { day: 6, actions: { scrollFeed: { min: 2, max: 4, duration: { min: 45, max: 120 }}, likes: { min: 5, max: 10 }, follows: { min: 1, max: 3 }}},
          { day: 7, actions: { scrollFeed: { min: 3, max: 5, duration: { min: 60, max: 150 }}, likes: { min: 6, max: 12 }, follows: { min: 2, max: 4 }}},
          
          // Week 2: Light activity
          { day: 8, actions: { scrollFeed: { min: 3, max: 5, duration: { min: 60, max: 150 }}, likes: { min: 8, max: 15 }, follows: { min: 3, max: 5 }}},
          { day: 9, actions: { scrollFeed: { min: 3, max: 6, duration: { min: 60, max: 180 }}, likes: { min: 10, max: 18 }, follows: { min: 4, max: 6 }}},
          { day: 10, actions: { scrollFeed: { min: 4, max: 6, duration: { min: 90, max: 180 }}, likes: { min: 12, max: 20 }, follows: { min: 5, max: 8 }}},
          { day: 11, actions: { scrollFeed: { min: 4, max: 7, duration: { min: 90, max: 180 }}, likes: { min: 15, max: 25 }, follows: { min: 6, max: 10 }}},
          { day: 12, actions: { scrollFeed: { min: 5, max: 7, duration: { min: 90, max: 200 }}, likes: { min: 18, max: 28 }, follows: { min: 8, max: 12 }}},
          { day: 13, actions: { scrollFeed: { min: 5, max: 8, duration: { min: 90, max: 200 }}, likes: { min: 20, max: 30 }, follows: { min: 10, max: 15 }}},
          { day: 14, actions: { scrollFeed: { min: 6, max: 8, duration: { min: 100, max: 200 }}, likes: { min: 22, max: 35 }, follows: { min: 12, max: 18 }}},
          
          // Week 3: Medium activity
          { day: 15, actions: { scrollFeed: { min: 6, max: 9, duration: { min: 100, max: 220 }}, likes: { min: 25, max: 40 }, follows: { min: 15, max: 22 }}},
          { day: 16, actions: { scrollFeed: { min: 7, max: 9, duration: { min: 100, max: 220 }}, likes: { min: 28, max: 45 }, follows: { min: 18, max: 25 }}},
          { day: 17, actions: { scrollFeed: { min: 7, max: 10, duration: { min: 120, max: 240 }}, likes: { min: 30, max: 50 }, follows: { min: 20, max: 30 }}},
          { day: 18, actions: { scrollFeed: { min: 8, max: 10, duration: { min: 120, max: 240 }}, likes: { min: 35, max: 55 }, follows: { min: 25, max: 35 }}},
          { day: 19, actions: { scrollFeed: { min: 8, max: 11, duration: { min: 120, max: 260 }}, likes: { min: 38, max: 60 }, follows: { min: 28, max: 40 }}},
          { day: 20, actions: { scrollFeed: { min: 9, max: 11, duration: { min: 120, max: 260 }}, likes: { min: 40, max: 65 }, follows: { min: 30, max: 45 }}},
          { day: 21, actions: { scrollFeed: { min: 9, max: 12, duration: { min: 150, max: 280 }}, likes: { min: 45, max: 70 }, follows: { min: 35, max: 50 }}},
          
          // Week 4: Approaching full activity
          { day: 22, actions: { scrollFeed: { min: 10, max: 12, duration: { min: 150, max: 300 }}, likes: { min: 50, max: 75 }, follows: { min: 40, max: 55 }}},
          { day: 23, actions: { scrollFeed: { min: 10, max: 13, duration: { min: 150, max: 300 }}, likes: { min: 55, max: 80 }, follows: { min: 45, max: 60 }}},
          { day: 24, actions: { scrollFeed: { min: 11, max: 13, duration: { min: 150, max: 300 }}, likes: { min: 60, max: 85 }, follows: { min: 50, max: 65 }}},
          { day: 25, actions: { scrollFeed: { min: 11, max: 14, duration: { min: 180, max: 320 }}, likes: { min: 65, max: 90 }, follows: { min: 55, max: 70 }}},
          { day: 26, actions: { scrollFeed: { min: 12, max: 14, duration: { min: 180, max: 320 }}, likes: { min: 70, max: 95 }, follows: { min: 60, max: 75 }}},
          { day: 27, actions: { scrollFeed: { min: 12, max: 15, duration: { min: 180, max: 340 }}, likes: { min: 75, max: 100 }, follows: { min: 65, max: 80 }}},
          { day: 28, actions: { scrollFeed: { min: 13, max: 15, duration: { min: 200, max: 340 }}, likes: { min: 80, max: 105 }, follows: { min: 70, max: 85 }}},
          { day: 29, actions: { scrollFeed: { min: 13, max: 16, duration: { min: 200, max: 360 }}, likes: { min: 85, max: 110 }, follows: { min: 75, max: 90 }}},
          { day: 30, actions: { scrollFeed: { min: 14, max: 16, duration: { min: 200, max: 360 }}, likes: { min: 90, max: 115 }, follows: { min: 80, max: 95 }}}
        ]
      },
      
      moderate_14day: {
        name: "Moderate 14-Day Warmup",
        description: "Balanced approach, faster warmup with acceptable risk",
        totalDays: 14,
        schedule: [
          { day: 1, actions: { scrollFeed: { min: 2, max: 4, duration: { min: 60, max: 120 }}, likes: { min: 3, max: 8 }, follows: { min: 0, max: 2 }}},
          { day: 2, actions: { scrollFeed: { min: 3, max: 5, duration: { min: 60, max: 150 }}, likes: { min: 6, max: 12 }, follows: { min: 2, max: 4 }}},
          { day: 3, actions: { scrollFeed: { min: 4, max: 6, duration: { min: 90, max: 180 }}, likes: { min: 10, max: 18 }, follows: { min: 4, max: 8 }}},
          { day: 4, actions: { scrollFeed: { min: 5, max: 7, duration: { min: 90, max: 180 }}, likes: { min: 15, max: 25 }, follows: { min: 8, max: 12 }}},
          { day: 5, actions: { scrollFeed: { min: 6, max: 8, duration: { min: 100, max: 200 }}, likes: { min: 20, max: 35 }, follows: { min: 12, max: 18 }}},
          { day: 6, actions: { scrollFeed: { min: 7, max: 9, duration: { min: 100, max: 220 }}, likes: { min: 28, max: 45 }, follows: { min: 18, max: 25 }}},
          { day: 7, actions: { scrollFeed: { min: 8, max: 10, duration: { min: 120, max: 240 }}, likes: { min: 35, max: 55 }, follows: { min: 25, max: 35 }}},
          { day: 8, actions: { scrollFeed: { min: 9, max: 11, duration: { min: 120, max: 260 }}, likes: { min: 42, max: 65 }, follows: { min: 32, max: 45 }}},
          { day: 9, actions: { scrollFeed: { min: 10, max: 12, duration: { min: 150, max: 280 }}, likes: { min: 50, max: 75 }, follows: { min: 40, max: 55 }}},
          { day: 10, actions: { scrollFeed: { min: 11, max: 13, duration: { min: 150, max: 300 }}, likes: { min: 60, max: 85 }, follows: { min: 50, max: 65 }}},
          { day: 11, actions: { scrollFeed: { min: 12, max: 14, duration: { min: 180, max: 320 }}, likes: { min: 70, max: 95 }, follows: { min: 60, max: 75 }}},
          { day: 12, actions: { scrollFeed: { min: 13, max: 15, duration: { min: 180, max: 340 }}, likes: { min: 80, max: 105 }, follows: { min: 70, max: 85 }}},
          { day: 13, actions: { scrollFeed: { min: 14, max: 16, duration: { min: 200, max: 360 }}, likes: { min: 90, max: 115 }, follows: { min: 80, max: 95 }}},
          { day: 14, actions: { scrollFeed: { min: 15, max: 18, duration: { min: 200, max: 360 }}, likes: { min: 100, max: 125 }, follows: { min: 90, max: 110 }}}
        ]
      },
      
      aggressive_7day: {
        name: "Aggressive 7-Day Warmup",
        description: "Fast warmup for testing or when you need accounts quickly (higher ban risk)",
        totalDays: 7,
        schedule: [
          { day: 1, actions: { scrollFeed: { min: 5, max: 8, duration: { min: 90, max: 180 }}, likes: { min: 10, max: 20 }, follows: { min: 3, max: 8 }}},
          { day: 2, actions: { scrollFeed: { min: 8, max: 12, duration: { min: 120, max: 240 }}, likes: { min: 25, max: 40 }, follows: { min: 15, max: 25 }}},
          { day: 3, actions: { scrollFeed: { min: 10, max: 15, duration: { min: 150, max: 280 }}, likes: { min: 40, max: 60 }, follows: { min: 30, max: 45 }}},
          { day: 4, actions: { scrollFeed: { min: 12, max: 16, duration: { min: 180, max: 320 }}, likes: { min: 60, max: 85 }, follows: { min: 50, max: 70 }}},
          { day: 5, actions: { scrollFeed: { min: 14, max: 18, duration: { min: 200, max: 340 }}, likes: { min: 80, max: 105 }, follows: { min: 70, max: 90 }}},
          { day: 6, actions: { scrollFeed: { min: 16, max: 20, duration: { min: 220, max: 360 }}, likes: { min: 100, max: 125 }, follows: { min: 90, max: 110 }}},
          { day: 7, actions: { scrollFeed: { min: 18, max: 22, duration: { min: 240, max: 400 }}, likes: { min: 120, max: 150 }, follows: { min: 110, max: 130 }}}
        ]
      }
    };
    
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TESTING/COHORT MANAGEMENT
// ============================================

// Get all tests
router.get('/testing/cohorts', async (req, res) => {
  try {
    const cohorts = await TestingCohort.find()
      .populate('accounts.accountId', 'username status')
      .sort({ createdAt: -1 });
    res.json({ success: true, cohorts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single test
router.get('/testing/cohorts/:id', async (req, res) => {
  try {
    const cohort = await TestingCohort.findById(req.params.id)
      .populate('accounts.accountId', 'username status totalFollows totalDMsSent totalConversions');
    
    if (!cohort) {
      return res.status(404).json({ success: false, error: 'Cohort not found' });
    }
    
    // Calculate latest results
    await cohort.calculateResults();
    
    res.json({ success: true, cohort });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new test
router.post('/testing/cohorts', async (req, res) => {
  try {
    const cohort = await TestingCohort.create(req.body);
    res.json({ success: true, cohort });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update test
router.patch('/testing/cohorts/:id', async (req, res) => {
  try {
    const cohort = await TestingCohort.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, cohort });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add account to cohort
router.post('/testing/cohorts/:id/accounts', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    const account = await TwitterAccount.findById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    const cohort = await TestingCohort.findById(req.params.id);
    if (!cohort) {
      return res.status(404).json({ success: false, error: 'Cohort not found' });
    }
    
    // Add account
    cohort.accounts.push({
      accountId: account._id,
      username: account.username,
      startDate: new Date(),
      status: account.status === 'warming_up' ? 'warming_up' : 'active'
    });
    
    await cohort.save();
    
    res.json({ success: true, cohort });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start test
router.post('/testing/cohorts/:id/start', async (req, res) => {
  try {
    const cohort = await TestingCohort.findById(req.params.id);
    if (!cohort) {
      return res.status(404).json({ success: false, error: 'Cohort not found' });
    }
    
    cohort.status = 'running';
    cohort.startDate = new Date();
    await cohort.save();
    
    res.json({ success: true, cohort });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop test
router.post('/testing/cohorts/:id/stop', async (req, res) => {
  try {
    const cohort = await TestingCohort.findById(req.params.id);
    if (!cohort) {
      return res.status(404).json({ success: false, error: 'Cohort not found' });
    }
    
    cohort.status = 'completed';
    cohort.endDate = new Date();
    await cohort.calculateResults();
    await cohort.save();
    
    res.json({ success: true, cohort });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate results
router.post('/testing/cohorts/:id/calculate', async (req, res) => {
  try {
    const cohort = await TestingCohort.findById(req.params.id);
    if (!cohort) {
      return res.status(404).json({ success: false, error: 'Cohort not found' });
    }
    
    const results = await cohort.calculateResults();
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compare tests
router.get('/testing/compare', async (req, res) => {
  try {
    const { cohortIds } = req.query;
    
    if (!cohortIds) {
      return res.status(400).json({ success: false, error: 'Missing cohortIds parameter' });
    }
    
    const ids = cohortIds.split(',');
    const cohorts = await TestingCohort.find({ _id: { $in: ids } });
    
    // Calculate latest results for all
    for (const cohort of cohorts) {
      await cohort.calculateResults();
    }
    
    // Create comparison
    const comparison = cohorts.map(c => ({
      name: c.testName,
      strategy: c.strategy,
      banRate: c.results.banRate,
      followBackRate: c.results.followBackRate,
      replyRate: c.results.replyRate,
      conversionRate: c.results.conversionRate,
      revenuePerAccount: c.results.revenuePerAccount,
      totalRevenue: c.results.totalRevenue,
      status: c.status
    }));
    
    res.json({ success: true, comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete test
router.delete('/testing/cohorts/:id', async (req, res) => {
  try {
    await TestingCohort.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

