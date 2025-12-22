# Railway Deployment Guide - CF Monitor Worker

This guide will walk you through deploying the CF Monitor Worker service to Railway.

## Overview

The worker service is a separate Node.js application that processes enrichment jobs for the Corporate Finance Monitor feature. It runs independently from the main SyndicatePlus application.

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub repository containing this codebase
- Database connection string (from your main app)
- API keys: Companies House API key, News API key

## Step 1: Prepare Environment Variables

First, generate a secure API key for the worker:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this key - you'll need it for both the worker and main app.

## Step 2: Deploy to Railway

### Option A: Deploy via Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**
   - Visit https://railway.app/dashboard
   - Click "New Project"

2. **Select Deployment Method**
   - Choose "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub
   - Select this repository

3. **Configure Service**
   - Railway will detect the Node.js app
   - Set **Root Directory** to `worker`
   - Railway will use the `railway.toml` config automatically

4. **Add Environment Variables**

   Go to the Variables tab and add:

   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   AGENT_API_KEY=<your-generated-api-key>
   COMPANIES_HOUSE_API_KEY=<your-companies-house-key>
   NEWS_API_KEY=<your-news-api-key>
   NODE_ENV=production
   ```

   **Important:** Use the same `DATABASE_URL` as your main app.

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (2-3 minutes)

6. **Get Public URL**
   - Go to Settings → Networking
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://cf-monitor-worker-production.up.railway.app`)

### Option B: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   cd worker
   railway init
   ```

4. **Link to Project**
   ```bash
   railway link
   ```

5. **Set Environment Variables**
   ```bash
   railway variables set DATABASE_URL="your-connection-string"
   railway variables set AGENT_API_KEY="your-api-key"
   railway variables set COMPANIES_HOUSE_API_KEY="your-key"
   railway variables set NEWS_API_KEY="your-key"
   railway variables set NODE_ENV="production"
   ```

6. **Deploy**
   ```bash
   railway up
   ```

## Step 3: Configure Main Application

After deploying the worker, update your main app's environment variables:

### On Vercel (if that's where main app is hosted):

1. Go to your project settings
2. Navigate to Environment Variables
3. Add:
   ```
   AGENT_SERVICE_URL=https://your-worker.railway.app
   AGENT_API_KEY=<same-key-as-worker>
   ```
4. Redeploy your main application

### Locally (.env file):

```bash
# Add to your .env file
AGENT_SERVICE_URL=https://your-worker.railway.app
AGENT_API_KEY=<same-key-as-worker>
```

## Step 4: Set Up Automated Job Processing

The worker needs to be triggered periodically to process jobs. You have two options:

### Option A: Railway Cron (Recommended)

1. In Railway dashboard, create a new service in the same project
2. Select "Cron Job" template
3. Configure:
   - **Schedule**: `0 2 * * *` (runs daily at 2 AM)
   - **Command**:
     ```bash
     curl -X POST https://your-worker.railway.app/api/process-jobs \
       -H "Authorization: Bearer YOUR_AGENT_API_KEY" \
       -H "Content-Type: application/json" \
       -d '{"limit": 50}'
     ```

### Option B: External Cron Service

Use a free service like cron-job.org or EasyCron:

1. Create account at https://cron-job.org
2. Create new cron job:
   - **URL**: `https://your-worker.railway.app/api/process-jobs`
   - **Method**: POST
   - **Headers**:
     ```
     Authorization: Bearer YOUR_AGENT_API_KEY
     Content-Type: application/json
     ```
   - **Body**: `{"limit": 50}`
   - **Schedule**: Daily at desired time

## Step 5: Test the Deployment

### Test 1: Health Check

```bash
curl https://your-worker.railway.app/health
```

Expected response:
```json
{"status": "healthy"}
```

### Test 2: Manually Trigger Job Processing

```bash
curl -X POST https://your-worker.railway.app/api/process-jobs \
  -H "Authorization: Bearer YOUR_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

Expected response:
```json
{
  "message": "Processed X jobs",
  "processed": X,
  "results": [...]
}
```

### Test 3: Create Test Job from Main App

1. Log into your admin dashboard
2. Go to CF Monitor
3. Add a test firm to monitor
4. Check Railway logs to see if the job was processed

## Step 6: Monitor and Troubleshoot

### View Logs

Railway Dashboard:
- Go to your worker service
- Click on "Deployments"
- Select latest deployment
- View real-time logs

Railway CLI:
```bash
cd worker
railway logs
```

### Common Issues

**Issue: Worker can't connect to database**
- Verify `DATABASE_URL` is correct
- Ensure database allows connections from Railway's IP range
- Check if database is running

**Issue: 401 Unauthorized errors**
- Verify `AGENT_API_KEY` matches in both worker and main app
- Check Authorization header format: `Bearer <key>`

**Issue: Jobs not processing**
- Check if jobs are being created in the database
- Verify cron job is running
- Check worker logs for errors

**Issue: Companies House API errors**
- Verify `COMPANIES_HOUSE_API_KEY` is valid
- Check rate limits
- Ensure API key has correct permissions

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AGENT_API_KEY` | Yes | Secure key for API authentication |
| `COMPANIES_HOUSE_API_KEY` | No | UK Companies House API key |
| `NEWS_API_KEY` | No | NewsAPI.org API key |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Auto-set by Railway (default: 4000) |

## Cost Estimation

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month for 500 hours
- **Pro Plan**: $20/month for unlimited usage

The worker service typically uses minimal resources:
- Memory: ~100MB
- CPU: Low (only active when processing jobs)
- Network: Minimal

Estimated cost: $5-10/month on Hobby plan

## Security Considerations

1. **Never commit API keys** - Always use environment variables
2. **Rotate AGENT_API_KEY** - Change periodically for security
3. **Monitor logs** - Watch for unauthorized access attempts
4. **Limit job processing** - Use reasonable `limit` values to prevent abuse
5. **Database access** - Ensure worker has read/write access only to required tables

## Next Steps

After successful deployment:

1. Monitor the first few job runs
2. Adjust cron schedule based on your needs
3. Set up Railway alerts for failures
4. Consider adding monitoring (e.g., Sentry, LogRocket)
5. Review and optimize job processing based on load

## Support

If you encounter issues:
- Check Railway docs: https://docs.railway.app
- Review worker logs
- Test locally first
- Check database connections
