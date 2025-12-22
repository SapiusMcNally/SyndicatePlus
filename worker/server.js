require('dotenv').config();
const express = require('express');
const enrichmentRouter = require('./routes/enrichment');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'CF Monitor Worker',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Enrichment routes
app.use('/api', enrichmentRouter);

// Start server
app.listen(PORT, () => {
  console.log(`CF Monitor Worker running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
