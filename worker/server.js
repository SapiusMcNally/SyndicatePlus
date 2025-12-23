require('dotenv').config();
const express = require('express');
const enrichmentRouter = require('./routes/enrichment');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'CF Monitor Worker', status: 'running', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/api', enrichmentRouter);

app.listen(PORT, () => {
  console.log('CF Monitor Worker running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));

  const SCHEDULE_INTERVAL = process.env.SCHEDULE_INTERVAL_MS || 3600000;

  if (process.env.NODE_ENV === 'production') {
    console.log('Auto-scheduler enabled: processing jobs every ' + (SCHEDULE_INTERVAL / 60000) + ' minutes');

    setTimeout(async () => {
      console.log('Running initial job processing...');
      try {
        const response = await fetch('http://localhost:' + PORT + '/api/process-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.AGENT_API_KEY },
          body: JSON.stringify({ limit: 20 })
        });
        const result = await response.json();
        console.log('Initial processing result:', result.message);
      } catch (err) { console.error('Initial processing failed:', err.message); }
    }, 30000);

    setInterval(async () => {
      console.log('Scheduled job processing starting...');
      try {
        const response = await fetch('http://localhost:' + PORT + '/api/process-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.AGENT_API_KEY },
          body: JSON.stringify({ limit: 20 })
        });
        const result = await response.json();
        console.log('Scheduled processing result:', result.message);
      } catch (err) { console.error('Scheduled processing failed:', err.message); }
    }, SCHEDULE_INTERVAL);
  }
});

process.on('SIGTERM', () => { console.log('SIGTERM received'); process.exit(0); });
