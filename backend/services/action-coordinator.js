/**
 * Action Coordinator
 * Prevents race conditions when multiple campaigns use same browser
 * Implements mutex/queue system for browser actions
 */
class ActionCoordinator {
  constructor() {
    // accountId -> queue of pending actions
    this.actionQueues = new Map();
    // accountId -> currently executing action
    this.activeActions = new Map();
  }

  /**
   * Request permission to use browser for an account
   * Waits until it's this campaign's turn
   */
  async acquireLock(accountId, campaignName, timeoutMs = 60000) {
    const accountIdStr = accountId.toString();

    return new Promise((resolve, reject) => {
      const lockRequest = {
        campaignName,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Initialize queue if not exists
      if (!this.actionQueues.has(accountIdStr)) {
        this.actionQueues.set(accountIdStr, []);
      }

      const queue = this.actionQueues.get(accountIdStr);

      // If no active action, grant immediately
      if (!this.activeActions.has(accountIdStr) && queue.length === 0) {
        this.activeActions.set(accountIdStr, lockRequest);
        console.log(`🔓 ${campaignName} acquired lock for account ${accountId}`);
        resolve();
      } else {
        // Add to queue
        queue.push(lockRequest);
        console.log(`⏳ ${campaignName} queued for account ${accountId} (${queue.length} in queue)`);
      }

      // Timeout mechanism
      setTimeout(() => {
        if (this.activeActions.get(accountIdStr) !== lockRequest && queue.includes(lockRequest)) {
          const index = queue.indexOf(lockRequest);
          if (index > -1) queue.splice(index, 1);
          reject(new Error(`Lock acquisition timeout for ${campaignName}`));
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

    // Process next in queue
    const queue = this.actionQueues.get(accountIdStr);
    if (queue && queue.length > 0) {
      const nextLock = queue.shift();
      this.activeActions.set(accountIdStr, nextLock);
      console.log(`🔓 ${nextLock.campaignName} acquired lock for account ${accountId}`);
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
        queueLength: queue.length,
        queuedCampaigns: queue.map(r => r.campaignName)
      });
    }
    return status;
  }
}

module.exports = new ActionCoordinator();

