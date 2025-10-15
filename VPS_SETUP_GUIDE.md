# 🖥️ VPS SETUP GUIDE - Complete System on One Server

## ✅ **RECOMMENDED ARCHITECTURE**

```
┌─────────────────────────────────────────────────┐
│               VPS (Windows Server)               │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  AdsPower    │  │   MongoDB    │            │
│  │ (100 accts)  │  │  (Database)  │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │   Automation System (Node.js)            │  │
│  │   - Runs campaigns 24/7                  │  │
│  │   - Controls all AdsPower browsers       │  │
│  │   - Dashboard on port 3000               │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
                      ↕️ Internet
        ┌──────────────────────────────┐
        │   YOU (Anywhere in World)    │
        │   - Mac, Phone, iPad         │
        │   - http://VPS-IP:3000       │
        │   - Monitor & Control        │
        └──────────────────────────────┘
```

**Benefits:**
- ✅ Everything in one place (simple!)
- ✅ Access dashboard from anywhere
- ✅ VPS runs 24/7
- ✅ AdsPower works perfectly
- ✅ No network complexity
- ✅ Easy to manage

---

## 🚀 **SETUP INSTRUCTIONS (30 minutes)**

### **STEP 1: Get a VPS (5 min)**

**Recommended Providers:**

**Option A: Contabo (Cheapest)**
- **Cost:** $6-15/month
- **Specs:** 4 CPU, 8GB RAM, Windows Server
- **Link:** https://contabo.com/en/vps/
- **Good for:** 50-100 accounts

**Option B: Vultr (Better Performance)**
- **Cost:** $18-24/month
- **Specs:** 4 CPU, 8GB RAM, Windows Server
- **Link:** https://www.vultr.com/
- **Good for:** 100-200 accounts

**Option C: AWS EC2 (Most Reliable)**
- **Cost:** $30-50/month
- **Specs:** t3.large, 8GB RAM, Windows Server
- **Good for:** 200+ accounts

**What to choose:**
- Windows Server 2022 or 2019
- At least 8GB RAM (for 100 accounts)
- At least 100GB storage

---

### **STEP 2: Setup VPS (10 min)**

**After VPS is created:**

1. **Connect via RDP (Remote Desktop)**
   - On Mac: Download "Microsoft Remote Desktop" from App Store
   - Connect to VPS IP address
   - Login with provided credentials

2. **Install Node.js**
   - Download: https://nodejs.org (LTS version)
   - Install with default settings

3. **Install MongoDB**
   - Download: https://www.mongodb.com/try/download/community
   - Install as Windows Service (runs automatically)

4. **Install AdsPower**
   - Download: https://www.adspower.net/
   - Install and login

5. **Install Git**
   - Download: https://git-scm.com/download/win
   - Install with default settings

---

### **STEP 3: Deploy Your Code (5 min)**

**In VPS command prompt/PowerShell:**

```powershell
# Clone your repository
cd C:\
git clone https://github.com/growthcrypto/twautomation.git
cd twautomation

# Install dependencies
npm install

# Create .env file
notepad .env

# Paste this:
MONGODB_URI=mongodb://localhost:27017/twitter-automation
PORT=3000
ADSPOWER_API_URL=http://local.adspower.net:50325
```

**Save and close notepad**

---

### **STEP 4: Start the System (2 min)**

**In PowerShell/CMD:**

```powershell
cd C:\twautomation
npm start
```

**You should see:**
```
✅ MongoDB connected successfully
✅ HTTP Server listening on port 3000
✅ Session Manager initialized
```

---

### **STEP 5: Access Dashboard from Your Mac (1 min)**

**On your Mac (anywhere in the world):**

1. **Get VPS IP address** (from provider email)
2. **Open browser**
3. **Go to:** `http://YOUR-VPS-IP:3000`
4. **Dashboard loads!** ✅

**Example:**
```
http://123.45.67.89:3000
```

---

### **STEP 6: Open Firewall (IMPORTANT)**

**On VPS, open port 3000:**

**Windows Firewall:**
1. Search "Windows Firewall"
2. Click "Advanced Settings"
3. Click "Inbound Rules" → "New Rule"
4. Type: Port
5. Protocol: TCP
6. Port: 3000
7. Action: Allow
8. Name: "Node.js Dashboard"
9. Click "Finish"

**Or via PowerShell (admin):**
```powershell
New-NetFirewallRule -DisplayName "Node.js Dashboard" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## 🎮 **HOW TO USE**

### **Daily Workflow:**

**On Your Mac (Anywhere):**
1. Open `http://VPS-IP:3000`
2. View accounts, leads, metrics
3. Start/stop campaigns
4. Monitor health
5. Check revenue

**Everything happens on the VPS, you just monitor!**

---

### **Setting Up Accounts:**

**On VPS (via RDP):**
1. Open AdsPower
2. Create browser profiles
3. Open dashboard: `http://localhost:3000`
4. Register accounts
5. Click "Extract Cookies" (works because AdsPower is local!)
6. Done!

**From Your Mac:**
- Accounts show up in real-time
- Watch the system work
- No need to be on VPS anymore

---

## 🔒 **SECURITY (IMPORTANT)**

### **Option A: Basic (IP Whitelist)**

Only allow your IP to access dashboard:

```javascript
// Add to backend/server.js after line 35

const allowedIPs = ['YOUR.HOME.IP', 'YOUR.OFFICE.IP'];

app.use((req, res, next) => {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Allow localhost always
  if (clientIP.includes('127.0.0.1') || clientIP.includes('::1')) {
    return next();
  }
  
  // Check whitelist
  if (!allowedIPs.some(ip => clientIP.includes(ip))) {
    return res.status(403).send('Access denied');
  }
  
  next();
});
```

**Find your IP:** Google "what is my ip"

---

### **Option B: Password Protection (Better)**

Add simple password auth:

```bash
npm install express-basic-auth
```

```javascript
// Add to backend/server.js
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
  users: { 'admin': 'your-strong-password' },
  challenge: true,
  realm: 'Twitter Automation Dashboard'
}));
```

Now browser will ask for password when accessing dashboard!

---

### **Option C: SSH Tunnel (Most Secure)**

Don't expose port 3000 publicly. Use SSH tunnel:

**From your Mac:**
```bash
ssh -L 3000:localhost:3000 user@VPS-IP
```

**Then open:** `http://localhost:3000` (tunnels through SSH)

---

## 💰 **COST BREAKDOWN**

**VPS Setup:**
- VPS (Contabo): $12/month
- AdsPower: $9/month (50 profiles) or $29/month (100 profiles)
- Proxies: $100-200/month (mobile/residential)
- **Total: $120-250/month**

**Railway Setup (for comparison):**
- Railway: $20/month
- MongoDB Atlas: $0-9/month
- AdsPower: Still need on local PC
- Proxies: Same $100-200
- **Total: $120-230/month + need local PC on**

**VPS is same cost but MUCH simpler!** ✅

---

## 📊 **VPS SPECS GUIDE**

### **For 50 Accounts:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB
- Cost: $10-15/month

### **For 100 Accounts:**
- CPU: 6 cores
- RAM: 16GB
- Storage: 200GB
- Cost: $20-30/month

### **For 500 Accounts:**
- CPU: 12 cores
- RAM: 32GB
- Storage: 500GB
- Cost: $80-120/month

---

## 🎯 **QUICK START (VPS)**

### **1. Order VPS**
- Go to Contabo.com
- Select "VPS M" (8GB RAM)
- Choose Windows Server 2022
- Order ($12/month)

### **2. Setup (30 min)**
```powershell
# Connect via RDP
# Install: Node.js, MongoDB, AdsPower, Git

# Clone repo
git clone https://github.com/growthcrypto/twautomation.git
cd twautomation
npm install

# Create .env
echo MONGODB_URI=mongodb://localhost:27017/twitter-automation > .env

# Start
npm start
```

### **3. Access from Mac**
```
http://YOUR-VPS-IP:3000
```

### **4. Done!** ✅

---

## 🔄 **KEEPING IT RUNNING 24/7**

### **Option A: PM2 (Recommended)**

```powershell
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start backend/server.js --name "twitter-automation"

# Auto-restart on VPS reboot
pm2 startup
pm2 save

# View logs
pm2 logs

# Stop
pm2 stop twitter-automation
```

### **Option B: Windows Service**

Use `node-windows` to run as Windows service:

```powershell
npm install -g node-windows
```

Then create a service script (I can help with this)

---

## 📱 **ACCESS FROM ANYWHERE**

Once VPS is setup:

**From Mac:**
```
http://VPS-IP:3000
```

**From Phone:**
```
http://VPS-IP:3000
(Same URL - dashboard is responsive!)
```

**From iPad:**
```
http://VPS-IP:3000
```

**From Office:**
```
http://VPS-IP:3000
```

**All connected to same VPS, same database!** ✅

---

## 🎉 **BENEFITS OF THIS SETUP**

✅ **Single VPS runs everything**
- AdsPower + MongoDB + Automation all local
- No network issues
- Extract cookies works perfectly
- Control 100+ accounts from one place

✅ **Access dashboard from anywhere**
- Monitor from your Mac
- Check on phone
- Show to clients
- Real-time updates

✅ **Multiple PCs possible (future)**
- Add more VPS when you scale
- All connect to same MongoDB Atlas
- Distributed account control
- Linear scaling

✅ **Simple & Reliable**
- One server to manage
- Easy troubleshooting
- Lower latency
- Better performance

---

## 🚀 **WANT ME TO HELP?**

I can:
1. ✅ Create PM2 startup script (runs 24/7)
2. ✅ Add password protection to dashboard
3. ✅ Create monitoring/alerting
4. ✅ Setup automatic backups
5. ✅ Create health check endpoints

**Or just order a VPS and I'll guide you through the setup!**

---

## 💡 **RECOMMENDATION**

**Start with:**
1. **One Contabo VPS** ($12/month)
2. **Setup in 30 minutes**
3. **Run 50-100 accounts**
4. **Access from your Mac**
5. **When you need to scale:** Add MongoDB Atlas, then add more VPS

**This is how the big agencies do it!** 🚀

---

**Should I create the PM2 startup script and security layer for the VPS?**
