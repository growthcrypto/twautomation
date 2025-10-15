const mongoose = require('mongoose');

// ============================================
// TWITTER ACCOUNT MODEL
// ============================================
const twitterAccountSchema = new mongoose.Schema({
  // Basic Info
  username: { type: String, required: true, unique: true },
  email: String,
  password: String, // Encrypted
  phoneNumber: String,
  
  // Account Role
  role: { 
    type: String, 
    enum: ['traffic', 'chat'], 
    required: true 
  },
  
  // Niche/Branding
  niche: { 
    type: String, 
    enum: ['soccer', 'politics', 'gaming', 'drama', 'fitness', 'crypto', 'general'],
    default: 'general'
  },
  
  // Status & Health
  status: { 
    type: String, 
    enum: ['creating', 'warming_up', 'active', 'rate_limited', 'shadowbanned', 'banned', 'archived'],
    default: 'creating'
  },
  
  // AdsPower Integration
  adsPowerProfileId: String,
  proxyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proxy' },
  
  // Account Lifecycle
  createdDate: { type: Date, default: Date.now },
  activatedDate: Date, // When it finished warm-up
  lastActiveDate: Date,
  bannedDate: Date,
  
  // Warm-up Progress
  warmupPhase: { 
    day: { type: Number, default: 0 },
    completed: { type: Boolean, default: false }
  },
  
  // Daily Activity Stats (resets at midnight)
  today: {
    follows: { type: Number, default: 0 },
    unfollows: { type: Number, default: 0 },
    dms: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    tweets: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now }
  },
  
  // Daily Limits (per account)
  limits: {
    maxFollowsPerDay: { type: Number, default: 100 },
    maxUnfollowsPerDay: { type: Number, default: 100 },
    maxDMsPerDay: { type: Number, default: 50 },
    maxLikesPerDay: { type: Number, default: 200 },
    maxTweetsPerDay: { type: Number, default: 10 }
  },
  
  // Lifetime Performance Stats
  totalLeadsGenerated: { type: Number, default: 0 }, // For traffic accounts
  totalConversations: { type: Number, default: 0 }, // For chat accounts
  totalConversions: { type: Number, default: 0 }, // For chat accounts
  revenueAttributed: { type: Number, default: 0 }, // For chat accounts
  
  // Health Monitoring
  health: {
    actionSuccessRate: { type: Number, default: 100 }, // %
    lastHealthCheck: Date,
    failureCount: { type: Number, default: 0 }, // Failed actions in a row
    warningFlags: [String], // ["high_fail_rate", "low_engagement", etc.]
  },
  
  // Traffic Account Specific
  linkedChatAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }], // Which chat accounts to route leads to
  
  // Chat Account Specific
  ofLink: String, // OnlyFans link
  
  // Profile Data
  bio: String,
  profilePicUrl: String,
  
  // Notes
  notes: String
}, { timestamps: true });

// Indexes for performance
twitterAccountSchema.index({ username: 1 }, { unique: true });
twitterAccountSchema.index({ status: 1, role: 1 });
twitterAccountSchema.index({ 'today.lastResetDate': 1 });
twitterAccountSchema.index({ adsPowerProfileId: 1 });
twitterAccountSchema.index({ lastActiveDate: -1 });

// ============================================
// PROXY MODEL
// ============================================
const proxySchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['datacenter', 'residential', 'mobile'], 
    required: true 
  },
  provider: String,
  
  // Connection Details
  host: String,
  port: Number,
  username: String,
  password: String,
  
  // Location
  country: String,
  city: String,
  
  // Assignment
  assignedAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }],
  maxAccountsPerProxy: { type: Number, default: 3 },
  
  // Health
  status: { 
    type: String, 
    enum: ['active', 'blocked', 'rotating', 'offline'], 
    default: 'active' 
  },
  lastChecked: Date,
  failureCount: { type: Number, default: 0 },
  
  // Cost Tracking
  costPerMonth: Number,
  dataUsedGB: { type: Number, default: 0 },
  
  notes: String
}, { timestamps: true });

// Indexes for proxy lookups
proxySchema.index({ status: 1 });
proxySchema.index({ type: 1, status: 1 });

// ============================================
// TWITTER LEAD MODEL
// ============================================
const twitterLeadSchema = new mongoose.Schema({
  username: { type: String, required: true },
  
  // Attribution
  sourceAccount: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TwitterAccount', 
    required: true 
  }, // Which traffic account found them
  
  chatAccount: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TwitterAccount' 
  }, // Which chat account is handling them
  
  niche: String, // Inherited from source account
  
  // Lead Journey
  status: { 
    type: String, 
    enum: ['new_lead', 'dm_sent', 'in_conversation', 'link_sent', 'converted', 'ghosted', 'not_interested'],
    default: 'new_lead'
  },
  
  // Timeline
  firstContactDate: { type: Date, default: Date.now },
  firstDMDate: Date,
  conversationStartDate: Date,
  ofLinkSentDate: Date,
  convertedDate: Date,
  lastInteractionDate: Date,
  
  // Conversation Data
  messageCount: { type: Number, default: 0 },
  lastMessage: String,
  conversationSummary: String, // AI-generated summary
  
  // Engagement Scoring
  engagementScore: { type: Number, min: 0, max: 10 }, // 1-10, how engaged they are
  conversionLikelihood: { type: Number, min: 0, max: 100 }, // % chance they'll convert
  
  // Conversion Data
  converted: { type: Boolean, default: false },
  ofUsername: String, // Which OF account they subbed to
  revenue: { type: Number, default: 0 },
  
  // Lead Source Details
  discoveryMethod: { 
    type: String, 
    enum: ['follow', 'dm', 'community_scrape', 'hashtag', 'mention'] 
  },
  communitySource: String, // e.g., "r/soccer community"
  
  notes: String
}, { timestamps: true });

// Indexes for lead tracking and queries
twitterLeadSchema.index({ username: 1 });
twitterLeadSchema.index({ sourceAccount: 1, createdAt: -1 });
twitterLeadSchema.index({ chatAccount: 1, status: 1 });
twitterLeadSchema.index({ status: 1, lastInteractionDate: -1 });
twitterLeadSchema.index({ niche: 1, status: 1 });
twitterLeadSchema.index({ converted: 1, convertedDate: -1 });

// ============================================
// AUTOMATION TASK MODEL
// ============================================
const automationTaskSchema = new mongoose.Schema({
  taskType: { 
    type: String, 
    enum: ['follow', 'unfollow', 'send_dm', 'reply_dm', 'like', 'tweet', 'scrape_community'],
    required: true 
  },
  
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TwitterAccount', 
    required: true 
  },
  
  // Task Details
  targetUsername: String,
  targetUrl: String, // For likes, retweets, etc.
  messageContent: String, // For DMs
  communityName: String, // For scraping
  
  // Scheduling
  scheduledFor: { type: Date, default: Date.now },
  priority: { type: Number, default: 5, min: 1, max: 10 }, // 1 = low, 10 = urgent
  
  // Execution
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  executedAt: Date,
  errorMessage: String,
  
  // Related Lead (if applicable)
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterLead' }
}, { timestamps: true });

// Indexes for task scheduling and health monitoring
automationTaskSchema.index({ accountId: 1, status: 1, executedAt: -1 }); // Health checks
automationTaskSchema.index({ accountId: 1, status: 1, scheduledFor: 1 }); // Task scheduler
automationTaskSchema.index({ status: 1, scheduledFor: 1, priority: -1 }); // Queue processing
automationTaskSchema.index({ leadId: 1 }); // Lead tracking
automationTaskSchema.index({ updatedAt: -1 }); // Cleanup queries
automationTaskSchema.index({ taskType: 1, status: 1 }); // Analytics

// ============================================
// ACCOUNT RESOURCE POOL MODEL
// ============================================
const resourcePoolSchema = new mongoose.Schema({
  // Phone Number Service
  phoneService: {
    provider: { 
      type: String, 
      enum: ['5sim', 'sms-activate', 'smspva', 'custom'], 
      default: '5sim' 
    },
    apiKey: String,
    balance: Number,
    lastChecked: Date
  },
  
  // API Keys Storage (using Mixed type for flexibility)
  apiKeys: mongoose.Schema.Types.Mixed,
  
  // Profile Pictures (organized by niche)
  profilePictures: [{
    niche: String,
    filename: String,
    path: String,
    url: String,
    used: { type: Boolean, default: false },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }
  }],
  
  // Bio Templates
  bioTemplates: [{
    niche: String,
    role: { type: String, enum: ['traffic', 'chat'] },
    template: String, // e.g., "⚽ Hot takes | Main: {chat_account}"
    variables: [String] // ["chat_account", "emoji", etc.]
  }],
  
  // Email Pool
  emails: [{
    address: String,
    password: String,
    provider: String, // gmail, protonmail, etc.
    used: { type: Boolean, default: false },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }
  }],
  
  // Username Generation Rules
  usernamePatterns: [{
    niche: String,
    role: String,
    patterns: [String] // ["SoccerDebates{rand}", "FootballTakes{rand}"]
  }]
}, { timestamps: true });

// ============================================
// BAN DETECTION LOG MODEL
// ============================================
const banDetectionLogSchema = new mongoose.Schema({
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TwitterAccount', 
    required: true 
  },
  
  detectionMethod: {
    type: String,
    enum: ['action_failure_rate', 'error_message', 'manual_check', 'engagement_drop', 'screenshot_analysis'],
    required: true
  },
  
  severity: {
    type: String,
    enum: ['warning', 'rate_limited', 'shadowbanned', 'banned'],
    required: true
  },
  
  evidence: {
    failureRate: Number,
    consecutiveFailures: Number,
    errorMessage: String,
    screenshotUrl: String,
    engagementDrop: Number
  },
  
  actionTaken: {
    type: String,
    enum: ['none', 'paused', 'reduced_activity', 'account_replaced', 'manual_review'],
    default: 'none'
  },
  
  replacementAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' },
  
  resolvedAt: Date,
  notes: String
}, { timestamps: true });

// Indexes for ban detection logs
banDetectionLogSchema.index({ accountId: 1, createdAt: -1 });
banDetectionLogSchema.index({ severity: 1, createdAt: -1 });

// ============================================
// TWITTER COMMUNITY MODEL
// ============================================
const twitterCommunitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  communityId: String, // Twitter's internal ID
  url: String,
  
  niche: { 
    type: String, 
    enum: ['soccer', 'politics', 'gaming', 'drama', 'fitness', 'crypto', 'general']
  },
  
  // Stats
  memberCount: Number,
  lastScraped: Date,
  totalLeadsGenerated: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 },
  
  // Scraping Config
  scrapingEnabled: { type: Boolean, default: true },
  scrapingFrequency: { type: String, enum: ['hourly', 'daily', 'weekly'], default: 'daily' },
  maxUsersPerScrape: { type: Number, default: 50 },
  
  // Quality Metrics
  avgEngagementScore: Number,
  avgConversionRate: Number,
  
  status: {
    type: String,
    enum: ['active', 'paused', 'banned', 'low_quality'],
    default: 'active'
  },
  
  notes: String
}, { timestamps: true });

// Indexes for community tracking
twitterCommunitySchema.index({ niche: 1, status: 1 });
twitterCommunitySchema.index({ status: 1, totalLeadsGenerated: -1 });
twitterCommunitySchema.index({ communityId: 1 });

// ============================================
// SYSTEM ANALYTICS MODEL
// ============================================
const systemAnalyticsSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  
  // Account Stats
  totalAccounts: Number,
  activeAccounts: Number,
  bannedToday: Number,
  createdToday: Number,
  
  // Activity Stats
  totalFollows: Number,
  totalDMs: Number,
  totalLikes: Number,
  
  // Lead Pipeline
  newLeads: Number,
  activeConversations: Number,
  linksSent: Number,
  conversions: Number,
  
  // Revenue
  totalRevenue: Number,
  avgRevenuePerConversion: Number,
  
  // Performance by Niche
  byNiche: [{
    niche: String,
    leads: Number,
    conversions: Number,
    revenue: Number,
    conversionRate: Number
  }],
  
  // Account Health
  avgAccountHealth: Number,
  accountsNeedingAttention: Number
}, { timestamps: true });

// Index for analytics queries
systemAnalyticsSchema.index({ date: 1 }, { unique: true });

// ============================================
// TWITTER SESSION MODEL
// ============================================
const twitterSessionSchema = new mongoose.Schema({
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TwitterAccount', 
    required: true,
    unique: true
  },
  
  // Session Data
  cookies: mongoose.Schema.Types.Mixed,  // Stored cookies for persistent login
  authToken: String,
  csrfToken: String,
  
  // Browser State
  isLoggedIn: { type: Boolean, default: false },
  lastLoginDate: Date,
  loginAttempts: { type: Number, default: 0 },
  
  // Session Health
  status: {
    type: String,
    enum: ['active', 'expired', 'requires_verification', 'locked'],
    default: 'active'
  },
  
  lastActivityDate: Date,
  expiresAt: Date
}, { timestamps: true });

// Indexes for session management
twitterSessionSchema.index({ accountId: 1 }, { unique: true });
twitterSessionSchema.index({ status: 1, expiresAt: 1 });

// ============================================
// EXPORTS
// ============================================
const TwitterAccount = mongoose.model('TwitterAccount', twitterAccountSchema);
const Proxy = mongoose.model('Proxy', proxySchema);
const TwitterLead = mongoose.model('TwitterLead', twitterLeadSchema);
const AutomationTask = mongoose.model('AutomationTask', automationTaskSchema);
const ResourcePool = mongoose.model('ResourcePool', resourcePoolSchema);
const BanDetectionLog = mongoose.model('BanDetectionLog', banDetectionLogSchema);
const TwitterCommunity = mongoose.model('TwitterCommunity', twitterCommunitySchema);
const SystemAnalytics = mongoose.model('SystemAnalytics', systemAnalyticsSchema);
const TwitterSession = mongoose.model('TwitterSession', twitterSessionSchema);

// Import campaign configs
const {
  FollowUnfollowConfig,
  MassDMConfig,
  AIChatConfig,
  WarmupConfig,
  RandomActivityConfig
} = require('./campaign-configs');

module.exports = {
  TwitterAccount,
  Proxy,
  TwitterLead,
  AutomationTask,
  ResourcePool,
  BanDetectionLog,
  TwitterCommunity,
  SystemAnalytics,
  TwitterSession,
  FollowUnfollowConfig,
  MassDMConfig,
  AIChatConfig,
  WarmupConfig,
  RandomActivityConfig
};

