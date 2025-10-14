const adsPowerController = require('./adspower-controller');
const { TwitterAccount } = require('../models');

/**
 * Browser Session Manager
 * Manages browser lifecycle: open, close, track idle time
 * Prevents memory exhaustion by closing idle browsers
 */
class BrowserSessionManager {
  constructor() {
    this.sessions = new Map(); // accountId -> { browser, lastUsed, profileId }
    this.MAX_CONCURRENT = 20; // Max browsers open at once
    this.IDLE_TIMEOUT = 30 * 60 * 1000; // Close after 30 min idle
    this.cleanupInterval = null;
  }

  /**
   * Start session manager
   */
  start() {
    console.log('🎮 Starting Browser Session Manager...');
    console.log(`   Max concurrent browsers: ${this.MAX_CONCURRENT}`);
    console.log(`   Idle timeout: ${this.IDLE_TIMEOUT / 1000 / 60} minutes`);

    // Cleanup idle sessions every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 10 * 60 * 1000);
  }

  /**
   * Stop session manager
   */
  async stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log('🛑 Closing all browser sessions...');
    await this.closeAllSessions();
  }

  /**
   * Get or create session for account
   */
  async getSession(accountId) {
    const accountIdStr = accountId.toString();

    // Check if session exists
    if (this.sessions.has(accountIdStr)) {
      const session = this.sessions.get(accountIdStr);
      session.lastUsed = Date.now(); // Update last used time
      return session;
    }

    // Check concurrent limit
    if (this.sessions.size >= this.MAX_CONCURRENT) {
      console.log(`⚠️  Max concurrent browsers reached (${this.MAX_CONCURRENT})`);
      
      // Close least recently used session
      await this.closeLRUSession();
    }

    // Create new session
    return await this.createSession(accountId);
  }

  /**
   * Create new browser session
   */
  async createSession(accountId) {
    try {
      const account = await TwitterAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      console.log(`🌐 Opening browser for @${account.username}...`);

      const browserSession = await adsPowerController.launchProfile(account.adsPowerProfileId);

      const session = {
        browser: browserSession.browser,
        profileId: account.adsPowerProfileId,
        accountId: accountIdStr,
        username: account.username,
        lastUsed: Date.now(),
        createdAt: Date.now()
      };

      this.sessions.set(accountId.toString(), session);

      console.log(`✅ Browser opened (${this.sessions.size}/${this.MAX_CONCURRENT} active)`);

      return session;

    } catch (error) {
      console.error(`❌ Failed to create session for ${accountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Close session
   */
  async closeSession(accountId) {
    const accountIdStr = accountId.toString();

    if (!this.sessions.has(accountIdStr)) {
      return;
    }

    const session = this.sessions.get(accountIdStr);

    try {
      console.log(`🔒 Closing browser for @${session.username}...`);
      await adsPowerController.closeProfile(session.profileId);
      this.sessions.delete(accountIdStr);
      console.log(`✅ Browser closed (${this.sessions.size} remaining)`);
    } catch (error) {
      console.error(`Error closing session:`, error.message);
    }
  }

  /**
   * Close least recently used session
   */
  async closeLRUSession() {
    let lruAccountId = null;
    let oldestTime = Date.now();

    for (const [accountId, session] of this.sessions) {
      if (session.lastUsed < oldestTime) {
        oldestTime = session.lastUsed;
        lruAccountId = accountId;
      }
    }

    if (lruAccountId) {
      console.log(`♻️  Closing LRU session to free space...`);
      await this.closeSession(lruAccountId);
    }
  }

  /**
   * Cleanup idle sessions (not used in 30+ minutes)
   */
  async cleanupIdleSessions() {
    const now = Date.now();
    const idleSessions = [];

    for (const [accountId, session] of this.sessions) {
      const idleTime = now - session.lastUsed;
      
      if (idleTime > this.IDLE_TIMEOUT) {
        idleSessions.push(accountId);
      }
    }

    if (idleSessions.length > 0) {
      console.log(`♻️  Cleaning up ${idleSessions.length} idle browser sessions...`);
      
      for (const accountId of idleSessions) {
        await this.closeSession(accountId);
      }
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions() {
    const accountIds = Array.from(this.sessions.keys());
    
    for (const accountId of accountIds) {
      await this.closeSession(accountId);
    }
  }

  /**
   * Get session stats
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      maxConcurrent: this.MAX_CONCURRENT,
      sessions: Array.from(this.sessions.values()).map(s => ({
        username: s.username,
        idleMinutes: Math.floor((Date.now() - s.lastUsed) / 1000 / 60)
      }))
    };
  }
}

module.exports = new BrowserSessionManager();

