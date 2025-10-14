# 🚀 Getting Started - Step-by-Step Guide

Complete walkthrough to get your Twitter automation system running in 30 minutes.

---

## ✅ **Pre-Flight Checklist**

Before starting, make sure you have:

- [ ] **Node.js v18+** installed
- [ ] **MongoDB** installed (local) or Atlas account
- [ ] **AdsPower** downloaded and installed
- [ ] **5sim.net or SMS-Activate** account with balance
- [ ] **Proxies** (mobile or residential recommended)
- [ ] **Profile pictures** for your niche (20+ images)
- [ ] **Email accounts** (10+ Gmail/ProtonMail accounts)

---

## 📥 **Step 1: Install & Setup (5 minutes)**

### **1.1 Navigate to project folder**

```bash
cd /Users/marcosmiguelwhelan/of-automation-system
```

### **1.2 Install dependencies** (already done)

```bash
npm install
```

### **1.3 Start MongoDB**

**Option A: Local MongoDB**
```bash
mongod --dbpath=/path/to/your/data
```

**Option B: MongoDB Atlas**
- Create free cluster at mongodb.com/cloud/atlas
- Get connection string
- Update `.env` with your connection string

### **1.4 Configure `.env` file**

Open `.env` and update:

```env
# REQUIRED
MONGODB_URI=mongodb://localhost:27017/twitter-automation  # or your Atlas URI
PHONE_SERVICE_API_KEY=your-5sim-api-key-here

# OPTIONAL (defaults are good to start)
MAX_FOLLOWS_PER_DAY=100
MAX_DMS_PER_DAY=50
AUTO_RECOVERY_ENABLED=true
```

### **1.5 Start AdsPower**

- Open AdsPower application
- Ensure it's running (you'll see the icon in your taskbar)
- Local API runs automatically on port 50325

---

## 🗄️ **Step 2: Seed Initial Data (10 minutes)**

### **2.1 Add Proxies**

Create a file `proxies.json`:

```json
[
  {
    "type": "mobile",
    "provider": "Bright Data",
    "host": "proxy.example.com",
    "port": 12345,
    "username": "your-username",
    "password": "your-password",
    "country": "US",
    "maxAccountsPerProxy": 3
  }
]
```

Import:

```bash
curl -X POST http://localhost:3000/api/proxies \
  -H "Content-Type: application/json" \
  -d @proxies.json
```

### **2.2 Upload Profile Pictures**

Organize your images:

```
/Users/marcosmiguelwhelan/profile-pics/
├── soccer/
│   ├── pic1.jpg
│   ├── pic2.jpg
│   └── pic3.jpg
├── politics/
│   ├── pic1.jpg
│   └── pic2.jpg
└── gaming/
    └── pic1.jpg
```

Upload via API or dashboard (feature coming soon).

### **2.3 Create Resource Pool**

```bash
curl -X POST http://localhost:3000/api/resources \
  -H "Content-Type: application/json" \
  -d '{
    "phoneService": {
      "provider": "5sim",
      "apiKey": "your-api-key-here"
    },
    "emails": [
      { "address": "email1@gmail.com", "password": "pass123", "provider": "gmail", "used": false },
      { "address": "email2@protonmail.com", "password": "pass456", "provider": "protonmail", "used": false }
    ],
    "bioTemplates": [
      {
        "niche": "soccer",
        "role": "traffic",
        "template": "⚽ Hot takes only | Main: {chat_account}",
        "variables": ["chat_account"]
      },
      {
        "niche": "soccer",
        "role": "chat",
        "template": "⚽ I'\''ll destroy you in any football debate 😈 | 🔞 Link below",
        "variables": []
      }
    ],
    "usernamePatterns": [
      {
        "niche": "soccer",
        "role": "traffic",
        "patterns": ["SoccerDebates{rand}", "FootballTakes{rand}", "GoalHotTakes{rand}"]
      },
      {
        "niche": "soccer",
        "role": "chat",
        "patterns": ["SoccerGirl_{rand}", "FootballBabe{rand}"]
      }
    ]
  }'
```

### **2.4 Add Twitter Communities**

```bash
curl -X POST http://localhost:3000/api/communities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Football/Soccer",
    "communityId": "twitter_community_id_here",
    "niche": "soccer",
    "memberCount": 50000,
    "scrapingEnabled": true,
    "scrapingFrequency": "daily",
    "maxUsersPerScrape": 50,
    "status": "active"
  }'
```

---

## 🚀 **Step 3: Start the System (2 minutes)**

### **3.1 Start the server**

```bash
npm start
```

You should see:

```
✅ MongoDB connected
✅ AdsPower connected
🚀 Twitter Automation System
   Server running on http://localhost:3000
   Dashboard: http://localhost:3000
```

### **3.2 Start automation**

```bash
curl -X POST http://localhost:3000/api/system/start
```

Or click "Start System" in the dashboard.

This starts:
- **Health Monitor** (checks accounts every 30 min)
- **Task Scheduler** (executes tasks every 2 min)

---

## 👤 **Step 4: Create Your First Accounts (10 minutes)**

### **4.1 Create a Chat Account (manually for now)**

For your first account, create it manually on Twitter:
1. Sign up at twitter.com
2. Use one of your email addresses
3. Verify with phone (use 5sim manually)
4. Set bio: `⚽ DM me for football debates 😈 | 🔞 onlyfans.com/yourlink`

Then add it to the system:

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "username": "SoccerGirl_123",
    "email": "email1@gmail.com",
    "password": "twitter_password_here",
    "role": "chat",
    "niche": "soccer",
    "status": "active",
    "warmupPhase": { "completed": true },
    "ofLink": "https://onlyfans.com/yourlink"
  }'
```

Note the `_id` returned (you'll need it next).

### **4.2 Create Traffic Accounts (auto-creation)**

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "role": "traffic",
    "niche": "soccer",
    "linkedChatAccountId": "chat_account_id_from_step_4.1"
  }'
```

System will:
- Create AdsPower browser profile
- Assign a proxy
- Open Twitter signup
- Get phone number from 5sim
- **YOU'LL NEED TO MANUALLY COMPLETE CAPTCHA**

The browser will stay open for you to:
1. Solve captcha
2. Enter phone code (check 5sim dashboard)
3. Complete signup

Once done, account enters 7-day warmup automatically.

### **4.3 Create 2-3 more traffic accounts**

Repeat Step 4.2 two more times.

**Result:** You now have:
- 1 chat account (active)
- 3 traffic accounts (warming up)

---

## 🎮 **Step 5: Launch Your First Campaign (3 minutes)**

### **5.1 Wait for warmup to complete**

Check dashboard or:

```bash
curl http://localhost:3000/api/accounts
```

Once an account shows `"status": "active"`, you're ready.

### **5.2 Start a follow campaign**

```bash
curl -X POST http://localhost:3000/api/campaigns/follow \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your_traffic_account_id",
    "targetNiche": "soccer",
    "maxFollows": 20
  }'
```

This creates 20 follow tasks for that account.

### **5.3 Start a mass DM campaign**

```bash
curl -X POST http://localhost:3000/api/campaigns/mass-dm \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your_traffic_account_id",
    "strategy": "community_members"
  }'
```

This scrapes soccer community and creates DM tasks.

---

## 📊 **Step 6: Monitor the Dashboard**

### **6.1 Open dashboard**

Visit: **http://localhost:3000**

You'll see:
- System status (all green dots = good)
- Account overview
- Lead pipeline
- Task queue

### **6.2 Watch tasks execute**

Every 2 minutes, the scheduler picks up tasks and executes them.

You'll see:
- Follows happening
- DMs being sent
- Leads being created

---

## 🔗 **Step 7: Integrate Your Chrome Extensions**

### **7.1 Modify your Follow/Unfollow extension**

Add to your extension's background script:

```javascript
// After successfully following someone
function reportFollowAction(targetUsername, success) {
  fetch('http://localhost:3000/api/extension/action/follow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: localStorage.getItem('currentAccountId'), // Store this when logging in
      targetUsername: targetUsername,
      success: success,
      errorMessage: success ? null : 'Error message here'
    })
  });
}
```

### **7.2 Modify your AI Chat extension**

Add decision logic:

```javascript
// Before replying to a DM
async function shouldReplyToFan(fanUsername) {
  const response = await fetch('http://localhost:3000/api/extension/chat/should-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: localStorage.getItem('currentAccountId'),
      fanUsername: fanUsername
    })
  });

  const data = await response.json();
  
  if (!data.shouldReply) {
    console.log('Skipping reply:', data.reason);
    return false;
  }

  return true;
}

// After sending a message
async function reportMessageSent(fanUsername, messageContent) {
  await fetch('http://localhost:3000/api/extension/chat/message-sent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: localStorage.getItem('currentAccountId'),
      fanUsername: fanUsername,
      messageContent: messageContent
    })
  });
}

// When user converts to OF
async function reportConversion(fanUsername, ofUsername, revenue) {
  await fetch('http://localhost:3000/api/extension/chat/conversion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: localStorage.getItem('currentAccountId'),
      fanUsername: fanUsername,
      ofUsername: ofUsername,
      revenue: revenue
    })
  });
}
```

---

## 🎯 **You're Done!**

### **What's Happening Now:**

✅ **Traffic accounts** are following users and sending DMs
✅ **Leads** are being routed to your chat account
✅ **Health monitor** is checking for bans every 30 min
✅ **Task scheduler** is executing tasks every 2 min
✅ **Dashboard** updates every 30 seconds

### **Next Steps:**

1. **Monitor for 24 hours** - Check dashboard, ensure no bans
2. **Adjust limits** - If getting rate limited, reduce in `.env`
3. **Create more accounts** - Once stable, scale to 10-20 accounts
4. **Test different niches** - Politics, gaming, drama
5. **Optimize DM templates** - Track which templates convert best

---

## 🐛 **Common Issues**

### **"Account creation failing"**

**Solution:**
- Check 5sim balance
- Ensure proxies are working
- Try different proxy if one is blocked

### **"Tasks not executing"**

**Solution:**
```bash
# Check system status
curl http://localhost:3000/api/system/status

# If scheduler is stopped, start it
curl -X POST http://localhost:3000/api/system/start
```

### **"AdsPower not detected"**

**Solution:**
- Ensure AdsPower is running
- Check it's on port 50325 (default)
- Restart AdsPower if needed

### **"All accounts getting banned quickly"**

**Solution:**
- Reduce limits in `.env`:
  ```env
  MAX_FOLLOWS_PER_DAY=50
  MAX_DMS_PER_DAY=20
  ```
- Ensure using residential/mobile proxies (not datacenter)
- Check warmup is completing (don't skip it)

---

## 📈 **Scaling Plan**

**Week 1:** 3-5 accounts, test and monitor
**Week 2:** 10 accounts, dial in settings
**Week 3:** 20 accounts, multiple niches
**Month 2:** 50 accounts
**Month 3:** 100+ accounts

**Expected Results at 100 accounts:**
- 500 leads/day
- 50 conversations/day
- 2-5 conversions/day
- $20-50/day revenue
- **$600-1,500/month**

---

**You're ready to scale! 🚀**

