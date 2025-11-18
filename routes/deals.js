const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Create new deal
router.post('/create', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const {
      dealName,
      targetAmount,
      sector,
      jurisdiction,
      dealType,
      description,
      targetInvestorProfile
    } = req.body;

    const newDeal = {
      id: uuidv4(),
      firmId: req.user.firmId,
      dealName,
      targetAmount,
      sector,
      jurisdiction,
      dealType,
      description,
      targetInvestorProfile,
      status: 'draft',
      syndicateMembers: [],
      invitedFirms: [],
      createdAt: new Date().toISOString()
    };

    db.deals.push(newDeal);
    res.status(201).json({ message: 'Deal created successfully', deal: newDeal });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all deals for a firm
router.get('/my-deals', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const deals = db.deals.filter(d => d.firmId === req.user.firmId);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get deals where firm is invited
router.get('/invited', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const invitedDeals = db.deals.filter(d =>
      d.invitedFirms.includes(req.user.firmId)
    );
    res.json(invitedDeals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single deal
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const deal = db.deals.find(d => d.id === req.params.id);

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Check if user has access to this deal
    if (deal.firmId !== req.user.firmId && !deal.syndicateMembers.includes(req.user.firmId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(deal);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update deal
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const dealIndex = db.deals.findIndex(d => d.id === req.params.id && d.firmId === req.user.firmId);

    if (dealIndex === -1) {
      return res.status(404).json({ message: 'Deal not found or access denied' });
    }

    const updates = req.body;
    db.deals[dealIndex] = { ...db.deals[dealIndex], ...updates, id: db.deals[dealIndex].id };

    res.json({ message: 'Deal updated successfully', deal: db.deals[dealIndex] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
