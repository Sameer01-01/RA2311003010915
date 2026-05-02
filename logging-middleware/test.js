const { log, logSync, info, warn, error, debug, fatal } = require('./logger');
const tokenManager = require('./tokenManager');

async function test() {
  console.log('Testing Logging Middleware...\n');
  console.log('Initializing token...');
  await tokenManager.initializeToken();
  
  console.log('\n--- Testing different log levels ---\n');
  await logSync('backend', 'debug', 'utils',       'Debug message - testing logging functionality');
  await logSync('backend', 'info',  'controller',  'Info message - user requested vehicles API');
  await logSync('backend', 'warn',  'service',     'Warning - API response took 2.5 seconds');
  await logSync('backend', 'error', 'db',          'Error - Failed to connect to database');
  await logSync('backend', 'fatal', 'handler',     'Fatal - Application cannot start without DB');
  
  console.log('\n--- Testing helper functions ---\n');
  
 

  
  await info('auth',       'User authenticated successfully');
  await warn('cache',      'Cache miss for key: user:123');
  await error('repository','Record not found with ID: 456');
  
  console.log('\n--- Testing different packages ---\n');
  const packages = [
    'cache', 'controller', 'cron_job', 'db', 'domain',
    'handler', 'repository', 'route', 'service', 'auth',
    'config', 'middleware', 'utils'
  ];
  
  for (const pkg of packages) {
    await logSync('backend', 'info', pkg, `Testing ${pkg} package logging`);
  }
  
  console.log('\n All tests completed! Check the console for log IDs.');
  console.log('Check your logs at: http://20.207.122.201/evaluation-service/logs (with your token)');
  process.exit(0);
}
test().catch(console.error);
