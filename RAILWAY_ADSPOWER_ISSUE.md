# ⚠️ AdsPower & Railway - Important Info

## 🚨 **THE ISSUE**

**AdsPower ONLY works on your LOCAL computer, NOT on Railway!**

When you try to click "Extract Cookies" on Railway, you get:
```
❌ Error launching profile: AdsPower is not running
```

**Why?**
- AdsPower is a **desktop application** (Windows/Mac)
- Railway is a **cloud server**
- Railway can't access your local AdsPower

---

## ✅ **SOLUTIONS**

### **Option 1: Run System Locally (Recommended for Setup)**

Use your local machine to extract cookies, then deploy to Railway:

```bash
# 1. On your LOCAL computer
cd /Users/marcosmiguelwhelan/of-automation-system

# 2. Start MongoDB locally
mongod --dbpath=/path/to/data

# 3. Set environment variables
export MONGODB_URI="mongodb://localhost:27017/twitter-automation"

# 4. Start AdsPower app
# Open AdsPower application

# 5. Start the server locally
npm start

# 6. Open browser
open http://localhost:3000

# 7. Now you can:
# - Register accounts
# - Extract cookies (AdsPower is running locally!)
# - Cookies are saved to local MongoDB

# 8. Export cookies to Railway
# Option A: Use MongoDB Atlas (shared between local & Railway)
# Option B: Manually copy cookies via API (see below)
```

---

### **Option 2: Manually Set Cookies via API**

If you can't run locally, manually copy cookies from browser:

#### **Step 1: Get Cookies from Browser**

1. **Login to Twitter** in your browser
2. **Press F12** (Developer Tools)
3. **Go to "Application" tab** (Chrome) or "Storage" tab (Firefox)
4. **Click "Cookies" → "https://twitter.com"**
5. **Copy these cookies** (you need at least these 2):
   - `auth_token`
   - `ct0`

#### **Step 2: Send to API**

```bash
curl -X POST https://your-app.railway.app/api/accounts/ACCOUNT_ID/set-cookies \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": [
      {
        "name": "auth_token",
        "value": "your-auth-token-value",
        "domain": ".twitter.com",
        "path": "/",
        "secure": true,
        "httpOnly": true
      },
      {
        "name": "ct0",
        "value": "your-ct0-value",
        "domain": ".twitter.com",
        "path": "/",
        "secure": true,
        "httpOnly": false
      }
    ]
  }'
```

---

### **Option 3: Use MongoDB Atlas (Best for Production)**

Share the same MongoDB between local and Railway:

#### **Setup:**

1. **Create MongoDB Atlas** (free tier)
   - https://www.mongodb.com/cloud/atlas
   - Create cluster
   - Get connection string

2. **Use on LOCAL machine:**
   ```bash
   export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/twitter-automation"
   npm start
   ```

3. **Use on RAILWAY:**
   - Add variable: `MONGODB_URI` = same connection string
   - Redeploy

4. **Now:**
   - Register accounts locally (with AdsPower)
   - Extract cookies locally
   - Cookies saved to Atlas
   - Railway can use same cookies!

---

## 🎯 **RECOMMENDED WORKFLOW**

### **For Setting Up Accounts:**

1. **Run locally** with AdsPower
2. **Register accounts**
3. **Extract cookies**
4. **Use MongoDB Atlas** (shared database)

### **For Production:**

1. **Deploy to Railway** (runs 24/7)
2. **Uses cookies from Atlas**
3. **Runs campaigns automatically**
4. **No AdsPower needed** (cookies already extracted)

---

## 📝 **WHY THIS ARCHITECTURE?**

**Local (with AdsPower):**
- ✅ Extract cookies easily
- ✅ Setup accounts
- ✅ Test campaigns
- ❌ Not 24/7

**Railway (cloud):**
- ✅ Runs 24/7
- ✅ Always online
- ✅ Uses saved cookies
- ❌ No AdsPower access

**Solution:**
- Setup locally → Deploy to Railway
- Best of both worlds!

---

## 🔧 **CURRENT FIX APPLIED**

I've added:
1. ✅ Better error message when AdsPower isn't available
2. ✅ New endpoint: `POST /api/accounts/:id/set-cookies`
3. ✅ Manual cookie upload support

---

## 🚀 **NEXT STEPS FOR YOU**

### **Quick Fix (5 minutes):**

1. **Use MongoDB Atlas** instead of Railway MongoDB
   - Same database for local + Railway
   - Extract cookies locally
   - Railway uses the same cookies

2. **Or manually copy cookies** using the API endpoint above

### **Long-term:**

- Setup accounts locally (with AdsPower)
- Extract cookies once
- Deploy to Railway for 24/7 operation
- Re-extract cookies every 30-60 days when they expire

---

**The code is fixed and deployed. Choose which workflow works best for you!** ✅

