const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const axios = require('axios');

// Environment configuration
const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const AGENT_API_KEY = process.env.AGENT_API_KEY;

// Middleware to authenticate agent service requests
function agentAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!AGENT_API_KEY || token !== AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized agent service' });
  }

  next();
}

// Process enrichment jobs (called by external agent service or cron)
router.post('/process-jobs', agentAuthMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.body;

    // Get queued jobs for CF monitoring
    const jobs = await prisma.agentJob.findMany({
      where: {
        status: 'queued',
        jobType: {
          in: ['enrich-monitored-firm', 'discover-cf-firms', 'fetch-news', 'fetch-deals']
        }
      },
      take: limit,
      orderBy: { createdAt: 'asc' }
    });

    if (jobs.length === 0) {
      return res.json({ message: 'No jobs to process', processed: 0 });
    }

    const results = [];

    for (const job of jobs) {
      // Update job status
      await prisma.agentJob.update({
        where: { id: job.id },
        data: { status: 'processing' }
      });

      try {
        let result;

        switch (job.jobType) {
          case 'enrich-monitored-firm':
            result = await enrichMonitoredFirm(job.payload);
            break;
          case 'discover-cf-firms':
            result = await discoverCFFirms(job.payload);
            break;
          case 'fetch-news':
            result = await fetchNews(job.payload);
            break;
          case 'fetch-deals':
            result = await fetchDeals(job.payload);
            break;
          default:
            throw new Error(`Unknown job type: ${job.jobType}`);
        }

        // Mark job as completed
        await prisma.agentJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            result,
            completedAt: new Date()
          }
        });

        results.push({ jobId: job.id, status: 'completed', result });
      } catch (error) {
        // Mark job as failed
        await prisma.agentJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: error.message
          }
        });

        results.push({ jobId: job.id, status: 'failed', error: error.message });
      }
    }

    res.json({
      message: `Processed ${results.length} jobs`,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Error processing jobs:', error);
    res.status(500).json({ error: 'Failed to process jobs' });
  }
});

// Helper: Enrich single monitored firm
async function enrichMonitoredFirm(payload) {
  const { monitoredFirmId, fullRefresh = false } = payload;

  const firm = await prisma.monitoredFirm.findUnique({
    where: { id: monitoredFirmId }
  });

  if (!firm) {
    throw new Error('Monitored firm not found');
  }

  const results = {
    firmData: null,
    deals: 0,
    news: 0,
    personnel: 0
  };

  // 1. Fetch company registry data
  if (firm.country === 'UK' && firm.registrationNumber) {
    try {
      const registryData = await fetchCompaniesHouseData(firm.registrationNumber);

      const firmData = await prisma.firmData.create({
        data: {
          monitoredFirmId,
          registryData,
          companyStatus: registryData.company_status,
          incorporationDate: registryData.date_of_creation ? new Date(registryData.date_of_creation) : null,
          sicCodes: registryData.sic_codes || [],
          dataSource: 'companies_house'
        }
      });

      results.firmData = firmData.id;
    } catch (error) {
      console.error('Companies House fetch failed:', error.message);
    }
  }

  // 2. Fetch recent news
  try {
    const articles = await fetchNewsForFirm(firm.firmName, firm.country);

    for (const article of articles) {
      try {
        await prisma.newsArticle.create({
          data: {
            monitoredFirmId,
            headline: article.title,
            summary: article.description,
            content: article.content,
            publishedAt: new Date(article.publishedAt),
            sourceUrl: article.url,
            sourceName: article.source.name,
            dataSource: 'news_api',
            rawData: article
          }
        });
        results.news++;
      } catch (e) {
        // Likely duplicate article (unique constraint), skip
        if (e.code !== 'P2002') {
          console.error('News article creation failed:', e.message);
        }
      }
    }
  } catch (error) {
    console.error('News fetch failed:', error.message);
  }

  // 3. Fetch deals from web scraping (placeholder - would use Puppeteer/Cheerio)
  try {
    const deals = await scrapeDealsForFirm(firm);
    results.deals = deals.length;
  } catch (error) {
    console.error('Deal scraping failed:', error.message);
  }

  // 4. Update firm's last update timestamp
  await prisma.monitoredFirm.update({
    where: { id: monitoredFirmId },
    data: {
      lastDataUpdate: new Date(),
      dataFreshnessScore: 100 // Fresh data
    }
  });

  return results;
}

// Helper: Fetch Companies House data
async function fetchCompaniesHouseData(companyNumber) {
  if (!COMPANIES_HOUSE_API_KEY) {
    throw new Error('COMPANIES_HOUSE_API_KEY not configured');
  }

  const response = await axios.get(
    `https://api.company-information.service.gov.uk/company/${companyNumber}`,
    {
      auth: {
        username: COMPANIES_HOUSE_API_KEY,
        password: ''
      },
      timeout: 10000
    }
  );

  return response.data;
}

// Helper: Fetch news articles
async function fetchNewsForFirm(firmName, country) {
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not configured, skipping news fetch');
    return [];
  }

  const searchQuery = `"${firmName}" AND (M&A OR merger OR acquisition OR deal)`;

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: searchQuery,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: NEWS_API_KEY
      },
      timeout: 10000
    });

    return response.data.articles || [];
  } catch (error) {
    console.error('NewsAPI fetch failed:', error.message);
    return [];
  }
}

// Helper: Scrape deals (placeholder - actual implementation would use web scraping)
async function scrapeDealsForFirm(firm) {
  // This would use Puppeteer or Cheerio to scrape:
  // - Firm's own website "Recent Deals" page
  // - Financial news sites
  // - Industry databases

  // For MVP, return empty array
  console.log(`Deal scraping not yet implemented for ${firm.firmName}`);
  return [];
}

// Helper: Fetch news (separate job type)
async function fetchNews(payload) {
  const { monitoredFirmId } = payload;
  return await enrichMonitoredFirm({ monitoredFirmId, newsOnly: true });
}

// Helper: Fetch deals (separate job type)
async function fetchDeals(payload) {
  const { monitoredFirmId } = payload;
  return await enrichMonitoredFirm({ monitoredFirmId, dealsOnly: true });
}

// Helper: Discover new firms from registries
async function discoverCFFirms(payload) {
  const { country, limit = 50, searchCriteria } = payload;

  const discovered = {
    uk: 0,
    switzerland: 0,
    total: 0
  };

  if (country === 'UK' || country === 'both') {
    try {
      const ukFirms = await discoverUKFirms(searchCriteria, limit);
      discovered.uk = ukFirms.length;
      discovered.total += ukFirms.length;
    } catch (error) {
      console.error('UK discovery failed:', error.message);
    }
  }

  if (country === 'Switzerland' || country === 'both') {
    try {
      const swissFirms = await discoverSwissFirms(searchCriteria, limit);
      discovered.switzerland = swissFirms.length;
      discovered.total += swissFirms.length;
    } catch (error) {
      console.error('Swiss discovery failed:', error.message);
    }
  }

  return discovered;
}

// Helper: Discover UK firms via Companies House
async function discoverUKFirms(searchCriteria, limit) {
  if (!COMPANIES_HOUSE_API_KEY) {
    throw new Error('COMPANIES_HOUSE_API_KEY not configured');
  }

  const discovered = [];

  // Search Companies House for firms matching criteria
  for (const keyword of searchCriteria.keywords) {
    try {
      const response = await axios.get(
        'https://api.company-information.service.gov.uk/search/companies',
        {
          params: {
            q: keyword,
            items_per_page: Math.min(limit, 100)
          },
          auth: {
            username: COMPANIES_HOUSE_API_KEY,
            password: ''
          },
          timeout: 10000
        }
      );

      for (const company of response.data.items || []) {
        // Check if already monitored
        const existing = await prisma.monitoredFirm.findFirst({
          where: {
            registrationNumber: company.company_number
          }
        });

        if (!existing && company.company_status === 'active') {
          // Add to monitored firms
          const firm = await prisma.monitoredFirm.create({
            data: {
              firmName: company.title,
              country: 'UK',
              registrationNumber: company.company_number,
              headquarters: company.address_snippet,
              discoverySource: 'companies_house',
              monitoringStatus: 'active'
            }
          });

          discovered.push(firm.id);

          // Create initial enrichment job
          await prisma.agentJob.create({
            data: {
              jobType: 'enrich-monitored-firm',
              status: 'queued',
              payload: { monitoredFirmId: firm.id, fullRefresh: true },
              monitoredFirmId: firm.id
            }
          });
        }

        if (discovered.length >= limit) break;
      }
    } catch (error) {
      console.error(`UK discovery failed for keyword "${keyword}":`, error.message);
    }

    if (discovered.length >= limit) break;
  }

  return discovered;
}

// Helper: Discover Swiss firms (placeholder)
async function discoverSwissFirms(searchCriteria, limit) {
  // Swiss Commercial Registry API integration would go here
  // For MVP, return empty array
  console.log('Swiss firm discovery not yet implemented');
  return [];
}

module.exports = router;
