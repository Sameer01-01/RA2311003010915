const path = require('path');
const { info } = require(path.join(__dirname, '..', 'logging-middleware', 'logger'));

function getOptimalSchedule(vehicles, mechanicHours) {
  const startTime = Date.now();

  const n = vehicles.length;
  const capacity = mechanicHours;

  const items = vehicles.map(v => ({
    id: v.TaskID || v.taskID,
    weight: v.Duration || v.duration || 1,
    value: v.Impact || v.ImpactScore || v.impactScore || 0
  }));

  const dp = new Array(capacity + 1).fill(0);
  const selected = new Array(capacity + 1).fill(null).map(() => []);

  for (let i = 0; i < n; i++) {
    const item = items[i];
    for (let w = capacity; w >= item.weight; w--) {
      if (dp[w - item.weight] + item.value > dp[w]) {
        dp[w] = dp[w - item.weight] + item.value;
        selected[w] = [...selected[w - item.weight], {
          taskId: item.id,
          duration: item.weight,
          impactScore: item.value
        }];
      }
    }
  }

  let bestWeight = 0;
  for (let w = 1; w <= capacity; w++) {
    if (dp[w] > dp[bestWeight]) bestWeight = w;
  }

  const runtime = Date.now() - startTime;
  info('service', `Done: ${selected[bestWeight].length} tasks, impact ${dp[bestWeight]}`);

  return {
    selectedTasks: selected[bestWeight],
    totalImpact: dp[bestWeight],
    mechanicHoursAvailable: capacity,
    mechanicHoursUsed: bestWeight,
    algorithmRuntimeMs: runtime
  };
}

module.exports = { getOptimalSchedule };
