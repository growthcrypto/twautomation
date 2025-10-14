const express = require('express');
const router = express.Router();
const {
  FollowUnfollowConfig,
  MassDMConfig,
  AIChatConfig,
  WarmupConfig,
  RandomActivityConfig
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

module.exports = router;

