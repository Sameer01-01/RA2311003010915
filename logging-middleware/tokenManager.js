const axios = require('axios');
const config = require('./config');

let currentToken = config.accessToken;
let tokenExpiryTime = null;

async function refreshToken() {
  try {
    console.log('Attempting to refresh access token...');
    const response = await axios.post(config.authTokenUrl, {
      clientID: config.clientID,
      clientSecret: config.clientSecret
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    currentToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    tokenExpiryTime = Date.now() + (expiresIn * 1000);

    console.log('Token refreshed successfully!');
    return currentToken;
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data || error.message;
    console.warn(`Token refresh failed (${status || 'network error'}): ${JSON.stringify(msg)}`);
    console.warn('   Falling back to hardcoded accessToken from config.js');
    currentToken = config.accessToken;
    tokenExpiryTime = Date.now() + 15 * 60 * 1000;
    return currentToken;
  }
}

async function getValidToken() {
 
  if (!tokenExpiryTime || Date.now() >= tokenExpiryTime - 300000) {
    await refreshToken();
  }
  return currentToken;
}

async function initializeToken() {
  return await refreshToken();
}
module.exports={ getValidToken, refreshToken, initializeToken };
