const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { adminAuthMiddleware } = require('../../middleware/adminAuth');

// Get all monitored firms with pagination and filters
router.get('/', adminAuthMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      country = 'all',
      firmType = 'all',
      freshness = 'all'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {
      ...(search && {
        OR: [
          { firmName: { contains: search, mode: 'insensitive' } },
          { website: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(country !== 'all' && { country }),
      ...(firmType !== 'all' && { firmType }),
      monitoringStatus: 'active' // Only show active monitored firms
    };

    // Add freshness filter
    if (freshness === 'fresh') {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      where.lastDataUpdate = { gte: cutoff };
    } else if (freshness === 'stale') {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      where.lastDataUpdate = { lt: cutoff };
    } else if (freshness === 'old') {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      where.lastDataUpdate = { lt: cutoff };
    }

    // Get monitored firms with counts and latest news
    const [firms, total] = await Promise.all([
      prisma.monitoredFirm.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          firmName: true,
          country: true,
          firmType: true,
          website: true,
          headquarters: true,
          lastDataUpdate: true,
          dataFreshnessScore: true,
          createdAt: true,
          _count: {
            select: {
              deals: true,
              news: true,
              personnel: true,
              firmDataSnapshots: true
            }
          },
          news: {
            orderBy: { publishedAt: 'desc' },
            take: 1,
            select: {
              headline: true,
              publishedAt: true
            }
          }
        },
        orderBy: { lastDataUpdate: 'desc' }
      }),
      prisma.monitoredFirm.count({ where })
    ]);

    // Format response
    const formatted = firms.map(firm => ({
      ...firm,
      latestNews: firm.news[0] || null,
      news: undefined
    }));

    res.json({
      firms: formatted,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching monitored firms:', error);
    res.status(500).json({ error: 'Failed to fetch monitored firms' });
  }
});

// Get statistics
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const [
      total,
      byCountry,
      freshDataCount,
      recentDeals
    ] = await Promise.all([
      prisma.monitoredFirm.count({ where: { monitoringStatus: 'active' } }),
      prisma.monitoredFirm.groupBy({
        by: ['country'],
        where: { monitoringStatus: 'active' },
        _count: true
      }),
      prisma.monitoredFirm.count({
        where: {
          monitoringStatus: 'active',
          lastDataUpdate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.dealActivity.count({
        where: {
          announcementDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const countryMap = byCountry.reduce((acc, item) => {
      acc[item.country] = item._count;
      return acc;
    }, {});

    res.json({
      total,
      byCountry: countryMap,
      freshDataCount,
      recentDealsCount: recentDeals
    });
  } catch (error) {
    console.error('Error fetching CF monitor stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get single monitored firm details
router.get('/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const firm = await prisma.monitoredFirm.findUnique({
      where: { id },
      include: {
        deals: {
          orderBy: { announcementDate: 'desc' },
          take: 10
        },
        news: {
          orderBy: { publishedAt: 'desc' },
          take: 10
        },
        personnel: {
          where: { isCurrent: true },
          orderBy: { createdAt: 'desc' }
        },
        firmDataSnapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 5
        },
        _count: {
          select: {
            deals: true,
            news: true,
            personnel: true,
            firmDataSnapshots: true
          }
        }
      }
    });

    if (!firm) {
      return res.status(404).json({ error: 'Monitored firm not found' });
    }

    res.json(firm);
  } catch (error) {
    console.error('Error fetching monitored firm:', error);
    res.status(500).json({ error: 'Failed to fetch firm details' });
  }
});

// Add new monitored firm
router.post('/', adminAuthMiddleware, async (req, res) => {
  try {
    const {
      firmName,
      country,
      firmType,
      registrationNumber,
      website,
      headquarters,
      geographicFocus,
      sectorFocus,
      discoverySource = 'manual'
    } = req.body;

    if (!firmName || !country) {
      return res.status(400).json({ error: 'Firm name and country are required' });
    }

    if (!['UK', 'Switzerland'].includes(country)) {
      return res.status(400).json({ error: 'Country must be UK or Switzerland' });
    }

    // Create monitored firm
    const firm = await prisma.monitoredFirm.create({
      data: {
        firmName,
        country,
        firmType,
        registrationNumber,
        website,
        headquarters,
        geographicFocus: geographicFocus || [],
        sectorFocus: sectorFocus || [],
        discoverySource,
        monitoringStatus: 'active'
      }
    });

    // Create initial enrichment job
    await prisma.agentJob.create({
      data: {
        jobType: 'enrich-monitored-firm',
        status: 'queued',
        payload: { monitoredFirmId: firm.id, fullRefresh: true },
        monitoredFirmId: firm.id
      }
    });

    res.status(201).json({
      message: 'Monitored firm added successfully',
      firm
    });
  } catch (error) {
    console.error('Error adding monitored firm:', error);
    res.status(500).json({ error: 'Failed to add monitored firm' });
  }
});

// Trigger manual refresh for specific firm
router.post('/refresh/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const firm = await prisma.monitoredFirm.findUnique({
      where: { id },
      select: { id: true, firmName: true }
    });

    if (!firm) {
      return res.status(404).json({ error: 'Monitored firm not found' });
    }

    // Create enrichment job
    const job = await prisma.agentJob.create({
      data: {
        jobType: 'enrich-monitored-firm',
        status: 'queued',
        payload: { monitoredFirmId: id, fullRefresh: true },
        monitoredFirmId: id
      }
    });

    res.json({
      success: true,
      message: 'Refresh job queued',
      jobId: job.id
    });
  } catch (error) {
    console.error('Error triggering refresh:', error);
    res.status(500).json({ error: 'Failed to trigger refresh' });
  }
});

// Auto-discover new firms from registries
router.post('/discover', adminAuthMiddleware, async (req, res) => {
  try {
    const { country, limit = 50 } = req.body;

    // Create discovery job
    const job = await prisma.agentJob.create({
      data: {
        jobType: 'discover-cf-firms',
        status: 'queued',
        payload: {
          country: country || 'both',
          limit,
          searchCriteria: {
            sicCodes: ['64910', '64920', '64991'], // Financial intermediation codes
            keywords: ['corporate finance', 'M&A', 'mergers', 'acquisitions', 'advisory']
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Discovery job created',
      jobId: job.id,
      note: 'This may take several minutes. Refresh the page to see newly discovered firms.'
    });
  } catch (error) {
    console.error('Error triggering discovery:', error);
    res.status(500).json({ error: 'Failed to trigger discovery' });
  }
});

// Update monitored firm status
router.patch('/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { monitoringStatus } = req.body;

    if (!['active', 'paused', 'archived'].includes(monitoringStatus)) {
      return res.status(400).json({ error: 'Invalid monitoring status' });
    }

    const updatedFirm = await prisma.monitoredFirm.update({
      where: { id },
      data: { monitoringStatus }
    });

    res.json({
      message: `Monitoring status updated to ${monitoringStatus}`,
      firm: updatedFirm
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update monitoring status' });
  }
});

module.exports = router;
