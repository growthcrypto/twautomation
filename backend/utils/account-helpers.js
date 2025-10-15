const { TwitterAccount } = require('../models');

/**
 * Account Helper Utilities
 * Provides atomic operations to prevent race conditions
 */

/**
 * Atomically increment a daily counter
 * Prevents race conditions where multiple processes try to increment simultaneously
 * 
 * @param {string} accountId - Account ID
 * @param {string} counterType - 'follows', 'unfollows', 'dms', 'likes', 'tweets'
 * @returns {Promise<{success: boolean, account?: object, reason?: string}>}
 */
async function incrementDailyCounter(accountId, counterType) {
  try {
    // Map counter type to limit field
    const limitField = `limits.max${capitalize(counterType)}PerDay`;
    const counterField = `today.${counterType}`;
    
    // Atomic update: increment only if below limit
    const account = await TwitterAccount.findById(accountId);
    
    if (!account) {
      return { success: false, reason: 'account_not_found' };
    }

    // Check daily reset
    const today = new Date().toDateString();
    const lastReset = account.today.lastResetDate ? account.today.lastResetDate.toDateString() : null;

    if (today !== lastReset) {
      // New day - reset counters
      account.today = {
        follows: 0,
        unfollows: 0,
        dms: 0,
        likes: 0,
        tweets: 0,
        lastResetDate: new Date()
      };
      await account.save();
    }

    // Get current value and limit
    const currentValue = account.today[counterType] || 0;
    const limit = getNestedValue(account, limitField);

    if (currentValue >= limit) {
      return {
        success: false,
        reason: 'limit_reached',
        current: currentValue,
        limit
      };
    }

    // Atomic increment
    const update = {
      $inc: {},
      $set: { lastActiveDate: new Date() }
    };
    update.$inc[counterField] = 1;

    const updatedAccount = await TwitterAccount.findByIdAndUpdate(
      accountId,
      update,
      { new: true }
    );

    return {
      success: true,
      account: updatedAccount,
      newValue: updatedAccount.today[counterType]
    };

  } catch (error) {
    console.error(`Error incrementing ${counterType}:`, error.message);
    return {
      success: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Check if account can perform action (without incrementing)
 */
async function canPerformAction(accountId, actionType) {
  try {
    const account = await TwitterAccount.findById(accountId);
    
    if (!account) {
      return { canPerform: false, reason: 'account_not_found' };
    }

    // Check if account is active
    if (account.status !== 'active' && account.status !== 'warming_up') {
      return { canPerform: false, reason: 'account_inactive', status: account.status };
    }

    // Check daily reset
    const today = new Date().toDateString();
    const lastReset = account.today.lastResetDate ? account.today.lastResetDate.toDateString() : null;

    if (today !== lastReset) {
      // New day - they can perform action
      return { canPerform: true, remaining: account.limits[`max${capitalize(actionType)}PerDay`] };
    }

    // Check limit
    const currentValue = account.today[actionType] || 0;
    const limit = account.limits[`max${capitalize(actionType)}PerDay`];

    if (currentValue >= limit) {
      return {
        canPerform: false,
        reason: 'limit_reached',
        current: currentValue,
        limit
      };
    }

    return {
      canPerform: true,
      remaining: limit - currentValue,
      current: currentValue,
      limit
    };

  } catch (error) {
    return {
      canPerform: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Reset daily counters for all accounts (called at midnight)
 */
async function resetDailyCounters() {
  try {
    const result = await TwitterAccount.updateMany(
      {},
      {
        $set: {
          'today.follows': 0,
          'today.unfollows': 0,
          'today.dms': 0,
          'today.likes': 0,
          'today.tweets': 0,
          'today.lastResetDate': new Date()
        }
      }
    );

    console.log(`🔄 Reset daily counters for ${result.modifiedCount} accounts`);

    return {
      success: true,
      resetCount: result.modifiedCount
    };

  } catch (error) {
    console.error('Error resetting daily counters:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Batch increment counters (for performance)
 */
async function batchIncrementCounters(updates) {
  try {
    const promises = updates.map(({ accountId, counterType }) =>
      incrementDailyCounter(accountId, counterType)
    );

    const results = await Promise.all(promises);

    return {
      success: true,
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper functions
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

module.exports = {
  incrementDailyCounter,
  canPerformAction,
  resetDailyCounters,
  batchIncrementCounters
};

