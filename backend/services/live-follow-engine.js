const twitterSessionManager = require('./twitter-session-manager');
const actionCoordinator = require('./action-coordinator');

/**
 * Live Follow Engine
 * Scrolls through members/hashtag feeds and follows in real-time
 * No scraping/storing - just scroll and follow like a human
 */
class LiveFollowEngine {
  constructor() {
    this.followedInSession = new Map(); // accountId -> Set of usernames
  }

  /**
   * Follow users from a community members list (live scrolling)
   */
  async followFromCommunity(accountId, communityId, maxFollows, config = {}) {
    const page = await twitterSessionManager.getPage(accountId);

    try {
      console.log(`📜 Opening community ${communityId} members list...`);

      // Navigate to members page
      await page.goto(`https://twitter.com/i/communities/${communityId}/members`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(2000, 4000);

      // Wait for user cells
      await page.waitForSelector('[data-testid="UserCell"], article', { timeout: 10000 });

      let followCount = 0;
      const sessionKey = accountId.toString();
      if (!this.followedInSession.has(sessionKey)) {
        this.followedInSession.set(sessionKey, new Set());
      }
      const alreadyFollowed = this.followedInSession.get(sessionKey);

      // Keep scrolling and following until we hit max
      let scrollAttempts = 0;
      const maxScrollAttempts = 20; // Prevent infinite loops
      
      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        // Get visible users on screen
        const visibleUsers = await page.$$('[data-testid="UserCell"]');
        
        console.log(`📋 Found ${visibleUsers.length} visible users on screen`);
        
        if (visibleUsers.length === 0) {
          console.log('⚠️  No users visible, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1000, 2000);
          scrollAttempts++;
          continue;
        }

        let processedThisScroll = 0;

        // Process each visible user
        for (const userCell of visibleUsers) {
          if (followCount >= maxFollows) break;

          try {
            // Extract username - try multiple selectors
            let username = null;
            
            // Try selector 1: Standard User-Name testid
            try {
              username = await userCell.$eval('[data-testid="User-Name"] a[href^="/"]', 
                el => el.getAttribute('href').replace(/\//g, ''));
            } catch {}
            
            // Try selector 2: Any link in the cell starting with /
            if (!username) {
              try {
                const links = await userCell.$$('a[href^="/"]');
                for (const link of links) {
                  const href = await link.evaluate(el => el.getAttribute('href'));
                  if (href && !href.includes('/') && href.length > 0) {
                    username = href.replace(/\//g, '');
                    break;
                  }
                  // Get just the username part (first segment)
                  const parts = href.split('/').filter(p => p.length > 0);
                  if (parts.length > 0 && !parts[0].includes('i')) {
                    username = parts[0];
                    break;
                  }
                }
              } catch {}
            }
            
            // Try selector 3: Get the follow button and work backwards
            if (!username) {
              try {
                const followBtn = await userCell.$('[data-testid="follow"]');
                if (followBtn) {
                  // Look for username in aria-label
                  const ariaLabel = await followBtn.evaluate(el => el.getAttribute('aria-label'));
                  if (ariaLabel) {
                    // Extract from "Follow @username"
                    const match = ariaLabel.match(/@(\w+)/);
                    if (match) username = match[1];
                  }
                }
              } catch {}
            }

            if (!username) {
              // Skip this cell silently
              continue;
            }

            // Skip if already followed in this session
            if (alreadyFollowed.has(username)) {
              continue; // Silent skip - already processed
            }

            console.log(`👁️  Checking @${username}...`);

            // Random skip (humanization)
            const skipChance = config.randomSkipProbability || 20; // 20% chance to skip
            if (Math.random() * 100 < skipChance) {
              console.log(`👻 Skipping @${username} randomly (humanization)`);
              alreadyFollowed.add(username); // Mark as seen
              processedThisScroll++;
              continue;
            }

            // Check if follow button is visible in the cell
            const followButton = await userCell.$('[data-testid="follow"]');
            if (!followButton) {
              // Already following or button not found
              console.log(`⏭️  @${username} - already following or no follow button`);
              alreadyFollowed.add(username);
              processedThisScroll++;
              continue;
            }

            // Humanization: Sometimes inspect profile before following
            const shouldInspect = config.inspectProfileProbability || 30; // 30% chance
            if (Math.random() * 100 < shouldInspect) {
              console.log(`👀 Inspecting @${username} profile...`);
              
              // Click username to open profile in same tab
              await userCell.$eval('[data-testid="User-Name"] a', el => el.click());
              await this.humanDelay(2000, 4000);
              
              // Read for a bit
              const readTime = this.randomBetween(2, 6);
              console.log(`📖 Reading profile for ${readTime}s...`);
              await this.humanDelay(readTime * 1000, readTime * 1000);
              
              // Maybe like a tweet while here
              if (Math.random() * 100 < 15) { // 15% chance
                try {
                  const likeBtn = await page.$('article [data-testid="like"]');
                  if (likeBtn) {
                    await likeBtn.click();
                    await this.humanDelay(500, 1000);
                    console.log(`💙 Liked recent tweet`);
                  }
                } catch {}
              }
              
              // Go back to members list
              await page.goBack();
              await this.humanDelay(1500, 3000);
              
              // Re-get the user cells since DOM changed
              break; // Exit loop, will get fresh cells on next iteration
            }

            // Follow directly from the list
            console.log(`👤 Following @${username}...`);
            await followButton.click();
            await this.humanDelay(1000, 2000);
            
            followCount++;
            alreadyFollowed.add(username);
            processedThisScroll++;
            console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);

            // Random pause between follows
            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 3,
              config.delayBetweenFollows?.max || 8
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

          } catch (error) {
            // User cell might have disappeared, skip it
            console.log(`⚠️  Error processing user cell: ${error.message}`);
            continue;
          }
        }

        // If we processed some users but didn't reach the goal, scroll for more
        if (followCount < maxFollows) {
          console.log(`📜 Scrolling for more users... (${followCount}/${maxFollows} follows so far, processed ${processedThisScroll} users this scroll)`);
          await this.humanScroll(page);
          await this.humanDelay(1500, 3000);
          scrollAttempts++;
        }
      }

      if (scrollAttempts >= maxScrollAttempts) {
        console.log(`⚠️  Reached max scroll attempts, stopping (${followCount} follows completed)`);
      }

      return { success: true, followedCount: followCount };

    } catch (error) {
      console.error('Error in live follow from community:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Follow users from hashtag feed (live scrolling)
   */
  async followFromHashtag(accountId, hashtag, maxFollows, config = {}) {
    const page = await twitterSessionManager.getPage(accountId);

    try {
      console.log(`📜 Opening #${hashtag} feed...`);

      const searchQuery = encodeURIComponent(`#${hashtag}`);
      await page.goto(`https://twitter.com/search?q=${searchQuery}&f=live`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(2000, 4000);

      await page.waitForSelector('article', { timeout: 10000 });

      let followCount = 0;
      const sessionKey = accountId.toString();
      if (!this.followedInSession.has(sessionKey)) {
        this.followedInSession.set(sessionKey, new Set());
      }
      const alreadyFollowed = this.followedInSession.get(sessionKey);

      while (followCount < maxFollows) {
        // Get visible tweets
        const tweets = await page.$$('article');
        
        if (tweets.length === 0) {
          console.log('⚠️  No tweets visible');
          break;
        }

        for (const tweet of tweets) {
          if (followCount >= maxFollows) break;

          try {
            // Get username from tweet
            const username = await tweet.$eval('[data-testid="User-Name"] a[href^="/"]', 
              el => el.getAttribute('href').replace('/', ''));

            if (alreadyFollowed.has(username)) continue;

            // Random skip
            if (Math.random() * 100 < (config.randomSkipProbability || 20)) {
              alreadyFollowed.add(username);
              continue;
            }

            // Check for follow button
            const followButton = await tweet.$('[data-testid="follow"]');
            if (!followButton) {
              alreadyFollowed.add(username);
              continue;
            }

            console.log(`👤 Following @${username}...`);
            await followButton.click();
            await this.humanDelay(1000, 2000);
            
            followCount++;
            alreadyFollowed.add(username);
            console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);

            // Pause between follows
            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 3,
              config.delayBetweenFollows?.max || 8
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

          } catch (error) {
            continue;
          }
        }

        // Scroll to load more
        if (followCount < maxFollows) {
          await this.humanScroll(page);
          await this.humanDelay(1500, 3000);
        }
      }

      return { success: true, followedCount: followCount };

    } catch (error) {
      console.error('Error in live follow from hashtag:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Human-like scroll (variable distance)
   */
  async humanScroll(page) {
    const scrollAmount = this.randomBetween(300, 800);
    await page.evaluate((distance) => {
      window.scrollBy({
        top: distance,
        behavior: 'smooth'
      });
    }, scrollAmount);
    await this.humanDelay(800, 1500);
  }

  /**
   * Random delay
   */
  async humanDelay(min, max) {
    const delay = this.randomBetween(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Clear followed users session (for fresh start)
   */
  clearSession(accountId) {
    if (accountId) {
      this.followedInSession.delete(accountId.toString());
      console.log(`🗑️  Cleared follow session cache for account ${accountId}`);
    } else {
      this.followedInSession.clear();
      console.log(`🗑️  Cleared all follow session caches`);
    }
  }

  /**
   * Get session stats
   */
  getSessionStats(accountId) {
    const sessionKey = accountId.toString();
    if (this.followedInSession.has(sessionKey)) {
      const followed = this.followedInSession.get(sessionKey);
      return {
        totalProcessed: followed.size,
        usernames: Array.from(followed)
      };
    }
    return { totalProcessed: 0, usernames: [] };
  }
}

module.exports = new LiveFollowEngine();

