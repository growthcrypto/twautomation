const mongoose = require('mongoose');

// ============================================
// FOLLOW/UNFOLLOW CAMPAIGN CONFIG
// ============================================
const followUnfollowConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  niche: String,
  enabled: { type: Boolean, default: true },
  
  // Daily Limits
  maxFollowsPerDay: { type: Number, default: 100 },
  maxUnfollowsPerDay: { type: Number, default: 100 },
  
  // Timing Controls
  delayBetweenFollows: {
    min: { type: Number, default: 30 },  // seconds
    max: { type: Number, default: 120 }
  },
  
  // Break System (TIME-BASED - More Realistic!)
  breaks: {
    enabled: { type: Boolean, default: true },
    
    // TIME between breaks (seconds) - "Work for X seconds, then break"
    timeBetweenBreaks: {
      min: { type: Number, default: 60 },   // Work for 1-5 minutes (RANDOM)
      max: { type: Number, default: 300 }
    },
    
    // Break duration (seconds)
    breakDuration: {
      min: { type: Number, default: 60 },   // Break for 1-3 minutes (RANDOM)
      max: { type: Number, default: 180 }
    },
    
    // Activity during breaks (looks human!)
    duringBreak: {
      enabled: { type: Boolean, default: true },
      activities: {
        goToHome: { type: Boolean, default: true },
        scrollFeed: { type: Boolean, default: true },
        likePosts: {
          enabled: { type: Boolean, default: true },
          probability: { type: Number, default: 30 }
        },
        readTweets: {
          enabled: { type: Boolean, default: true },
          probability: { type: Number, default: 40 }
        },
        readReplies: {
          enabled: { type: Boolean, default: true },
          probability: { type: Number, default: 20 }
        },
        visitProfiles: {
          enabled: { type: Boolean, default: true },
          probability: { type: Number, default: 15 }
        }
      }
    }
  },
  
  // Active Hours
  activeHours: {
    start: { type: String, default: "08:00" },
    end: { type: String, default: "22:00" },
    timezone: { type: String, default: "America/New_York" }
  },
  
  // Follow Back Checker
  followBackChecker: {
    enabled: { type: Boolean, default: true },
    checkAfterDays: { type: Number, default: 3 },
    unfollowIfNoFollowBack: { type: Boolean, default: true }
  },
  
  // Target Sources
  targetSources: [{
    type: { type: String, enum: ['community', 'hashtag', 'follower_scrape', 'likes_scrape'] },
    value: String,  // community ID, hashtag, account username
    weight: { type: Number, default: 100 }  // percentage
  }],
  
  // Random Activity
  randomActivity: {
    likeTargetProfile: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 30 }
    },
    viewProfile: {
      enabled: { type: Boolean, default: true },
      scrollTime: {
        min: { type: Number, default: 2 },
        max: { type: Number, default: 8 }
      }
    },
    readBio: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 50 }
    }
  },
  
  // Filters
  skipIfPrivate: { type: Boolean, default: true },
  skipIfNoProfilePic: { type: Boolean, default: true },
  skipIfLowFollowers: { type: Number, default: 10 },
  skipIfHighFollowing: { type: Number, default: 5000 },
  
  // Error Handling
  maxConsecutiveErrors: { type: Number, default: 3 },
  pauseOnError: { type: Boolean, default: true },
  
  // Applied To
  accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }]
}, { timestamps: true });

// ============================================
// MASS DM CAMPAIGN CONFIG
// ============================================
const massDMConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  niche: String,
  enabled: { type: Boolean, default: true },
  
  // Daily Limits
  maxDMsPerDay: { type: Number, default: 50 },
  
  // Timing Controls
  delayBetweenDMs: {
    min: { type: Number, default: 60 },
    max: { type: Number, default: 180 }
  },
  
  // Break System
  breaks: {
    enabled: { type: Boolean, default: true },
    afterActions: { type: Number, default: 10 },
    breakDuration: {
      min: { type: Number, default: 600 },
      max: { type: Number, default: 1800 }
    }
  },
  
  // Active Hours
  activeHours: {
    start: { type: String, default: "09:00" },
    end: { type: String, default: "21:00" },
    timezone: { type: String, default: "America/New_York" }
  },
  
  // Target Sources
  targetSources: [{
    type: { type: String, enum: ['community_members', 'new_followers', 'hashtag_users', 'engagement_users'] },
    value: String,
    weight: { type: Number, default: 100 }
  }],
  
  // Message Templates (A/B testing)
  messageTemplates: [{
    template: { type: String, required: true },
    variables: [String],
    weight: { type: Number, default: 100 },
    conversionRate: { type: Number, default: 0 },
    timesSent: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 }
  }],
  
  // Personalization
  personalization: {
    extractTopicFromBio: { type: Boolean, default: true },
    extractTopicFromRecentTweets: { type: Boolean, default: true },
    maxTweetsToAnalyze: { type: Number, default: 3 }
  },
  
  // Random Activity
  randomActivity: {
    viewProfile: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 80 },
      scrollTime: {
        min: { type: Number, default: 3 },
        max: { type: Number, default: 10 }
      }
    },
    likeRecentTweet: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 40 }
    },
    followBefore: {
      enabled: { type: Boolean, default: false },
      probability: { type: Number, default: 20 }
    }
  },
  
  // Filters
  skipIfAlreadyContacted: { type: Boolean, default: true },
  skipIfPrivate: { type: Boolean, default: true },
  skipIfBotAccount: { type: Boolean, default: true },
  minAccountAge: { type: Number, default: 30 },  // days
  
  // Reply Handling
  autoReplyToResponses: {
    enabled: { type: Boolean, default: true },
    maxReplies: { type: Number, default: 3 },
    replyTemplates: [String]
  },
  
  // Applied To
  accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }]
}, { timestamps: true });

// ============================================
// AI CHAT CONFIG
// ============================================
const aiChatConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  niche: String,
  enabled: { type: Boolean, default: true },
  
  // AI Provider
  aiProvider: {
    type: { type: String, enum: ['custom_api', 'openai', 'anthropic', 'local'], default: 'custom_api' },
    apiUrl: String,
    apiKey: String,
    model: String
  },
  
  // Response Timing
  responseDelay: {
    min: { type: Number, default: 10 },   // seconds
    max: { type: Number, default: 300 }
  },
  
  // Daily Limits
  maxConversationsPerDay: { type: Number, default: 50 },
  maxMessagesPerConversation: { type: Number, default: 30 },
  
  // Active Hours
  activeHours: {
    start: { type: String, default: "08:00" },
    end: { type: String, default: "23:00" },
    timezone: { type: String, default: "America/New_York" }
  },
  
  // Conversation Strategy
  strategy: {
    messagesToEngageBefore: { type: Number, default: 10 },
    messagesToEngageAfter: { type: Number, default: 15 },
    
    sendLinkTriggers: [{
      type: { type: String, enum: ['message_count', 'ai_detected_buying_signal', 'high_engagement', 'time_elapsed'] },
      value: mongoose.Schema.Types.Mixed
    }]
  },
  
  // AI Personality
  personality: {
    style: { type: String, default: 'flirty_argumentative' },
    tone: { type: String, default: 'playful' },
    customInstructions: String
  },
  
  // Context Management
  contextWindow: {
    maxMessages: { type: Number, default: 20 },
    includeUserBio: { type: Boolean, default: true },
    includeRecentTweets: { type: Boolean, default: false }
  },
  
  // OF Link Message
  ofLinkMessage: {
    templates: [String],
    randomize: { type: Boolean, default: true }
  },
  
  // Follow-Up System
  followUp: {
    enabled: { type: Boolean, default: true },
    afterHours: { type: Number, default: 24 },
    maxFollowUps: { type: Number, default: 2 },
    followUpTemplates: [String]
  },
  
  // Typing Simulation
  typingSimulation: {
    enabled: { type: Boolean, default: true },
    wordsPerMinute: { type: Number, default: 60 },
    pauseForThinking: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 30 },
      duration: {
        min: { type: Number, default: 2 },
        max: { type: Number, default: 8 }
      }
    }
  },
  
  // Random Activity
  randomActivity: {
    viewTheirProfile: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 40 },
      timing: { type: String, enum: ['before_reply', 'after_reply', 'random'], default: 'before_reply' }
    },
    likeTheirRecentTweet: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 20 }
    }
  },
  
  // Quality Filters
  skipConversations: {
    ifTimeWaster: {
      enabled: { type: Boolean, default: true },
      detectAfterMessages: { type: Number, default: 20 },
      noEngagementThreshold: { type: Number, default: 3 }
    },
    ifRude: {
      enabled: { type: Boolean, default: true },
      rudeKeywords: [String]
    },
    ifSuspiciousBot: {
      enabled: { type: Boolean, default: true },
      patterns: [String]
    }
  },
  
  // Applied To
  accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }]
}, { timestamps: true });

// ============================================
// WARMUP CONFIG
// ============================================
const warmupConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  
  // Daily Schedule
  schedule: [{
    day: { type: Number, required: true },
    actions: {
      profileViews: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      scrollFeed: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 },
        duration: {
          min: { type: Number, default: 30 },
          max: { type: Number, default: 120 }
        }
      },
      likes: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      follows: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      dms: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      tweets: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      }
    }
  }],
  
  // Timing
  spreadActionsOverHours: {
    start: { type: String, default: "08:00" },
    end: { type: String, default: "22:00" }
  },
  
  // Random Breaks
  breaks: {
    frequency: {
      min: { type: Number, default: 3 },
      max: { type: Number, default: 6 }
    },
    duration: {
      min: { type: Number, default: 30 },
      max: { type: Number, default: 120 }
    }
  }
}, { timestamps: true });

// ============================================
// RANDOM ACTIVITY CONFIG
// ============================================
const randomActivityConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  
  // Profile Browsing
  profileBrowsing: {
    enabled: { type: Boolean, default: true },
    frequency: {
      min: { type: Number, default: 10 },
      max: { type: Number, default: 30 }
    },
    scrollTime: {
      min: { type: Number, default: 5 },
      max: { type: Number, default: 30 }
    },
    clickOnTabs: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 40 },
      tabs: [{ type: String, default: ['Tweets', 'Replies', 'Media', 'Likes'] }]
    }
  },
  
  // Feed Scrolling
  feedScrolling: {
    enabled: { type: Boolean, default: true },
    frequency: {
      min: { type: Number, default: 5 },
      max: { type: Number, default: 15 }
    },
    duration: {
      min: { type: Number, default: 30 },
      max: { type: Number, default: 180 }
    },
    scrollSpeed: { type: String, enum: ['slow', 'human', 'fast'], default: 'human' },
    stopToRead: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 30 },
      duration: {
        min: { type: Number, default: 3 },
        max: { type: Number, default: 15 }
      }
    }
  },
  
  // Random Likes
  randomLikes: {
    enabled: { type: Boolean, default: true },
    frequency: {
      min: { type: Number, default: 20 },
      max: { type: Number, default: 50 }
    },
    targetSources: [{ type: String, enum: ['feed', 'trending', 'niche_hashtags'] }]
  },
  
  // Random Retweets
  randomRetweets: {
    enabled: { type: Boolean, default: true },
    frequency: {
      min: { type: Number, default: 2 },
      max: { type: Number, default: 5 }
    },
    addComment: {
      enabled: { type: Boolean, default: true },
      probability: { type: Number, default: 20 },
      templates: [String]
    }
  },
  
  // Search Activity
  searchActivity: {
    enabled: { type: Boolean, default: true },
    frequency: {
      min: { type: Number, default: 3 },
      max: { type: Number, default: 8 }
    },
    searches: [String],
    browseResults: {
      duration: {
        min: { type: Number, default: 10 },
        max: { type: Number, default: 60 }
      }
    }
  },
  
  // Notifications Check
  checkNotifications: {
    enabled: { type: Boolean, default: true },
    frequency: {
      min: { type: Number, default: 10 },
      max: { type: Number, default: 30 }
    },
    clickOn: {
      probability: { type: Number, default: 20 }
    }
  },
  
  // Applied To
  accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TwitterAccount' }]
}, { timestamps: true });

// ============================================
// EXPORTS
// ============================================
const FollowUnfollowConfig = mongoose.model('FollowUnfollowConfig', followUnfollowConfigSchema);
const MassDMConfig = mongoose.model('MassDMConfig', massDMConfigSchema);
const AIChatConfig = mongoose.model('AIChatConfig', aiChatConfigSchema);
const WarmupConfig = mongoose.model('WarmupConfig', warmupConfigSchema);
const RandomActivityConfig = mongoose.model('RandomActivityConfig', randomActivityConfigSchema);

module.exports = {
  FollowUnfollowConfig,
  MassDMConfig,
  AIChatConfig,
  WarmupConfig,
  RandomActivityConfig
};

