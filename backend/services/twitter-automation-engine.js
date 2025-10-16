const twitterSessionManager = require('./twitter-session-manager');
const { TwitterLead } = require('../models');

/**
 * Twitter Automation Engine
 * Direct browser control for all Twitter actions
 * NO EXTENSIONS - Pure Puppeteer automation
 */
class TwitterAutomationEngine {
  constructor() {
    this.activeActions = new Map(); // Track running actions per account
    this.scrapedUsersCache = new Map(); // Cache scraped users: key -> { users, timestamp }
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL
    
    // Cleanup stale cache every 15 minutes
    setInterval(() => {
      this.cleanupStaleCache();
    }, 15 * 60 * 1000);
  }

  /**
   * Cleanup stale cache entries
   */
  cleanupStaleCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.scrapedUsersCache) {
      if (now - data.timestamp > this.CACHE_TTL) {
        this.scrapedUsersCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} stale scraping cache entries (${this.scrapedUsersCache.size} remaining)`);
    }
  }

  // ============================================
  // HUMANIZATION FEATURES
  // ============================================

  /**
   * Random scrolling with human patterns (not uniform)
   */
  async humanScroll(page) {
    const scrollPatterns = [
      // Slow scroll down
      async () => {
        const scrolls = this.randomBetween(2, 4);
        for (let i = 0; i < scrolls; i++) {
          await page.evaluate(() => window.scrollBy(0, Math.random() * 200 + 100));
          await this.humanDelay(800, 1500);
        }
      },
      // Quick scroll down then pause
      async () => {
        await page.evaluate(() => window.scrollBy(0, Math.random() * 400 + 200));
        await this.humanDelay(2000, 4000);
      },
      // Scroll down, read, scroll back up a bit
      async () => {
        await page.evaluate(() => window.scrollBy(0, Math.random() * 300 + 150));
        await this.humanDelay(1500, 3000);
        await page.evaluate(() => window.scrollBy(0, -50));
        await this.humanDelay(500, 1000);
      }
    ];
    
    const pattern = scrollPatterns[Math.floor(Math.random() * scrollPatterns.length)];
    await pattern();
  }

  /**
   * Read tweets (pause while looking at content)
   */
  async readContent(page, minSeconds = 3, maxSeconds = 8) {
    const readTime = this.randomBetween(minSeconds * 1000, maxSeconds * 1000);
    console.log(`📖 Reading content for ${(readTime / 1000).toFixed(1)}s...`);
    await this.humanDelay(readTime, readTime + 500);
  }

  /**
   * Move mouse around randomly (looks more human)
   */
  async randomMouseMovement(page) {
    const movements = this.randomBetween(2, 5);
    for (let i = 0; i < movements; i++) {
      const x = this.randomBetween(100, 800);
      const y = this.randomBetween(100, 600);
      await page.mouse.move(x, y, { steps: this.randomBetween(10, 30) });
      await this.humanDelay(50, 200);
    }
  }

  /**
   * Occasionally visit home feed (looks natural)
   */
  async maybeVisitHomeFeed(page, probability = 15) {
    if (Math.random() * 100 < probability) {
      console.log(`🏠 Checking home feed (looks natural)...`);
      await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
      await this.humanScroll(page);
      await this.readContent(page, 5, 10);
      return true;
    }
    return false;
  }

  /**
   * Random pause to "think" (makes timing less predictable)
   */
  async randomThinkingPause() {
    if (Math.random() * 100 < 20) { // 20% chance
      const pauseTime = this.randomBetween(2000, 5000);
      console.log(`🤔 Thinking... (${(pauseTime / 1000).toFixed(1)}s pause)`);
      await this.humanDelay(pauseTime, pauseTime + 500);
    }
  }

  /**
   * Read profile bio and tweets before following
   */
  async inspectProfileBeforeFollow(page) {
    console.log(`👀 Inspecting profile...`);
    
    // Scroll down to see bio and tweets
    await this.humanScroll(page);
    
    // Read for a bit (like a real person deciding whether to follow)
    await this.readContent(page, 3, 6);
    
    // Maybe scroll back up
    if (Math.random() > 0.5) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await this.humanDelay(500, 1000);
    }
  }

  // ============================================
  // FOLLOW/UNFOLLOW ACTIONS
  // ============================================

  /**
   * Follow a user
   */
  async follow(accountId, targetUsername, config = {}) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      console.log(`👤 Following @${targetUsername}...`);

      // Maybe visit home feed first (15% chance - looks natural)
      await this.maybeVisitHomeFeed(page, 15);

      // Navigate to target profile
      await page.goto(`https://twitter.com/${targetUsername}`, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      await this.humanDelay(2000, 4000);

      // Random mouse movements (looks more human)
      await this.randomMouseMovement(page);

      // Inspect profile before following (looks human)
      if (Math.random() > 0.3) { // 70% chance
        await this.inspectProfileBeforeFollow(page);
      }

      // Random thinking pause
      await this.randomThinkingPause();

      // Check if already following
      const alreadyFollowing = await page.$('[data-testid*="unfollow"]');
      if (alreadyFollowing) {
        console.log(`⚠️  Already following @${targetUsername}`);
        return { success: false, reason: 'already_following' };
      }

      // Check filters
      if (config.skipIfPrivate) {
        const isPrivate = await this.isAccountPrivate(page);
        if (isPrivate) {
          console.log(`🔒 Skipping @${targetUsername} (private account)`);
          return { success: false, reason: 'private_account' };
        }
      }

      if (config.skipIfNoProfilePic) {
        const hasProfilePic = await this.hasProfilePicture(page);
        if (!hasProfilePic) {
          console.log(`👤 Skipping @${targetUsername} (no profile pic)`);
          return { success: false, reason: 'no_profile_pic' };
        }
      }

      // Get follow button
      const followBtn = await page.$('[data-testid$="follow"]');
      if (!followBtn) {
        throw new Error('Follow button not found');
      }

      // Random activity: like a recent tweet (if configured)
      if (config.randomActivity?.likeTargetProfile?.enabled) {
        const shouldLike = Math.random() * 100 < config.randomActivity.likeTargetProfile.probability;
        if (shouldLike) {
          await this.likeRecentTweet(page);
        }
      }

      // Click follow
      await followBtn.click();
      await this.humanDelay(1000, 2000);

      console.log(`✅ Successfully followed @${targetUsername}`);

      return { success: true, targetUsername };

    } catch (error) {
      console.error(`❌ Error following @${targetUsername}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unfollow a user
   */
  async unfollow(accountId, targetUsername) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      console.log(`👋 Unfollowing @${targetUsername}...`);

      await page.goto(`https://twitter.com/${targetUsername}`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(2000, 3000);

      // Click unfollow button
      const unfollowBtn = await page.$('[data-testid*="unfollow"]');
      if (!unfollowBtn) {
        return { success: false, reason: 'not_following' };
      }

      await unfollowBtn.click();
      await this.humanDelay(500, 1000);

      // Confirm unfollow
      const confirmBtn = await page.$('[data-testid="confirmationSheetConfirm"]');
      if (confirmBtn) {
        await confirmBtn.click();
        await this.humanDelay(1000, 2000);
      }

      console.log(`✅ Successfully unfollowed @${targetUsername}`);

      return { success: true, targetUsername };

    } catch (error) {
      console.error(`❌ Error unfollowing @${targetUsername}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user followed back
   */
  async checkFollowBack(accountId, targetUsername) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      await page.goto(`https://twitter.com/${targetUsername}`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Check if "Follows you" badge exists
      const followsYouBadge = await page.$('[data-testid="userFollowIndicator"]');
      
      return { 
        success: true, 
        followsBack: !!followsYouBadge 
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DM ACTIONS
  // ============================================

  /**
   * Send a DM
   */
  async sendDM(accountId, targetUsername, message, config = {}) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      console.log(`💬 Sending DM to @${targetUsername}...`);

      // Random activity before DM (if configured)
      if (config.randomActivity?.viewProfile?.enabled) {
        const shouldView = Math.random() * 100 < config.randomActivity.viewProfile.probability;
        if (shouldView) {
          await this.viewProfile(page, targetUsername, config.randomActivity.viewProfile.scrollTime);
        }
      }

      if (config.randomActivity?.likeRecentTweet?.enabled) {
        const shouldLike = Math.random() * 100 < config.randomActivity.likeRecentTweet.probability;
        if (shouldLike) {
          await page.goto(`https://twitter.com/${targetUsername}`, { waitUntil: 'networkidle2' });
          await this.likeRecentTweet(page);
        }
      }

      // Navigate to messages
      await page.goto('https://twitter.com/messages', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(2000, 3000);

      // Click "New message"
      const newMsgBtn = await page.$('[data-testid="NewDM_Button"]');
      if (newMsgBtn) {
        await newMsgBtn.click();
        await this.humanDelay(1000, 2000);
      }

      // Search for user
      const searchInput = await page.$('[data-testid="searchPeople"]');
      if (searchInput) {
        await this.typeHuman(page, searchInput, targetUsername);
        await this.humanDelay(1500, 2500);

        // Click on the user
        const userOption = await page.$('[data-testid="TypeaheadUser"]');
        if (userOption) {
          await userOption.click();
          await this.humanDelay(500, 1000);
        }
      }

      // Type message with typing simulation
      const messageBox = await page.$('[data-testid="dmComposerTextInput"]');
      if (messageBox) {
        // Simulate typing delay (based on config)
        if (config.typingSimulation?.enabled) {
          const wpm = config.typingSimulation.wordsPerMinute || 60;
          const wordsInMessage = message.split(' ').length;
          const typingTime = (wordsInMessage / wpm) * 60 * 1000; // ms

          await this.typeHuman(page, messageBox, message, typingTime / message.length);
        } else {
          await this.typeHuman(page, messageBox, message);
        }

        await this.humanDelay(1000, 2000);

        // Send
        const sendBtn = await page.$('[data-testid="dmComposerSendButton"]');
        if (sendBtn) {
          await sendBtn.click();
          await this.humanDelay(1000, 2000);
        }
      }

      console.log(`✅ DM sent to @${targetUsername}`);

      return { success: true, targetUsername, message };

    } catch (error) {
      console.error(`❌ Error sending DM to @${targetUsername}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for new DMs
   */
  async checkNewDMs(accountId) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      await page.goto('https://twitter.com/messages', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(2000, 3000);

      // Get conversation list
      const conversations = await page.$$('[data-testid="conversation"]');

      const newMessages = [];

      for (const conv of conversations.slice(0, 10)) { // Check first 10
        try {
          // Check if unread
          const hasUnread = await conv.$('[data-testid="unreadBadge"]');
          if (!hasUnread) continue;

          // Click conversation
          await conv.click();
          await this.humanDelay(1500, 2500);

          // Get username
          const usernameEl = await page.$('[data-testid="UserName"]');
          const username = usernameEl ? await page.evaluate(el => el.textContent, usernameEl) : 'Unknown';

          // Get last message
          const messages = await page.$$('[data-testid="messageEntry"]');
          const lastMessage = messages[messages.length - 1];
          const messageText = lastMessage ? await page.evaluate(el => el.textContent, lastMessage) : '';

          newMessages.push({
            username: username.replace('@', ''),
            message: messageText,
            timestamp: new Date()
          });

          // Go back to conversation list
          await page.goBack();
          await this.humanDelay(1000, 2000);

        } catch (error) {
          console.error('Error processing conversation:', error.message);
          continue;
        }
      }

      return { success: true, messages: newMessages };

    } catch (error) {
      console.error('Error checking DMs:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reply to a DM
   */
  async replyToDM(accountId, targetUsername, message, config = {}) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      // Navigate to messages
      await page.goto('https://twitter.com/messages', { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      // Find conversation with user
      const conversations = await page.$$('[data-testid="conversation"]');
      
      let foundConversation = false;
      for (const conv of conversations) {
        const text = await page.evaluate(el => el.textContent, conv);
        if (text.includes(targetUsername)) {
          await conv.click();
          await this.humanDelay(1500, 2500);
          foundConversation = true;
          break;
        }
      }

      if (!foundConversation) {
        throw new Error(`Conversation with @${targetUsername} not found`);
      }

      // Simulate thinking pause (if configured)
      if (config.typingSimulation?.pauseForThinking?.enabled) {
        const shouldPause = Math.random() * 100 < config.typingSimulation.pauseForThinking.probability;
        if (shouldPause) {
          const pauseDuration = this.randomBetween(
            config.typingSimulation.pauseForThinking.duration.min * 1000,
            config.typingSimulation.pauseForThinking.duration.max * 1000
          );
          await this.humanDelay(pauseDuration, pauseDuration);
        }
      }

      // Type message
      const messageBox = await page.$('[data-testid="dmComposerTextInput"]');
      if (messageBox) {
        await this.typeHuman(page, messageBox, message);
        await this.humanDelay(1000, 2000);

        const sendBtn = await page.$('[data-testid="dmComposerSendButton"]');
        if (sendBtn) {
          await sendBtn.click();
        }
      }

      console.log(`✅ Replied to @${targetUsername}`);

      return { success: true };

    } catch (error) {
      console.error(`Error replying to @${targetUsername}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // SCRAPING ACTIONS
  // ============================================

  /**
   * Scrape community members (with caching)
   */
  async scrapeCommunityMembers(accountId, communityId, limit = 50) {
    try {
      const cacheKey = `community:${communityId}`;
      const cached = this.scrapedUsersCache.get(cacheKey);
      
      // Check cache first
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`📦 Using cached users for community ${communityId} (${cached.users.length} users, ${Math.floor((Date.now() - cached.timestamp) / 1000 / 60)}min old)`);
        
        const shuffled = [...cached.users].sort(() => 0.5 - Math.random());
        return { success: true, usernames: shuffled.slice(0, limit), cached: true };
      }

      // Scrape fresh
      const page = await twitterSessionManager.getPage(accountId);

      console.log(`🔍 Scraping community ${communityId} (fresh)...`);

      // Navigate to community MEMBERS page
      await page.goto(`https://twitter.com/i/communities/${communityId}/members`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(3000, 5000);

      // Wait for user cells to appear
      try {
        await page.waitForSelector('[data-testid="UserCell"]', { timeout: 10000 });
      } catch {
        console.log('⚠️  No users found on members page, trying alternative selectors...');
      }

      // Scroll and collect usernames
      const usernames = new Set();
      let scrolls = 0;
      const maxScrolls = Math.ceil((limit * 3) / 10); // Scrape 3x more for cache

      while (usernames.size < limit * 3 && scrolls < maxScrolls) {
        // Try multiple selectors (Twitter changes these frequently)
        let users = [];
        
        try {
          // Method 1: UserCell with User-Name
          users = await page.$$eval('[data-testid="UserCell"] [data-testid="User-Name"] a[href^="/"]', links =>
            links.map(link => link.getAttribute('href').replace('/', ''))
              .filter(username => username && !username.includes('/') && !username.includes('?'))
          );
        } catch (e) {
          console.log('⚠️  UserCell selector failed, trying alternative...');
        }

        // Method 2: Try cellInnerDiv (alternative structure)
        if (users.length === 0) {
          try {
            users = await page.$$eval('[data-testid="cellInnerDiv"] a[href^="/"][role="link"]', links =>
              links.map(link => {
                const href = link.getAttribute('href');
                const match = href.match(/^\/([^\/\?]+)/);
                return match ? match[1] : null;
              })
              .filter(username => username && 
                                  !username.startsWith('i/') && 
                                  !username.startsWith('hashtag/') &&
                                  !username.startsWith('search'))
            );
          } catch (e) {
            console.log('⚠️  Alternative selector also failed');
          }
        }

        console.log(`📝 Found ${users.length} users on page (scroll ${scrolls + 1}/${maxScrolls})`);
        users.forEach(u => usernames.add(u));

        // Human-like scrolling (not uniform)
        await this.humanScroll(page);

        scrolls++;
        
        // If we haven't found any users after 3 scrolls, something is wrong
        if (scrolls >= 3 && usernames.size === 0) {
          console.log('⚠️  No users found after 3 scrolls, page may have different structure');
          break;
        }
      }

      const allUsers = Array.from(usernames);

      // If no users found from /members, try the main community page
      if (allUsers.length === 0) {
        console.log('⚠️  Members page returned 0 users, trying main community feed...');
        
        await page.goto(`https://twitter.com/i/communities/${communityId}`, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        await this.humanDelay(2000, 3000);
        
        // Try to get users from tweet authors
        for (let i = 0; i < 3; i++) {
          const tweetAuthors = await page.$$eval('article [data-testid="User-Name"] a[href^="/"]', links =>
            links.map(link => link.getAttribute('href').replace('/', ''))
              .filter(username => username && !username.includes('/'))
          );
          
          tweetAuthors.forEach(u => usernames.add(u));
          console.log(`📝 Found ${tweetAuthors.length} users from feed (scroll ${i + 1}/3)`);
          
          await this.humanScroll(page);
          await this.humanDelay(1000, 2000);
        }
      }

      const finalUsers = Array.from(usernames);

      // Cache the results (even if empty, to avoid repeated scraping)
      this.scrapedUsersCache.set(cacheKey, {
        users: finalUsers,
        timestamp: Date.now()
      });

      if (finalUsers.length === 0) {
        console.log(`⚠️  Scraped 0 users from community ${communityId} - check if community exists or is accessible`);
      } else {
        console.log(`✅ Scraped ${finalUsers.length} users from community (cached for 1 hour)`);
      }

      const shuffled = [...finalUsers].sort(() => 0.5 - Math.random());
      return { success: true, usernames: shuffled.slice(0, limit), cached: false };

    } catch (error) {
      console.error('Error scraping community:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Scrape hashtag users (with caching)
   */
  async scrapeHashtagUsers(accountId, hashtag, limit = 50) {
    try {
      const cacheKey = `hashtag:${hashtag}`;
      const cached = this.scrapedUsersCache.get(cacheKey);
      
      // Check cache first
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`📦 Using cached users for #${hashtag} (${cached.users.length} users, ${Math.floor((Date.now() - cached.timestamp) / 1000 / 60)}min old)`);
        
        // Return random sample from cache
        const shuffled = [...cached.users].sort(() => 0.5 - Math.random());
        return { success: true, usernames: shuffled.slice(0, limit), cached: true };
      }

      // Scrape fresh
      const page = await twitterSessionManager.getPage(accountId);

      console.log(`🔍 Scraping hashtag #${hashtag} (fresh)...`);

      const searchQuery = encodeURIComponent(`#${hashtag}`);
      await page.goto(`https://twitter.com/search?q=${searchQuery}&f=live`, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await this.humanDelay(3000, 5000);
      
      // Wait for tweets to load
      try {
        await page.waitForSelector('article', { timeout: 10000 });
      } catch {
        console.log('⚠️  No tweets found for hashtag');
      }

      const usernames = new Set();
      let scrolls = 0;
      const maxScrolls = Math.ceil((limit * 3) / 10); // Scrape 3x more for cache

      while (usernames.size < limit * 3 && scrolls < maxScrolls) {
        // Extract usernames from tweets (improved selector)
        const users = await page.$$eval('article [data-testid="User-Name"] a[href^="/"]', links =>
          links.map(link => link.getAttribute('href').replace('/', ''))
            .filter(username => username && !username.includes('/') && !username.includes('?'))
        );

        console.log(`📝 Found ${users.length} users from tweets (scroll ${scrolls + 1}/${maxScrolls})`);
        users.forEach(u => usernames.add(u));

        // Human-like scrolling (not uniform)
        await this.humanScroll(page);

        scrolls++;
        
        // If no users after 3 scrolls, stop trying
        if (scrolls >= 3 && usernames.size === 0) {
          console.log(`⚠️  No users found for hashtag #${hashtag} after 3 scrolls`);
          break;
        }
      }

      const allUsers = Array.from(usernames);

      // Cache the results
      this.scrapedUsersCache.set(cacheKey, {
        users: allUsers,
        timestamp: Date.now()
      });

      console.log(`✅ Scraped ${allUsers.length} users from #${hashtag} (cached for 1 hour)`);

      // Return random sample
      const shuffled = [...allUsers].sort(() => 0.5 - Math.random());
      return { success: true, usernames: shuffled.slice(0, limit), cached: false };

    } catch (error) {
      console.error('Error scraping hashtag:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Scrape followers of an account
   */
  async scrapeFollowers(accountId, targetUsername, limit = 50) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      await page.goto(`https://twitter.com/${targetUsername}/followers`, { 
        waitUntil: 'networkidle2' 
      });
      await this.humanDelay(3000, 5000);

      const usernames = new Set();
      let scrolls = 0;
      const maxScrolls = Math.ceil(limit / 10);

      while (usernames.size < limit && scrolls < maxScrolls) {
        const users = await page.$$eval('[data-testid="UserCell"] a[href^="/"]', links =>
          links.map(link => link.getAttribute('href').replace('/', ''))
            .filter(username => !username.includes('/'))
        );

        users.forEach(u => usernames.add(u));

        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.humanDelay(2000, 4000);

        scrolls++;
      }

      const result = Array.from(usernames).slice(0, limit);

      return { success: true, usernames: result };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // ENGAGEMENT ACTIONS
  // ============================================

  /**
   * Like a tweet
   */
  async like(accountId, tweetUrl) {
    try {
      const page = await twitterSessionManager.getPage(accountId);

      await page.goto(tweetUrl, { waitUntil: 'networkidle2' });
      await this.humanDelay(2000, 3000);

      const likeBtn = await page.$('[data-testid="like"]');
      if (likeBtn) {
        await likeBtn.click();
        await this.humanDelay(500, 1000);
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Like recent tweet from profile page
   */
  async likeRecentTweet(page) {
    try {
      // Find first like button
      const likeBtn = await page.$('[data-testid="like"]');
      if (likeBtn) {
        await likeBtn.click();
        await this.humanDelay(500, 1000);
        console.log(`💙 Liked recent tweet`);
      }
    } catch (error) {
      console.log('Could not like recent tweet:', error.message);
    }
  }

  // ============================================
  // RANDOM ACTIVITY
  // ============================================

  /**
   * View profile (human-like scrolling)
   */
  async viewProfile(page, username, scrollTimeConfig = {}) {
    try {
      const scrollTime = this.randomBetween(
        (scrollTimeConfig.min || 2) * 1000,
        (scrollTimeConfig.max || 8) * 1000
      );

      await page.goto(`https://twitter.com/${username}`, { waitUntil: 'networkidle2' });
      await this.humanDelay(1000, 2000);

      // Scroll slowly
      const scrolls = Math.floor(scrollTime / 1000);
      for (let i = 0; i < scrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
        await this.humanDelay(800, 1500);
      }

      console.log(`👀 Viewed profile @${username} for ${scrollTime / 1000}s`);

    } catch (error) {
      console.log('Error viewing profile:', error.message);
    }
  }

  /**
   * Scroll feed
   */
  async scrollFeed(page, durationSeconds = 60) {
    try {
      await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
      
      const scrolls = Math.floor(durationSeconds / 3);
      for (let i = 0; i < scrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 300));
        await this.humanDelay(2000, 4000);

        // Randomly stop to "read"
        if (Math.random() < 0.3) {
          await this.humanDelay(5000, 10000);
        }
      }

      console.log(`📜 Scrolled feed for ${durationSeconds}s`);

    } catch (error) {
      console.log('Error scrolling feed:', error.message);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async isAccountPrivate(page) {
    try {
      const privateIndicator = await page.$('[data-testid="privateAccountIcon"]');
      return !!privateIndicator;
    } catch {
      return false;
    }
  }

  async hasProfilePicture(page) {
    try {
      const avatar = await page.$('[data-testid="UserAvatar-Container-unknown"]');
      return !avatar; // If "unknown" avatar exists, they don't have a custom pic
    } catch {
      return true;
    }
  }

  async typeHuman(page, element, text, delayPerChar = null) {
    await element.click();
    await this.humanDelay(100, 300);

    for (const char of text) {
      const delay = delayPerChar || (Math.floor(Math.random() * 100) + 50);
      await element.type(char, { delay });
    }
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async humanDelay(min, max) {
    const delay = this.randomBetween(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Clear scraping cache (useful when scrapers return 0 users)
   */
  clearScrapingCache() {
    const count = this.scrapedUsersCache.size;
    this.scrapedUsersCache.clear();
    console.log(`🧹 Cleared scraping cache (${count} entries removed)`);
    return { cleared: count };
  }
}

module.exports = new TwitterAutomationEngine();

