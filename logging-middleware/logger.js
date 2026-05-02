const axios=require('axios');
const tokenManager=require('./tokenManager');
const config=require('./config');
const VALID_STACKS=['backend', 'frontend'];
const VALID_LEVELS=['debug', 'info', 'warn', 'error', 'fatal'];
const VALID_PACKAGES=[
  'cache', 'controller', 'cron_job', 'db', 'domain', 
  'handler', 'repository', 'route', 'service', 'auth', 
  'config', 'middleware', 'utils'
];

let failedLogsQueue=[];
let isProcessingQueue=false;

function validateLogParams(stack, level, packageName, message) {
  if (!VALID_STACKS.includes(stack)) {
    throw new Error(`Invalid stack: ${stack}. Must be one of: ${VALID_STACKS.join(', ')}`);
  }
  if (!VALID_LEVELS.includes(level)) {
    throw new Error(`Invalid level: ${level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  if (!VALID_PACKAGES.includes(packageName)) {
    throw new Error(`Invalid package: ${packageName}. Must be one of: ${VALID_PACKAGES.join(', ')}`);
  }
  if (!message ||typeof message !=='string') {
    throw new Error('Message must be a non-empty string');
  }
  return true;
}

async function sendLog(stack, level, packageName, message, retryCount = 0) {
  const maxRetries=3;
  
  try {
    validateLogParams(stack, level, packageName, message);
    
    const token=await tokenManager.getValidToken();
    
    const logData = {
      stack: stack,
      level: level,
      package: packageName,
      message: message.substring(0, 48)
    };
    
    const response=await axios.post(config.logApiUrl, logData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log(`Log sent successfully! [${level.toUpperCase()}] ${packageName}: ${message.substring(0, 100)}`);
    console.log(` LogID: ${response.data.logID}`);
    
    return { success: true, logID: response.data.logID };
    
  } catch (error) {
    console.error(` Failed to send log (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);
    
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; 
      console.log(`   Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendLog(stack, level, packageName, message, retryCount + 1);
    }
    failedLogsQueue.push({ stack, level, packageName, message, timestamp: Date.now() });
    console.log(`   Log queued for later retry. Queue size: ${failedLogsQueue.length}`);
    
    return { success: false, error: error.message };
  }
}

async function processQueue() {
  if (isProcessingQueue|| failedLogsQueue.length === 0) return;
  
  isProcessingQueue=true;
  console.log(`Processing ${failedLogsQueue.length} queued logs...`);
  
  while (failedLogsQueue.length > 0) {
    const log=failedLogsQueue.shift();
    await sendLog(log.stack, log.level, log.packageName, log.message);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  isProcessingQueue = false;
  console.log('Queue processing complete');
}
setInterval(processQueue, 30000);
async function log(stack, level, packageName, message) {
  sendLog(stack, level, packageName, message).catch(console.error);
}

async function logSync(stack, level, packageName, message) {
  return await sendLog(stack, level, packageName, message);
}

const info=(packageName, message)=>log('backend', 'info',  packageName, message);
const warn=(packageName, message)=>log('backend', 'warn',  packageName, message);
const error=(packageName, message)=>log('backend', 'error', packageName, message);
const debug=(packageName, message)=>log('backend', 'debug', packageName, message);
const fatal=(packageName, message)=>log('backend', 'fatal', packageName, message);

module.exports={ 
  log, 
  logSync, 
  info, 
  warn, 
  error, 
  debug, 
  fatal,
  processQueue 
};
