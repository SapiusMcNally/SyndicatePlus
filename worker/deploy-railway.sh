#!/bin/bash

# CF Monitor Worker - Railway Deployment Script

echo "=========================================="
echo "  CF Monitor Worker - Railway Deployment"
echo "=========================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed"
    echo "Install it with: npm i -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "📝 Please login to Railway (browser will open)..."
    railway login
fi

echo "✅ Logged in to Railway"
echo ""

# Initialize project
echo "🚀 Initializing Railway project..."
railway init

echo ""
echo "⚙️  Setting environment variables..."

# Set environment variables
railway variables set DATABASE_URL="postgres://52cef9be87c6f3d682c4b6e5af21bf3b0cf146e856b7dd267e16a2c2f84408df:sk_IfsaDH3jkuTFiGbbT41i-@db.prisma.io:5432/postgres?sslmode=require"

railway variables set AGENT_API_KEY="105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632"

railway variables set NODE_ENV="production"

# Optional: Set API keys if you have them
read -p "Do you have a Companies House API key? (y/n): " has_ch_key
if [[ $has_ch_key == "y" ]]; then
    read -p "Enter Companies House API key: " ch_key
    railway variables set COMPANIES_HOUSE_API_KEY="$ch_key"
fi

read -p "Do you have a News API key? (y/n): " has_news_key
if [[ $has_news_key == "y" ]]; then
    read -p "Enter News API key: " news_key
    railway variables set NEWS_API_KEY="$news_key"
fi

echo ""
echo "✅ Environment variables set"
echo ""
echo "🚀 Deploying to Railway..."

# Deploy
railway up

echo ""
echo "🌐 Generating public domain..."
railway domain

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy the Railway URL shown above"
echo "2. Add these to your main app environment variables:"
echo "   AGENT_SERVICE_URL=<your-railway-url>"
echo "   AGENT_API_KEY=105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632"
echo ""
echo "3. Test the deployment:"
echo "   curl <your-railway-url>/health"
echo ""
