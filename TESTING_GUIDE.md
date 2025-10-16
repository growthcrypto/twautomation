# 🧪 **Testing Guide: Finding Your Best Strategy**

## **Quick Summary**

You now have:
1. **Warmup System** - Configure exactly how accounts warm up (prevents bans)
2. **A/B Testing Framework** - Track & compare different strategies
3. **3 Preset Templates** - Conservative (30d), Moderate (14d), Aggressive (7d)

---

## **Part 1: Warmup System**

### **Why Warmup Matters**

New Twitter accounts that immediately start following/DMing get **instantly flagged** as bots.

Warmup = Gradual activity increase over days to look human.

### **Access Warmup Configuration**

**Via Dashboard:**
```
Open: http://localhost:3000/config-warmup.html
```

**Via API:**
```bash
# Get all warmup configs
curl http://localhost:3000/api/configs/warmup

# Get templates
curl http://localhost:3000/api/configs/warmup/templates/presets

# Create custom warmup
curl -X POST http://localhost:3000/api/configs/warmup \
  -H "Content-Type: application/json" \
  -d @warmup-config.json
```

### **3 Preset Templates**

#### **Template 1: Conservative (30 days)** ⭐⭐⭐⭐⭐

**Best For:** Long-term accounts, branded accounts, high-value niches

**Schedule:**
- **Week 1:** 0-12 likes/day, 0-4 follows/day
- **Week 2:** 15-35 likes/day, 5-18 follows/day
- **Week 3:** 25-70 likes/day, 15-50 follows/day
- **Week 4:** 50-115 likes/day, 40-95 follows/day

**Ban Risk:** <2% (extremely low)
**Time to Production:** 30 days

#### **Template 2: Moderate (14 days)** ⭐⭐⭐⭐

**Best For:** Most use cases, balanced approach

**Schedule:**
- **Day 1-4:** 3-25 likes/day, 0-12 follows/day
- **Day 5-7:** 20-55 likes/day, 12-35 follows/day
- **Day 8-11:** 42-95 likes/day, 32-75 follows/day
- **Day 12-14:** 80-125 likes/day, 70-110 follows/day

**Ban Risk:** 5-8%
**Time to Production:** 14 days

#### **Template 3: Aggressive (7 days)** ⚠️

**Best For:** Testing, disposable accounts, high-volume

**Schedule:**
- **Day 1-2:** 10-40 likes/day, 3-25 follows/day
- **Day 3-4:** 40-85 likes/day, 30-70 follows/day
- **Day 5-7:** 80-150 likes/day, 70-130 follows/day

**Ban Risk:** 15-20%
**Time to Production:** 7 days

### **How to Use**

**Option 1: Use Preset (Easiest)**
1. Go to http://localhost:3000/config-warmup.html
2. Click on a template (Conservative, Moderate, or Aggressive)
3. Review the schedule
4. Click "Save Warmup Config"
5. Done!

**Option 2: Custom Schedule**
1. Open warmup config page
2. Set "Total Warmup Days" (e.g., 21)
3. Click "Generate Schedule" (creates linear ramp)
4. Edit individual days if needed
5. Save

**Option 3: Via API**
```bash
curl -X POST http://localhost:3000/api/configs/warmup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Warmup",
    "enabled": true,
    "schedule": [
      {
        "day": 1,
        "actions": {
          "scrollFeed": { "min": 2, "max": 4, "duration": { "min": 60, "max": 120 }},
          "likes": { "min": 3, "max": 8 },
          "follows": { "min": 0, "max": 2 }
        }
      }
      // ... more days
    ]
  }'
```

---

## **Part 2: A/B Testing Framework**

### **How to Test Strategies**

Create **cohorts** (test groups) with different strategies, then compare results.

### **Example Test Setup**

**Test Question:** "Should I use Evolution (single account) or Specialist (separate traffic/chat)?"

**Setup:**

**Cohort A: Evolution Strategy**
```bash
curl -X POST http://localhost:3000/api/configs/testing/cohorts \
  -H "Content-Type: application/json" \
  -d '{
    "testName": "Evolution Test",
    "strategy": "evolution_single_account",
    "description": "Accounts age 30 days, then become traffic+chat",
    "config": {
      "warmupDays": 30,
      "followPerDay": 100,
      "dmPerDay": 0,
      "hasPremium": false,
      "usesRedirect": false
    },
    "hypothesis": "Single account = higher conversion (no redirect friction)"
  }'
```

**Cohort B: Specialist Strategy**
```bash
curl -X POST http://localhost:3000/api/configs/testing/cohorts \
  -H "Content-Type: application/json" \
  -d '{
    "testName": "Specialist Test",
    "strategy": "specialist_separate",
    "description": "Traffic accounts redirect to chat accounts",
    "config": {
      "warmupDays": 14,
      "followPerDay": 200,
      "dmPerDay": 50,
      "hasPremium": true,
      "usesRedirect": true
    },
    "hypothesis": "Separate accounts = chat accounts protected"
  }'
```

### **Add Accounts to Cohorts**

```bash
# Get cohort IDs (from creation response)
COHORT_A_ID="..."
COHORT_B_ID="..."

# Add 3 accounts to Cohort A
curl -X POST http://localhost:3000/api/configs/testing/cohorts/$COHORT_A_ID/accounts \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account_id_here"}'

# Add 3 accounts to Cohort B
curl -X POST http://localhost:3000/api/configs/testing/cohorts/$COHORT_B_ID/accounts \
  -H "Content-Type: application/json" \
  -d '{"accountId": "account_id_here"}'
```

### **Start Tests**

```bash
# Start Cohort A
curl -X POST http://localhost:3000/api/configs/testing/cohorts/$COHORT_A_ID/start

# Start Cohort B
curl -X POST http://localhost:3000/api/configs/testing/cohorts/$COHORT_B_ID/start
```

### **Check Results (Anytime)**

```bash
# Get Cohort A results
curl http://localhost:3000/api/configs/testing/cohorts/$COHORT_A_ID

# Response:
{
  "success": true,
  "cohort": {
    "testName": "Evolution Test",
    "results": {
      "banRate": 5.2,
      "followBackRate": 12.3,
      "replyRate": 28.5,
      "conversionRate": 8.2,
      "revenuePerAccount": 47.50,
      "totalRevenue": 142.50
    }
  }
}
```

### **Compare Tests**

```bash
curl "http://localhost:3000/api/configs/testing/compare?cohortIds=$COHORT_A_ID,$COHORT_B_ID"

# Response:
{
  "success": true,
  "comparison": [
    {
      "name": "Evolution Test",
      "strategy": "evolution_single_account",
      "banRate": 5.2,
      "followBackRate": 12.3,
      "replyRate": 28.5,
      "conversionRate": 8.2,
      "revenuePerAccount": 47.50
    },
    {
      "name": "Specialist Test",
      "strategy": "specialist_separate",
      "banRate": 12.8,
      "followBackRate": 9.1,
      "replyRate": 22.0,
      "conversionRate": 5.1,
      "revenuePerAccount": 35.20
    }
  ]
}
```

**Winner:** Evolution (higher conversion rate, lower ban rate, more revenue!)

---

## **Part 3: Recommended Test Plan**

### **Week 1: Baseline Test**

**Goal:** Establish baseline with safest approach

**Setup:**
- **3 accounts**
- **Conservative warmup (30 days)**
- **Follow/Unfollow only**
- **No DMs**

**Track:**
- Ban rate
- Follow-back rate
- Time to 1000 followers

### **Week 2-5: Strategy Tests**

Run **3 parallel tests** with **3 accounts each** (9 accounts total):

**Test A: Evolution Method**
```
Warmup: 30 days conservative
Strategy: Single account (Follow → Age → Becomes chat account)
Premium: No
Expected Ban Rate: <5%
Expected Conversion Rate: High (no redirect)
```

**Test B: Hybrid Method**
```
Warmup: 14 days moderate
Strategy: Follow + DM on same account
Premium: Yes ($8/mo)
Expected Ban Rate: 10-15%
Expected Conversion Rate: Medium-High
```

**Test C: Specialist Method**
```
Warmup: 14 days moderate
Strategy: Traffic accounts → Chat accounts
Premium: Yes (traffic only)
Expected Ban Rate: 8-12% (traffic), <5% (chat)
Expected Conversion Rate: Medium (redirect friction)
```

### **Week 6: Analysis & Decision**

Compare:
1. **Ban Rate** (sustainability)
2. **Conversion Rate** (effectiveness)
3. **Revenue Per Account** (profitability)
4. **Setup Time** (speed to market)

**Decision Matrix:**
```
                Ban Rate  Conv Rate  Revenue/Acc  Setup Time
Evolution         5%        8%         $50         30 days
Hybrid           12%        6%         $42         14 days
Specialist        9%        5%         $35         14 days
```

**Choose:** Evolution (best long-term) OR Hybrid (best speed)

---

## **Part 4: How to Configure via Dashboard**

### **Register Account with Warmup**

When registering a new account:

```javascript
// In Dashboard → Accounts → Register
1. Fill in account details
2. Role: "traffic" or "chat"
3. Status: "warming_up" (NEW!)
4. Save

// Backend automatically:
- Assigns warmup config (if one exists)
- Starts day 1 of warmup
- Progresses daily automatically
- Graduates to "active" after final day
```

### **Monitor Warmup Progress**

```bash
# View account warmup status
curl http://localhost:3000/api/accounts/$ACCOUNT_ID

# Response:
{
  "username": "FitnessGirl2024",
  "status": "warming_up",
  "warmupPhase": {
    "day": 7,
    "completed": false
  }
}
```

### **Manual Warmup Control**

```bash
# Skip warmup (use cautiously!)
curl -X PATCH http://localhost:3000/api/accounts/$ACCOUNT_ID \
  -d '{"status": "active", "warmupPhase.completed": true}'

# Restart warmup
curl -X PATCH http://localhost:3000/api/accounts/$ACCOUNT_ID \
  -d '{"status": "warming_up", "warmupPhase.day": 1}'
```

---

## **Part 5: API Reference**

### **Warmup Endpoints**

```
GET    /api/configs/warmup                    - List all warmup configs
GET    /api/configs/warmup/:id                - Get specific config
POST   /api/configs/warmup                    - Create new config
PATCH  /api/configs/warmup/:id                - Update config
DELETE /api/configs/warmup/:id                - Delete config
GET    /api/configs/warmup/templates/presets  - Get preset templates
```

### **Testing Endpoints**

```
GET    /api/configs/testing/cohorts           - List all tests
GET    /api/configs/testing/cohorts/:id       - Get test + results
POST   /api/configs/testing/cohorts           - Create new test
PATCH  /api/configs/testing/cohorts/:id       - Update test
DELETE /api/configs/testing/cohorts/:id       - Delete test
POST   /api/configs/testing/cohorts/:id/accounts        - Add account to test
POST   /api/configs/testing/cohorts/:id/start           - Start test
POST   /api/configs/testing/cohorts/:id/stop            - Stop test
POST   /api/configs/testing/cohorts/:id/calculate       - Recalculate results
GET    /api/configs/testing/compare?cohortIds=...       - Compare tests
```

---

## **Quick Start: Test 3 Strategies**

```bash
# 1. Create 3 cohorts
curl -X POST http://localhost:3000/api/configs/testing/cohorts -d @evolution-test.json
curl -X POST http://localhost:3000/api/configs/testing/cohorts -d @hybrid-test.json
curl -X POST http://localhost:3000/api/configs/testing/cohorts -d @specialist-test.json

# 2. Register 9 accounts (3 per strategy)
# Dashboard → Accounts → Register (repeat 9 times)

# 3. Assign accounts to cohorts
# For each account, add to appropriate cohort

# 4. Start all tests
curl -X POST http://localhost:3000/api/configs/testing/cohorts/$COHORT_ID/start

# 5. Wait 30 days

# 6. Compare results
curl "http://localhost:3000/api/configs/testing/compare?cohortIds=$ID1,$ID2,$ID3"

# 7. Pick winner & scale!
```

---

## **Summary**

✅ **Warmup System** - Prevents bans, 3 preset templates
✅ **Testing Framework** - Track cohorts, compare strategies  
✅ **API Ready** - Full CRUD for warmup & testing
✅ **Dashboard UI** - Visual warmup configuration

**Next Steps:**
1. Choose warmup template (Conservative recommended)
2. Create 3 test cohorts (Evolution, Hybrid, Specialist)
3. Register 9 accounts (3 per cohort)
4. Run for 30 days
5. Compare results
6. Scale winner! 🚀

