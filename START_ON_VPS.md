# 🚀 START ON VPS - Quick Reference

## ⚡ **Quick Commands (Copy-Paste on VPS)**

### **First Time Setup:**

```powershell
# 1. Clone repository
cd C:\
git clone https://github.com/growthcrypto/twautomation.git
cd twautomation

# 2. Install dependencies
npm install

# 3. Install PM2 globally
npm install -g pm2 pm2-windows-startup

# 4. Setup PM2 to start on boot
pm2-startup install

# 5. Create logs directory
mkdir logs

# 6. Start the system
pm2 start ecosystem.config.js

# 7. Save PM2 config (auto-starts on reboot)
pm2 save

# 8. Check status
pm2 status
```

---

## 🎮 **Daily Commands**

### **View Status:**
```powershell
pm2 status
# Shows: online/stopped, uptime, CPU, memory
```

### **View Logs:**
```powershell
pm2 logs twitter-automation

# Or view last 100 lines
pm2 logs twitter-automation --lines 100

# Clear logs
pm2 flush
```

### **Restart System:**
```powershell
pm2 restart twitter-automation
```

### **Stop System:**
```powershell
pm2 stop twitter-automation
```

### **Start System:**
```powershell
pm2 start twitter-automation
```

### **Update Code (After Git Push):**
```powershell
cd C:\twautomation
git pull
pm2 restart twitter-automation
```

---

## 🌐 **Access Dashboard**

### **From VPS:**
```
http://localhost:3000
```

### **From Your Mac:**
```
http://YOUR-VPS-IP:3000
```

**Example:**
```
http://123.45.67.89:3000
```

---

## 🔥 **Open Firewall (IMPORTANT)**

**Allow port 3000 from outside:**

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Node.js Dashboard" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

**Or manually:**
1. Windows Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → 3000
4. Allow → Finish

---

## 📊 **Monitor System**

### **PM2 Dashboard:**
```powershell
pm2 monit
# Real-time monitoring (CPU, memory, logs)
```

### **PM2 Plus (Web Dashboard):**
```powershell
pm2 plus
# Free account for web-based monitoring
# Access from anywhere: https://app.pm2.io
```

---

## 🐛 **Troubleshooting**

### **"MongoDB connection failed"**
```powershell
# Check MongoDB is running
net start MongoDB

# Or restart it
net stop MongoDB
net start MongoDB
```

### **"AdsPower not detected"**
```powershell
# Make sure AdsPower app is running
# Check it's on port 50325
# Settings → API → Enable API
```

### **"Can't access from Mac"**
```powershell
# Check firewall allows port 3000
# Check VPS IP is correct
# Try: http://VPS-IP:3000/test
```

### **"System crashed"**
```powershell
# PM2 auto-restarts, check why it crashed:
pm2 logs twitter-automation --lines 50

# Check error logs
type logs\pm2-error.log
```

---

## ⚙️ **Environment Variables**

**Edit .env file on VPS:**

```env
# Database
MONGODB_URI=mongodb://localhost:27017/twitter-automation

# Server
PORT=3000
NODE_ENV=production

# AdsPower
ADSPOWER_API_URL=http://local.adspower.net:50325

# API Keys (optional - can set via dashboard)
TWOCAPTCHA_API_KEY=your-key-here
PHONE_SERVICE_API_KEY=your-5sim-key
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=sk-your-key
```

**After editing:**
```powershell
pm2 restart twitter-automation
```

---

## 🔄 **Auto-Update from GitHub**

**When you push code changes:**

```powershell
# On VPS, run:
cd C:\twautomation
git pull origin main
pm2 restart twitter-automation

# System updates with zero downtime!
```

**Or create auto-update script:**

```powershell
# update.ps1
cd C:\twautomation
git pull origin main
pm2 restart twitter-automation
Write-Host "✅ System updated and restarted!"
```

**Run:** `.\update.ps1`

---

## 📈 **Scaling on Single VPS**

**Your VPS can handle:**
- 50 accounts: 4 CPU, 8GB RAM
- 100 accounts: 6 CPU, 16GB RAM  
- 200 accounts: 12 CPU, 32GB RAM

**When you hit limits:**
1. Upgrade VPS (click a button)
2. Or add second VPS with MongoDB Atlas

---

## ✅ **VERIFICATION CHECKLIST**

After setup, verify:
- [ ] `pm2 status` shows "online"
- [ ] MongoDB running: `net start MongoDB`
- [ ] AdsPower running
- [ ] Dashboard accessible from VPS: `http://localhost:3000`
- [ ] Dashboard accessible from Mac: `http://VPS-IP:3000`
- [ ] Port 3000 open in firewall
- [ ] Can register accounts
- [ ] Can extract cookies
- [ ] PM2 saves config: `pm2 save`

---

## 🎯 **YOUR WORKFLOW**

**Setup (one time):**
1. Order VPS → Install software → Deploy code
2. Create Twitter accounts → Register in system
3. Extract cookies → Configure campaigns

**Daily (from your Mac):**
1. Open `http://VPS-IP:3000`
2. Monitor dashboard
3. Check metrics
4. Adjust settings

**VPS runs 24/7, you just monitor!** 🚀

---

## 💡 **PRO TIPS**

1. **Get static IP** from VPS provider (don't want IP to change)
2. **Set up PM2 Plus** for mobile monitoring
3. **Create backup script** for MongoDB
4. **Use RDP only for AdsPower setup** (everything else via dashboard)
5. **Setup alerts** (PM2 Plus or custom webhooks)

---

**Ready to setup your VPS? It's simpler than Railway for this use case!** ✅

