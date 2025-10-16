const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Services
const healthMonitor = require('./services/health-monitor');
const taskScheduler = require('./services/task-scheduler');
const taskCleanup = require('./services/task-cleanup-service');
const adsPowerController = require('./services/adspower-controller');

// Routes
const extensionRoutes = require('./routes/extension-api');
const configRoutes = require('./routes/config-api');
const resourceRoutes = require('./routes/resource-api');
const leadsRoutes = require('./routes/leads-api');

// Models
const {
  TwitterAccount,
  Proxy,
  TwitterLead,
  AutomationTask,
  ResourcePool,
  BanDetectionLog,
  TwitterCommunity,
  SystemAnalytics
} = require('./models');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static dashboard files
app.use(express.static(path.join(__dirname, '../dashboard')));

// ==============================================
// DATABASE CONNECTION
// ==============================================

const connectDB = async () => {
  try {
    // Railway MongoDB sets multiple env vars - check PUBLIC URL first (works across services)
    const mongoUri = process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.MONGO_URL || 'mongodb://localhost:27017/twitter-automation';
    console.log('🔄 Connecting to MongoDB with connection pooling...');
    console.log('   MONGO_PUBLIC_URL:', process.env.MONGO_PUBLIC_URL ? 'SET' : 'NOT SET');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    console.log('   MONGODB_URL:', process.env.MONGODB_URL ? 'SET' : 'NOT SET');
    console.log('   MONGO_URL:', process.env.MONGO_URL ? 'SET' : 'NOT SET');
    console.log('   Using:', mongoUri.includes('@') ? mongoUri.replace(/\/\/.*@/, '//***:***@') : mongoUri); // Hide credentials
    
    // Connection pool configuration
    const options = {
      maxPoolSize: 50,        // Max 50 concurrent connections
      minPoolSize: 10,        // Keep 10 connections ready
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      serverSelectionTimeoutMS: 10000, // Timeout after 10s if server not found
      family: 4,              // Use IPv4, skip trying IPv6
      maxIdleTimeMS: 60000,   // Close idle connections after 60s
      retryWrites: true,      // Automatically retry failed writes
      retryReads: true        // Automatically retry failed reads
    };
    
    await mongoose.connect(mongoUri, options);
    console.log('✅ MongoDB connected successfully (pool: 10-50 connections)');
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  Mongoose disconnected from MongoDB');
    });

    // Monitor connection pool
    if (process.env.NODE_ENV !== 'production') {
      setInterval(() => {
        const stats = mongoose.connection.client?.topology?.s?.pool?.stats;
        if (stats) {
          console.log(`📊 MongoDB Pool: ${stats.activeConnections} active, ${stats.availableConnections} available`);
        }
      }, 60000); // Every minute in development
    }

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('   Error type:', error.name);
    console.error('   Full error:', error);
    console.error('\n⚠️  CRITICAL: Database features will NOT work!');
    console.error('   Please check:');
    console.error('   1. MONGODB_URI or MONGO_URL is set in Railway');
    console.error('   2. MongoDB addon is added to your Railway project');
    console.error('   3. Connection string is correct\n');
    throw error; // Re-throw so startServer can handle it
  }
};

// ==============================================
// API ROUTES
// ==============================================

// Extension API
app.use('/api/extension', extensionRoutes);

// Config API
app.use('/api/configs', configRoutes);

// Resource API
app.use('/api/resources', resourceRoutes);

// Leads API
app.use('/api/leads', leadsRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Cookie Management
const cookieManager = require('./services/cookie-manager');

app.post('/api/accounts/:id/extract-cookies', async (req, res) => {
  try {
    const result = await cookieManager.extractCookies(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounts/:id/set-cookies', async (req, res) => {
  try {
    const { cookies } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cookies must be provided as an array' 
      });
    }

    const result = await cookieManager.setCookiesManually(req.params.id, cookies);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/accounts/:id/cookie-status', async (req, res) => {
  try {
    const status = await cookieManager.getCookieStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounts/:id/test-cookies', async (req, res) => {
  try {
    const result = await cookieManager.testCookies(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Account Management
app.get('/api/accounts', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, role, niche } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    if (niche) filter.niche = niche;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TwitterAccount.countDocuments(filter);

    const accounts = await TwitterAccount.find(filter)
      .populate('proxyId')
      .sort({ createdDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      accounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + accounts.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const account = await TwitterAccount.findById(req.params.id)
      .populate('proxyId')
      .populate('linkedChatAccounts');

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await TwitterAccount.create(req.body);
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk account creation (with parallel processing)
app.post('/api/accounts/bulk-create', async (req, res) => {
  try {
    const { count, role, niche, linkedChatUsername } = req.body;
    
    if (!count || count < 1 || count > 50) {
      return res.status(400).json({ success: false, error: 'Count must be between 1 and 50' });
    }

    console.log(`🤖 Starting bulk creation of ${count} ${role} accounts (parallel batches)...`);

    const accountCreator = require('./services/twitter-account-creator');
    const results = [];

    // Process in batches of 3 (parallel)
    const BATCH_SIZE = 3;
    const batches = Math.ceil(count / BATCH_SIZE);

    for (let batchNum = 0; batchNum < batches; batchNum++) {
      const batchStart = batchNum * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
      const batchCount = batchEnd - batchStart;

      console.log(`📦 Processing batch ${batchNum + 1}/${batches} (${batchCount} accounts)...`);

      // Create accounts in parallel within batch
      const batchPromises = [];
      for (let i = 0; i < batchCount; i++) {
        batchPromises.push(
          accountCreator.createAccount({
        role,
        niche,
        linkedChatAccountUsername: linkedChatUsername
          })
        );
      }

      // Wait for entire batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((result, idx) => {
        const accountNum = batchStart + idx + 1;
        
        if (result.status === 'fulfilled' && result.value.success) {
          console.log(`✅ Created account ${accountNum}/${count}: ${result.value.username}`);
          results.push(result.value);
        } else {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          console.log(`❌ Failed account ${accountNum}/${count}: ${error}`);
          results.push({ success: false, error: error.toString() });
        }
      });

      // Delay between batches (not between individual accounts)
      if (batchNum < batches - 1) {
        console.log('   ⏸️  Waiting 30 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 sec between batches
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`✅ Bulk creation complete: ${successCount}/${count} successful`);

    res.json({
      success: true,
      total: count,
      successful: successCount,
      failed: count - successCount,
      results
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/accounts/:id', async (req, res) => {
  try {
    const account = await TwitterAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const account = await TwitterAccount.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    console.log(`🗑️  Deleting account @${account.username}...`);

    // Cancel all pending tasks
    await AutomationTask.updateMany(
      { accountId: account._id, status: 'pending' },
      { status: 'cancelled' }
    );

    // Delete related Twitter session
    await TwitterSession.deleteOne({ accountId: account._id });

    // Delete AdsPower profile (if exists and AdsPower is running)
    if (account.adsPowerProfileId) {
      try {
        await adsPowerController.deleteProfile(account.adsPowerProfileId);
        console.log(`   ✅ Deleted AdsPower profile: ${account.adsPowerProfileId}`);
      } catch (error) {
        console.log(`   ⚠️  Could not delete AdsPower profile: ${error.message}`);
      }
    }

    // Actually DELETE the account (not just archive)
    await TwitterAccount.deleteOne({ _id: account._id });

    console.log(`✅ Account @${account.username} deleted successfully`);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Leads & Conversions
app.get('/api/leads', async (req, res) => {
  try {
    const { status, niche, accountId, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (niche) filter.niche = niche;
    if (accountId) {
      filter.$or = [
        { sourceAccount: accountId },
        { chatAccount: accountId }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TwitterLead.countDocuments(filter);

    const leads = await TwitterLead.find(filter)
      .populate('sourceAccount', 'username role niche')
      .populate('chatAccount', 'username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + leads.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/leads/:id', async (req, res) => {
  try {
    const lead = await TwitterLead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { status, accountId, page = 1, limit = 100 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (accountId) filter.accountId = accountId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AutomationTask.countDocuments(filter);

    const tasks = await AutomationTask.find(filter)
      .populate('accountId', 'username role niche')
      .sort({ priority: -1, scheduledFor: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + tasks.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = await AutomationTask.create(req.body);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await AutomationTask.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Campaigns
app.post('/api/campaigns/follow', async (req, res) => {
  try {
    const twitterAutomation = require('./services/twitter-automation');
    const { accountId, targetNiche, maxFollows } = req.body;
    
    const result = await twitterAutomation.runFollowCampaign(accountId, targetNiche, maxFollows);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/campaigns/mass-dm', async (req, res) => {
  try {
    const twitterAutomation = require('./services/twitter-automation');
    const { accountId, strategy } = req.body;
    
    const result = await twitterAutomation.runMassDMCampaign(accountId, { strategy });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Communities
app.get('/api/communities', async (req, res) => {
  try {
    const { page = 1, limit = 50, niche, status } = req.query;
    
    const filter = {};
    if (niche) filter.niche = niche;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TwitterCommunity.countDocuments(filter);

    const communities = await TwitterCommunity.find(filter)
      .sort({ totalLeadsGenerated: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      communities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + communities.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/communities', async (req, res) => {
  try {
    const community = await TwitterCommunity.create(req.body);
    res.json({ success: true, community });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxies
app.get('/api/proxies', async (req, res) => {
  try {
    const proxies = await Proxy.find().populate('assignedAccounts', 'username');
    res.json({ success: true, proxies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/proxies', async (req, res) => {
  try {
    const proxy = await Proxy.create(req.body);
    res.json({ success: true, proxy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Note: Resource Pool endpoints are in /routes/resource-api.js
// Registered at line 110: app.use('/api/resources', resourceRoutes)

// System Analytics
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    // Get overall stats
    const totalAccounts = await TwitterAccount.countDocuments();
    const activeAccounts = await TwitterAccount.countDocuments({ status: 'active' });
    const warmingUp = await TwitterAccount.countDocuments({ status: 'warming_up' });
    const banned = await TwitterAccount.countDocuments({ status: 'banned' });

    // Today's activity
    const today = new Date().toDateString();
    const accountsActiveToday = await TwitterAccount.find({
      'today.lastResetDate': { $gte: new Date(today) }
    });

    const todayStats = accountsActiveToday.reduce((acc, account) => {
      acc.follows += account.today.follows;
      acc.dms += account.today.dms;
      acc.likes += account.today.likes;
      return acc;
    }, { follows: 0, dms: 0, likes: 0 });

    // Lead pipeline
    const newLeads = await TwitterLead.countDocuments({ status: 'new_lead' });
    const inConversation = await TwitterLead.countDocuments({ status: 'in_conversation' });
    const linkSent = await TwitterLead.countDocuments({ status: 'link_sent' });
    const converted = await TwitterLead.countDocuments({ status: 'converted' });

    // Revenue
    const conversions = await TwitterLead.find({ status: 'converted' });
    const totalRevenue = conversions.reduce((sum, lead) => sum + (lead.revenue || 0), 0);

    // Task queue
    const pendingTasks = await AutomationTask.countDocuments({ status: 'pending' });
    const failedTasksToday = await AutomationTask.countDocuments({
      status: 'failed',
      updatedAt: { $gte: new Date(today) }
    });

    // By niche
    const byNiche = await TwitterAccount.aggregate([
      { $match: { status: { $in: ['active', 'warming_up'] } } },
      {
        $group: {
          _id: '$niche',
          accounts: { $sum: 1 },
          traffic: {
            $sum: { $cond: [{ $eq: ['$role', 'traffic'] }, 1, 0] }
          },
          chat: {
            $sum: { $cond: [{ $eq: ['$role', 'chat'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      dashboard: {
        accounts: {
          total: totalAccounts,
          active: activeAccounts,
          warmingUp,
          banned
        },
        today: todayStats,
        leads: {
          new: newLeads,
          inConversation,
          linkSent,
          converted
        },
        revenue: {
          total: totalRevenue,
          conversions: converted,
          avgPerConversion: converted > 0 ? totalRevenue / converted : 0
        },
        tasks: {
          pending: pendingTasks,
          failedToday: failedTasksToday
        },
        byNiche
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// System Control
app.post('/api/system/start', async (req, res) => {
  try {
    const smartEngine = require('./services/smart-execution-engine');
    const logStreamer = require('./utils/log-streamer');
    
    logStreamer.info('🚀 Starting system via dashboard...');
    
    const result = await smartEngine.start();

    if (result.success === false && result.reason === 'already_running') {
      logStreamer.warning('⚠️ System is already running');
      return res.json({
        success: true,
        message: 'System is already running',
        alreadyRunning: true,
        accountsManaged: smartEngine.managedAccounts?.size || 0
      });
    }

    logStreamer.success('✅ System started successfully', { accountsManaged: result.accountsManaged });

    res.json({
      success: true,
      message: 'System started',
      ...result
    });
  } catch (error) {
    console.error('Start system error:', error);
    logStreamer.error('❌ Failed to start system', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/system/stop', async (req, res) => {
  try {
    const smartEngine = require('./services/smart-execution-engine');
    const logStreamer = require('./utils/log-streamer');
    
    logStreamer.info('🛑 Stopping system via dashboard...');
    
    const result = await smartEngine.stop();

    logStreamer.success('✅ System stopped successfully');

    res.json({
      success: true,
      message: 'System stopped',
      ...result
    });
  } catch (error) {
    logStreamer.error('❌ Failed to stop system', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system/status', async (req, res) => {
  try {
    const smartEngine = require('./services/smart-execution-engine');
    const adsPowerOnline = await adsPowerController.checkConnection();

    res.json({
      success: true,
      status: {
        healthMonitor: healthMonitor.isRunning,
        taskScheduler: taskScheduler.isRunning,
        smartEngine: smartEngine.isRunning,
        adsPower: adsPowerOnline,
        database: mongoose.connection.readyState === 1,
        activeProfiles: adsPowerController.getActiveProfiles().length,
        managedAccounts: smartEngine.managedAccounts?.size || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint (for Railway/Docker)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.send('Twitter Automation System is running! ✅');
});

// Live logs endpoint (Server-Sent Events)
const logStreamer = require('./utils/log-streamer');

app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Add client
  logStreamer.addClient(res);
  
  // Remove on disconnect
  req.on('close', () => {
    logStreamer.removeClient(res);
  });
});

// Dashboard route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// ==============================================
// START SERVER
// ==============================================

const startServer = async () => {
  try {
    console.log('🚀 Starting Twitter Automation System...');
    console.log('   PORT:', PORT);
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   MONGO_PUBLIC_URL:', process.env.MONGO_PUBLIC_URL ? 'SET' : 'NOT SET');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    console.log('   MONGODB_URL:', process.env.MONGODB_URL ? 'SET' : 'NOT SET');
    console.log('   MONGO_URL:', process.env.MONGO_URL ? 'SET' : 'NOT SET');

    // IMPORTANT: Connect to MongoDB FIRST (Railway needs this)
    await connectDB();

    // Start server AFTER database is connected
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ HTTP Server listening on port ${PORT}`);
      console.log(`   Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`   Test endpoint: http://0.0.0.0:${PORT}/test`);
      console.log(`   Dashboard: http://0.0.0.0:${PORT}`);
    });

    // Check AdsPower (non-blocking, don't await)
    adsPowerController.checkConnection().catch(() => {
      console.warn('⚠️  AdsPower not available (expected on Railway)');
    });

    // Start task cleanup service (runs daily)
    taskCleanup.start();

    // DON'T auto-start the system - let user click Start button
    // const smartEngine = require('./services/smart-execution-engine');
    // await smartEngine.start();

    console.log('\n✅ Server ready! Open http://localhost:3000');
    console.log('   Click "Start System" button in dashboard to begin automation\n');

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    // Still start the server even if DB fails (Railway needs a responding port)
    app.listen(PORT, '0.0.0.0', () => {
      console.log('⚠️  Server started WITHOUT database connection');
      console.log(`   Check MONGODB_URI or MONGO_URL environment variable`);
    });
  }
};

// Graceful shutdown (SIGINT = Ctrl+C, SIGTERM = Railway restart)
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    const smartEngine = require('./services/smart-execution-engine');
    const browserSessionManager = require('./services/browser-session-manager');
    
    // Stop all automation
    if (smartEngine.isRunning) {
      await smartEngine.stop();
    }
    
    healthMonitor.stop();
    taskScheduler.stop();
    taskCleanup.stop();
    
    // Close all browsers
    await browserSessionManager.stop();
    await adsPowerController.closeAllProfiles();
    
    // Close database
    await mongoose.connection.close();
    
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Railway sends this

startServer();

module.exports = app;

