# Quick Start - Deploy in 5 Minutes

## 1. Generate API Key (30 seconds)

```bash
cd worker
node generate-api-key.js
```

Copy the generated key - you'll need it twice.

## 2. Deploy to Railway (2 minutes)

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select this repository
4. Set root directory: `worker`
5. Click "Deploy"

## 3. Add Environment Variables (1 minute)

In Railway dashboard → Variables:

```
DATABASE_URL=<copy from your main app>
AGENT_API_KEY=<paste generated key>
COMPANIES_HOUSE_API_KEY=<your key or leave empty>
NEWS_API_KEY=<your key or leave empty>
NODE_ENV=production
```

## 4. Generate Public URL (30 seconds)

Railway Settings → Networking → "Generate Domain"

Copy the URL.

## 5. Update Main App (1 minute)

Add to your main app's environment variables:

```
AGENT_SERVICE_URL=<paste Railway URL>
AGENT_API_KEY=<paste same key from step 1>
```

## 6. Test (30 seconds)

```bash
curl https://your-worker-url.railway.app/health
```

Should return: `{"status": "healthy"}`

## Done! 🎉

The worker is now deployed and ready to process jobs.

**Next:** Set up a cron job to run daily (see RAILWAY_DEPLOYMENT.md)
