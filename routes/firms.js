const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// Get firm profile
router.get('/profile/:id', authMiddleware, async (req, res) => {
  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firmName: true,
        profile: true,
        createdAt: true
      }
    });

    if (!firm) {
      return res.status(404).json({ message: 'Firm not found' });
    }

    res.json(firm);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update firm profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.user.firmId }
    });

    if (!firm) {
      return res.status(404).json({ message: 'Firm not found' });
    }

    const { jurisdictions, typicalDealSize, sectorFocus, recentTransactions, description } = req.body;

    const currentProfile = firm.profile || {};
    const updatedProfile = {
      ...currentProfile,
      jurisdictions: jurisdictions || currentProfile.jurisdictions,
      typicalDealSize: typicalDealSize || currentProfile.typicalDealSize,
      sectorFocus: sectorFocus || currentProfile.sectorFocus,
      recentTransactions: recentTransactions || currentProfile.recentTransactions,
      description: description || currentProfile.description
    };

    const updatedFirm = await prisma.firm.update({
      where: { id: req.user.firmId },
      data: { profile: updatedProfile },
      select: {
        id: true,
        email: true,
        firmName: true,
        profile: true,
        createdAt: true
      }
    });

    res.json({ message: 'Profile updated successfully', firm: updatedFirm });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all firms (for syndicate building)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const firms = await prisma.firm.findMany({
      select: {
        id: true,
        email: true,
        firmName: true,
        profile: true,
        createdAt: true
      }
    });
    res.json(firms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
