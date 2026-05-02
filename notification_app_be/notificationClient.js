const axios = require('axios');
const path = require('path');

const loggerPath = path.join(__dirname, '..', 'logging-middleware', 'logger');
const tokenManagerPath = path.join(__dirname, '..', 'logging-middleware', 'tokenManager');
const { info, error } = require(loggerPath);
const tokenManager = require(tokenManagerPath);

const API_BASE = 'http://20.207.122.201/evaluation-service';

async function fetchNotifications() {
  await info('service', 'Fetching notifications from API');
  try {
    const token = await tokenManager.getValidToken();
    const response = await axios.get(`${API_BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await info('service', `Fetched ${response.data.notifications.length} notifications`);
    return response.data.notifications;
  } catch (err) {
    await error('service', `Failed to fetch notifications: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchNotifications };

