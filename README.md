# RA2311003010915

Backend evaluation project — vehicle maintenance scheduler and notification priority inbox.

## Setup

```bash
npm install
```

Update the `accessToken` in `logging-middleware/config.js` with a fresh token before running (tokens expire every 15 minutes).

## Running

**Vehicle scheduler** — fetches depots and vehicles, runs 0/1 knapsack to maximize impact within mechanic hour budgets:
```bash
npm run scheduler
```
Output saved to `vehicle_maintenance_scheduler/screenshots/output.txt`

**Priority inbox** — fetches notifications and ranks top 10 by type weight and recency:
```bash
npm run priority
```
Output saved to `notification_app_be/screenshots/priority_output.json`

**Express server** — exposes REST endpoints for both:
```bash
npm start
```
```
GET /health
GET /api/schedule/:depotId
GET /api/priority-notifications?n=10
```

## Project structure

```
├── logging-middleware/       reusable logger with auto token refresh
├── vehicle_maintenance_scheduler/
│   ├── apiClient.js          fetches depots and vehicles from API
│   ├── knapsack.js           0/1 knapsack algorithm
│   └── scheduler.js          runs the schedule for all depots
├── notification_app_be/
│   ├── notificationClient.js fetches notifications from API
│   └── priorityInbox.js      scores and ranks notifications
├── notification_system_design.md  system design answers (stages 1-6)
└── server.js                 express server
```

## Notes

- All API calls use the token manager which auto-refreshes via the auth endpoint
- Logs are sent to the evaluation service after every major operation
- The knapsack runs independently per depot — no shared state between depots
