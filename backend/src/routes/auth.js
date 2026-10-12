const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { getAuthUrl, handleAuthCallback, isAuthenticated, getOAuth2Client } = require('../services/gmail');

// GET /auth/status - Check if we're authenticated with Google and show connected email
router.get('/status', async (req, res) => {
  const authed = await isAuthenticated();
  let email = null;

  if (authed) {
    try {
      const oauth2Client = await getOAuth2Client();
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      email = data.email;
    } catch (err) {
      console.warn('Could not get Gmail email:', err.message);
      // Token might be invalid
      email = null;
    }
  }

  res.json({ authenticated: authed, email });
});

// GET /auth/google - Redirect to Google OAuth consent screen
router.get('/google', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// GET /auth/google/callback - Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    await handleAuthCallback(code);
    
    // Redirect to frontend after successful auth
    const frontendUrl = process.env.FRONTEND_URL || 'https://bill-reminder-73a35.web.app';
    res.redirect(`${frontendUrl}?auth=success`);
  } catch (error) {
    console.error('Auth callback error:', error.message);
    res.status(500).json({ error: 'Authentication failed: ' + error.message });
  }
});

// POST /auth/disconnect - Remove stored Gmail token
router.post('/disconnect', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const firestore = admin.firestore();
    await firestore.doc('config/google_token').delete();
    res.json({ message: 'Gmail disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
