const path = require('path');

const config = {
  FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN || 'hashia',
  FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GRAPH_API_URL: 'https://graph.facebook.com/v22.0'
};

if (!config.FACEBOOK_PAGE_ACCESS_TOKEN || !config.GEMINI_API_KEY) {
  console.error('Error: Missing required environment variables. Please set FACEBOOK_PAGE_ACCESS_TOKEN and GEMINI_API_KEY in your .env file or Vercel environment variables.');
  process.exit(1);
}

module.exports = config;
