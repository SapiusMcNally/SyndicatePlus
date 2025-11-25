const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// Create new deal
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      dealName,
      targetAmount,
      sector,
      jurisdiction,
      dealType,
      description,
      targetInvestorProfile
    } = req.body;

    // Validate required fields
    if (!dealName || !sector || !jurisdiction || !dealType) {
      return res.status(400).json({
        message: 'Missing required fields. Please provide dealName, sector, jurisdiction, and dealType.'
      });
    }

    // Validate targetAmount
    const parsedAmount = parseFloat(targetAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        message: 'Invalid target amount. Please provide a valid positive number.'
      });
    }

    // Validate firmId
    if (!req.user || !req.user.firmId) {
      return res.status(401).json({
        message: 'Authentication error. Please log in again.'
      });
    }

    console.log('Creating deal with data:', {
      dealName,
      targetAmount: parsedAmount,
      sector,
      jurisdiction,
      dealType,
      description,
      targetInvestorProfile,
      firmId: req.user.firmId
    });

    const newDeal = await prisma.deal.create({
      data: {
        firmId: req.user.firmId,
        dealName,
        targetAmount: parsedAmount,
        sector,
        jurisdiction,
        dealType,
        description: description || null,
        targetInvestorProfile: targetInvestorProfile || null,
        status: 'draft'
      }
    });

    res.status(201).json({ message: 'Deal created successfully', deal: newDeal });
  } catch (error) {
    console.error('Error creating deal:', error);

    // Provide more specific error messages
    if (error.code === 'P2003') {
      return res.status(400).json({
        message: 'Invalid firm ID. Please log in again.',
        error: 'Foreign key constraint failed'
      });
    }

    res.status(500).json({
      message: 'Server error while creating deal',
      error: error.message
    });
  }
});

// Get all deals for a firm
router.get('/my-deals', authMiddleware, async (req, res) => {
  try {
    const deals = await prisma.deal.findMany({
      where: { firmId: req.user.firmId }
    });
    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get deals where firm is invited
router.get('/invited', authMiddleware, async (req, res) => {
  try {
    const invitedDeals = await prisma.deal.findMany({
      where: {
        invitedFirms: {
          has: req.user.firmId
        }
      }
    });
    res.json(invitedDeals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single deal
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id }
    });

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
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id }
    });

    if (!deal || deal.firmId !== req.user.firmId) {
      return res.status(404).json({ message: 'Deal not found or access denied' });
    }

    const updates = req.body;
    const updatedDeal = await prisma.deal.update({
      where: { id: req.params.id },
      data: updates
    });

    res.json({ message: 'Deal updated successfully', deal: updatedDeal });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
