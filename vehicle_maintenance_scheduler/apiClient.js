const axios = require('axios');
const path = require('path');

const loggerPath = path.join(__dirname, '..', 'logging-middleware', 'logger');
const { info, error } = require(loggerPath);

const API_BASE = 'http://20.207.122.201/evaluation-service';
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJzeTMyNTNAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMjc4OSwiaWF0IjoxNzc3NzAxODg5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNGZmNmViMzYtNzRiMS00MzA2LWFhMzctMjhkMTU5NjMwNTVjIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoic2FtZWVyIHlhZGF2Iiwic3ViIjoiOGNiNmU3YjAtNDZmNy00ZWEyLTkwNzItNmEzYmRjMmZhZmViIn0sImVtYWlsIjoic3kzMjUzQHNybWlzdC5lZHUuaW4iLCJuYW1lIjoic2FtZWVyIHlhZGF2Iiwicm9sbE5vIjoicmEyMzExMDAzMDEwOTE1IiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiOGNiNmU3YjAtNDZmNy00ZWEyLTkwNzItNmEzYmRjMmZhZmViIiwiY2xpZW50U2VjcmV0IjoiY3RWQ2tIanZWWmtwenV0YSJ9.i0cERMWD4N8EiBx2nJGDWMNoLank3SHaDv1m-PlGhgQ";

async function fetchDepots() {
  await info('service', 'Fetching depots from API');
  try {
    const response = await axios.get(`${API_BASE}/depots`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    await info('service', `Successfully fetched ${response.data.depots.length} depots`);
    return response.data.depots;
  } catch (err) {
    await error('service', `Failed to fetch depots: ${err.message}`);
    throw err;
  }
}

async function fetchVehicles() {
  await info('service', 'Fetching vehicles from API');
  try {
    const response = await axios.get(`${API_BASE}/vehicles`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    await info('service', `Successfully fetched ${response.data.vehicles.length} vehicles`);
    return response.data.vehicles;
  } catch (err) {
    await error('service', `Failed to fetch vehicles: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchDepots, fetchVehicles };
