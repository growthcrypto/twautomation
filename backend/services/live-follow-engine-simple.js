const twitterSessionManager = require('./twitter-session-manager');

/**
 * SIMPLIFIED Live Follow Engine
 * Just scroll and click follow buttons - no username extraction needed
 */
class SimpleFollowEngine {
  /**
   * Follow users from a community members list (simplified)
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

      let followCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 15;

      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        // Find ALL follow buttons currently visible on screen
        const followButtons = await page.$$('[data-testid="follow"]');
        
        console.log(`📋 Found ${followButtons.length} follow buttons on screen`);

        if (followButtons.length === 0) {
          console.log('⚠️  No follow buttons visible, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        // Click follow buttons one by one with humanization
        for (const button of followButtons) {
          if (followCount >= maxFollows) break;

          try {
            // Check if button is still in viewport and clickable
            const isVisible = await button.isIntersectingViewport();
            if (!isVisible) continue;

            // Random skip (humanization)
            const skipChance = config.randomSkipProbability || 15; // 15% skip
            if (Math.random() * 100 < skipChance) {
              console.log(`👻 Skipping a user randomly (humanization)`);
              continue;
            }

            // Sometimes inspect profile before following
            const shouldInspect = config.inspectProfileProbability || 25; // 25% inspect
            if (Math.random() * 100 < shouldInspect) {
              try {
                console.log(`👀 Inspecting profile before following...`);
                
                // Find the username link near this button
                const parent = await button.evaluateHandle(el => {
                  // Go up to find the user cell
                  let current = el;
                  for (let i = 0; i < 10; i++) {
                    if (!current.parentElement) break;
                    current = current.parentElement;
                    if (current.querySelector('[data-testid="User-Name"]')) {
                      return current.querySelector('[data-testid="User-Name"] a');
                    }
                  }
                  return null;
                });

                if (parent) {
                  await parent.click();
                  await this.humanDelay(2000, 4000);
                  
                  // Read profile
                  const readTime = this.randomBetween(2, 5);
                  console.log(`📖 Reading profile for ${readTime}s...`);
                  await this.humanDelay(readTime * 1000, readTime * 1000);
                  
                  // Maybe like a tweet
                  if (Math.random() * 100 < 15) {
                    try {
                      const likeBtn = await page.$('article [data-testid="like"]');
                      if (likeBtn) {
                        await likeBtn.click();
                        await this.humanDelay(500, 1000);
                        console.log(`💙 Liked recent tweet`);
                      }
                    } catch {}
                  }
                  
                  // Now follow from the profile page
                  const profileFollowBtn = await page.$('[data-testid="follow"]');
                  if (profileFollowBtn) {
                    await profileFollowBtn.click();
                    await this.humanDelay(1000, 1500);
                    followCount++;
                    console.log(`✅ Followed from profile (${followCount}/${maxFollows})`);
                  }
                  
                  // Go back to members list
                  await page.goBack();
                  await this.humanDelay(1500, 3000);
                  
                  // Break to get fresh buttons
                  break;
                }
              } catch (err) {
                // If profile inspection fails, just follow from list
              }
            }

            // Follow directly from the list
            console.log(`👤 Following user...`);
            await button.click();
            await this.humanDelay(1000, 1500);
            
            followCount++;
            console.log(`✅ Followed user (${followCount}/${maxFollows})`);

            // Pause between follows
            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 2,
              config.delayBetweenFollows?.max || 6
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

          } catch (error) {
            console.log(`⚠️  Error clicking button: ${error.message}`);
            continue;
          }
        }

        // Scroll to load more users
        if (followCount < maxFollows) {
          console.log(`📜 Scrolling for more users... (${followCount}/${maxFollows} follows so far)`);
          await this.humanScroll(page);
          await this.humanDelay(1500, 3000);
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
   * Follow users from hashtag feed (simplified)
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

      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        const followButtons = await page.$$('[data-testid="follow"]');
        
        console.log(`📋 Found ${followButtons.length} follow buttons`);

        if (followButtons.length === 0) {
          console.log('⚠️  No follow buttons, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        for (const button of followButtons) {
          if (followCount >= maxFollows) break;

          try {
            const isVisible = await button.isIntersectingViewport();
            if (!isVisible) continue;

            // Random skip
            if (Math.random() * 100 < (config.randomSkipProbability || 15)) {
              console.log(`👻 Skipping randomly`);
              continue;
            }

            console.log(`👤 Following user...`);
            await button.click();
            await this.humanDelay(1000, 1500);
            
            followCount++;
            console.log(`✅ Followed user (${followCount}/${maxFollows})`);

            const pauseTime = this.randomBetween(
              config.delayBetweenFollows?.min || 2,
              config.delayBetweenFollows?.max || 6
            );
            await this.humanDelay(pauseTime * 1000, pauseTime * 1000);

          } catch (error) {
            continue;
          }
        }

        if (followCount < maxFollows) {
          await this.humanScroll(page);
          await this.humanDelay(1500, 3000);
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

module.exports = new SimpleFollowEngine();

