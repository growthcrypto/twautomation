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

    console.log('📥 Received API keys save request:', {
      phoneApiKey: phoneApiKey ? '(provided)' : '(empty)',
      captchaApiKey: captchaApiKey ? '(provided)' : '(empty)',
      aiApiUrl: aiApiUrl || '(empty)',
      aiApiKey: aiApiKey ? '(provided)' : '(empty)'
    });

    let pool = await ResourcePool.findOne();
    if (!pool) {
      console.log('📦 Creating new ResourcePool...');
      pool = await ResourcePool.create({
        phoneService: { provider: '5sim' },
        apiKeys: {},
        profilePictures: [],
        bioTemplates: [],
        emails: [],
        usernamePatterns: []
      });
    }

    // Initialize apiKeys object if it doesn't exist
    if (!pool.apiKeys || typeof pool.apiKeys !== 'object') {
      pool.apiKeys = {};
    }

    // Save phone service key
    if (phoneApiKey) {
      if (!pool.phoneService) pool.phoneService = {};
      pool.phoneService.provider = pool.phoneService.provider || '5sim';
      pool.phoneService.apiKey = phoneApiKey;
      pool.phoneService.lastChecked = new Date();
      pool.markModified('phoneService');
      console.log('✅ Phone API key set');
    }

    // Save 2captcha key
    if (captchaApiKey) {
      pool.apiKeys.twoCaptcha = captchaApiKey;
      pool.markModified('apiKeys');
      console.log('✅ 2Captcha API key set');
    }

    // Save AI API settings
    if (aiApiUrl || aiApiKey) {
      if (!pool.apiKeys.ai) pool.apiKeys.ai = {};
      if (aiApiUrl) pool.apiKeys.ai.url = aiApiUrl;
      if (aiApiKey) pool.apiKeys.ai.key = aiApiKey;
      pool.markModified('apiKeys');
      console.log('✅ AI API settings set');
    }

    await pool.save();

    console.log('💾 API keys saved to database successfully');

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
    console.error('❌ Error saving API keys:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Delete/Clear API keys
router.delete('/api-keys', async (req, res) => {
  try {
    const { keyType } = req.query; // 'phone', 'captcha', 'ai', or 'all'

    let pool = await ResourcePool.findOne();
    if (!pool) {
      return res.json({ success: true, message: 'No API keys to delete' });
    }

    if (!pool.apiKeys) pool.apiKeys = {};

    // Delete specific key or all
    if (keyType === 'all') {
      pool.phoneService = { provider: '5sim' };
      pool.apiKeys = {};
      pool.markModified('phoneService');
      pool.markModified('apiKeys');
      console.log('🗑️  Deleted ALL API keys');
    } else if (keyType === 'phone') {
      if (pool.phoneService) {
        pool.phoneService.apiKey = null;
        pool.markModified('phoneService');
      }
      console.log('🗑️  Deleted phone API key');
    } else if (keyType === 'captcha') {
      if (pool.apiKeys) {
        pool.apiKeys.twoCaptcha = null;
        pool.markModified('apiKeys');
      }
      console.log('🗑️  Deleted 2Captcha API key');
    } else if (keyType === 'ai') {
      if (pool.apiKeys) {
        pool.apiKeys.ai = null;
        pool.markModified('apiKeys');
      }
      console.log('🗑️  Deleted AI API keys');
    }

    await pool.save();

    res.json({ 
      success: true, 
      message: `API keys deleted: ${keyType || 'all'}` 
    });

  } catch (error) {
    console.error('❌ Error deleting API keys:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

