const { fetchNotifications } = require('./notificationClient');
const path = require('path');
const fs = require('fs');

const loggerPath = path.join(__dirname, '..', 'logging-middleware', 'logger');
const { info } = require(loggerPath);

// Priority weights for notification types
const TYPE_WEIGHTS = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

// Calculate priority score for a notification
function calculatePriorityScore(notification) {
  const type = notification.Type || notification.type || 'Event';
  const weight = TYPE_WEIGHTS[type] || 1;

  const timestamp = new Date(notification.Timestamp || notification.timestamp || Date.now());
  const now = new Date();

  // Recency factor: newer = higher (range 0-10, max 7 days)
  const ageInSeconds = Math.max(0, (now - timestamp) / 1000);
  const recencyScore = Math.max(0, 604800 - ageInSeconds) / 60480;

  // Score = (weight * 10) + recencyFactor
  const score = (weight * 10) + recencyScore;

  return { score, weight, recencyScore };
}

// Get top N notifications sorted by priority score
async function getTopNotifications(n = 10) {
  const startTime = Date.now();
  await info('service', `Getting top ${n} priority notifications`);

  const notifications = await fetchNotifications();

  if (!notifications || notifications.length === 0) {
    await info('service', 'No notifications found');
    return [];
  }

  const scoredNotifications = notifications.map(notif => {
    const { score, weight, recencyScore } = calculatePriorityScore(notif);
    return {
      id: notif.ID || notif.id,
      type: notif.Type || notif.type,
      message: notif.Message || notif.message,
      timestamp: notif.Timestamp || notif.timestamp,
      priorityScore: parseFloat(score.toFixed(2)),
      weightUsed: weight,
      recencyScore: parseFloat(recencyScore.toFixed(2))
    };
  });

  scoredNotifications.sort((a, b) => b.priorityScore - a.priorityScore);
  const topN = scoredNotifications.slice(0, n);

  const duration = Date.now() - startTime;
  await info('service', `Found top ${topN.length} notifications in ${duration}ms`);

  // Save results
  const outputDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const output = {
    timestamp: new Date().toISOString(),
    requestedCount: n,
    actualCount: topN.length,
    topNotifications: topN,
    calculationMethod: "Priority = (Weight * 10) + RecencyFactor (0-10)",
    weights: TYPE_WEIGHTS
  };

  fs.writeFileSync(
    path.join(outputDir, 'priority_output.json'),
    JSON.stringify(output, null, 2)
  );

  console.log('\n' + '='.repeat(70));
  console.log(`TOP ${n} PRIORITY NOTIFICATIONS`);
  console.log('='.repeat(70));

  topN.forEach((notif, idx) => {
    console.log(`\n${idx + 1}. [${notif.type}] ${notif.message}`);
    console.log(`   ${notif.timestamp}`);
    console.log(`   Priority Score: ${notif.priorityScore} (Weight: ${notif.weightUsed}, Recency: ${notif.recencyScore})`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Results saved to: ${path.join(outputDir, 'priority_output.json')}`);

  return topN;
}

// Efficient cache for maintaining top N with streaming notifications
class PriorityInboxCache {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.topNotifications = [];
  }

  addNotification(notification) {
    const { score } = calculatePriorityScore(notification);
    const scoredNotif = { ...notification, priorityScore: score };

    if (this.topNotifications.length < this.maxSize) {
      this.topNotifications.push(scoredNotif);
      this.topNotifications.sort((a, b) => b.priorityScore - a.priorityScore);
    } else if (score > this.topNotifications[this.topNotifications.length - 1].priorityScore) {
      this.topNotifications[this.topNotifications.length - 1] = scoredNotif;
      this.topNotifications.sort((a, b) => b.priorityScore - a.priorityScore);
    }

    return this.topNotifications;
  }

  getTop() {
    return this.topNotifications;
  }
}

if (require.main === module) {
  getTopNotifications(10).catch(console.error);
}

module.exports = { getTopNotifications, PriorityInboxCache, calculatePriorityScore, TYPE_WEIGHTS };
