# Deploy Right Now - Choose Your Method

## 🚀 EASIEST: Automated Script (Windows)

Simply double-click or run:

```bash
cd worker
deploy-railway.bat
```

This will:
- Login to Railway
- Create project
- Set all environment variables
- Deploy the service
- Generate public URL

---

## 📝 Manual CLI Deployment (Step by Step)

Open your terminal in the `worker` directory and run these commands one by one:

### Step 1: Login
```bash
railway login
```
*(Browser will open - authorize the app)*

### Step 2: Initialize Project
```bash
railway init
```
*(Choose "Create new project" and give it a name like "cf-monitor-worker")*

### Step 3: Set Environment Variables

```bash
railway variables set DATABASE_URL="postgres://52cef9be87c6f3d682c4b6e5af21bf3b0cf146e856b7dd267e16a2c2f84408df:sk_IfsaDH3jkuTFiGbbT41i-@db.prisma.io:5432/postgres?sslmode=require"
```

```bash
railway variables set AGENT_API_KEY="105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632"
```

```bash
railway variables set NODE_ENV="production"
```

**Optional** (if you have these keys):
```bash
railway variables set COMPANIES_HOUSE_API_KEY="your-key-here"
railway variables set NEWS_API_KEY="your-key-here"
```

### Step 4: Deploy
```bash
railway up
```

### Step 5: Generate Public URL
```bash
railway domain
```

Copy the URL that's generated (e.g., `https://cf-monitor-worker-production.up.railway.app`)

---

## 🌐 Alternative: Web Dashboard Deployment

If you prefer using the web interface:

### 1. Go to Railway Dashboard
Visit: https://railway.app/new

### 2. Deploy from GitHub
- Click "Deploy from GitHub repo"
- Select your `SyndicatePlus` repository
- **Important**: Set "Root Directory" to `worker`
- Click "Deploy"

### 3. Add Environment Variables
Go to your project → Variables tab → Add these:

```
DATABASE_URL=postgres://52cef9be87c6f3d682c4b6e5af21bf3b0cf146e856b7dd267e16a2c2f84408df:sk_IfsaDH3jkuTFiGbbT41i-@db.prisma.io:5432/postgres?sslmode=require

AGENT_API_KEY=105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632

NODE_ENV=production
```

### 4. Generate Domain
- Go to Settings → Networking
- Click "Generate Domain"
- Copy the URL

---

## ✅ After Deployment

Once deployed, you'll get a URL like: `https://your-worker.railway.app`

### Test It:

```bash
curl https://your-worker.railway.app/health
```

Should return: `{"status":"healthy"}`

### Update Main App:

Add these to your **Vercel** environment variables:

```
AGENT_SERVICE_URL=https://your-worker.railway.app
AGENT_API_KEY=105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632
```

Then redeploy your main app on Vercel.

---

## 🔧 Troubleshooting

**"Railway CLI not found"**
```bash
npm install -g @railway/cli
```

**"Unauthorized"**
```bash
railway login
```

**"Deployment failed"**
- Check Railway logs in dashboard
- Verify DATABASE_URL is correct
- Ensure all required variables are set

**Need help?**
- Railway Docs: https://docs.railway.app
- Check `RAILWAY_DEPLOYMENT.md` for detailed guide
