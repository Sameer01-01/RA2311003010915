const express = require('express');
const cors = require('cors');
const { info, error } = require('./logging-middleware/logger');
const { loggingMiddleware } = require('./logging-middleware/index');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(loggingMiddleware);

app.get('/health', async (req, res) => {
  await info('route', 'Health check');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/schedule/:depotId', async (req, res) => {
  try {
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

    await info('route', `Schedule done for depot ${req.params.depotId}`);
    res.json({ depotId: depot.ID, mechanicHours: depot.MechanicHours, ...result });

  } catch (err) {
    await error('route', `Schedule error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/priority-notifications', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 10;
    const { getTopNotifications } = require('./notification_app_be/priorityInbox');
    const notifications = await getTopNotifications(n);
    res.json({ topCount: n, notifications, generatedAt: new Date().toISOString() });

  } catch (err) {
    await error('route', `Priority inbox error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  await info('config', `Server started on port ${PORT}`);
  console.log(`server running on http://localhost:${PORT}`);
});
