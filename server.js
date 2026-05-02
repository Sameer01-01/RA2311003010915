const express = require('express');
const cors = require('cors');
const { log, info, error } = require('./logging-middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { loggingMiddleware } = require('./logging-middleware/index');
app.use(loggingMiddleware);

app.get('/health', async (req, res) => {
  await info('route', 'Health check endpoint called');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/schedule/:depotId', async (req, res) => {
  try {
    await info('route', `Schedule request for depot ${req.params.depotId}`);

    const { getOptimalSchedule } = require('./vehicle_maintenance_scheduler/knapsack');
    const { fetchDepots, fetchVehicles } = require('./vehicle_maintenance_scheduler/apiClient');

    const depots = await fetchDepots();
    const depot = depots.find(d => d.ID == req.params.depotId);

    if (!depot) {
      await error('route', `Depot ${req.params.depotId} not found`);
      return res.status(404).json({ error: 'Depot not found' });
    }

    const vehicles = await fetchVehicles();
    const result = getOptimalSchedule(vehicles, depot.MechanicHours);

    await info('route', `Schedule generated for depot ${req.params.depotId}: ${result.selectedTasks.length} tasks, total impact: ${result.totalImpact}`);

    res.json({
      depotId: depot.ID,
      mechanicHours: depot.MechanicHours,
      ...result
    });
  } catch (err) {
    await error('route', `Schedule error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/priority-notifications', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 10;
    await info('route', `Priority inbox request for top ${n} notifications`);

    const { getTopNotifications } = require('./notification_app_be/priorityInbox');
    const topNotifications = await getTopNotifications(n);

    res.json({
      topCount: n,
      notifications: topNotifications,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    await error('route', `Priority inbox error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  await info('config', `Server started on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET /health`);
  console.log(`  GET /api/schedule/:depotId`);
  console.log(`  GET /api/priority-notifications?n=10`);
});
