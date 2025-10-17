const twitterSessionManager = require('./twitter-session-manager');

/**
 * FIXED Live Follow Engine
 * Finds follow buttons in the list properly
 */
class FixedFollowEngine {
  /**
   * Follow users from community members list (FIXED)
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
      const processedInSession = new Set();

      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        console.log(`🔍 Looking for users to follow...`);

        // Find ALL buttons on the page with various selectors
        const allButtons = await page.evaluate(() => {
          const buttons = [];
          
          // Find all divs with role="button" that might be follow buttons
          const roleButtons = document.querySelectorAll('div[role="button"]');
          roleButtons.forEach((btn, idx) => {
            const text = btn.innerText.trim();
            const ariaLabel = btn.getAttribute('aria-label');
            
            // Check if it's a "Follow" button (not "Following")
            if (text === 'Follow' || (ariaLabel && ariaLabel.includes('Follow') && !ariaLabel.includes('Following'))) {
              // Get parent container to find username
              let parent = btn;
              for (let i = 0; i < 10; i++) {
                if (!parent.parentElement) break;
                parent = parent.parentElement;
                
                // Look for username link in parent
                const usernameLink = parent.querySelector('a[href^="/"]');
                if (usernameLink) {
                  const href = usernameLink.getAttribute('href');
                  const username = href.replace('/', '').split('/')[0];
                  if (username && !username.includes('i/') && username.length > 0) {
                    buttons.push({
                      index: idx,
                      username: username,
                      buttonText: text,
                      ariaLabel: ariaLabel
                    });
                    break;
                  }
                }
              }
            }
          });
          
          return buttons;
        });

        console.log(`📋 Found ${allButtons.length} follow buttons with usernames`);

        if (allButtons.length === 0) {
          console.log('⚠️  No follow buttons found, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        // Process each button
        let followedThisRound = 0;
        for (const btnInfo of allButtons) {
          if (followCount >= maxFollows) break;

          const username = btnInfo.username;

          // Skip if we've already processed this user
          if (processedInSession.has(username)) {
            continue;
          }

          processedInSession.add(username);

          console.log(`👁️  Checking @${username}...`);

          // Random skip (humanization)
          const skipChance = config.randomSkipProbability || 15;
          if (Math.random() * 100 < skipChance) {
            console.log(`👻 Skipping @${username} randomly (humanization)`);
            continue;
          }

          // Find and click the button
          try {
            const clicked = await page.evaluate((btnIndex, username) => {
              const buttons = document.querySelectorAll('div[role="button"]');
              const targetBtn = buttons[btnIndex];
              
              if (targetBtn && targetBtn.innerText.trim() === 'Follow') {
                targetBtn.click();
                return true;
              }
              return false;
            }, btnInfo.index, username);

            if (clicked) {
              console.log(`👤 Following @${username}...`);
              await this.humanDelay(1000, 2000);
              followCount++;
              followedThisRound++;
              console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);

              // Random pause between follows
              const pauseTime = this.randomBetween(
                config.delayBetweenFollows?.min || 2,
                config.delayBetweenFollows?.max || 5
              );
              await this.humanDelay(pauseTime * 1000, pauseTime * 1000);
            } else {
              console.log(`⚠️  Button disappeared or changed for @${username}`);
            }

          } catch (error) {
            console.log(`⚠️  Error clicking button for @${username}: ${error.message}`);
            continue;
          }
        }

        // Scroll for more users
        if (followCount < maxFollows) {
          console.log(`📜 Scrolling for more users... (${followCount}/${maxFollows} follows so far, ${followedThisRound} this round)`);
          await this.humanScroll(page);
          await this.humanDelay(2000, 3000);
          
          if (followedThisRound === 0) {
            scrollAttempts++;
          } else {
            scrollAttempts = 0; // Reset if we found people
          }
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
   * Follow users from hashtag feed
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
      const processedInSession = new Set();

      while (followCount < maxFollows && scrollAttempts < maxScrollAttempts) {
        const allButtons = await page.evaluate(() => {
          const buttons = [];
          const roleButtons = document.querySelectorAll('div[role="button"]');
          
          roleButtons.forEach((btn, idx) => {
            const text = btn.innerText.trim();
            if (text === 'Follow') {
              let parent = btn;
              for (let i = 0; i < 10; i++) {
                if (!parent.parentElement) break;
                parent = parent.parentElement;
                const usernameLink = parent.querySelector('a[href^="/"]');
                if (usernameLink) {
                  const href = usernameLink.getAttribute('href');
                  const username = href.replace('/', '').split('/')[0];
                  if (username && !username.includes('i/') && username.length > 0) {
                    buttons.push({ index: idx, username: username });
                    break;
                  }
                }
              }
            }
          });
          
          return buttons;
        });

        console.log(`📋 Found ${allButtons.length} follow buttons`);

        if (allButtons.length === 0) {
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        for (const btnInfo of allButtons) {
          if (followCount >= maxFollows) break;

          if (processedInSession.has(btnInfo.username)) continue;
          processedInSession.add(btnInfo.username);

          // Random skip
          if (Math.random() * 100 < (config.randomSkipProbability || 15)) {
            console.log(`👻 Skipping @${btnInfo.username} randomly`);
            continue;
          }

          try {
            const clicked = await page.evaluate((idx) => {
              const buttons = document.querySelectorAll('div[role="button"]');
              const btn = buttons[idx];
              if (btn && btn.innerText.trim() === 'Follow') {
                btn.click();
                return true;
              }
              return false;
            }, btnInfo.index);

            if (clicked) {
              console.log(`👤 Following @${btnInfo.username}...`);
              await this.humanDelay(1000, 2000);
              followCount++;
              console.log(`✅ Followed @${btnInfo.username} (${followCount}/${maxFollows})`);

              const pauseTime = this.randomBetween(
                config.delayBetweenFollows?.min || 2,
                config.delayBetweenFollows?.max || 5
              );
              await this.humanDelay(pauseTime * 1000, pauseTime * 1000);
            }
          } catch (error) {
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

module.exports = new FixedFollowEngine();

