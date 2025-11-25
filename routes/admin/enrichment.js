const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const axios = require('axios');
const { adminAuthMiddleware } = require('../../middleware/adminAuth');

// Agent service URL (will be set when we deploy to Railway)
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4000';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

// Get all enrichment records
router.get('/', adminAuthMiddleware, async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = status !== 'all' ? { enrichmentStatus: status } : {};

    const [enrichments, total] = await Promise.all([
      prisma.firmEnrichment.findMany({
        where,
        skip,
        take,
        include: {
          firm: {
            select: {
              id: true,
              firmName: true,
              email: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.firmEnrichment.count({ where })
    ]);

    res.json({
      enrichments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching enrichments:', error);
    res.status(500).json({ error: 'Failed to fetch enrichments' });
  }
});

// Get enrichment for a specific firm
router.get('/firm/:firmId', adminAuthMiddleware, async (req, res) => {
  try {
    const { firmId } = req.params;

    const enrichment = await prisma.firmEnrichment.findUnique({
      where: { firmId },
      include: {
        firm: {
          select: {
            id: true,
            firmName: true,
            email: true,
            profile: true
          }
        }
      }
    });

    if (!enrichment) {
      return res.status(404).json({ error: 'No enrichment data found for this firm' });
    }

    res.json(enrichment);
  } catch (error) {
    console.error('Error fetching enrichment:', error);
    res.status(500).json({ error: 'Failed to fetch enrichment data' });
  }
});

// Trigger enrichment for a specific firm
router.post('/trigger/:firmId', adminAuthMiddleware, async (req, res) => {
  try {
    const { firmId } = req.params;

    // Check if firm exists
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: { id: true, firmName: true }
    });

    if (!firm) {
      return res.status(404).json({ error: 'Firm not found' });
    }

    // Create or update enrichment record
    await prisma.firmEnrichment.upsert({
      where: { firmId },
      update: {
        enrichmentStatus: 'pending',
        errorMessage: null
      },
      create: {
        firmId,
        enrichmentStatus: 'pending'
      }
    });

    // Create agent job record
    const job = await prisma.agentJob.create({
      data: {
        jobType: 'enrich-firm',
        status: 'queued',
        payload: { firmId }
      }
    });

    // Try to call agent service if available
    if (AGENT_SERVICE_URL && AGENT_SERVICE_URL !== 'http://localhost:4000') {
      try {
        const response = await axios.post(
          `${AGENT_SERVICE_URL}/api/enrich/${firmId}`,
          {},
          {
            headers: AGENT_API_KEY ? {
              'Authorization': `Bearer ${AGENT_API_KEY}`
            } : {},
            timeout: 5000
          }
        );

        // Update job with agent service job ID
        await prisma.agentJob.update({
          where: { id: job.id },
          data: {
            result: { agentJobId: response.data.jobId }
          }
        });

        return res.json({
          success: true,
          message: 'Enrichment job queued',
          jobId: job.id,
          agentJobId: response.data.jobId
        });
      } catch (agentError) {
        console.error('Agent service call failed:', agentError.message);
        // Continue with local job creation even if agent service is unreachable
      }
    }

    // If agent service is not available, return job info
    res.json({
      success: true,
      message: 'Enrichment job created (agent service not configured)',
      jobId: job.id,
      note: 'Set AGENT_SERVICE_URL environment variable to enable automatic enrichment'
    });
  } catch (error) {
    console.error('Error triggering enrichment:', error);
    res.status(500).json({ error: 'Failed to trigger enrichment' });
  }
});

// Trigger bulk enrichment
router.post('/trigger-bulk', adminAuthMiddleware, async (req, res) => {
  try {
    const { firmIds, onlyStale = true, maxDaysOld = 30 } = req.body;

    let firms;

    if (firmIds && Array.isArray(firmIds)) {
      // Enrich specific firms
      firms = await prisma.firm.findMany({
        where: { id: { in: firmIds } },
        select: { id: true, firmName: true }
      });
    } else {
      // Enrich all firms that need it
      const where = { isAdmin: false };

      if (onlyStale) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDaysOld);

        firms = await prisma.firm.findMany({
          where: {
            ...where,
            OR: [
              { enrichment: null },
              {
                enrichment: {
                  OR: [
                    { lastEnriched: null },
                    { lastEnriched: { lt: cutoffDate } },
                    { enrichmentStatus: 'failed' }
                  ]
                }
              }
            ]
          },
          select: { id: true, firmName: true }
        });
      } else {
        firms = await prisma.firm.findMany({
          where,
          select: { id: true, firmName: true }
        });
      }
    }

    if (firms.length === 0) {
      return res.json({
        success: true,
        message: 'No firms need enrichment',
        jobsCreated: 0
      });
    }

    // Create jobs for each firm
    const jobs = [];
    for (const firm of firms) {
      // Create enrichment record
      await prisma.firmEnrichment.upsert({
        where: { firmId: firm.id },
        update: {
          enrichmentStatus: 'pending',
          errorMessage: null
        },
        create: {
          firmId: firm.id,
          enrichmentStatus: 'pending'
        }
      });

      // Create agent job
      const job = await prisma.agentJob.create({
        data: {
          jobType: 'enrich-firm',
          status: 'queued',
          payload: { firmId: firm.id }
        }
      });

      jobs.push({ firmId: firm.id, firmName: firm.firmName, jobId: job.id });

      // Try to trigger via agent service
      if (AGENT_SERVICE_URL && AGENT_SERVICE_URL !== 'http://localhost:4000') {
        try {
          await axios.post(
            `${AGENT_SERVICE_URL}/api/enrich/${firm.id}`,
            {},
            {
              headers: AGENT_API_KEY ? {
                'Authorization': `Bearer ${AGENT_API_KEY}`
              } : {},
              timeout: 3000
            }
          );
        } catch (agentError) {
          console.error(`Agent service call failed for firm ${firm.id}:`, agentError.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Queued ${jobs.length} enrichment jobs`,
      jobsCreated: jobs.length,
      jobs: jobs.slice(0, 10), // Return first 10
      agentServiceConfigured: !!(AGENT_SERVICE_URL && AGENT_SERVICE_URL !== 'http://localhost:4000')
    });
  } catch (error) {
    console.error('Error triggering bulk enrichment:', error);
    res.status(500).json({ error: 'Failed to trigger bulk enrichment' });
  }
});

// Get all agent jobs
router.get('/jobs', adminAuthMiddleware, async (req, res) => {
  try {
    const { status = 'all', jobType = 'all', page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      ...(status !== 'all' && { status }),
      ...(jobType !== 'all' && { jobType })
    };

    const [jobs, total] = await Promise.all([
      prisma.agentJob.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.agentJob.count({ where })
    ]);

    res.json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get specific job details
router.get('/jobs/:jobId', adminAuthMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.agentJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Try to get status from agent service if available
    if (job.result?.agentJobId && AGENT_SERVICE_URL && AGENT_SERVICE_URL !== 'http://localhost:4000') {
      try {
        const response = await axios.get(
          `${AGENT_SERVICE_URL}/api/jobs/${job.result.agentJobId}`,
          {
            headers: AGENT_API_KEY ? {
              'Authorization': `Bearer ${AGENT_API_KEY}`
            } : {},
            timeout: 5000
          }
        );

        return res.json({
          ...job,
          agentServiceStatus: response.data
        });
      } catch (agentError) {
        console.error('Failed to fetch agent service status:', agentError.message);
      }
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// Get enrichment statistics
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const [
      totalFirms,
      enrichedFirms,
      pendingFirms,
      failedFirms,
      totalJobs,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs
    ] = await Promise.all([
      prisma.firm.count({ where: { isAdmin: false } }),
      prisma.firmEnrichment.count({ where: { enrichmentStatus: 'completed' } }),
      prisma.firmEnrichment.count({ where: { enrichmentStatus: 'pending' } }),
      prisma.firmEnrichment.count({ where: { enrichmentStatus: 'failed' } }),
      prisma.agentJob.count(),
      prisma.agentJob.count({ where: { status: 'queued' } }),
      prisma.agentJob.count({ where: { status: 'processing' } }),
      prisma.agentJob.count({ where: { status: 'completed' } }),
      prisma.agentJob.count({ where: { status: 'failed' } })
    ]);

    const enrichmentRate = totalFirms > 0
      ? ((enrichedFirms / totalFirms) * 100).toFixed(2)
      : 0;

    res.json({
      firms: {
        total: totalFirms,
        enriched: enrichedFirms,
        pending: pendingFirms,
        failed: failedFirms,
        notStarted: totalFirms - enrichedFirms - pendingFirms - failedFirms,
        enrichmentRate: parseFloat(enrichmentRate)
      },
      jobs: {
        total: totalJobs,
        queued: queuedJobs,
        processing: processingJobs,
        completed: completedJobs,
        failed: failedJobs
      },
      agentServiceConfigured: !!(AGENT_SERVICE_URL && AGENT_SERVICE_URL !== 'http://localhost:4000')
    });
  } catch (error) {
    console.error('Error fetching enrichment stats:', error);
    res.status(500).json({ error: 'Failed to fetch enrichment statistics' });
  }
});

module.exports = router;
