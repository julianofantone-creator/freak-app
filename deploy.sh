#!/bin/bash

echo "🔥 Freaky Deployment Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required commands exist
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is required but not installed.${NC}"
        exit 1
    fi
}

echo -e "${BLUE}🔍 Checking dependencies...${NC}"
check_command npm
check_command git

# Install dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
npm install

echo -e "${BLUE}📦 Installing server dependencies...${NC}"
cd server
npm install
cd ..

# Create environment files if they don't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating frontend .env file...${NC}"
    cp .env.example .env
fi

if [ ! -f server/.env ]; then
    echo -e "${YELLOW}📝 Creating server .env file...${NC}"
    cp server/.env.example server/.env
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}🎯 Next steps:${NC}"
echo "1. Update .env files with your configuration"
echo "2. Start development:"
echo "   • Frontend: npm run dev"
echo "   • Backend:  cd server && npm run dev"
echo ""
echo -e "${BLUE}🚀 Production deployment:${NC}"
echo "1. Frontend: Connect repo to Netlify"
echo "2. Backend:  Connect repo to Railway/Render"
echo "3. Update environment variables in hosting platforms"
echo ""
echo -e "${GREEN}🔥 Ready to dominate the space!${NC}"