@echo off
REM CF Monitor Worker - Railway Deployment Script for Windows

echo ==========================================
echo   CF Monitor Worker - Railway Deployment
echo ==========================================
echo.

REM Check if Railway CLI is installed
where railway >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Railway CLI is not installed
    echo Install it with: npm i -g @railway/cli
    pause
    exit /b 1
)

echo [OK] Railway CLI found
echo.

REM Check if logged in
railway whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Please login to Railway (browser will open)...
    railway login
)

echo [OK] Logged in to Railway
echo.

REM Initialize project
echo Initializing Railway project...
railway init

echo.
echo Setting environment variables...

REM Set environment variables
railway variables set DATABASE_URL="postgres://52cef9be87c6f3d682c4b6e5af21bf3b0cf146e856b7dd267e16a2c2f84408df:sk_IfsaDH3jkuTFiGbbT41i-@db.prisma.io:5432/postgres?sslmode=require"

railway variables set AGENT_API_KEY="105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632"

railway variables set NODE_ENV="production"

echo.
echo [OK] Environment variables set
echo.

set /p add_api_keys="Do you want to add Companies House and News API keys now? (y/n): "
if /i "%add_api_keys%"=="y" (
    set /p ch_key="Enter Companies House API key (or press Enter to skip): "
    if not "%ch_key%"=="" (
        railway variables set COMPANIES_HOUSE_API_KEY="%ch_key%"
    )

    set /p news_key="Enter News API key (or press Enter to skip): "
    if not "%news_key%"=="" (
        railway variables set NEWS_API_KEY="%news_key%"
    )
)

echo.
echo Deploying to Railway...
railway up

echo.
echo Generating public domain...
railway domain

echo.
echo ==========================================
echo [OK] Deployment Complete!
echo ==========================================
echo.
echo Next steps:
echo 1. Copy the Railway URL shown above
echo 2. Add these to your main app environment variables:
echo    AGENT_SERVICE_URL=^<your-railway-url^>
echo    AGENT_API_KEY=105fd83624fd2a3c12f58ffe33fe06b6e54000c2fc7af97dca1280201abf5632
echo.
echo 3. Test the deployment:
echo    curl ^<your-railway-url^>/health
echo.
pause
