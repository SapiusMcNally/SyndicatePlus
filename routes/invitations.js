const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// Send invitation to firm
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { dealId, firmId, message } = req.body;

    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    });

    if (!deal || deal.firmId !== req.user.firmId) {
      return res.status(404).json({ message: 'Deal not found or access denied' });
    }

    const targetFirm = await prisma.firm.findUnique({
      where: { id: firmId }
    });

    if (!targetFirm) {
      return res.status(404).json({ message: 'Target firm not found' });
    }

    const invitation = await prisma.invitation.create({
      data: {
        dealId,
        fromFirmId: req.user.firmId,
        toFirmId: firmId,
        message,
        status: 'pending'
      }
    });

    res.status(201).json({
      message: `Invitation sent to ${targetFirm.firmName}`,
      invitation
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get received invitations
router.get('/received', authMiddleware, async (req, res) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { toFirmId: req.user.firmId },
      include: {
        deal: {
          select: {
            id: true,
            dealName: true,
            sector: true
          }
        },
        fromFirm: {
          select: {
            id: true,
            firmName: true
          }
        }
      }
    });

    const enrichedInvitations = invitations.map(inv => ({
      ...inv,
      deal: inv.deal ? { id: inv.deal.id, name: inv.deal.dealName, sector: inv.deal.sector } : null,
      fromFirm: inv.fromFirm ? { id: inv.fromFirm.id, name: inv.fromFirm.firmName } : null
    }));

    res.json(enrichedInvitations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get sent invitations
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { fromFirmId: req.user.firmId },
      include: {
        deal: {
          select: {
            id: true,
            dealName: true
          }
        },
        toFirm: {
          select: {
            id: true,
            firmName: true
          }
        }
      }
    });

    const enrichedInvitations = invitations.map(inv => ({
      ...inv,
      deal: inv.deal ? { id: inv.deal.id, name: inv.deal.dealName } : null,
      toFirm: inv.toFirm ? { id: inv.toFirm.id, name: inv.toFirm.firmName } : null
    }));

    res.json(enrichedInvitations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Respond to invitation
router.post('/respond', authMiddleware, async (req, res) => {
  try {
    const { invitationId, response, ndaSigned } = req.body; // response: 'accepted' or 'declined'

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation || invitation.toFirmId !== req.user.firmId) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: response,
        respondedAt: new Date()
      }
    });

    if (response === 'accepted' && ndaSigned) {
      // Add firm to syndicate and record NDA
      const deal = await prisma.deal.findUnique({
        where: { id: invitation.dealId }
      });

      if (deal) {
        const syndicateMembers = deal.syndicateMembers || [];
        if (!syndicateMembers.includes(req.user.firmId)) {
          syndicateMembers.push(req.user.firmId);
        }

        await prisma.deal.update({
          where: { id: invitation.dealId },
          data: { syndicateMembers }
        });

        // Record NDA
        await prisma.nDA.create({
          data: {
            dealId: invitation.dealId,
            firmId: req.user.firmId
          }
        });
      }
    }

    res.json({
      message: `Invitation ${response}`,
      invitation: updatedInvitation
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
