const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory database (for development - replace with real database in production)
const db = {
  firms: [],
  deals: [],
  invitations: [],
  ndas: []
};

// Import routes
const authRoutes = require('./routes/auth');
const firmRoutes = require('./routes/firms');
const dealRoutes = require('./routes/deals');
const syndicateRoutes = require('./routes/syndicate');
const invitationRoutes = require('./routes/invitations');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/firms', firmRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/syndicate', syndicateRoutes);
app.use('/api/invitations', invitationRoutes);

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export db for use in routes
app.locals.db = db;

app.listen(PORT, () => {
  console.log(`Syndicate+ server running on http://localhost:${PORT}`);
});
