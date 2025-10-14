const axios = require('axios');
const puppeteer = require('puppeteer-core');

class AdsPowerController {
  constructor() {
    this.apiUrl = process.env.ADSPOWER_API_URL || 'http://local.adspower.net:50325';
    this.activeProfiles = new Map(); // Track running browser sessions
  }

  /**
   * Create a new browser profile in AdsPower
   */
  async createProfile(accountData) {
    const { username, niche, proxy } = accountData;

    const profileConfig = {
      name: `${niche}_${username}`,
      group_id: this.getGroupIdByNiche(niche),
      domain_name: 'twitter.com',
      
      // Proxy configuration
      user_proxy_config: proxy ? {
        proxy_soft: 'other',
        proxy_type: proxy.type === 'mobile' ? 'http' : proxy.type,
        proxy_host: proxy.host,
        proxy_port: proxy.port,
        proxy_user: proxy.username,
        proxy_password: proxy.password
      } : {},
      
      // Fingerprint randomization
      fingerprint_config: {
        automatic_timezone: 1, // Auto-detect timezone based on IP
        language: ['en-US', 'en'],
        ua: 'random', // Random user agent
        screen_resolution: 'random',
        fonts: 'random',
        canvas: 1, // Canvas fingerprint randomization
        webgl_image: 1, // WebGL fingerprint randomization
        webgl: 1,
        audio: 1, // Audio context fingerprint
        do_not_track: 0,
        hardware_concurrency: 'random',
        device_memory: 'random',
        client_rects: 1,
        random_ua: 1
      },
      
      // Additional settings
      clear_cache_file_on_close: 0, // Keep cookies between sessions
      random_finger_fingerprint: 1
    };

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/v1/user/create`,
        profileConfig
      );

      if (response.data.code === 0) {
        console.log(`✅ Created AdsPower profile: ${username} (ID: ${response.data.data.id})`);
        return {
          success: true,
          profileId: response.data.data.id
        };
      } else {
        throw new Error(`AdsPower API error: ${response.data.msg}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create profile for ${username}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Launch a browser profile and return Puppeteer instance
   */
  async launchProfile(profileId, options = {}) {
    try {
      // Check if already running
      if (this.activeProfiles.has(profileId)) {
        console.log(`ℹ️  Profile ${profileId} is already running`);
        return this.activeProfiles.get(profileId);
      }

      // Start the browser via AdsPower
      const response = await axios.get(`${this.apiUrl}/api/v1/browser/start`, {
        params: {
          user_id: profileId,
          open_tabs: options.openTabs || 1,
          launch_args: options.launchArgs || [],
          headless: options.headless || 0
        }
      });

      if (response.data.code === 0) {
        const { ws, debug_port, webdriver } = response.data.data;
        
        // Connect via Chrome DevTools Protocol
        const browser = await puppeteer.connect({
          browserWSEndpoint: ws,
          defaultViewport: null
        });

        // Store the active session
        const session = {
          browser,
          debugPort: debug_port,
          webdriver,
          profileId,
          launchedAt: new Date()
        };

        this.activeProfiles.set(profileId, session);

        console.log(`✅ Launched browser profile: ${profileId}`);
        return session;

      } else {
        throw new Error(`Failed to start browser: ${response.data.msg}`);
      }
    } catch (error) {
      console.error(`❌ Error launching profile ${profileId}:`, error.message);
      throw error;
    }
  }

  /**
   * Close a browser profile
   */
  async closeProfile(profileId) {
    try {
      const session = this.activeProfiles.get(profileId);
      
      if (session) {
        // Disconnect Puppeteer
        await session.browser.disconnect();
      }

      // Stop browser via API
      await axios.get(`${this.apiUrl}/api/v1/browser/stop`, {
        params: { user_id: profileId }
      });

      this.activeProfiles.delete(profileId);
      console.log(`✅ Closed browser profile: ${profileId}`);

      return { success: true };
    } catch (error) {
      console.error(`❌ Error closing profile ${profileId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a browser profile permanently
   */
  async deleteProfile(profileId) {
    try {
      // Close if running
      if (this.activeProfiles.has(profileId)) {
        await this.closeProfile(profileId);
      }

      // Delete via API
      const response = await axios.post(`${this.apiUrl}/api/v1/user/delete`, {
        user_ids: [profileId]
      });

      if (response.data.code === 0) {
        console.log(`✅ Deleted AdsPower profile: ${profileId}`);
        return { success: true };
      } else {
        throw new Error(response.data.msg);
      }
    } catch (error) {
      console.error(`❌ Error deleting profile ${profileId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get active page from browser session
   */
  async getPage(profileId) {
    const session = this.activeProfiles.get(profileId);
    if (!session) {
      throw new Error(`Profile ${profileId} is not running`);
    }

    const pages = await session.browser.pages();
    if (pages.length === 0) {
      return await session.browser.newPage();
    }

    return pages[0];
  }

  /**
   * Check if profile is currently running
   */
  isProfileActive(profileId) {
    return this.activeProfiles.has(profileId);
  }

  /**
   * Get all active profiles
   */
  getActiveProfiles() {
    return Array.from(this.activeProfiles.keys());
  }

  /**
   * Close all active profiles
   */
  async closeAllProfiles() {
    console.log(`🔄 Closing ${this.activeProfiles.size} active profiles...`);
    
    const promises = Array.from(this.activeProfiles.keys()).map(profileId => 
      this.closeProfile(profileId)
    );

    await Promise.all(promises);
    console.log(`✅ All profiles closed`);
  }

  /**
   * Get AdsPower group ID based on niche (for organization)
   */
  getGroupIdByNiche(niche) {
    const groupMap = {
      soccer: '0',
      politics: '0',
      gaming: '0',
      drama: '0',
      fitness: '0',
      crypto: '0',
      general: '0'
    };
    return groupMap[niche] || '0';
  }

  /**
   * Update profile proxy
   */
  async updateProxy(profileId, proxy) {
    try {
      const proxyConfig = {
        user_id: profileId,
        user_proxy_config: {
          proxy_soft: 'other',
          proxy_type: proxy.type === 'mobile' ? 'http' : proxy.type,
          proxy_host: proxy.host,
          proxy_port: proxy.port,
          proxy_user: proxy.username,
          proxy_password: proxy.password
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/api/v1/user/update`,
        proxyConfig
      );

      if (response.data.code === 0) {
        console.log(`✅ Updated proxy for profile ${profileId}`);
        return { success: true };
      } else {
        throw new Error(response.data.msg);
      }
    } catch (error) {
      console.error(`❌ Error updating proxy for ${profileId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check AdsPower connection
   */
  async checkConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/status`);
      return response.status === 200;
    } catch (error) {
      console.error('❌ AdsPower is not running or not accessible');
      return false;
    }
  }
}

module.exports = new AdsPowerController();

