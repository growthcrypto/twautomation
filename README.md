# 🤖 Twitter Automation System for OF Agency

**Massive-scale Twitter automation system** for generating traffic and converting to OnlyFans subscriptions.

---

## 🎯 **System Overview**

```
TRAFFIC ACCOUNTS  →  LEAD ROUTING  →  CHAT ACCOUNTS  →  OF CONVERSIONS
(Follow/DM automation)   (Smart routing)   (AI chat conversion)   (Revenue tracking)
```

### **Key Features:**

✅ **Account Lifecycle Management**
- Auto-create Twitter accounts with phone verification
- 7-day warmup phase (gradual activity ramp-up)
- Auto-detect bans/shadowbans and replace accounts
- Health monitoring every 30 minutes

✅ **Traffic Generation (2 Tools)**
- **Tool #1**: Follow/Unfollow automation (your Chrome extension)
- **Tool #2**: Mass DM system (scrapes communities, sends DMs)

✅ **Niche-Based Funnels**
- Soccer, Politics, Gaming, Drama, Fitness, Crypto
- Topic-specific accounts with matching branding
- AI trained to argue/engage based on niche

✅ **Lead Management**
- Track every interaction from first follow to conversion
- Attribution: Which traffic account generated which sale
- Conversation state tracking

✅ **AI Chat Integration**
- Your AI chat Chrome extension reports to central system
- System decides when to reply, when to send OF link
- Tracks conversion rates per account

✅ **Intelligent Task Scheduler**
- Distributes work across 100+ accounts
- Respects daily limits (avoid bans)
- Priority queue system

✅ **Control Dashboard**
- Real-time metrics (follows, DMs, conversions, revenue)
- Account health monitoring
- Lead pipeline visualization
- Start/stop campaigns

---

## 📂 **Project Structure**

```
of-automation-system/
├── backend/
│   ├── models/
│   │   └── index.js          # Database schemas (Accounts, Leads, Tasks, etc.)
│   ├── services/
│   │   ├── adspower-controller.js    # Browser profile management
│   │   ├── account-lifecycle.js      # Auto account creation & warmup
│   │   ├── health-monitor.js         # Ban detection & auto-recovery
│   │   ├── task-scheduler.js         # Task distribution engine
│   │   ├── twitter-automation.js     # Follow/DM/scrape automation
│   │   └── phone-service.js          # SMS verification (5sim, SMS-Activate)
│   ├── routes/
│   │   └── extension-api.js          # API for Chrome extensions
│   └── server.js                      # Main server
│
├── dashboard/
│   ├── index.html                     # Control dashboard UI
│   └── js/
│       └── dashboard.js               # Dashboard logic
│
├── extensions/
│   ├── twitter-extension/             # Your follow/unfollow extension
│   ├── ai-chat-bridge/                # Bridge for AI chat extension
│   └── shared/                        # Shared utilities
│
├── .env                               # Configuration
├── package.json
└── README.md
```

---

## 🚀 **Setup Instructions**

### **1. Prerequisites**

- **Node.js** (v18+)
- **MongoDB** (local or Atlas)
- **AdsPower** (browser fingerprint manager)
- **5sim or SMS-Activate API** (for phone verification)

### **2. Install Dependencies**

```bash
cd /Users/marcosmiguelwhelan/of-automation-system
npm install
```

### **3. Configure Environment**

Edit `.env` file:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/twitter-automation

# Server
PORT=3000

# AdsPower API
ADSPOWER_API_URL=http://local.adspower.net:50325

# Phone Service
PHONE_SERVICE_PROVIDER=5sim
PHONE_SERVICE_API_KEY=your-api-key-here

# Rate Limits
MAX_FOLLOWS_PER_DAY=100
MAX_DMS_PER_DAY=50

# Auto-recovery
AUTO_RECOVERY_ENABLED=true
```

### **4. Start MongoDB**

```bash
# If using local MongoDB
mongod --dbpath=/path/to/data
```

### **5. Start AdsPower**

- Open AdsPower app
- Ensure local API is running on port 50325

### **6. Start the Server**

```bash
npm start
```

Dashboard will be available at: **http://localhost:3000**

---

## 🎮 **How to Use**

### **Step 1: Upload Resources**

Before creating accounts, upload:

1. **Profile Pictures** (organized by niche)
2. **Bio Templates** (for traffic/chat accounts)
3. **Email Pool** (Gmail, ProtonMail, etc.)
4. **Phone Service API Key** (5sim or SMS-Activate)

```bash
POST /api/resources
{
  "profilePictures": [
    { "niche": "soccer", "url": "https://...", "filename": "pic1.jpg" }
  ],
  "bioTemplates": [
    { "niche": "soccer", "role": "traffic", "template": "⚽ Hot takes | Main: {chat_account}" }
  ],
  "emails": [
    { "address": "email@example.com", "password": "pass123", "provider": "gmail" }
  ],
  "phoneService": {
    "provider": "5sim",
    "apiKey": "your-api-key"
  }
}
```

### **Step 2: Create Accounts**

```bash
POST /api/accounts
{
  "role": "traffic",
  "niche": "soccer",
  "linkedChatAccountId": "chat_account_id_here"
}
```

System will:
- Create AdsPower profile
- Assign proxy
- Navigate to Twitter signup
- Get phone number from 5sim
- Create account (manual captcha solving for now)
- Enter 7-day warmup phase

### **Step 3: Start the System**

```bash
POST /api/system/start
```

This starts:
- **Health Monitor** (checks accounts every 30 min)
- **Task Scheduler** (executes tasks every 2 min)

### **Step 4: Launch Campaigns**

**Follow Campaign:**
```bash
POST /api/campaigns/follow
{
  "accountId": "account_id_here",
  "targetNiche": "soccer",
  "maxFollows": 50
}
```

**Mass DM Campaign:**
```bash
POST /api/campaigns/mass-dm
{
  "accountId": "account_id_here",
  "strategy": "community_members"
}
```

### **Step 5: Integrate Your Chrome Extensions**

**Your Follow/Unfollow Extension:**

Add this to your extension:

```javascript
// After following someone
fetch('http://localhost:3000/api/extension/action/follow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'your_account_id',
    targetUsername: 'user_you_followed',
    success: true
  })
});
```

**Your AI Chat Extension:**

```javascript
// Before replying to a DM
const response = await fetch('http://localhost:3000/api/extension/chat/should-reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'your_account_id',
    fanUsername: 'fan_username'
  })
});

const data = await response.json();

if (data.shouldReply) {
  // Send your AI reply
  // Then report:
  await fetch('http://localhost:3000/api/extension/chat/message-sent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'your_account_id',
      fanUsername: 'fan_username',
      messageContent: 'Your AI message'
    })
  });
}
```

---

## 📊 **Dashboard Features**

- **System Status**: Database, AdsPower, Health Monitor, Task Scheduler
- **Accounts Overview**: See all accounts, their status, daily activity, performance
- **Lead Pipeline**: Track leads from new → DM sent → conversation → link sent → converted
- **Task Queue**: See pending/in-progress/completed/failed tasks
- **Analytics**: Conversions, revenue, conversion rates per niche

---

## 🔥 **Advanced Features**

### **Auto-Recovery**

When an account gets banned:
1. System detects (via action failure rate or error messages)
2. Marks account as `banned`
3. Pauses all tasks for that account
4. Auto-creates replacement account
5. New account goes through warmup
6. Once active, takes over the role

### **Niche-Specific Strategies**

**Soccer Traffic Account:**
- Username: `@SoccerDebates{rand}`
- Bio: `⚽ Hot takes | Main: @SoccerGirl_Chat`
- Scrapes: r/soccer community, #MUFC, #Messi
- DMs: `"Bro your take on Ronaldo is terrible 😂 DM me @SoccerGirl_Chat"`

**Soccer Chat Account:**
- Username: `@SoccerGirl_Chat`
- Bio: `⚽ I'll destroy you in any football debate 😈 | 🔞 Link below`
- AI Training: Argue about soccer, flirt, convert to OF
- Profile Pic: Girl in football jersey

### **Health Monitoring Checks**

1. **Action Success Rate**: If < 30% success, account likely banned
2. **Consecutive Failures**: 5+ failed tasks in a row = rate limited
3. **Engagement Drop**: No leads in 3 days (for traffic accounts) = shadowban
4. **Platform Signals**: "Unusual activity" message detected

---

## 🛠️ **API Reference**

### **Accounts**

```bash
GET    /api/accounts              # List all accounts
GET    /api/accounts/:id          # Get account details
POST   /api/accounts              # Create new account
PATCH  /api/accounts/:id          # Update account
DELETE /api/accounts/:id          # Archive account
```

### **Leads**

```bash
GET    /api/leads                 # List leads
GET    /api/leads?status=in_conversation
GET    /api/leads?accountId=xxx
PATCH  /api/leads/:id             # Update lead
```

### **Tasks**

```bash
GET    /api/tasks                 # List tasks
GET    /api/tasks?status=pending
POST   /api/tasks                 # Create task
DELETE /api/tasks/:id             # Cancel task
```

### **Campaigns**

```bash
POST   /api/campaigns/follow      # Start follow campaign
POST   /api/campaigns/mass-dm     # Start mass DM campaign
```

### **System**

```bash
GET    /api/system/status         # Get system status
POST   /api/system/start          # Start automation
POST   /api/system/stop           # Stop automation
```

### **Extension API**

```bash
POST   /api/extension/auth        # Authenticate extension
POST   /api/extension/action/follow
POST   /api/extension/action/dm
POST   /api/extension/chat/should-reply
POST   /api/extension/chat/message-sent
POST   /api/extension/chat/conversion
```

---

## 📈 **Scaling Strategy**

**Phase 1: Start Small (5-10 accounts)**
- 3 traffic accounts
- 2 chat accounts
- Test different niches
- Dial in DM templates

**Phase 2: Scale Up (20-50 accounts)**
- 15 traffic accounts (5 niches × 3 each)
- 5 chat accounts (1 per niche)
- Monitor ban rates
- Optimize warmup schedules

**Phase 3: Full Scale (100+ accounts)**
- 70 traffic accounts
- 30 chat accounts
- Multiple proxies per account
- Auto-replacement pipeline
- Expected: 50-100 conversions/week

---

## ⚠️ **Important Notes**

1. **Twitter will ban accounts.** Accept 20-30% ban rate. System auto-replaces.
2. **Start slow.** Don't launch 100 accounts on day 1.
3. **Warm-up is critical.** Don't skip the 7-day warmup phase.
4. **Rotate proxies.** Use mobile/residential proxies, not datacenter.
5. **Monitor closely.** First week, check dashboard daily.
6. **Backup accounts.** Always have accounts in warmup ready to replace banned ones.

---

## 🎯 **Expected ROI**

**Setup Cost:**
- AdsPower: $89/month (100 profiles)
- 5sim: ~$0.50/number × 100 = $50
- Proxies: ~$100/month (mobile rotating)
- **Total: ~$250/month**

**Revenue (Conservative):**
- 100 accounts active
- 5 leads/day per traffic account (500 total leads/day)
- 10% convert to chat conversations (50 conversations/day)
- 5% of conversations convert to OF (2.5 subs/day)
- At $10/sub = **$25/day = $750/month**

**Break-even: Month 1**
**Profitable by Month 2+**

Scale to 500 accounts = **$3,750/month**

---

## 🐛 **Troubleshooting**

**"AdsPower not detected"**
- Ensure AdsPower is running
- Check API is on port 50325

**"Account creation failing"**
- Check 5sim API key
- Ensure balance is sufficient
- Twitter may be blocking signups from your IP

**"Tasks not executing"**
- Check task scheduler status: `GET /api/system/status`
- Start system if stopped: `POST /api/system/start`

**"All accounts getting banned quickly"**
- Reduce daily limits in `.env`
- Ensure proxies are residential/mobile, not datacenter
- Check warmup is completing properly

---

## 📞 **Support**

For issues or questions, check:
- System logs: `node backend/server.js` output
- Health monitor logs
- AdsPower console

---

**Built for scale. Designed for conversions. Ready to dominate.** 🚀

