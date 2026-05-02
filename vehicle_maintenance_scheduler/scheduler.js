const { fetchDepots, fetchVehicles } = require('./apiClient');
const { getOptimalSchedule } = require('./knapsack');
const path = require('path');
const fs = require('fs');

const loggerPath = path.join(__dirname, '..', 'logging-middleware', 'logger');
const { info, error } = require(loggerPath);

async function runScheduler() {
  console.log('\n' + '='.repeat(60));
  console.log('VEHICLE MAINTENANCE SCHEDULER');
  console.log('='.repeat(60) + '\n');

  await info('service', 'Starting vehicle maintenance scheduler');

  try {
    console.log('Fetching depots and vehicles...');
    const [depots, vehicles] = await Promise.all([
      fetchDepots(),
      fetchVehicles()
    ]);

    console.log(`Found ${depots.length} depots and ${vehicles.length} vehicles\n`);

    const results = [];

    for (const depot of depots) {
      console.log(`\nProcessing Depot ${depot.ID} (Budget: ${depot.MechanicHours} hours)`);
      console.log('-'.repeat(40));

      const result = getOptimalSchedule(vehicles, depot.MechanicHours);
      results.push({
        depotId: depot.ID,
        mechanicHoursBudget: depot.MechanicHours,
        ...result
      });

      console.log(`  Selected ${result.selectedTasks.length} tasks`);
      console.log(`  Total Impact Score: ${result.totalImpact}`);
      console.log(`  Hours Used: ${result.mechanicHoursUsed}/${depot.MechanicHours}`);
      console.log(`  Runtime: ${result.algorithmRuntimeMs}ms`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));

    for (const result of results) {
      console.log(`\nDepot ${result.depotId}:`);
      console.log(`  Budget: ${result.mechanicHoursBudget} hours`);
      console.log(`  Tasks Selected: ${result.selectedTasks.length}`);
      console.log(`  Total Impact: ${result.totalImpact}`);
      console.log(`  Hours Utilized: ${result.mechanicHoursUsed}`);
    }

    // Save results to file
    const outputPath = path.join(__dirname, 'screenshots', 'output.txt');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);

    await info('service', 'Scheduler completed successfully');
    return results;

  } catch (err) {
    await error('service', `Scheduler failed: ${err.message}`);
    console.error('Error:', err.message);
    throw err;
  }
}

if (require.main === module) {
  runScheduler().catch(console.error);
}

module.exports = { runScheduler };
