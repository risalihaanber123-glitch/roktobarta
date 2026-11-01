const https = require('https');
const http = require('http');

/**
 * Pings the application's public URL every 9 minutes
 * to keep Render's free tier web service awake (Render sleeps after 15 mins of inactivity).
 */
function startKeepAlive() {
  const rawUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL;

  if (!rawUrl || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
    console.log('[Keep-Alive] Skipped in local/development mode.');
    return;
  }

  const pingUrl = rawUrl.replace(/\/+$/, '') + '/ping';
  const INTERVAL_MS = 9 * 60 * 1000; // 9 minutes

  console.log(`[Keep-Alive] Active. Pinging ${pingUrl} every 9 minutes.`);

  // Set interval to ping every 9 minutes
  setInterval(() => {
    try {
      const client = pingUrl.startsWith('https') ? https : http;
      client.get(pingUrl, (res) => {
        console.log(`[Keep-Alive Ping] Status: ${res.statusCode} at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} BST`);
      }).on('error', (err) => {
        console.warn(`[Keep-Alive Ping Warning] ${err.message}`);
      });
    } catch (err) {
      console.warn(`[Keep-Alive Error] ${err.message}`);
    }
  }, INTERVAL_MS);
}

module.exports = startKeepAlive;
