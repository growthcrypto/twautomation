const mongoose = require('mongoose');

/**
 * Testing Cohort Model
 * Track A/B tests for different automation strategies
 */
const testingCohortSchema = new mongoose.Schema({
  // Test Information
  testName: { type: String, required: true },
  strategy: {
    type: String,
    enum: [
      'evolution_single_account',       // Account ages, then becomes traffic+chat
      'hybrid_follow_dm',               // Follow + DM on same account
      'specialist_follow_only',         // Just Follow/Unfollow
      'specialist_dm_only',             // Just Mass DM
      'specialist_separate',            // Traffic accounts → Chat accounts
      'custom'
    ],
    required: true
  },
  description: String,
  
  // Test Configuration
  config: {
    warmupDays: { type: Number, default: 14 },
    followPerDay: { type: Number, default: 0 },
    dmPerDay: { type: Number, default: 0 },
    hasPremium: { type: Boolean, default: false },
    usesRedirect: { type: Boolean, default: false },
    niche: String,
    customSettings: mongoose.Schema.Types.Mixed
  },
  
  // Accounts in this cohort
  accounts: [{
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' },
    username: String,
    startDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['warming_up', 'active', 'banned', 'completed'],
      default: 'warming_up'
    },
    banDate: Date,
    graduationDate: Date  // When warmup completed
  }],
  
  // Results Tracking
  results: {
    // Account Health
    totalAccountsStarted: { type: Number, default: 0 },
    accountsBanned: { type: Number, default: 0 },
    accountsActive: { type: Number, default: 0 },
    banRate: { type: Number, default: 0 },  // Percentage
    
    // Traffic Generated
    totalFollows: { type: Number, default: 0 },
    totalFollowBacks: { type: Number, default: 0 },
    followBackRate: { type: Number, default: 0 },  // Percentage
    totalDMsSent: { type: Number, default: 0 },
    totalProfileViews: { type: Number, default: 0 },
    
    // Conversion Funnel
    leadsGenerated: { type: Number, default: 0 },
    dmRepliesReceived: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 },  // Percentage
    ofLinksSent: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },  // Percentage
    
    // Revenue
    totalRevenue: { type: Number, default: 0 },
    avgRevenuePerConversion: { type: Number, default: 0 },
    revenuePerAccount: { type: Number, default: 0 },
    
    // Timing
    avgDaysToFirstConversion: { type: Number, default: 0 },
    avgDaysToAccountBan: { type: Number, default: 0 }
  },
  
  // Test Status
  status: {
    type: String,
    enum: ['planning', 'running', 'paused', 'completed', 'cancelled'],
    default: 'planning'
  },
  startDate: Date,
  endDate: Date,
  targetDuration: { type: Number, default: 30 },  // Days to run test
  
  // Notes
  hypothesis: String,
  notes: String,
  conclusions: String
  
}, { timestamps: true });

// Calculate and update results
testingCohortSchema.methods.calculateResults = async function() {
  const TwitterAccount = mongoose.model('TwitterAccount');
  const TwitterLead = mongoose.model('TwitterLead');
  
  // Get all accounts in cohort
  const accountIds = this.accounts.map(a => a.accountId);
  
  // Count statuses
  this.results.totalAccountsStarted = this.accounts.length;
  this.results.accountsBanned = this.accounts.filter(a => a.status === 'banned').length;
  this.results.accountsActive = this.accounts.filter(a => a.status === 'active').length;
  this.results.banRate = (this.results.accountsBanned / this.results.totalAccountsStarted * 100) || 0;
  
  // Get account stats
  const accounts = await TwitterAccount.find({ _id: { $in: accountIds } });
  
  this.results.totalFollows = accounts.reduce((sum, acc) => sum + (acc.totalFollows || 0), 0);
  this.results.totalFollowBacks = accounts.reduce((sum, acc) => sum + (acc.totalFollowBacks || 0), 0);
  this.results.followBackRate = (this.results.totalFollowBacks / this.results.totalFollows * 100) || 0;
  this.results.totalDMsSent = accounts.reduce((sum, acc) => sum + (acc.totalDMsSent || 0), 0);
  
  // Get lead/conversion stats
  const leads = await TwitterLead.find({ sourceAccount: { $in: accountIds } });
  
  this.results.leadsGenerated = leads.length;
  this.results.dmRepliesReceived = leads.filter(l => l.status !== 'dm_sent' && l.status !== 'new_lead').length;
  this.results.replyRate = (this.results.dmRepliesReceived / this.results.totalDMsSent * 100) || 0;
  this.results.ofLinksSent = leads.filter(l => l.status === 'link_sent' || l.status === 'converted').length;
  this.results.conversions = leads.filter(l => l.status === 'converted').length;
  this.results.conversionRate = (this.results.conversions / this.results.ofLinksSent * 100) || 0;
  
  // Revenue
  this.results.totalRevenue = leads.reduce((sum, l) => sum + (l.revenue || 0), 0);
  this.results.avgRevenuePerConversion = (this.results.totalRevenue / this.results.conversions) || 0;
  this.results.revenuePerAccount = (this.results.totalRevenue / this.results.totalAccountsStarted) || 0;
  
  await this.save();
  return this.results;
};

// Index for lookups
testingCohortSchema.index({ strategy: 1, status: 1 });
testingCohortSchema.index({ 'accounts.accountId': 1 });

module.exports = mongoose.model('TestingCohort', testingCohortSchema);

