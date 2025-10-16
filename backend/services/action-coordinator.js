/**
 * Action Coordinator
 * Prevents race conditions when multiple campaigns use same browser
 * Implements mutex/queue system with priority for browser actions
 */
class ActionCoordinator {
  constructor() {
    // accountId -> queue of pending actions
    this.actionQueues = new Map();
    // accountId -> currently executing action
    this.activeActions = new Map();
    
    // Campaign priorities (lower number = higher priority)
    this.campaignPriorities = {
      'AI Chat Monitor': 1,  // Highest - fast response needed
      'Mass DM': 2,          // Medium priority
      'Follow/Unfollow': 3,  // Lower priority
      'Random Activity': 4,  // Lowest priority
      'Warmup': 5            // Background task
    };
    
    // Timeout defaults per campaign type (ms)
    this.campaignTimeouts = {
      'AI Chat Monitor': 30000,  // 30 seconds
      'Mass DM': 60000,          // 60 seconds
      'Follow/Unfollow': 90000,  // 90 seconds
      'Random Activity': 120000, // 2 minutes
      'Warmup': 120000           // 2 minutes
    };
    
    // Configuration
    this.maxQueueLength = 20;  // Max actions per account
  }

  /**
   * Request permission to use browser for an account
   * Waits until it's this campaign's turn
   * Uses priority system and auto-timeout based on campaign type
   */
  async acquireLock(accountId, campaignName, timeoutMs = null) {
    const accountIdStr = accountId.toString();
    
    // Use campaign-specific timeout if not provided
    if (timeoutMs === null) {
      timeoutMs = this.campaignTimeouts[campaignName] || 60000;
    }
    
    // Get campaign priority
    const priority = this.campaignPriorities[campaignName] || 99;

    return new Promise((resolve, reject) => {
      const lockRequest = {
        campaignName,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Initialize queue if not exists
      if (!this.actionQueues.has(accountIdStr)) {
        this.actionQueues.set(accountIdStr, []);
      }

      const queue = this.actionQueues.get(accountIdStr);
      
      // Check queue limit
      if (queue.length >= this.maxQueueLength) {
        console.log(`⚠️  Queue full for account ${accountId}, rejecting ${campaignName}`);
        reject(new Error(`Queue full (${this.maxQueueLength} max)`));
        return;
      }

      // If no active action, grant immediately
      if (!this.activeActions.has(accountIdStr) && queue.length === 0) {
        this.activeActions.set(accountIdStr, lockRequest);
        console.log(`🔓 ${campaignName} (priority ${priority}) acquired lock for account ${accountId}`);
        resolve();
      } else {
        // Add to queue with priority sorting
        queue.push(lockRequest);
        // Sort queue by priority (lower number = higher priority)
        queue.sort((a, b) => a.priority - b.priority);
        console.log(`⏳ ${campaignName} (priority ${priority}) queued for account ${accountId} (${queue.length} in queue)`);
      }

      // Timeout mechanism
      setTimeout(() => {
        if (this.activeActions.get(accountIdStr) !== lockRequest && queue.includes(lockRequest)) {
          const index = queue.indexOf(lockRequest);
          if (index > -1) queue.splice(index, 1);
          reject(new Error(`Lock acquisition timeout for ${campaignName} after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
  }

  /**
   * Release lock and process next in queue
   */
  async releaseLock(accountId, campaignName) {
    const accountIdStr = accountId.toString();
    const currentLock = this.activeActions.get(accountIdStr);

    if (!currentLock || currentLock.campaignName !== campaignName) {
      console.log(`⚠️  ${campaignName} tried to release lock it doesn't own`);
      return;
    }

    this.activeActions.delete(accountIdStr);
    console.log(`🔐 ${campaignName} released lock for account ${accountId}`);

    // Process next in queue (already sorted by priority)
    const queue = this.actionQueues.get(accountIdStr);
    if (queue && queue.length > 0) {
      const nextLock = queue.shift();
      this.activeActions.set(accountIdStr, nextLock);
      console.log(`🔓 ${nextLock.campaignName} (priority ${nextLock.priority}) acquired lock for account ${accountId}`);
      nextLock.resolve();
    }
  }

  /**
   * Execute action with automatic lock management
   * This is the recommended way to use the coordinator
   */
  async executeWithLock(accountId, campaignName, actionFn) {
    try {
      await this.acquireLock(accountId, campaignName);
      const result = await actionFn();
      return result;
    } finally {
      await this.releaseLock(accountId, campaignName);
    }
  }

  /**
   * Check if account has pending actions
   */
  getQueueLength(accountId) {
    const accountIdStr = accountId.toString();
    const queue = this.actionQueues.get(accountIdStr);
    return queue ? queue.length : 0;
  }

  /**
   * Get current lock holder
   */
  getCurrentLockHolder(accountId) {
    const accountIdStr = accountId.toString();
    const lock = this.activeActions.get(accountIdStr);
    return lock ? lock.campaignName : null;
  }

  /**
   * Clear all locks and queues (for shutdown)
   */
  clearAll() {
    for (const [accountId, queue] of this.actionQueues) {
      for (const request of queue) {
        request.reject(new Error('Coordinator shutdown'));
      }
    }
    this.actionQueues.clear();
    this.activeActions.clear();
    console.log('🧹 Action coordinator cleared');
  }

  /**
   * Get status for debugging
   */
  getStatus() {
    const status = [];
    for (const [accountId, queue] of this.actionQueues) {
      const currentLock = this.activeActions.get(accountId);
      status.push({
        accountId,
        currentAction: currentLock ? currentLock.campaignName : null,
        currentPriority: currentLock ? currentLock.priority : null,
        queueLength: queue.length,
        queuedCampaigns: queue.map(r => `${r.campaignName} (P${r.priority})`)
      });
    }
    return status;
  }

  /**
   * Configure campaign priority
   * @param {string} campaignName - Name of campaign
   * @param {number} priority - Priority (1 = highest, lower numbers = higher priority)
   */
  setCampaignPriority(campaignName, priority) {
    if (priority < 1) {
      console.log(`⚠️  Priority must be >= 1, setting to 1`);
      priority = 1;
    }
    this.campaignPriorities[campaignName] = priority;
    console.log(`✅ Set priority for "${campaignName}" to ${priority}`);
  }

  /**
   * Configure campaign timeout
   * @param {string} campaignName - Name of campaign
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  setCampaignTimeout(campaignName, timeoutMs) {
    if (timeoutMs < 1000) {
      console.log(`⚠️  Timeout must be >= 1000ms, setting to 1000ms`);
      timeoutMs = 1000;
    }
    this.campaignTimeouts[campaignName] = timeoutMs;
    console.log(`✅ Set timeout for "${campaignName}" to ${timeoutMs}ms (${timeoutMs/1000}s)`);
  }

  /**
   * Configure max queue length
   * @param {number} maxLength - Maximum number of queued actions per account
   */
  setMaxQueueLength(maxLength) {
    if (maxLength < 1) {
      console.log(`⚠️  Max queue length must be >= 1, setting to 1`);
      maxLength = 1;
    }
    this.maxQueueLength = maxLength;
    console.log(`✅ Set max queue length to ${maxLength}`);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      priorities: { ...this.campaignPriorities },
      timeouts: { ...this.campaignTimeouts },
      maxQueueLength: this.maxQueueLength
    };
  }

  /**
   * Get queue statistics
   */
  getStatistics() {
    let totalQueued = 0;
    let totalActive = this.activeActions.size;
    const queuesByPriority = {};

    for (const queue of this.actionQueues.values()) {
      totalQueued += queue.length;
      for (const request of queue) {
        const priority = request.priority;
        queuesByPriority[priority] = (queuesByPriority[priority] || 0) + 1;
      }
    }

    return {
      activeActions: totalActive,
      totalQueued,
      queuesByPriority,
      accountsWithQueues: this.actionQueues.size
    };
  }
}

module.exports = new ActionCoordinator();

