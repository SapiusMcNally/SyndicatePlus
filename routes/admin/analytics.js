const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { adminAuthMiddleware } = require('../../middleware/adminAuth');

// Get deal analytics
router.get('/deals', adminAuthMiddleware, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (timeframe === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeframe === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeframe === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeframe === '1y') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    // Get deals created in timeframe
    const deals = await prisma.deal.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        dealName: true,
        targetAmount: true,
        sector: true,
        jurisdiction: true,
        status: true,
        createdAt: true,
        syndicateMembers: true,
        invitedFirms: true
      }
    });

    // Calculate metrics
    const totalDeals = deals.length;
    const totalVolume = deals.reduce((sum, deal) => sum + deal.targetAmount, 0);

    const dealsByStatus = deals.reduce((acc, deal) => {
      acc[deal.status] = (acc[deal.status] || 0) + 1;
      return acc;
    }, {});

    const dealsBySector = deals.reduce((acc, deal) => {
      acc[deal.sector] = (acc[deal.sector] || 0) + 1;
      return acc;
    }, {});

    const dealsByJurisdiction = deals.reduce((acc, deal) => {
      acc[deal.jurisdiction] = (acc[deal.jurisdiction] || 0) + 1;
      return acc;
    }, {});

    // Average syndicate size
    const avgSyndicateSize = totalDeals > 0
      ? deals.reduce((sum, deal) => sum + deal.syndicateMembers.length, 0) / totalDeals
      : 0;

    res.json({
      timeframe,
      summary: {
        totalDeals,
        totalVolume,
        averageDealSize: totalDeals > 0 ? totalVolume / totalDeals : 0,
        averageSyndicateSize: parseFloat(avgSyndicateSize.toFixed(2))
      },
      breakdown: {
        byStatus: dealsByStatus,
        bySector: dealsBySector,
        byJurisdiction: dealsByJurisdiction
      },
      recentDeals: deals.slice(0, 10).map(deal => ({
        id: deal.id,
        dealName: deal.dealName,
        targetAmount: deal.targetAmount,
        sector: deal.sector,
        status: deal.status,
        syndicateSize: deal.syndicateMembers.length,
        createdAt: deal.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching deal analytics:', error);
    res.status(500).json({ error: 'Failed to fetch deal analytics' });
  }
});

// Get invitation analytics
router.get('/invitations', adminAuthMiddleware, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (timeframe === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeframe === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeframe === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeframe === '1y') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        deal: {
          select: {
            sector: true,
            jurisdiction: true
          }
        }
      }
    });

    const totalInvitations = invitations.length;
    const accepted = invitations.filter(i => i.status === 'accepted').length;
    const declined = invitations.filter(i => i.status === 'declined').length;
    const pending = invitations.filter(i => i.status === 'pending').length;

    const acceptanceRate = totalInvitations > 0
      ? ((accepted / totalInvitations) * 100).toFixed(2)
      : 0;

    // Calculate average response time for responded invitations
    const respondedInvitations = invitations.filter(i => i.respondedAt);
    const avgResponseTime = respondedInvitations.length > 0
      ? respondedInvitations.reduce((sum, inv) => {
          const responseTime = inv.respondedAt - inv.createdAt;
          return sum + responseTime;
        }, 0) / respondedInvitations.length
      : 0;

    // Convert to hours
    const avgResponseHours = (avgResponseTime / (1000 * 60 * 60)).toFixed(1);

    // Acceptance rate by sector
    const bySector = invitations.reduce((acc, inv) => {
      const sector = inv.deal.sector;
      if (!acc[sector]) {
        acc[sector] = { total: 0, accepted: 0 };
      }
      acc[sector].total++;
      if (inv.status === 'accepted') {
        acc[sector].accepted++;
      }
      return acc;
    }, {});

    const sectorStats = Object.entries(bySector).map(([sector, data]) => ({
      sector,
      total: data.total,
      accepted: data.accepted,
      acceptanceRate: ((data.accepted / data.total) * 100).toFixed(2)
    }));

    res.json({
      timeframe,
      summary: {
        total: totalInvitations,
        accepted,
        declined,
        pending,
        acceptanceRate: parseFloat(acceptanceRate),
        avgResponseTimeHours: parseFloat(avgResponseHours)
      },
      bySector: sectorStats.sort((a, b) => b.total - a.total)
    });
  } catch (error) {
    console.error('Error fetching invitation analytics:', error);
    res.status(500).json({ error: 'Failed to fetch invitation analytics' });
  }
});

// Get firm activity analytics
router.get('/firms/activity', adminAuthMiddleware, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Most active deal creators
    const dealCreators = await prisma.firm.findMany({
      where: {
        deals: {
          some: {}
        }
      },
      select: {
        id: true,
        firmName: true,
        email: true,
        _count: {
          select: {
            deals: true
          }
        }
      },
      orderBy: {
        deals: {
          _count: 'desc'
        }
      },
      take: parseInt(limit)
    });

    // Most active in invitations
    const invitationActivity = await prisma.firm.findMany({
      where: {
        OR: [
          { sentInvitations: { some: {} } },
          { receivedInvitations: { some: {} } }
        ]
      },
      select: {
        id: true,
        firmName: true,
        email: true,
        _count: {
          select: {
            sentInvitations: true,
            receivedInvitations: true
          }
        }
      },
      orderBy: {
        sentInvitations: {
          _count: 'desc'
        }
      },
      take: parseInt(limit)
    });

    res.json({
      topDealCreators: dealCreators.map(firm => ({
        id: firm.id,
        firmName: firm.firmName,
        email: firm.email,
        dealsCreated: firm._count.deals
      })),
      topInviters: invitationActivity.map(firm => ({
        id: firm.id,
        firmName: firm.firmName,
        email: firm.email,
        invitationsSent: firm._count.sentInvitations,
        invitationsReceived: firm._count.receivedInvitations
      }))
    });
  } catch (error) {
    console.error('Error fetching firm activity:', error);
    res.status(500).json({ error: 'Failed to fetch firm activity analytics' });
  }
});

// Get algorithm performance metrics
router.get('/algorithm', adminAuthMiddleware, async (req, res) => {
  try {
    // Get all invitations with deal information
    const invitations = await prisma.invitation.findMany({
      include: {
        deal: {
          select: {
            sector: true,
            jurisdiction: true,
            targetAmount: true
          }
        }
      }
    });

    // Calculate overall matching accuracy (acceptance rate)
    const totalInvitations = invitations.length;
    const acceptedInvitations = invitations.filter(i => i.status === 'accepted').length;
    const overallAccuracy = totalInvitations > 0
      ? ((acceptedInvitations / totalInvitations) * 100).toFixed(2)
      : 0;

    // Accuracy by sector
    const sectorAccuracy = invitations.reduce((acc, inv) => {
      const sector = inv.deal.sector;
      if (!acc[sector]) {
        acc[sector] = { total: 0, accepted: 0 };
      }
      acc[sector].total++;
      if (inv.status === 'accepted') {
        acc[sector].accepted++;
      }
      return acc;
    }, {});

    const sectorStats = Object.entries(sectorAccuracy).map(([sector, data]) => ({
      sector,
      accuracy: ((data.accepted / data.total) * 100).toFixed(2),
      sampleSize: data.total
    }));

    // Accuracy by deal size ranges
    const dealSizeRanges = [
      { label: 'Under $1M', min: 0, max: 1000000 },
      { label: '$1M - $5M', min: 1000000, max: 5000000 },
      { label: '$5M - $10M', min: 5000000, max: 10000000 },
      { label: 'Over $10M', min: 10000000, max: Infinity }
    ];

    const sizeAccuracy = dealSizeRanges.map(range => {
      const rangeInvitations = invitations.filter(
        inv => inv.deal.targetAmount >= range.min && inv.deal.targetAmount < range.max
      );
      const accepted = rangeInvitations.filter(i => i.status === 'accepted').length;
      return {
        range: range.label,
        accuracy: rangeInvitations.length > 0
          ? ((accepted / rangeInvitations.length) * 100).toFixed(2)
          : 0,
        sampleSize: rangeInvitations.length
      };
    });

    res.json({
      overall: {
        accuracy: parseFloat(overallAccuracy),
        totalInvitations,
        acceptedInvitations
      },
      bySector: sectorStats.sort((a, b) => b.sampleSize - a.sampleSize),
      byDealSize: sizeAccuracy,
      recommendations: generateRecommendations(sectorStats, sizeAccuracy)
    });
  } catch (error) {
    console.error('Error fetching algorithm metrics:', error);
    res.status(500).json({ error: 'Failed to fetch algorithm metrics' });
  }
});

// Helper function to generate recommendations
function generateRecommendations(sectorStats, sizeStats) {
  const recommendations = [];

  // Check for low-performing sectors
  const lowPerformingSectors = sectorStats.filter(
    s => parseFloat(s.accuracy) < 50 && s.sampleSize > 5
  );
  if (lowPerformingSectors.length > 0) {
    recommendations.push({
      type: 'warning',
      message: `Low acceptance rate in sectors: ${lowPerformingSectors.map(s => s.sector).join(', ')}. Consider adjusting sector matching weights.`
    });
  }

  // Check for data gaps
  const lowSampleSectors = sectorStats.filter(s => s.sampleSize < 5);
  if (lowSampleSectors.length > 0) {
    recommendations.push({
      type: 'info',
      message: `Limited data for sectors: ${lowSampleSectors.map(s => s.sector).join(', ')}. More data needed for accurate assessment.`
    });
  }

  // Check overall performance
  const avgAccuracy = sectorStats.reduce((sum, s) => sum + parseFloat(s.accuracy), 0) / sectorStats.length;
  if (avgAccuracy > 70) {
    recommendations.push({
      type: 'success',
      message: 'Algorithm performing well with average acceptance rate above 70%.'
    });
  }

  return recommendations;
}

module.exports = router;
