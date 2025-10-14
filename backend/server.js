const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Services
const healthMonitor = require('./services/health-monitor');
const taskScheduler = require('./services/task-scheduler');
const adsPowerController = require('./services/adspower-controller');

// Routes
const extensionRoutes = require('./routes/extension-api');
const configRoutes = require('./routes/config-api');

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
    // Railway sets MONGO_URL, but we use MONGODB_URI - check both
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/twitter-automation';
    console.log('🔄 Connecting to MongoDB...');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    console.log('   MONGO_URL:', process.env.MONGO_URL ? 'SET' : 'NOT SET');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('⚠️  App will start but database features will not work');
    // Don't exit - let app start anyway
  }
};

// ==============================================
// API ROUTES
// ==============================================

// Extension API
app.use('/api/extension', extensionRoutes);

// Config API
app.use('/api/configs', configRoutes);

// Account Management
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await TwitterAccount.find()
      .populate('proxyId')
      .sort({ createdDate: -1 });

    res.json({ success: true, accounts });
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
    const accountLifecycle = require('./services/account-lifecycle');
    const result = await accountLifecycle.createNewAccount(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
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
    
    if (account) {
      // Archive instead of delete
      account.status = 'archived';
      await account.save();

      // Delete AdsPower profile
      if (account.adsPowerProfileId) {
        await adsPowerController.deleteProfile(account.adsPowerProfileId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Leads & Conversions
app.get('/api/leads', async (req, res) => {
  try {
    const { status, niche, accountId } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (niche) filter.niche = niche;
    if (accountId) {
      filter.$or = [
        { sourceAccount: accountId },
        { chatAccount: accountId }
      ];
    }

    const leads = await TwitterLead.find(filter)
      .populate('sourceAccount', 'username role niche')
      .populate('chatAccount', 'username role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, leads });
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
    const { status, accountId } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (accountId) filter.accountId = accountId;

    const tasks = await AutomationTask.find(filter)
      .populate('accountId', 'username role niche')
      .sort({ priority: -1, scheduledFor: 1 })
      .limit(200);

    res.json({ success: true, tasks });
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
    const communities = await TwitterCommunity.find().sort({ totalLeadsGenerated: -1 });
    res.json({ success: true, communities });
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

// Resource Pool
app.get('/api/resources', async (req, res) => {
  try {
    const resources = await ResourcePool.findOne();
    res.json({ success: true, resources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/resources', async (req, res) => {
  try {
    let resources = await ResourcePool.findOne();
    
    if (!resources) {
      resources = await ResourcePool.create(req.body);
    } else {
      Object.assign(resources, req.body);
      await resources.save();
    }

    res.json({ success: true, resources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    const result = await smartEngine.start();

    res.json({
      success: true,
      message: 'System started',
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/system/stop', async (req, res) => {
  try {
    const smartEngine = require('./services/smart-execution-engine');
    const result = await smartEngine.stop();

    res.json({
      success: true,
      message: 'System stopped',
      ...result
    });
  } catch (error) {
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
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET (using default)');

    // Start server FIRST (so Railway knows app is responding)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ HTTP Server listening on port ${PORT}`);
      console.log(`   Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`   Test endpoint: http://0.0.0.0:${PORT}/test`);
    });

    // Then try to connect to MongoDB (non-blocking)
    connectDB().catch((err) => {
      console.error('⚠️  MongoDB connection failed, but server is running');
    });

    // Check AdsPower (non-blocking, don't await)
    adsPowerController.checkConnection().catch(() => {
      console.warn('⚠️  AdsPower not available (expected on Railway)');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  healthMonitor.stop();
  taskScheduler.stop();
  await adsPowerController.closeAllProfiles();
  await mongoose.connection.close();
  
  console.log('✅ Shutdown complete');
  process.exit(0);
});

startServer();

module.exports = app;

