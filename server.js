const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many requests from this IP, please try again later.'
    });
  }
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many API requests, please try again later.'
    });
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import routes
const authRoutes = require('./routes/auth');
const firmRoutes = require('./routes/firms');
const dealRoutes = require('./routes/deals');
const syndicateRoutes = require('./routes/syndicate');
const invitationRoutes = require('./routes/invitations');

// Use routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/firms', apiLimiter, firmRoutes);
app.use('/api/deals', apiLimiter, dealRoutes);
app.use('/api/syndicate', apiLimiter, syndicateRoutes);
app.use('/api/invitations', apiLimiter, invitationRoutes);

// Serve static files (must be last to not catch API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler - must be after all routes
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Only listen on port in local development (not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Syndicate+ server running on http://0.0.0.0:${PORT}`);
    console.log(`Server accessible from other devices at http://<your-ip>:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
