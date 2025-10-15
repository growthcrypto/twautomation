const express = require('express');
const router = express.Router();
const { ResourcePool } = require('../models');
const multer = require('multer');
const path = require('path');

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profile-pics/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// Get resource pool
router.get('/', async (req, res) => {
  try {
    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }
    res.json({ success: true, pool });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload profile pictures
router.post('/profile-pics', upload.array('images', 50), async (req, res) => {
  try {
    const { niche } = req.body;
    
    if (!niche) {
      return res.status(400).json({ success: false, error: 'Niche is required' });
    }

    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }

    // Add uploaded files to pool
    const newPics = req.files.map(file => ({
      niche,
      filename: file.filename,
      path: file.path,
      url: `/uploads/profile-pics/${file.filename}`,
      used: false
    }));

    pool.profilePictures.push(...newPics);
    await pool.save();

    res.json({ 
      success: true, 
      uploaded: newPics.length,
      message: `Uploaded ${newPics.length} profile pictures for ${niche}`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add bio templates
router.post('/bio-templates', async (req, res) => {
  try {
    const { niche, role, template, variables } = req.body;

    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }

    pool.bioTemplates.push({
      niche,
      role,
      template,
      variables: variables || []
    });

    await pool.save();

    res.json({ success: true, message: 'Bio template added' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add emails
router.post('/emails', async (req, res) => {
  try {
    const { emails } = req.body; // Array of {address, password, provider}

    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }

    const newEmails = emails.map(e => ({
      address: e.address,
      password: e.password,
      provider: e.provider || 'gmail',
      used: false
    }));

    pool.emails.push(...newEmails);
    await pool.save();

    res.json({ 
      success: true, 
      added: newEmails.length,
      message: `Added ${newEmails.length} emails to pool`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add username patterns
router.post('/username-patterns', async (req, res) => {
  try {
    const { niche, role, patterns } = req.body;

    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }

    pool.usernamePatterns.push({
      niche,
      role,
      patterns
    });

    await pool.save();

    res.json({ success: true, message: 'Username patterns added' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set phone service API key
router.post('/phone-service', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;

    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }

    pool.phoneService = {
      provider,
      apiKey,
      lastChecked: new Date()
    };

    await pool.save();

    res.json({ success: true, message: 'Phone service configured' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set all API keys at once
router.post('/api-keys', async (req, res) => {
  try {
    const { phoneApiKey, captchaApiKey, aiApiUrl, aiApiKey } = req.body;

    let pool = await ResourcePool.findOne();
    if (!pool) {
      pool = await ResourcePool.create({});
    }

    // Save phone service key
    if (phoneApiKey) {
      pool.phoneService = {
        provider: pool.phoneService?.provider || '5sim',
        apiKey: phoneApiKey,
        lastChecked: new Date()
      };
    }

    // Save 2captcha key
    if (captchaApiKey) {
      if (!pool.apiKeys) pool.apiKeys = {};
      pool.apiKeys.twoCaptcha = captchaApiKey;
    }

    // Save AI API settings
    if (aiApiUrl || aiApiKey) {
      if (!pool.apiKeys) pool.apiKeys = {};
      if (!pool.apiKeys.ai) pool.apiKeys.ai = {};
      if (aiApiUrl) pool.apiKeys.ai.url = aiApiUrl;
      if (aiApiKey) pool.apiKeys.ai.key = aiApiKey;
    }

    await pool.save();

    // Also update environment variables for immediate use
    if (captchaApiKey) {
      process.env.TWOCAPTCHA_API_KEY = captchaApiKey;
    }
    if (phoneApiKey) {
      process.env.PHONE_SERVICE_API_KEY = phoneApiKey;
    }
    if (aiApiUrl) {
      process.env.AI_API_URL = aiApiUrl;
    }
    if (aiApiKey) {
      process.env.AI_API_KEY = aiApiKey;
    }

    res.json({ 
      success: true, 
      message: 'All API keys saved successfully',
      saved: {
        phoneService: !!phoneApiKey,
        twoCaptcha: !!captchaApiKey,
        aiUrl: !!aiApiUrl,
        aiKey: !!aiApiKey
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

