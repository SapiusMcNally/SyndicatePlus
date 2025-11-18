const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Intelligent syndicate matching algorithm
function calculateSyndicateMatch(deal, firm) {
  let score = 0;
  let reasons = [];

  // Check jurisdiction match
  if (firm.profile.jurisdictions && firm.profile.jurisdictions.includes(deal.jurisdiction)) {
    score += 30;
    reasons.push(`Active in ${deal.jurisdiction}`);
  }

  // Check sector focus
  if (firm.profile.sectorFocus && firm.profile.sectorFocus.includes(deal.sector)) {
    score += 35;
    reasons.push(`Specialized in ${deal.sector} sector`);
  }

  // Check deal size compatibility
  if (firm.profile.typicalDealSize) {
    const dealAmount = deal.targetAmount;
    const { min, max } = firm.profile.typicalDealSize;

    if (dealAmount >= min && dealAmount <= max) {
      score += 25;
      reasons.push('Deal size matches typical investment range');
    } else if (dealAmount < max && dealAmount > min * 0.5) {
      score += 15;
      reasons.push('Deal size within acceptable range');
    }
  }

  // Check recent transaction activity
  if (firm.profile.recentTransactions && firm.profile.recentTransactions.length > 0) {
    score += 10;
    reasons.push(`${firm.profile.recentTransactions.length} recent transactions`);
  }

  return { score, reasons };
}

// Get syndicate recommendations
router.post('/recommend', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { dealId, syndicateSize } = req.body;

    const deal = db.deals.find(d => d.id === dealId && d.firmId === req.user.firmId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found or access denied' });
    }

    // Get all other firms
    const otherFirms = db.firms.filter(f => f.id !== req.user.firmId);

    // Calculate match scores
    const matches = otherFirms.map(firm => {
      const { score, reasons } = calculateSyndicateMatch(deal, firm);
      return {
        firmId: firm.id,
        firmName: firm.firmName,
        score,
        reasons,
        profile: firm.profile
      };
    });

    // Sort by score and take top N
    const recommendations = matches
      .sort((a, b) => b.score - a.score)
      .slice(0, syndicateSize || 5);

    res.json({
      deal: {
        id: deal.id,
        name: deal.dealName,
        sector: deal.sector,
        targetAmount: deal.targetAmount
      },
      recommendations
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Build syndicate (save selections)
router.post('/build', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { dealId, selectedFirms } = req.body;

    const dealIndex = db.deals.findIndex(d => d.id === dealId && d.firmId === req.user.firmId);
    if (dealIndex === -1) {
      return res.status(404).json({ message: 'Deal not found or access denied' });
    }

    db.deals[dealIndex].invitedFirms = selectedFirms;
    db.deals[dealIndex].status = 'syndicate_building';

    res.json({
      message: 'Syndicate selections saved',
      deal: db.deals[dealIndex]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
