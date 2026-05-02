
const { log }=require('./logger');
function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  log('backend', 'info', 'middleware', 
    `Incoming ${req.method} ${req.url} from ${clientIp}`);
  const originalSend = res.send;
  let responseBody = null;
  
  res.send=function(body) {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'error' : 'info';
    const statusText = res.statusCode >= 400 ? 'Failed' : 'Success';
    
    log('backend', level, 'middleware',
      `${statusText} ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${duration}ms`);
  });
  
  next();
}

function createRouteLogger(routeName) {
  return {
    request: (req, details = '') => {
      log('backend', 'info', 'route', 
        `${routeName} - ${req.method} ${req.url} ${details}`);
    },
    response: (req, res, duration, details = '') => {
      const level = res.statusCode >= 400 ? 'error' : 'info';
      log('backend', level, 'route',
        `${routeName} - Response ${res.statusCode} - ${duration}ms ${details}`);
    },
    error: (req, error, details = '') => {
      log('backend', 'error', 'route',
        `${routeName} - Error: ${error.message} ${details}`);
    }
  };
}

module.exports={ loggingMiddleware, createRouteLogger };
