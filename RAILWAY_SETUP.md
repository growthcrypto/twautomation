# 🚂 RAILWAY SETUP GUIDE

## ⚠️ **CURRENT ISSUE: No MongoDB Connected**

Your Railway deployment is failing because **MongoDB is not configured**.

Error: `getaddrinfo ENOTFOUND mongodb.railway.internal`

---

## ✅ **SOLUTION: Add MongoDB to Railway**

### **Option 1: Use Railway's MongoDB Plugin (Recommended)**

1. **Go to Railway Dashboard**
   - Open your project: https://railway.app/project/[your-project-id]

2. **Click "New Service"**
   - Click the **"+ New"** button
   - Select **"Database"**
   - Choose **"MongoDB"**

3. **Wait for Deployment** (~2 minutes)
   - Railway will provision MongoDB
   - It will auto-generate `MONGO_URL` environment variable

4. **Verify Environment Variable**
   - Go to your **main service** (not the MongoDB service)
   - Click **"Variables"** tab
   - Look for `MONGO_URL` - should be auto-populated
   - Format: `mongodb://mongo:password@mongodb.railway.internal:27017`

5. **Redeploy Your App**
   - Railway should auto-redeploy
   - Or click **"Deploy"** button manually

---

### **Option 2: Use MongoDB Atlas (Free Tier)**

If Railway MongoDB is paid or unavailable:

1. **Create MongoDB Atlas Account**
   - Go to: https://www.mongodb.com/cloud/atlas
   - Sign up (free tier available)

2. **Create Cluster**
   - Choose **"Shared"** (free)
   - Select region closest to Railway (US East recommended)

3. **Get Connection String**
   - Click **"Connect"**
   - Choose **"Connect your application"**
   - Copy connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/twitter-automation`

4. **Add to Railway**
   - Go to Railway → Your project → **Variables**
   - Click **"New Variable"**
   - Name: `MONGODB_URI`
   - Value: `mongodb+srv://username:password@cluster.mongodb.net/twitter-automation`
   - Click **"Add"**

5. **Whitelist Railway IP**
   - In MongoDB Atlas → Network Access
   - Click **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Or add Railway's specific IPs

6. **Redeploy**
   - Railway will auto-redeploy with new env var

---

## 🔍 **HOW TO CHECK IF IT WORKED**

### **After Adding MongoDB:**

1. **Check Railway Logs**
   - Railway Dashboard → Your Service → **"Deployments"**
   - Click latest deployment → **"View Logs"**
   - Look for:
     ```
     ✅ MongoDB connected successfully (pool: 10-50 connections)
     📡 Mongoose connected to MongoDB
     ```

2. **Test Health Endpoint**
   ```bash
   curl https://your-app.railway.app/health
   ```
   
   Should return:
   ```json
   {
     "status": "healthy",
     "mongodb": "connected"
   }
   ```

3. **Test API Keys Saving**
   - Go to your app → Resources tab
   - Enter API keys
   - Click Save
   - Should work now! ✅

---

## 📋 **RAILWAY ENVIRONMENT VARIABLES CHECKLIST**

Make sure these are set in Railway → Variables:

### **Required:**
- ✅ `MONGODB_URI` or `MONGO_URL` - MongoDB connection string
- ✅ `PORT` - Usually auto-set by Railway (3000)

### **Optional (for full functionality):**
- ⚪ `TWOCAPTCHA_API_KEY` - For auto captcha solving
- ⚪ `PHONE_SERVICE_API_KEY` - For phone verification (5sim)
- ⚪ `AI_API_URL` - Your AI chat endpoint
- ⚪ `AI_API_KEY` - Your AI authentication key

**Note:** You can also save these through the dashboard UI once MongoDB is working!

---

## 🚀 **QUICK SETUP (5 minutes)**

### **Fastest Way:**

```bash
# 1. Add MongoDB to Railway
railway add

# Select: MongoDB

# 2. Verify it's added
railway variables

# Should show MONGO_URL

# 3. Redeploy
railway up

# 4. Check logs
railway logs

# Should see: "✅ MongoDB connected successfully"
```

---

## 🐛 **TROUBLESHOOTING**

### **Error: "mongodb.railway.internal not found"**
**Solution:** Add MongoDB plugin to Railway (see Option 1 above)

### **Error: "Authentication failed"**
**Solution:** 
- Check connection string has correct username/password
- MongoDB Atlas: Verify database user is created

### **Error: "Network timeout"**
**Solution:**
- MongoDB Atlas: Add 0.0.0.0/0 to IP whitelist
- Check connection string is correct

### **Error: "Bad auth: Authentication failed"**
**Solution:**
- Verify MongoDB username and password in connection string
- Create database user in MongoDB Atlas

---

## 📊 **AFTER MONGODB IS CONNECTED**

Your app will be able to:
- ✅ Save API keys
- ✅ Create accounts
- ✅ Store leads
- ✅ Track tasks
- ✅ Save campaign configs
- ✅ Monitor health
- ✅ Track conversions & revenue

---

## 🎯 **CURRENT STATUS**

**Code:** ✅ All fixed, pushed to Railway  
**MongoDB:** ❌ **NOT CONNECTED** ← This is blocking everything  
**Server:** ✅ Running (but can't save data)

**Next Step:** Add MongoDB to Railway (5 minutes)

---

## 💡 **RECOMMENDED: Railway MongoDB Plugin**

**Why:**
- Automatically configured
- MONGO_URL auto-set
- No IP whitelisting needed
- Works immediately
- $5/month (shared with your app credits)

**How:**
1. Railway Dashboard → Your Project
2. Click "+ New"
3. Select "Database" → "MongoDB"
4. Done! ✅

Railway will auto-redeploy your app with the database connected.

---

**Fix this ASAP - without MongoDB, nothing can save!** 🔥

