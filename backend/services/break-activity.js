const twitterSessionManager = require('./twitter-session-manager');

/**
 * Break Activity Service
 * Simulates human browsing during breaks (looks natural!)
 */
class BreakActivityService {
  
  /**
   * Execute random Twitter browsing during break
   */
  async simulateBreakActivity(accountId, breakDuration, config = {}) {
    if (!config.enabled) {
      console.log(`   💤 Idle break (no activity)`);
      return;
    }

    console.log(`   🎭 Simulating human activity during break...`);
    
    const page = await twitterSessionManager.getPage(accountId);
    const activities = config.activities || {};
    const endTime = Date.now() + breakDuration;
    
    try {
      // Always start by going to home
      if (activities.goToHome) {
        await this.goToHome(page);
      }
      
      // Do random activities until break is over
      let activityCount = 0;
      while (Date.now() < endTime && activityCount < 15) { // Max 15 activities
        const remainingTime = endTime - Date.now();
        if (remainingTime < 5000) break; // Less than 5s left, stop
        
        // Pick a random activity
        const activity = this.pickRandomActivity(activities);
        
        if (activity) {
          await this[activity](page);
          activityCount++;
        }
        
        // Wait between activities
        await this.humanDelay(this.randomBetween(3000, 8000));
      }
      
      console.log(`   ✅ Completed ${activityCount} activities during break`);
      
    } catch (error) {
      console.log(`   ⚠️  Break activity error: ${error.message}`);
    }
  }
  
  /**
   * Pick random activity based on probabilities
   */
  pickRandomActivity(activities) {
    const possibleActivities = [];
    
    if (activities.scrollFeed) {
      possibleActivities.push({ name: 'scrollFeed', weight: 100 }); // Always likely
    }
    if (activities.likePosts) {
      possibleActivities.push({ name: 'likeRandomPost', weight: activities.likePosts.probability || 30 });
    }
    if (activities.readTweets) {
      possibleActivities.push({ name: 'readRandomTweet', weight: activities.readTweets.probability || 40 });
    }
    if (activities.readReplies) {
      possibleActivities.push({ name: 'readTweetReplies', weight: activities.readReplies.probability || 20 });
    }
    if (activities.visitProfiles) {
      possibleActivities.push({ name: 'visitRandomProfile', weight: activities.visitProfiles.probability || 15 });
    }
    
    // Weighted random selection
    const totalWeight = possibleActivities.reduce((sum, a) => sum + a.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const activity of possibleActivities) {
      random -= activity.weight;
      if (random <= 0) {
        return activity.name;
      }
    }
    
    return possibleActivities[0]?.name || null;
  }
  
  /**
   * Go to home feed
   */
  async goToHome(page) {
    console.log(`      🏠 Going to home feed...`);
    await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await this.humanDelay(2000, 4000);
  }
  
  /**
   * Scroll through feed
   */
  async scrollFeed(page) {
    console.log(`      📜 Scrolling through feed...`);
    const scrolls = this.randomBetween(2, 5);
    for (let i = 0; i < scrolls; i++) {
      const scrollAmount = this.randomBetween(300, 800);
      await page.evaluate((distance) => {
        window.scrollBy({ top: distance, behavior: 'smooth' });
      }, scrollAmount);
      await this.humanDelay(1500, 3000);
    }
  }
  
  /**
   * Like a random post
   */
  async likeRandomPost(page) {
    console.log(`      💙 Liking a random post...`);
    try {
      const likeButtons = await page.$$('article [data-testid="like"]');
      if (likeButtons.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(likeButtons.length, 5));
        await likeButtons[randomIndex].scrollIntoView({ block: 'center' });
        await this.humanDelay(500, 1000);
        await likeButtons[randomIndex].click();
        await this.humanDelay(1000, 2000);
      }
    } catch (error) {
      // Silent fail
    }
  }
  
  /**
   * Click and "read" a random tweet
   */
  async readRandomTweet(page) {
    console.log(`      📖 Reading a random tweet...`);
    try {
      const tweets = await page.$$('article');
      if (tweets.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(tweets.length, 5));
        const tweet = tweets[randomIndex];
        
        // Click on tweet to open it
        const tweetLink = await tweet.$('a[href*="/status/"]');
        if (tweetLink) {
          await tweetLink.click();
          await this.humanDelay(3000, 6000); // "Read" for 3-6 seconds
          
          // Go back
          await page.goBack();
          await this.humanDelay(1500, 2500);
        }
      }
    } catch (error) {
      // Silent fail
    }
  }
  
  /**
   * Read tweet replies
   */
  async readTweetReplies(page) {
    console.log(`      💬 Reading tweet replies...`);
    try {
      const tweets = await page.$$('article');
      if (tweets.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(tweets.length, 5));
        const tweet = tweets[randomIndex];
        
        // Click on tweet
        const tweetLink = await tweet.$('a[href*="/status/"]');
        if (tweetLink) {
          await tweetLink.click();
          await this.humanDelay(2000, 3000);
          
          // Scroll through replies
          const scrolls = this.randomBetween(2, 4);
          for (let i = 0; i < scrolls; i++) {
            await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
            await this.humanDelay(2000, 4000); // "Read" replies
          }
          
          // Go back
          await page.goBack();
          await this.humanDelay(1500, 2500);
        }
      }
    } catch (error) {
      // Silent fail
    }
  }
  
  /**
   * Visit a random profile
   */
  async visitRandomProfile(page) {
    console.log(`      👤 Visiting a random profile...`);
    try {
      const userLinks = await page.$$('article [data-testid="User-Name"] a[href^="/"]');
      if (userLinks.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(userLinks.length, 5));
        await userLinks[randomIndex].click();
        await this.humanDelay(3000, 5000); // "Look at" profile
        
        // Maybe scroll a bit on their profile
        if (Math.random() > 0.5) {
          await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
          await this.humanDelay(2000, 3000);
        }
        
        // Go back
        await page.goBack();
        await this.humanDelay(1500, 2500);
      }
    } catch (error) {
      // Silent fail
    }
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

module.exports = new BreakActivityService();

