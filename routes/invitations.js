const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Send invitation to firm
router.post('/send', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { dealId, firmId, message } = req.body;

    const deal = db.deals.find(d => d.id === dealId && d.firmId === req.user.firmId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found or access denied' });
    }

    const targetFirm = db.firms.find(f => f.id === firmId);
    if (!targetFirm) {
      return res.status(404).json({ message: 'Target firm not found' });
    }

    const invitation = {
      id: uuidv4(),
      dealId,
      fromFirmId: req.user.firmId,
      toFirmId: firmId,
      message,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    db.invitations.push(invitation);

    res.status(201).json({
      message: `Invitation sent to ${targetFirm.firmName}`,
      invitation
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get received invitations
router.get('/received', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const invitations = db.invitations.filter(i => i.toFirmId === req.user.firmId);

    // Enrich with deal and firm info
    const enrichedInvitations = invitations.map(inv => {
      const deal = db.deals.find(d => d.id === inv.dealId);
      const fromFirm = db.firms.find(f => f.id === inv.fromFirmId);
      return {
        ...inv,
        deal: deal ? { id: deal.id, name: deal.dealName, sector: deal.sector } : null,
        fromFirm: fromFirm ? { id: fromFirm.id, name: fromFirm.firmName } : null
      };
    });

    res.json(enrichedInvitations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get sent invitations
router.get('/sent', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const invitations = db.invitations.filter(i => i.fromFirmId === req.user.firmId);

    // Enrich with firm info
    const enrichedInvitations = invitations.map(inv => {
      const deal = db.deals.find(d => d.id === inv.dealId);
      const toFirm = db.firms.find(f => f.id === inv.toFirmId);
      return {
        ...inv,
        deal: deal ? { id: deal.id, name: deal.dealName } : null,
        toFirm: toFirm ? { id: toFirm.id, name: toFirm.firmName } : null
      };
    });

    res.json(enrichedInvitations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Respond to invitation
router.post('/respond', authMiddleware, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { invitationId, response, ndaSigned } = req.body; // response: 'accepted' or 'declined'

    const invitationIndex = db.invitations.findIndex(
      i => i.id === invitationId && i.toFirmId === req.user.firmId
    );

    if (invitationIndex === -1) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    db.invitations[invitationIndex].status = response;
    db.invitations[invitationIndex].respondedAt = new Date().toISOString();

    if (response === 'accepted' && ndaSigned) {
      // Add firm to syndicate
      const dealIndex = db.deals.findIndex(d => d.id === db.invitations[invitationIndex].dealId);
      if (dealIndex !== -1) {
        if (!db.deals[dealIndex].syndicateMembers) {
          db.deals[dealIndex].syndicateMembers = [];
        }
        db.deals[dealIndex].syndicateMembers.push(req.user.firmId);

        // Record NDA
        db.ndas.push({
          id: uuidv4(),
          dealId: db.invitations[invitationIndex].dealId,
          firmId: req.user.firmId,
          signedAt: new Date().toISOString()
        });
      }
    }

    res.json({
      message: `Invitation ${response}`,
      invitation: db.invitations[invitationIndex]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
