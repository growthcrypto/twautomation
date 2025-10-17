const twitterSessionManager = require('./twitter-session-manager');

/**
 * Live Follow Engine - WORKING VERSION
 * Goes into each profile to follow (like the old system that worked)
 */
class WorkingFollowEngine {
  /**
   * Follow users from community members list by visiting profiles
   */
  async followFromCommunity(accountId, communityId, maxFollows, config = {}) {
    const page = await twitterSessionManager.getPage(accountId);

    try {
      console.log(`📜 Opening community ${communityId} members list...`);

      await page.goto(`https://twitter.com/i/communities/${communityId}/members`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.humanDelay(2000, 4000);

      let followCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 15;
      const processedUsers = new Set(); // Track who we've already tried

      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        // Find all user cells
        const userCells = await page.$$('[data-testid="UserCell"]');
        
        console.log(`📋 Found ${userCells.length} user cells on screen`);

        if (userCells.length === 0) {
          console.log('⚠️  No user cells visible, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        // Process each user cell
        let processedThisRound = 0;
        for (const userCell of userCells) {
          if (followCount >= maxFollows) break;

          try {
            // Try to get username from the cell
            let username = null;
            try {
              const usernameLink = await userCell.$('[data-testid="User-Name"] a[href^="/"]');
              if (usernameLink) {
                const href = await usernameLink.evaluate(el => el.getAttribute('href'));
                username = href.replace('/', '').split('/')[0];
              }
            } catch {}

            // If we can't get username, try to get any link
            if (!username) {
              try {
                const links = await userCell.$$('a[href^="/"]');
                for (const link of links) {
                  const href = await link.evaluate(el => el.getAttribute('href'));
                  const parts = href.split('/').filter(p => p && p !== 'i');
                  if (parts.length > 0 && !parts[0].includes('communities')) {
                    username = parts[0];
                    break;
                  }
                }
              } catch {}
            }

            if (!username) {
              continue; // Skip if we can't identify the user
            }

            // Skip if already processed
            if (processedUsers.has(username)) {
              continue;
            }

            console.log(`👁️  Found @${username}`);
            processedUsers.add(username);
            processedThisRound++;

            // Random skip (humanization)
            const skipChance = config.randomSkipProbability || 20;
            if (Math.random() * 100 < skipChance) {
              console.log(`👻 Skipping @${username} randomly (humanization)`);
              continue;
            }

            // Click on username to go to their profile
            console.log(`👤 Opening @${username} profile...`);
            const usernameLink = await userCell.$('[data-testid="User-Name"] a, a[href^="/"]');
            if (!usernameLink) {
              console.log(`⚠️  No link found for @${username}`);
              continue;
            }

            await usernameLink.click();
            await this.humanDelay(2000, 4000);

            // Wait for profile to load
            await page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 10000 }).catch(() => {});
            await this.humanDelay(1000, 2000);

            // Read profile for a bit (humanization)
            const readTime = this.randomBetween(2, 5);
            console.log(`📖 Reading @${username} profile for ${readTime}s...`);
            await this.humanDelay(readTime * 1000, readTime * 1000);

            // Maybe scroll down a bit on their profile
            if (Math.random() > 0.5) {
              await this.humanScroll(page);
              await this.humanDelay(500, 1000);
            }

            // Maybe like a tweet (15% chance)
            if (Math.random() * 100 < 15) {
              try {
                const likeBtn = await page.$('article [data-testid="like"]');
                if (likeBtn) {
                  await likeBtn.click();
                  await this.humanDelay(500, 1000);
                  console.log(`💙 Liked recent tweet from @${username}`);
                }
              } catch {}
            }

            // Now follow from the profile
            const followButton = await page.$('[data-testid="follow"]');
            if (followButton) {
              console.log(`✅ Following @${username}...`);
              await followButton.click();
              await this.humanDelay(1000, 2000);
              followCount++;
              console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);
            } else {
              console.log(`⏭️  @${username} - already following or no follow button`);
            }

            // Go back to members list
            console.log(`⬅️  Returning to members list...`);
            await page.goBack();
            await this.humanDelay(2000, 3000);

            // Wait for list to load again
            await page.waitForSelector('[data-testid="UserCell"]', { timeout: 5000 }).catch(() => {});

            // Random pause between follows
            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 3,
              config.delayBetweenFollows?.max || 8
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

            // Break to get fresh cells after navigation
            break;

          } catch (error) {
            console.log(`⚠️  Error processing user: ${error.message}`);
            // Try to get back to members list if we're lost
            try {
              await page.goto(`https://twitter.com/i/communities/${communityId}/members`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
              });
              await this.humanDelay(2000, 3000);
            } catch {}
            continue;
          }
        }

        // Scroll for more users if needed
        if (followCount < maxFollows && processedThisRound > 0) {
          console.log(`📜 Scrolling for more users... (${followCount}/${maxFollows} follows so far)`);
          await this.humanScroll(page);
          await this.humanDelay(2000, 3000);
          scrollAttempts++;
        } else if (processedThisRound === 0) {
          console.log(`⚠️  No new users found, scrolling...`);
          await this.humanScroll(page);
          await this.humanDelay(2000, 3000);
          scrollAttempts++;
        }
      }

      if (scrollAttempts >= maxScrollAttempts) {
        console.log(`⚠️  Reached max scroll attempts (${followCount} follows completed)`);
      }

      return { success: true, followedCount: followCount };

    } catch (error) {
      console.error('Error in live follow from community:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Follow users from hashtag feed (visit profiles)
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

      let followCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 15;
      const processedUsers = new Set();

      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        const tweets = await page.$$('article');
        
        console.log(`📋 Found ${tweets.length} tweets`);

        if (tweets.length === 0) {
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        for (const tweet of tweets) {
          if (followCount >= maxFollows) break;

          try {
            // Get username from tweet
            const usernameLink = await tweet.$('[data-testid="User-Name"] a[href^="/"]');
            if (!usernameLink) continue;

            const href = await usernameLink.evaluate(el => el.getAttribute('href'));
            const username = href.replace('/', '').split('/')[0];

            if (processedUsers.has(username)) continue;
            
            console.log(`👁️  Found @${username}`);
            processedUsers.add(username);

            // Random skip
            if (Math.random() * 100 < (config.randomSkipProbability || 20)) {
              console.log(`👻 Skipping @${username} randomly`);
              continue;
            }

            // Go to profile
            console.log(`👤 Opening @${username} profile...`);
            await usernameLink.click();
            await this.humanDelay(2000, 4000);

            // Read profile
            const readTime = this.randomBetween(2, 4);
            console.log(`📖 Reading profile for ${readTime}s...`);
            await this.humanDelay(readTime * 1000, readTime * 1000);

            // Follow
            const followButton = await page.$('[data-testid="follow"]');
            if (followButton) {
              console.log(`✅ Following @${username}...`);
              await followButton.click();
              await this.humanDelay(1000, 2000);
              followCount++;
              console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);
            } else {
              console.log(`⏭️  @${username} - already following`);
            }

            // Go back
            await page.goBack();
            await this.humanDelay(2000, 3000);

            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 3,
              config.delayBetweenFollows?.max || 8
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

            break; // Get fresh tweets

          } catch (error) {
            console.log(`⚠️  Error: ${error.message}`);
            continue;
          }
        }

        if (followCount < maxFollows) {
          await this.humanScroll(page);
          await this.humanDelay(2000, 3000);
          scrollAttempts++;
        }
      }

      return { success: true, followedCount: followCount };

    } catch (error) {
      console.error('Error in live follow from hashtag:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Human-like scroll
   */
  async humanScroll(page) {
    const scrollAmount = this.randomBetween(400, 900);
    await page.evaluate((distance) => {
      window.scrollBy({
        top: distance,
        behavior: 'smooth'
      });
    }, scrollAmount);
    await this.humanDelay(500, 1200);
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
}

module.exports = new WorkingFollowEngine();

