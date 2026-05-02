const { fetchNotifications } = require('./notificationClient');
const path = require('path');
const fs = require('fs');
const { info } = require(path.join(__dirname, '..', 'logging-middleware', 'logger'));

const TYPE_WEIGHTS = { Placement: 3, Result: 2, Event: 1 };

function calculatePriorityScore(notification) {
  const type = notification.Type || notification.type || 'Event';
  const weight = TYPE_WEIGHTS[type] || 1;

  const ts = new Date(notification.Timestamp || notification.timestamp || Date.now());
  const ageInSeconds = Math.max(0, (Date.now() - ts) / 1000);
  const recencyScore = Math.max(0, 604800 - ageInSeconds) / 60480;

  return { score: weight * 10 + recencyScore, weight, recencyScore };
}

async function getTopNotifications(n = 10) {
  await info('service', `Getting top ${n} priority notifications`);

  const notifications = await fetchNotifications();
  if (!notifications || notifications.length === 0) return [];

  const scored = notifications.map(notif => {
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

  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  const topN = scored.slice(0, n);

  await info('service', `Found top ${topN.length} notifications`);

  const outputDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'priority_output.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), topNotifications: topN, weights: TYPE_WEIGHTS }, null, 2)
  );

  console.log(`\ntop ${n} notifications:`);
  topN.forEach((notif, i) => {
    console.log(`${i + 1}. [${notif.type}] ${notif.message}`);
    console.log(`   ${notif.timestamp} | score: ${notif.priorityScore}`);
  });
  console.log('\nsaved to screenshots/priority_output.json');

  return topN;
}

class PriorityInboxCache {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.items = [];
  }

  add(notification) {
    const { score } = calculatePriorityScore(notification);
    const entry = { ...notification, priorityScore: score };

    if (this.items.length < this.maxSize) {
      this.items.push(entry);
    } else if (score > this.items[this.items.length - 1].priorityScore) {
      this.items[this.items.length - 1] = entry;
    } else {
      return this.items;
    }

    this.items.sort((a, b) => b.priorityScore - a.priorityScore);
    return this.items;
  }

  getTop() {
    return this.items;
  }
}

if (require.main === module) {
  getTopNotifications(10).catch(console.error);
}

module.exports = { getTopNotifications, PriorityInboxCache, calculatePriorityScore, TYPE_WEIGHTS };
