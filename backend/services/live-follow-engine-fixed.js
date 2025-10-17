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

        // COMPREHENSIVE DEBUG - Find ALL buttons on the page
        const debugInfo = await page.evaluate(() => {
          const debug = {
            allRoleButtons: 0,
            buttonTexts: [],
            followButtons: [],
            followingButtons: 0,
            otherButtons: []
          };
          
          // Find ALL button-like elements (button tags, div[role=button], spans with onClick)
          const roleButtons = [
            ...document.querySelectorAll('button'),
            ...document.querySelectorAll('div[role="button"]'),
            ...document.querySelectorAll('span[role="button"]'),
            ...document.querySelectorAll('[data-testid*="follow"]')
          ];
          debug.allRoleButtons = roleButtons.length;
          
          roleButtons.forEach((btn, idx) => {
            const text = btn.innerText.trim();
            const ariaLabel = btn.getAttribute('aria-label') || '';
            
            // Collect all button texts for debugging
            if (text.length > 0 && text.length < 20) {
              debug.buttonTexts.push(text);
            }
            
            // Check if it's a "Follow" button (not "Following")
            const isFollowButton = text === 'Follow' || 
                                   text === 'follow' ||
                                   (ariaLabel.includes('Follow') && !ariaLabel.includes('Following')) ||
                                   btn.getAttribute('data-testid') === 'follow';
            
            if (isFollowButton && text !== 'Following') {
              // Get parent container to find username
              let parent = btn;
              for (let i = 0; i < 15; i++) { // Increased from 10 to 15
                if (!parent.parentElement) break;
                parent = parent.parentElement;
                
                // Look for username link in parent - try multiple selectors
                let usernameLink = parent.querySelector('a[href^="/"][role="link"]');
                if (!usernameLink) usernameLink = parent.querySelector('a[href^="/"]');
                
                if (usernameLink) {
                  const href = usernameLink.getAttribute('href');
                  const username = href.replace('/', '').split('/')[0];
                  if (username && !username.includes('i/') && !username.includes('communities') && username.length > 0) {
                    debug.followButtons.push({
                      index: idx,
                      username: username,
                      buttonText: text,
                      ariaLabel: ariaLabel
                    });
                    break;
                  }
                }
              }
            } else if (text === 'Following' || text === 'following') {
              debug.followingButtons++;
            } else if (text.length > 0 && text.length < 20) {
              debug.otherButtons.push(text);
            }
          });
          
          return debug;
        });

        // Log comprehensive debug info
        console.log(`📋 Button Analysis:`);
        console.log(`   Total role=button elements: ${debugInfo.allRoleButtons}`);
        console.log(`   "Follow" buttons found: ${debugInfo.followButtons.length}`);
        console.log(`   "Following" buttons: ${debugInfo.followingButtons}`);
        console.log(`   Unique button texts: ${[...new Set(debugInfo.buttonTexts)].join(', ')}`);
        
        const allButtons = debugInfo.followButtons;

        if (allButtons.length === 0) {
          console.log('⚠️  No follow buttons found, scrolling...');
          await this.humanScroll(page);
          await this.humanDelay(1500, 2500);
          scrollAttempts++;
          continue;
        }

        // Process visible buttons only (take first 3-5 from current view)
        const visibleBatch = allButtons.slice(0, Math.min(5, allButtons.length));
        let followedThisRound = 0;
        
        for (const btnInfo of visibleBatch) {
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

          // Find and click the button (simplified - just find by username)
          try {
            const clicked = await page.evaluate((targetUsername) => {
              // Search all potential follow buttons
              const allButtons = [
                ...document.querySelectorAll('button'),
                ...document.querySelectorAll('div[role="button"]')
              ];
              
              for (const btn of allButtons) {
                const text = btn.innerText ? btn.innerText.trim() : '';
                if (text !== 'Follow') continue;
                
                // Find username near this button by checking parent containers
                let element = btn;
                for (let i = 0; i < 20; i++) {
                  if (!element.parentElement) break;
                  element = element.parentElement;
                  
                  // Check all links in this container
                  const links = element.querySelectorAll('a[href^="/"]');
                  for (const link of links) {
                    const href = link.getAttribute('href') || '';
                    const parts = href.split('/').filter(p => p);
                    if (parts[0] === targetUsername || href === `/${targetUsername}`) {
                      // Found the right user! Click the button
                      btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
                      setTimeout(() => btn.click(), 500);
                      return true;
                    }
                  }
                }
              }
              return false;
            }, username);

            if (clicked) {
              console.log(`👤 Following @${username}...`);
              await this.humanDelay(800, 1500);
              followCount++;
              followedThisRound++;
              console.log(`✅ Followed @${username} (${followCount}/${maxFollows})`);

              // Short pause between follows
              const pauseTime = this.randomBetween(2, 4);
              await this.humanDelay(pauseTime * 1000, pauseTime * 1000);
            } else {
              console.log(`⚠️  Couldn't click button for @${username} (not visible or changed)`);
            }

          } catch (error) {
            console.log(`⚠️  Error clicking button for @${username}: ${error.message}`);
            continue;
          }
        }

        // Scroll for more users only if we followed someone or need fresh content
        if (followCount < maxFollows) {
          if (followedThisRound > 0) {
            // We followed people, scroll smoothly to see new users
            console.log(`📜 Scrolling down smoothly... (${followCount}/${maxFollows} follows so far)`);
            await this.humanScroll(page);
            await this.humanDelay(2000, 3000);
            scrollAttempts = 0; // Reset since we're making progress
          } else {
            // No one followed this round, scroll more aggressively
            console.log(`⬇️  Scrolling for fresh users...`);
            await this.humanScroll(page);
            await this.humanDelay(1500, 2000);
            scrollAttempts++;
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
          const roleButtons = [
            ...document.querySelectorAll('button'),
            ...document.querySelectorAll('div[role="button"]'),
            ...document.querySelectorAll('span[role="button"]'),
            ...document.querySelectorAll('[data-testid*="follow"]')
          ];
          
          roleButtons.forEach((btn, idx) => {
            const text = btn.innerText ? btn.innerText.trim() : '';
            if (text === 'Follow' || btn.getAttribute('data-testid') === 'follow') {
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
              const buttons = [
                ...document.querySelectorAll('button'),
                ...document.querySelectorAll('div[role="button"]'),
                ...document.querySelectorAll('span[role="button"]'),
                ...document.querySelectorAll('[data-testid*="follow"]')
              ];
              const btn = buttons[idx];
              if (btn && (btn.innerText.trim() === 'Follow' || btn.getAttribute('data-testid') === 'follow')) {
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
   * Human-like scroll (smooth and natural)
   */
  async humanScroll(page) {
    const scrollAmount = this.randomBetween(300, 600);
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
}

module.exports = new FixedFollowEngine();

