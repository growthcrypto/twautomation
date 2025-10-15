const cron = require('node-cron');
const { AutomationTask } = require('../models');

/**
 * Task Cleanup Service
 * Auto-deletes old completed/failed tasks to keep database small
 * 
 * Without this, database grows to 100GB+ after 1 month with 100 accounts
 * With this: ~2-5GB database size
 */
class TaskCleanupService {
  constructor() {
    this.isRunning = false;
    this.scheduledJob = null;
  }

  /**
   * Start cleanup service (runs daily at 3 AM)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Task cleanup service already running');
      return;
    }

    console.log('🧹 Starting task cleanup service...');
    this.isRunning = true;

    // Run immediately on startup
    this.cleanupOldTasks();

    // Then run daily at 3 AM
    this.scheduledJob = cron.schedule('0 3 * * *', async () => {
      await this.cleanupOldTasks();
    });

    console.log('✅ Task cleanup service started (runs daily at 3 AM)');
  }

  /**
   * Cleanup old tasks
   */
  async cleanupOldTasks() {
    try {
      console.log('\n🧹 Running task cleanup...');

      // Delete completed tasks older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const deletedCompleted = await AutomationTask.deleteMany({
        status: 'completed',
        updatedAt: { $lt: sevenDaysAgo }
      });

      console.log(`   ✅ Deleted ${deletedCompleted.deletedCount} completed tasks (>7 days old)`);

      // Delete failed/cancelled tasks older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const deletedFailed = await AutomationTask.deleteMany({
        status: { $in: ['failed', 'cancelled'] },
        updatedAt: { $lt: thirtyDaysAgo }
      });

      console.log(`   ✅ Deleted ${deletedFailed.deletedCount} failed/cancelled tasks (>30 days old)`);

      // Get remaining task counts for monitoring
      const remaining = await AutomationTask.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      console.log('   📊 Remaining tasks:');
      remaining.forEach(stat => {
        console.log(`      - ${stat._id}: ${stat.count}`);
      });

      console.log('✅ Task cleanup complete\n');

      return {
        success: true,
        deletedCompleted: deletedCompleted.deletedCount,
        deletedFailed: deletedFailed.deletedCount
      };

    } catch (error) {
      console.error('❌ Task cleanup error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop cleanup service
   */
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
      this.isRunning = false;
      console.log('🛑 Task cleanup service stopped');
    }
  }

  /**
   * Manually trigger cleanup
   */
  async cleanupNow() {
    return await this.cleanupOldTasks();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun || null
    };
  }
}

module.exports = new TaskCleanupService();

