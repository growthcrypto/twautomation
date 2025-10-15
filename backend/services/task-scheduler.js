const { AutomationTask, TwitterAccount } = require('../models');
const twitterAutomation = require('./twitter-automation');
const { canPerformAction } = require('../utils/account-helpers');
const cron = require('node-cron');

/**
 * Task Scheduler
 * Intelligently distributes and executes tasks across accounts
 */
class TaskScheduler {
  constructor() {
    this.isRunning = false;
    this.scheduledJob = null;
    this.activeExecutions = new Map(); // Track running tasks per account
    this.maxConcurrentTasksPerAccount = 1; // Execute one task at a time per account
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Task scheduler is already running');
      return;
    }

    console.log('⏰ Starting task scheduler...');
    this.isRunning = true;

    // Run every 2 minutes
    this.scheduledJob = cron.schedule('*/2 * * * *', () => {
      this.processPendingTasks();
    });

    // Also run immediately
    this.processPendingTasks();

    console.log('✅ Task scheduler started (runs every 2 minutes)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
      this.isRunning = false;
      console.log('🛑 Task scheduler stopped');
    }
  }

  /**
   * Process pending tasks
   */
  async processPendingTasks() {
    if (!this.isRunning) return;

    try {
      console.log('\n⏰ Processing pending tasks...');

      // Get all active accounts
      const activeAccounts = await TwitterAccount.find({
        status: { $in: ['active', 'warming_up'] }
      });

      if (activeAccounts.length === 0) {
        console.log('   No active accounts to process tasks');
        return;
      }

      let totalProcessed = 0;

      for (const account of activeAccounts) {
        // Skip if account already has running tasks
        if (this.activeExecutions.get(account._id.toString())) {
          continue;
        }

        // Get next task for this account
        const nextTask = await this.getNextTaskForAccount(account._id);

        if (nextTask) {
          // Execute task (non-blocking)
          this.executeTaskForAccount(account._id, nextTask._id);
          totalProcessed++;
        }
      }

      if (totalProcessed > 0) {
        console.log(`✅ Dispatched ${totalProcessed} tasks for execution\n`);
      } else {
        console.log('   No tasks ready for execution\n');
      }

    } catch (error) {
      console.error('❌ Error processing tasks:', error.message);
    }
  }

  /**
   * Get next task for a specific account
   */
  async getNextTaskForAccount(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) return null;

      // Find pending tasks that are:
      // 1. Scheduled for now or earlier
      // 2. Within daily limits
      // 3. Prioritized by priority score

      const now = new Date();

      const task = await AutomationTask.findOne({
        accountId: account._id,
        status: 'pending',
        scheduledFor: { $lte: now }
      })
      .sort({ priority: -1, scheduledFor: 1 }) // High priority first, then oldest
      .limit(1);

      if (!task) return null;

      // Check daily limits before returning task
      const canExecute = await this.checkDailyLimits(account, task.taskType);
      
      if (!canExecute) {
        // Reschedule for tomorrow
        task.scheduledFor = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await task.save();
        console.log(`   ⏸️  ${account.username}: Daily limit reached for ${task.taskType}, rescheduled`);
        return null;
      }

      return task;

    } catch (error) {
      console.error(`Error getting task for account ${accountId}:`, error.message);
      return null;
    }
  }

  /**
   * Execute a task for an account (async, non-blocking)
   */
  async executeTaskForAccount(accountId, taskId) {
    const accountIdStr = accountId.toString();

    // Mark as executing
    this.activeExecutions.set(accountIdStr, taskId);

    try {
      // Execute the task
      await twitterAutomation.executeTask(taskId);
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error.message);
    } finally {
      // Remove from active executions
      this.activeExecutions.delete(accountIdStr);
    }
  }

  /**
   * Check if account can execute more tasks of this type today
   */
  async checkDailyLimits(account, taskType) {
    // Map task types to counter types
    const actionTypeMap = {
      'follow': 'follows',
      'unfollow': 'unfollows',
      'send_dm': 'dms',
      'reply_dm': 'dms',
      'like': 'likes',
      'tweet': 'tweets'
    };

    const actionType = actionTypeMap[taskType];
    
    if (!actionType) {
      return true; // Unknown task type, allow it
    }

    // Use atomic check to prevent race conditions
    const check = await canPerformAction(account._id, actionType);
    
    return check.canPerform;
  }

  /**
   * Manually trigger task processing
   */
  async processNow() {
    await this.processPendingTasks();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeExecutions: this.activeExecutions.size,
      accounts: Array.from(this.activeExecutions.keys())
    };
  }

  /**
   * Cancel all pending tasks for an account
   */
  async cancelAccountTasks(accountId) {
    try {
      const result = await AutomationTask.updateMany(
        { accountId, status: 'pending' },
        { status: 'cancelled' }
      );

      console.log(`🚫 Cancelled ${result.modifiedCount} tasks for account ${accountId}`);

      return {
        success: true,
        cancelledCount: result.modifiedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get task queue for an account
   */
  async getAccountQueue(accountId) {
    try {
      const tasks = await AutomationTask.find({
        accountId,
        status: 'pending'
      })
      .sort({ priority: -1, scheduledFor: 1 })
      .limit(50);

      return {
        success: true,
        tasks: tasks.map(t => ({
          id: t._id,
          type: t.taskType,
          target: t.targetUsername,
          scheduled: t.scheduledFor,
          priority: t.priority
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get overall system queue stats
   */
  async getQueueStats() {
    try {
      const pending = await AutomationTask.countDocuments({ status: 'pending' });
      const inProgress = await AutomationTask.countDocuments({ status: 'in_progress' });
      const completed = await AutomationTask.countDocuments({ 
        status: 'completed',
        executedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
      });
      const failed = await AutomationTask.countDocuments({ 
        status: 'failed',
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
      });

      // Group by task type
      const byType = await AutomationTask.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: '$taskType', count: { $sum: 1 } } }
      ]);

      return {
        success: true,
        stats: {
          pending,
          inProgress,
          completedToday: completed,
          failedToday: failed,
          byType: byType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Priority queue management: Bump task priority
   */
  async prioritizeTask(taskId) {
    try {
      const task = await AutomationTask.findById(taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      task.priority = 10; // Max priority
      task.scheduledFor = new Date(); // Execute ASAP
      await task.save();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TaskScheduler();

