/**
 * Action Coordinator Configuration
 * Customize campaign priorities, timeouts, and queue settings
 */

const actionCoordinator = require('../services/action-coordinator');

/**
 * Apply custom configuration on startup
 */
function configureCoordinator() {
  console.log('⚙️  Applying custom coordinator configuration...');

  // ============================================
  // CAMPAIGN PRIORITIES
  // ============================================
  // Lower number = higher priority (1 is highest)
  
  // Default priorities (uncomment and modify to change):
  // actionCoordinator.setCampaignPriority('AI Chat Monitor', 1);
  // actionCoordinator.setCampaignPriority('Mass DM', 2);
  // actionCoordinator.setCampaignPriority('Follow/Unfollow', 3);
  // actionCoordinator.setCampaignPriority('Random Activity', 4);
  // actionCoordinator.setCampaignPriority('Warmup', 5);

  // ============================================
  // CAMPAIGN TIMEOUTS
  // ============================================
  // How long to wait before giving up (in milliseconds)
  
  // Default timeouts (uncomment and modify to change):
  // actionCoordinator.setCampaignTimeout('AI Chat Monitor', 30000);   // 30 seconds
  // actionCoordinator.setCampaignTimeout('Mass DM', 60000);           // 60 seconds
  // actionCoordinator.setCampaignTimeout('Follow/Unfollow', 90000);   // 90 seconds
  // actionCoordinator.setCampaignTimeout('Random Activity', 120000);  // 2 minutes
  // actionCoordinator.setCampaignTimeout('Warmup', 120000);           // 2 minutes

  // ============================================
  // QUEUE SETTINGS
  // ============================================
  
  // Max queued actions per account (default: 20)
  // actionCoordinator.setMaxQueueLength(20);

  // ============================================
  // CUSTOM CONFIGURATIONS
  // ============================================
  
  // Example: Make Mass DM highest priority
  // actionCoordinator.setCampaignPriority('Mass DM', 1);
  // actionCoordinator.setCampaignPriority('AI Chat Monitor', 2);

  // Example: Give AI Chat only 10 seconds to respond
  // actionCoordinator.setCampaignTimeout('AI Chat Monitor', 10000);

  // Example: Allow 100 queued actions (for very busy accounts)
  // actionCoordinator.setMaxQueueLength(100);

  console.log('✅ Coordinator configuration applied');
  
  // Log current config
  const config = actionCoordinator.getConfig();
  console.log('📊 Current Configuration:', JSON.stringify(config, null, 2));
}

module.exports = { configureCoordinator };

