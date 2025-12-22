# CF Monitor Worker Service

This is a standalone worker service for the Corporate Finance Monitor feature. It processes enrichment jobs for monitored firms by scraping company registries, news APIs, and other data sources.

## Features

- Fetches Companies House data for UK firms
- Scrapes news articles related to M&A activity
- Processes enrichment jobs asynchronously
- Can be triggered via API or cron schedule

## Deployment to Railway

### Prerequisites

1. Railway account (https://railway.app)
2. Railway CLI installed (optional but recommended)
3. Database connection string from main app

### Steps

1. **Create New Project in Railway**
   - Go to https://railway.app/new
   - Select "Deploy from GitHub repo" or "Empty Project"

2. **Connect Your Repository**
   - Link your GitHub repository
   - Select the repository containing this worker
   - Set the root directory to `/worker`

3. **Configure Environment Variables**

   Add the following environment variables in Railway dashboard:

   ```
   DATABASE_URL=<your-postgres-connection-string>
   AGENT_API_KEY=<generate-secure-random-key>
   COMPANIES_HOUSE_API_KEY=<your-companies-house-api-key>
   NEWS_API_KEY=<your-news-api-key>
   NODE_ENV=production
   ```

4. **Deploy**
   - Railway will automatically detect the `railway.toml` config
   - The service will build and deploy

5. **Get Service URL**
   - After deployment, Railway provides a public URL
   - Copy this URL (e.g., `https://your-worker.railway.app`)

6. **Configure Main App**

   Update your main app's environment variables:

   ```
   AGENT_SERVICE_URL=https://your-worker.railway.app
   AGENT_API_KEY=<same-key-as-worker>
   ```

### Setting Up Cron Jobs

Railway supports cron jobs to run the worker on a schedule:

1. **Add Cron Service in Railway**
   - Create a new service in the same project
   - Configure it to call your worker endpoint

2. **Or Use External Cron (Recommended)**
   - Use a service like cron-job.org or EasyCron
   - Schedule POST request to: `https://your-worker.railway.app/api/process-jobs`
   - Add Authorization header: `Bearer <AGENT_API_KEY>`
   - Run daily or as needed

## API Endpoints

### `POST /api/process-jobs`

Processes queued enrichment jobs.

**Headers:**
```
Authorization: Bearer <AGENT_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "limit": 10
}
```

**Response:**
```json
{
  "message": "Processed 5 jobs",
  "processed": 5,
  "results": [...]
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

3. Run the worker:
   ```bash
   npm start
   ```

4. Test the endpoint:
   ```bash
   curl -X POST http://localhost:4000/api/process-jobs \
     -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     -d '{"limit": 5}'
   ```

## Monitoring

- Check Railway logs for job processing status
- Monitor database for job status changes
- Set up alerts for failed jobs in Railway dashboard
