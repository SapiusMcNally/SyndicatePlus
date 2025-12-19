const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');

// Middleware to verify cron secret
function cronAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // Vercel sets Authorization header with Bearer token
  const token = authHeader?.split(' ')[1];
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, allowing cron execution (unsafe in production)');
    return next();
  }

  if (token !== cronSecret) {
    console.error('Unauthorized cron attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Daily CF monitor refresh
router.get('/', cronAuthMiddleware, async (req, res) => {
  try {
    console.log('Starting CF monitor daily refresh...');

    // Find all monitored firms that need refreshing (>24 hours old or never updated)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleFirms = await prisma.monitoredFirm.findMany({
      where: {
        monitoringStatus: 'active',
        OR: [
          { lastDataUpdate: null },
          { lastDataUpdate: { lt: cutoffDate } }
        ]
      },
      select: {
        id: true,
        firmName: true,
        country: true,
        lastDataUpdate: true
      }
    });

    console.log(`Found ${staleFirms.length} firms needing refresh`);

    // Create enrichment jobs for each firm
    const jobPromises = staleFirms.map(firm =>
      prisma.agentJob.create({
        data: {
          jobType: 'enrich-monitored-firm',
          status: 'queued',
          payload: {
            monitoredFirmId: firm.id,
            fullRefresh: false,
            triggeredBy: 'cron'
          },
          monitoredFirmId: firm.id
        }
      })
    );

    await Promise.all(jobPromises);

    // Update data freshness scores for all monitored firms
    const allFirms = await prisma.monitoredFirm.findMany({
      where: { monitoringStatus: 'active' },
      select: { id: true, lastDataUpdate: true }
    });

    const freshnessUpdates = allFirms.map(firm => {
      const score = calculateFreshnessScore(firm.lastDataUpdate);
      return prisma.monitoredFirm.update({
        where: { id: firm.id },
        data: { dataFreshnessScore: score }
      });
    });

    await Promise.all(freshnessUpdates);

    console.log(`CF monitor cron completed: ${staleFirms.length} jobs queued`);

    res.json({
      success: true,
      message: `CF monitor daily refresh completed`,
      firmsQueued: staleFirms.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CF monitor cron error:', error);
    res.status(500).json({
      error: 'Cron job failed',
      message: error.message
    });
  }
});

// Helper: Calculate freshness score (0-100)
function calculateFreshnessScore(lastUpdate) {
  if (!lastUpdate) return 0;

  const hoursSince = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

  if (hoursSince < 24) return 100;
  if (hoursSince < 48) return 80;
  if (hoursSince < 72) return 60;
  if (hoursSince < 168) return 40; // 1 week
  if (hoursSince < 720) return 20; // 1 month
  return 10;
}

module.exports = router;
