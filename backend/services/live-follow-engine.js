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
      while (followCount < maxFollows) {
        // Get visible users on screen
        const visibleUsers = await page.$$('[data-testid="UserCell"]');
        
        if (visibleUsers.length === 0) {
          console.log('⚠️  No more users visible, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1000, 2000);
          continue;
        }

        // Process each visible user
        for (const userCell of visibleUsers) {
          if (followCount >= maxFollows) break;

          try {
            // Extract username
            const username = await userCell.$eval('[data-testid="User-Name"] a[href^="/"]', 
              el => el.getAttribute('href').replace('/', ''));

            // Skip if already followed in this session
            if (alreadyFollowed.has(username)) continue;

            // Random skip (humanization)
            const skipChance = config.randomSkipProbability || 20; // 20% chance to skip
            if (Math.random() * 100 < skipChance) {
              console.log(`👻 Skipping @${username} randomly (humanization)`);
              alreadyFollowed.add(username); // Mark as seen
              continue;
            }

            // Check if follow button is visible in the cell
            const followButton = await userCell.$('[data-testid="follow"]');
            if (!followButton) {
              // Already following or button not found
              alreadyFollowed.add(username);
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
            console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);

            // Random pause between follows
            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 3,
              config.delayBetweenFollows?.max || 8
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

          } catch (error) {
            // User cell might have disappeared, skip it
            continue;
          }
        }

        // Scroll to load more users
        if (followCount < maxFollows) {
          await this.humanScroll(page);
          await this.humanDelay(1500, 3000);
        }
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
    this.followedInSession.delete(accountId.toString());
  }
}

module.exports = new LiveFollowEngine();

