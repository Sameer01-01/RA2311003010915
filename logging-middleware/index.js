const { log } = require('./logger');

function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;

  log('backend', 'info', 'middleware', `${req.method} ${req.url} from ${clientIp}`);

  const originalSend = res.send;
  res.send = function (body) {
    return originalSend.call(this, body);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'error' : 'info';
    log('backend', level, 'middleware', `${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });

  next();
}

function createRouteLogger(routeName) {
  return {
    request: (req, details = '') => {
      log('backend', 'info', 'route', `${routeName} ${req.method} ${req.url} ${details}`);
    },
    response: (req, res, duration, details = '') => {
      const level = res.statusCode >= 400 ? 'error' : 'info';
      log('backend', level, 'route', `${routeName} ${res.statusCode} ${duration}ms ${details}`);
    },
    error: (req, err, details = '') => {
      log('backend', 'error', 'route', `${routeName} error: ${err.message} ${details}`);
    }
  };
}

module.exports = { loggingMiddleware, createRouteLogger };
