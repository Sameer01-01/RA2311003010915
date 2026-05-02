const { fetchDepots, fetchVehicles } = require('./apiClient');
const { getOptimalSchedule } = require('./knapsack');
const path = require('path');
const fs = require('fs');
const { info, error } = require(path.join(__dirname, '..', 'logging-middleware', 'logger'));

async function runScheduler() {
  await info('service', 'Starting vehicle maintenance scheduler');

  try {
    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
    console.log(`\nFetched ${depots.length} depots, ${vehicles.length} vehicles\n`);

    const results = [];

    for (const depot of depots) {
      console.log(`Depot ${depot.ID} — budget: ${depot.MechanicHours}h`);
      const result = getOptimalSchedule(vehicles, depot.MechanicHours);
      results.push({ depotId: depot.ID, mechanicHoursBudget: depot.MechanicHours, ...result });
      console.log(`  tasks: ${result.selectedTasks.length}, impact: ${result.totalImpact}, hours used: ${result.mechanicHoursUsed}/${depot.MechanicHours}`);
    }

    console.log('\n--- summary ---');
    for (const r of results) {
      console.log(`Depot ${r.depotId}: ${r.selectedTasks.length} tasks, impact ${r.totalImpact}, ${r.mechanicHoursUsed}/${r.mechanicHoursBudget}h`);
    }

    const outputDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'output.txt'), JSON.stringify(results, null, 2));
    console.log('\nresults saved to screenshots/output.txt');

    await info('service', 'Scheduler completed successfully');
    return results;

  } catch (err) {
    await error('service', `Scheduler failed: ${err.message}`);
    console.error(err.message);
    throw err;
  }
}

if (require.main === module) {
  runScheduler().catch(console.error);
}

module.exports = { runScheduler };
