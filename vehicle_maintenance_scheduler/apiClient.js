const axios = require('axios');
const path = require('path');

const loggerPath = path.join(__dirname, '..', 'logging-middleware', 'logger');
const tokenManagerPath = path.join(__dirname, '..', 'logging-middleware', 'tokenManager');
const { info, error } = require(loggerPath);
const tokenManager = require(tokenManagerPath);

const API_BASE = 'http://20.207.122.201/evaluation-service';

async function fetchDepots() {
  await info('service', 'Fetching depots from API');
  try {
    const token = await tokenManager.getValidToken();
    const response = await axios.get(`${API_BASE}/depots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await info('service', `Fetched ${response.data.depots.length} depots`);
    return response.data.depots;
  } catch (err) {
    await error('service', `Failed to fetch depots: ${err.message}`);
    throw err;
  }
}

async function fetchVehicles() {
  await info('service', 'Fetching vehicles from API');
  try {
    const token = await tokenManager.getValidToken();
    const response = await axios.get(`${API_BASE}/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await info('service', `Fetched ${response.data.vehicles.length} vehicles`);
    return response.data.vehicles;
  } catch (err) {
    await error('service', `Failed to fetch vehicles: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchDepots, fetchVehicles };
