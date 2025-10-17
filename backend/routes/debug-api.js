const express = require('express');
const router = express.Router();
const twitterSessionManager = require('../services/twitter-session-manager');
const { TwitterAccount } = require('../models');

/**
 * Debug: Check what's on the current page
 */
router.get('/check-page/:accountId', async (req, res) => {
  try {
    const account = await TwitterAccount.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const page = await twitterSessionManager.getPage(account._id);
    
    // Get current URL
    const currentUrl = page.url();
    
    // Take a screenshot
    const screenshot = await page.screenshot({ 
      encoding: 'base64',
      fullPage: false 
    });
    
    // Count elements
    const followButtons = await page.$$('[data-testid="follow"]');
    const userCells = await page.$$('[data-testid="UserCell"]');
    const articles = await page.$$('article');
    
    // Get page title
    const title = await page.title();
    
    // Check if logged in
    const bodyText = await page.evaluate(() => document.body.innerText);
    const isLoggedIn = !bodyText.includes('Sign in') && !bodyText.includes('Log in');
    
    // Get HTML of a small section
    const sampleHTML = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? main.innerHTML.substring(0, 1000) : 'No main element found';
    });

    res.json({
      success: true,
      url: currentUrl,
      title: title,
      isLoggedIn: isLoggedIn,
      counts: {
        followButtons: followButtons.length,
        userCells: userCells.length,
        articles: articles.length
      },
      screenshot: `data:image/png;base64,${screenshot}`,
      sampleHTML: sampleHTML
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

/**
 * Debug: Try to follow from current page
 */
router.post('/test-follow/:accountId', async (req, res) => {
  try {
    const account = await TwitterAccount.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const page = await twitterSessionManager.getPage(account._id);
    
    // Find first follow button
    const followButtons = await page.$$('[data-testid="follow"]');
    
    if (followButtons.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No follow buttons found on page',
        url: page.url()
      });
    }

    // Click first button
    await followButtons[0].click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({ 
      success: true, 
      message: `Clicked first follow button (found ${followButtons.length} total)` 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug: Navigate to community members
 */
router.post('/nav-community/:accountId', async (req, res) => {
  try {
    const { communityId } = req.body;
    const account = await TwitterAccount.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const page = await twitterSessionManager.getPage(account._id);
    
    console.log(`🔍 Navigating to community ${communityId} members...`);
    
    await page.goto(`https://twitter.com/i/communities/${communityId}/members`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const followButtons = await page.$$('[data-testid="follow"]');
    const userCells = await page.$$('[data-testid="UserCell"]');
    const screenshot = await page.screenshot({ encoding: 'base64' });

    res.json({ 
      success: true,
      url: page.url(),
      counts: {
        followButtons: followButtons.length,
        userCells: userCells.length
      },
      screenshot: `data:image/png;base64,${screenshot}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

