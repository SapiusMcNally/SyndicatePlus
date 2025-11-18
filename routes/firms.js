const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Get firm profile
router.get('/profile/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const firm = db.firms.find(f => f.id === req.params.id);

    if (!firm) {
      return res.status(404).json({ message: 'Firm not found' });
    }

    // Don't send password
    const { password, ...firmData } = firm;
    res.json(firmData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update firm profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const firmIndex = db.firms.findIndex(f => f.id === req.user.firmId);

    if (firmIndex === -1) {
      return res.status(404).json({ message: 'Firm not found' });
    }

    const { jurisdictions, typicalDealSize, sectorFocus, recentTransactions, description } = req.body;

    db.firms[firmIndex].profile = {
      ...db.firms[firmIndex].profile,
      jurisdictions: jurisdictions || db.firms[firmIndex].profile.jurisdictions,
      typicalDealSize: typicalDealSize || db.firms[firmIndex].profile.typicalDealSize,
      sectorFocus: sectorFocus || db.firms[firmIndex].profile.sectorFocus,
      recentTransactions: recentTransactions || db.firms[firmIndex].profile.recentTransactions,
      description: description || db.firms[firmIndex].profile.description
    };

    const { password, ...firmData } = db.firms[firmIndex];
    res.json({ message: 'Profile updated successfully', firm: firmData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all firms (for syndicate building)
router.get('/all', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const firms = db.firms.map(({ password, ...firm }) => firm);
    res.json(firms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
