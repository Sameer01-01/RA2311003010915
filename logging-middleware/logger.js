const axios = require('axios');
const tokenManager = require('./tokenManager');
const config = require('./config');

const VALID_STACKS = ['backend', 'frontend'];
const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const VALID_PACKAGES = [
  'cache', 'controller', 'cron_job', 'db', 'domain',
  'handler', 'repository', 'route', 'service', 'auth',
  'config', 'middleware', 'utils'
];

let failedLogsQueue = [];
let isProcessingQueue = false;

function validateLogParams(stack, level, packageName, message) {
  if (!VALID_STACKS.includes(stack))
    throw new Error(`Invalid stack: ${stack}`);
  if (!VALID_LEVELS.includes(level))
    throw new Error(`Invalid level: ${level}`);
  if (!VALID_PACKAGES.includes(packageName))
    throw new Error(`Invalid package: ${packageName}`);
  if (!message || typeof message !== 'string')
    throw new Error('Message must be a non-empty string');
}

async function sendLog(stack, level, packageName, message, retryCount = 0) {
  const maxRetries = 3;

  try {
    validateLogParams(stack, level, packageName, message);

    const token = await tokenManager.getValidToken();
    const response = await axios.post(config.logApiUrl, {
      stack,
      level,
      package: packageName,
      message: message.substring(0, 48)
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`[${level.toUpperCase()}] ${packageName}: ${message.substring(0, 80)}`);
    console.log(`  logID: ${response.data.logID}`);
    return { success: true, logID: response.data.logID };

  } catch (err) {
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendLog(stack, level, packageName, message, retryCount + 1);
    }
    failedLogsQueue.push({ stack, level, packageName, message });
    return { success: false, error: err.message };
  }
}

async function processQueue() {
  if (isProcessingQueue || failedLogsQueue.length === 0) return;
  isProcessingQueue = true;

  while (failedLogsQueue.length > 0) {
    const entry = failedLogsQueue.shift();
    await sendLog(entry.stack, entry.level, entry.packageName, entry.message);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isProcessingQueue = false;
}

setInterval(processQueue, 30000);

async function log(stack, level, packageName, message) {
  sendLog(stack, level, packageName, message).catch(() => {});
}

async function logSync(stack, level, packageName, message) {
  return await sendLog(stack, level, packageName, message);
}

const info  = (pkg, msg) => log('backend', 'info',  pkg, msg);
const warn  = (pkg, msg) => log('backend', 'warn',  pkg, msg);
const error = (pkg, msg) => log('backend', 'error', pkg, msg);
const debug = (pkg, msg) => log('backend', 'debug', pkg, msg);
const fatal = (pkg, msg) => log('backend', 'fatal', pkg, msg);

module.exports = { log, logSync, info, warn, error, debug, fatal, processQueue };
