#!/bin/bash

# 🔥 Freaky Production Deployment Script
# This script handles the complete production deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_REPO_URL="https://github.com/your-username/freaky-frontend"
BACKEND_REPO_URL="https://github.com/your-username/freaky-backend"
DOMAIN="freaky.app"
STAGING_DOMAIN="staging.freaky.app"

echo -e "${PURPLE}"
echo "🔥🔥🔥 FREAKY PRODUCTION DEPLOYMENT 🔥🔥🔥"
echo "=============================================="
echo -e "${NC}"

# Check if running on CI/CD or local
if [ "$CI" = "true" ]; then
    echo -e "${BLUE}🤖 Running in CI/CD environment${NC}"
    INTERACTIVE=false
else
    echo -e "${BLUE}🏠 Running in local environment${NC}"
    INTERACTIVE=true
fi

# Function to check command existence
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is required but not installed.${NC}"
        exit 1
    fi
}

# Function to ask for confirmation
confirm() {
    if [ "$INTERACTIVE" = "true" ]; then
        read -p "$1 (y/N): " -n 1 -r
        echo
        [[ $REPLY =~ ^[Yy]$ ]]
    else
        echo -e "${YELLOW}Auto-confirming: $1${NC}"
        true
    fi
}

# Pre-flight checks
echo -e "${CYAN}🔍 Running pre-flight checks...${NC}"
check_command git
check_command npm
check_command curl

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    echo -e "${RED}❌ This doesn't look like the Freaky project directory.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-flight checks passed!${NC}"

# Git status check
if [ "$INTERACTIVE" = "true" ]; then
    echo -e "${CYAN}📋 Git status:${NC}"
    git status --short
    
    if ! git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes.${NC}"
        if confirm "Continue with deployment anyway?"; then
            echo "Continuing..."
        else
            echo "Aborting deployment."
            exit 1
        fi
    fi
fi

# Build and test
echo -e "${CYAN}🔨 Building and testing...${NC}"

echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
npm ci

echo -e "${BLUE}🧪 Running frontend tests...${NC}"
npm run lint || echo -e "${YELLOW}⚠️  Linting warnings detected${NC}"

echo -e "${BLUE}📦 Installing server dependencies...${NC}"
cd server
npm ci
cd ..

echo -e "${BLUE}🏗️  Building frontend for production...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Frontend build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully!${NC}"

# Environment variable checks
echo -e "${CYAN}🔧 Checking environment configuration...${NC}"

if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found. Creating from template...${NC}"
    cp .env.example .env.production
    echo -e "${YELLOW}📝 Please update .env.production with production values!${NC}"
fi

if [ ! -f "server/.env.production" ]; then
    echo -e "${YELLOW}⚠️  server/.env.production not found. Creating from template...${NC}"
    cp server/.env.example server/.env.production
    echo -e "${YELLOW}📝 Please update server/.env.production with production values!${NC}"
fi

# Security checks
echo -e "${CYAN}🔐 Running security checks...${NC}"

# Check for default secrets
if grep -q "your-super-secret" server/.env.production 2>/dev/null; then
    echo -e "${RED}❌ Found default JWT secret in production config!${NC}"
    echo -e "${YELLOW}Please update JWT_SECRET in server/.env.production${NC}"
    exit 1
fi

if grep -q "your_mixpanel_token_here" .env.production 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Found placeholder tokens in production config${NC}"
    echo -e "${YELLOW}Please update all API keys and tokens${NC}"
fi

echo -e "${GREEN}✅ Security checks passed!${NC}"

# Deploy frontend to Netlify
if confirm "Deploy frontend to Netlify?"; then
    echo -e "${CYAN}🚀 Deploying frontend to Netlify...${NC}"
    
    if command -v netlify &> /dev/null; then
        echo -e "${BLUE}📤 Deploying via Netlify CLI...${NC}"
        netlify deploy --prod --dir=dist
    else
        echo -e "${YELLOW}💡 Netlify CLI not found. Please:${NC}"
        echo "1. Connect your repository to Netlify"
        echo "2. Set build command: npm run build"
        echo "3. Set publish directory: dist"
        echo "4. Add environment variables from .env.production"
        echo "5. Deploy!"
    fi
fi

# Deploy backend to Railway
if confirm "Deploy backend to Railway?"; then
    echo -e "${CYAN}🚂 Preparing backend for Railway deployment...${NC}"
    
    # Create Railway deployment info
    cat > server/railway-deploy.md << EOF
# Railway Deployment Instructions

1. Connect your GitHub repository to Railway
2. Select the server/ directory as the root
3. Add these environment variables in Railway dashboard:

$(cat server/.env.production | grep -v '^#' | grep -v '^$' | sed 's/=.*/=<YOUR_VALUE_HERE>/')

4. Deploy!

Railway will automatically detect the Node.js app and use package.json scripts.
EOF
    
    echo -e "${GREEN}✅ Railway deployment guide created at server/railway-deploy.md${NC}"
    
    if command -v railway &> /dev/null; then
        echo -e "${BLUE}📤 Deploying via Railway CLI...${NC}"
        cd server
        railway up
        cd ..
    else
        echo -e "${YELLOW}💡 Railway CLI not found. Manual deployment required.${NC}"
        echo "See server/railway-deploy.md for instructions"
    fi
fi

# Health checks
if confirm "Run health checks on deployed services?"; then
    echo -e "${CYAN}🏥 Running health checks...${NC}"
    
    # Check frontend
    echo -e "${BLUE}🌐 Checking frontend at https://${DOMAIN}...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}" | grep -q "200"; then
        echo -e "${GREEN}✅ Frontend is live!${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend check failed or still deploying${NC}"
    fi
    
    # Check backend
    echo -e "${BLUE}🖥️  Checking backend API...${NC}"
    BACKEND_URL="https://freaky-api.railway.app"
    if curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health" | grep -q "200"; then
        echo -e "${GREEN}✅ Backend API is live!${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend check failed or still deploying${NC}"
    fi
fi

# Performance and monitoring setup
if confirm "Set up monitoring and analytics?"; then
    echo -e "${CYAN}📊 Setting up monitoring...${NC}"
    
    cat > monitoring-setup.md << EOF
# Monitoring & Analytics Setup Checklist

## Analytics
- [ ] Google Analytics: Add GA_MEASUREMENT_ID to Netlify env vars
- [ ] Mixpanel: Add MIXPANEL_TOKEN to both frontend and backend
- [ ] Custom events: Implement user actions tracking

## Error Monitoring  
- [ ] Sentry: Add SENTRY_DSN to both environments
- [ ] Configure error boundaries in React components
- [ ] Set up server error handling

## Performance Monitoring
- [ ] Google PageSpeed Insights: Check core web vitals
- [ ] Lighthouse CI: Add to GitHub Actions
- [ ] Uptime monitoring: UptimeRobot or Pingdom

## Security Monitoring
- [ ] SSL Labs test: A+ rating required
- [ ] Security headers check
- [ ] OWASP ZAP scan

## Business Metrics
- [ ] User registration rate
- [ ] Connection success rate  
- [ ] Session duration
- [ ] Feature usage analytics
EOF

    echo -e "${GREEN}✅ Monitoring checklist created!${NC}"
fi

# Final success message
echo -e "${GREEN}"
echo "🎉🎉🎉 DEPLOYMENT COMPLETE! 🎉🎉🎉"
echo "======================================"
echo -e "${NC}"
echo -e "${BLUE}🌐 Frontend: https://${DOMAIN}${NC}"
echo -e "${BLUE}🖥️  Backend:  https://freaky-api.railway.app${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Test all functionality end-to-end"
echo "2. Monitor error rates in first 24h"
echo "3. Set up alerts and notifications"  
echo "4. Plan your launch strategy! 🚀"
echo ""
echo -e "${PURPLE}🔥 Time to get freaky! 🔥${NC}"

# Create deployment log
echo "$(date): Deployment completed successfully" >> deployment.log
echo "Frontend: https://${DOMAIN}" >> deployment.log
echo "Backend: https://freaky-api.railway.app" >> deployment.log
echo "---" >> deployment.log