# 🧪 SINGLE ACCOUNT TEST GUIDE

## ⚡ **QUICK SETUP (5 Minutes)**

### **1. Get SMSPool API Key**
1. Sign up at https://www.smspool.net/
2. Add funds ($5-10 is enough for testing)
3. Get your API key from dashboard
4. Copy it

---

### **2. Set Environment Variables**

Add these to Railway (or `.env` file locally):

```bash
# SMSPool Configuration
PHONE_SERVICE_PROVIDER=smspool
PHONE_SERVICE_API_KEY=your_smspool_api_key_here

# 2Captcha (for Twitter signup)
CAPTCHA_SERVICE_API_KEY=your_2captcha_api_key_here

# AdsPower (for browser profiles)
ADSPOWER_API_URL=http://local.adspower.net:50325
```

---

### **3. Upload Resources (Dashboard)**

Go to Railway URL → Resources Tab:

**A. Profile Picture:**
- Upload 1 photo (any pic for testing)

**B. Bio Template:**
- Add a bio like: "Soccer enthusiast | Sports debates | DM me ⚽"

**C. Email (optional):**
- If you don't want auto-creation, add a Gmail manually

---

### **4. Create Test Account**

Go to **Accounts Tab** → Click **"Create New Account"**

Fill in:
```
Niche: Soccer
Role: Follow/Unfollow
Proxy: http://user:pass@ip:port (or leave empty for no proxy)
```

Click **"Create Account"** ✅

**What happens:**
1. System buys SMSPool number (~$0.50)
2. Creates AdsPower browser profile
3. Opens twitter.com/signup
4. Fills random username/email
5. Enters SMSPool phone number
6. Waits for SMS code
7. Solves captchas automatically
8. Uploads profile pic
9. Sets bio
10. Saves cookies
11. Account ready! 🎉

**Time:** 2-4 minutes per account

---

### **5. Configure Campaign**

Go to **Campaigns Tab** → **"Follow/Unfollow Config"**

**Quick Settings:**
```
Daily Follow Limit: 50 (conservative for testing)
Min Delay: 30 seconds
Max Delay: 60 seconds
Active Hours: 9-21 (your timezone)
Target Sources:
  - Community: https://twitter.com/i/communities/1234567890
  - Hashtag: #soccer
```

Click **"Save Config"** ✅

---

### **6. Start Automation**

Go to **Accounts Tab** → Find your account → Click **"Start"**

**What happens:**
1. System opens AdsPower browser with saved cookies
2. Starts following users from target sources
3. Follows 50 users/day
4. Tracks everything in database
5. Waits for follow-backs
6. Auto-stops after 50 follows

---

### **7. Monitor Progress**

**Dashboard Tab:**
- See total follows, account status, today's activity

**Leads Tab:**
- See every user followed
- Track who followed back
- See conversion pipeline

---

## 📊 **EXPECTED RESULTS (Day 1)**

After 24 hours with 1 account:

**Actions:**
- 50 follows ✅
- ~5-15 follow-backs (10-30% rate)
- Account still active ✅

**Next Steps:**
- Wait 2-3 days for warm-up
- Increase to 100 follows/day
- Add Mass DM for follow-backs
- Add AI Chat for conversions

---

## 🎯 **COST BREAKDOWN**

**Per Account:**
- SMSPool number: $0.40-0.80
- 2Captcha solves: $0.05-0.15
- **Total:** ~$0.50-1.00 per account

**Testing (1 account):**
- Total cost: $1
- Railway hosting: Free tier (512MB)
- AdsPower: Free (up to 10 profiles)

---

## ⚠️ **TROUBLESHOOTING**

### **Account Creation Fails:**
- Check SMSPool balance
- Check 2Captcha balance
- Check AdsPower is running

### **Login Fails (Cookies Expired):**
- Go to Accounts tab
- Click "Extract Cookies"
- System will re-login and save new cookies

### **Automation Not Starting:**
- Check account status is "active"
- Check campaign config is saved
- Check Railway logs for errors

---

## 🚀 **SCALE TO 10+ ACCOUNTS**

Once 1 account works:

**1. Bulk Create:**
```
Go to Accounts tab
Set: Create 10 accounts
Niche: Mix of Soccer, Politics, Gaming
Roles: Mix of Follow/Unfollow, Mass DM, Chat
```

**2. Auto-Replace:**
```
System detects bans automatically
Creates new accounts from resource pool
Never runs out of accounts
```

**3. Monitor:**
```
Dashboard shows all 10 accounts
Total follows, DMs, conversions
Real-time status
```

---

**READY TO TEST?** 🧪

Just set those 3 env vars and hit "Create Account"!

Let me know if you hit any issues. 💪
