const mongoose = require('mongoose');

// ============================================
// LEAD POOL - Scraped potential leads
// ============================================
const leadPoolSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  platform: { type: String, default: 'twitter' },
  
  // Discovery
  discoveredFrom: {
    type: { type: String, enum: ['community', 'hashtag', 'follower_list', 'engagement'], required: true },
    source: String, // Community ID, hashtag, account username
    discoveredDate: { type: Date, default: Date.now }
  },
  
  niche: { type: String }, // soccer, politics, gaming, etc.
  
  // Quality Metrics
  quality: {
    score: { type: Number, min: 0, max: 10, default: 5 }, // Overall quality
    hasProfilePic: { type: Boolean },
    isPrivate: { type: Boolean },
    followerCount: Number,
    followingCount: Number,
    accountAge: Number, // days
    bio: String,
    isVerified: { type: Boolean, default: false },
    isSuspectedBot: { type: Boolean, default: false }
  },
  
  // Lead Status
  status: {
    type: String,
    enum: ['new', 'followed', 'follow_back', 'dmed', 'responded', 'routed_to_chat', 'converted', 'dead'],
    default: 'new'
  },
  
  // Assignment
  assignedToAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' },
  followedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' },
  dmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' },
  
  // Timeline
  followedDate: Date,
  followBackDate: Date,
  dmedDate: Date,
  respondedDate: Date,
  convertedDate: Date,
  
  // Attempts
  followAttempts: { type: Number, default: 0 },
  dmAttempts: { type: Number, default: 0 },
  
  // Conversion Data
  convertedToOF: { type: Boolean, default: false },
  revenue: { type: Number, default: 0 },
  
  notes: String
}, { timestamps: true });

// ============================================
// SCRAPER CONFIG
// ============================================
const scraperConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  
  // Target Sources
  targets: [{
    type: { type: String, enum: ['community', 'hashtag', 'follower_list'] },
    value: String, // Community ID, hashtag, account username
    niche: String,
    priority: { type: Number, default: 5 }
  }],
  
  // Scraping Settings
  settings: {
    maxLeadsPerRun: { type: Number, default: 100 },
    runsPerDay: { type: Number, default: 3 },
    delayBetweenRuns: { type: Number, default: 8 }, // hours
  },
  
  // Quality Filters
  qualityFilters: {
    requireProfilePic: { type: Boolean, default: true },
    skipPrivateAccounts: { type: Boolean, default: true },
    minFollowers: { type: Number, default: 10 },
    maxFollowers: { type: Number, default: 10000 },
    minAccountAge: { type: Number, default: 30 }, // days
    skipSuspectedBots: { type: Boolean, default: true }
  },
  
  // Stats
  stats: {
    totalScraped: { type: Number, default: 0 },
    qualityLeads: { type: Number, default: 0 },
    filteredOut: { type: Number, default: 0 },
    lastRunDate: Date
  }
}, { timestamps: true });

// ============================================
// EXPORTS
// ============================================
const LeadPool = mongoose.model('LeadPool', leadPoolSchema);
const ScraperConfig = mongoose.model('ScraperConfig', scraperConfigSchema);

module.exports = {
  LeadPool,
  ScraperConfig
};

