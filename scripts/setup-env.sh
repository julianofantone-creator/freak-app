#!/bin/bash

# 🔥 Freaky Environment Setup Script
# This script helps configure environment variables for different environments

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🔥 Freaky Environment Setup${NC}"
echo "================================="

# Check if script is being run from project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

# Function to prompt for input with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        echo "${input:-$default}"
    else
        read -p "$prompt: " input
        echo "$input"
    fi
}

# Environment selection
echo -e "${BLUE}Select environment to configure:${NC}"
echo "1) Development (local)"
echo "2) Production"
echo "3) Both"
read -p "Choose (1-3): " env_choice

case $env_choice in
    1) environments=("development") ;;
    2) environments=("production") ;;
    3) environments=("development" "production") ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

# Configure environments
for env in "${environments[@]}"; do
    echo -e "\n${CYAN}🔧 Configuring $env environment...${NC}"
    
    if [ "$env" = "development" ]; then
        env_file=".env"
        api_url="http://localhost:8080"
        ws_url="ws://localhost:8080"
        mongodb_uri="mongodb://localhost:27017/freaky"
        frontend_url="http://localhost:3000"
    else
        env_file=".env.production"
        api_url="https://freaky-api.railway.app"
        ws_url="wss://freaky-api.railway.app"
        mongodb_uri="mongodb+srv://username:password@cluster.mongodb.net/freaky"
        frontend_url="https://freaky.app"
    fi
    
    # Frontend environment variables
    echo -e "${YELLOW}📱 Frontend Configuration${NC}"
    
    cat > "$env_file" << EOF
# Frontend Environment Variables - $env
VITE_API_URL=$api_url
VITE_WS_URL=$ws_url
VITE_APP_NAME=Freaky
VITE_ENVIRONMENT=$env

# Analytics & Monitoring
EOF

    if [ "$env" = "production" ]; then
        ga_id=$(prompt_with_default "Google Analytics ID (GA-XXXXXXXXXX)" "" "ga_id")
        mixpanel_token=$(prompt_with_default "Mixpanel Token" "" "mixpanel_token")
        sentry_dsn=$(prompt_with_default "Sentry DSN" "" "sentry_dsn")
        recaptcha_key=$(prompt_with_default "reCAPTCHA Site Key" "" "recaptcha_key")
        
        cat >> "$env_file" << EOF
VITE_GOOGLE_ANALYTICS_ID=$ga_id
VITE_MIXPANEL_TOKEN=$mixpanel_token
VITE_SENTRY_DSN=$sentry_dsn

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CRASH_REPORTING=true
VITE_ENABLE_PERFORMANCE_MONITORING=true

# Security
VITE_RECAPTCHA_SITE_KEY=$recaptcha_key

# Social sharing
VITE_APP_URL=$frontend_url
VITE_SUPPORT_EMAIL=support@freaky.app

# Performance
VITE_CDN_URL=https://cdn.freaky.app
VITE_ENABLE_SERVICE_WORKER=true
EOF
    else
        cat >> "$env_file" << EOF
VITE_GOOGLE_ANALYTICS_ID=
VITE_MIXPANEL_TOKEN=
VITE_SENTRY_DSN=

# Feature flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_CRASH_REPORTING=false
VITE_ENABLE_PERFORMANCE_MONITORING=false

# Security
VITE_RECAPTCHA_SITE_KEY=

# Social sharing
VITE_APP_URL=$frontend_url
VITE_SUPPORT_EMAIL=hello@freaky.app
EOF
    fi

    echo -e "${GREEN}✅ Frontend $env_file created${NC}"
    
    # Backend environment variables
    echo -e "${YELLOW}🖥️  Backend Configuration${NC}"
    
    server_env_file="server/$env_file"
    jwt_secret=$(generate_secret)
    cookie_secret=$(generate_secret)
    
    cat > "$server_env_file" << EOF
# Backend Environment Variables - $env
PORT=8080
NODE_ENV=$env

# Frontend URL (for CORS)
FRONTEND_URL=$frontend_url

# Database
MONGODB_URI=$mongodb_uri

# JWT Configuration
JWT_SECRET=$jwt_secret

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
EOF

    if [ "$env" = "production" ]; then
        echo -e "${BLUE}🔒 Production Security Configuration${NC}"
        
        mongodb_prod=$(prompt_with_default "MongoDB Atlas Connection String" "$mongodb_uri" "mongodb_prod")
        turn_server=$(prompt_with_default "TURN Server URL (e.g., turns:relay.metered.ca:443)" "" "turn_server")
        turn_user=$(prompt_with_default "TURN Server Username" "" "turn_user")
        turn_cred=$(prompt_with_default "TURN Server Credential" "" "turn_cred")
        redis_url=$(prompt_with_default "Redis URL (optional)" "" "redis_url")
        sendgrid_key=$(prompt_with_default "SendGrid API Key" "" "sendgrid_key")
        
        cat >> "$server_env_file" << EOF
RATE_LIMIT_MAX_REQUESTS=50
RATE_LIMIT_SKIP_FAILED_REQUESTS=true

# WebRTC Configuration  
TURN_SERVER_URL=$turn_server
TURN_SERVER_USERNAME=$turn_user
TURN_SERVER_CREDENTIAL=$turn_cred

# Redis for session storage
REDIS_URL=$redis_url

# Monitoring & Analytics
SENTRY_DSN=$sentry_dsn
MIXPANEL_TOKEN=$mixpanel_token

# Email configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=$sendgrid_key
FROM_EMAIL=noreply@freaky.app

# Security
BCRYPT_ROUNDS=12
COOKIE_SECRET=$cookie_secret
TRUSTED_PROXIES=127.0.0.1,::1

# File uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp

# Feature flags
ENABLE_USER_REGISTRATION=true
ENABLE_ROOM_CREATION=true
ENABLE_ANALYTICS=true
ENABLE_RATE_LIMITING=true

# Performance
CLUSTER_WORKERS=0
SOCKET_TIMEOUT=30000
REQUEST_TIMEOUT=30000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
EOF
    else
        cat >> "$server_env_file" << EOF
RATE_LIMIT_MAX_REQUESTS=100

# WebRTC Configuration
TURN_SERVER_URL=
TURN_SERVER_USERNAME=
TURN_SERVER_CREDENTIAL=

# Redis (optional for development)
REDIS_URL=

# Monitoring (disabled for development)
SENTRY_DSN=
MIXPANEL_TOKEN=

# Email (use console for development)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=hello@freaky.local

# Security
BCRYPT_ROUNDS=10
COOKIE_SECRET=$cookie_secret

# Feature flags
ENABLE_USER_REGISTRATION=true
ENABLE_ROOM_CREATION=true
ENABLE_ANALYTICS=false
ENABLE_RATE_LIMITING=true

# Performance
CLUSTER_WORKERS=0
SOCKET_TIMEOUT=30000

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
EOF
    fi

    echo -e "${GREEN}✅ Backend $server_env_file created${NC}"
done

# Create environment validation script
echo -e "\n${CYAN}🔍 Creating environment validation script...${NC}"

cat > "scripts/validate-env.js" << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Required environment variables for each environment
const requiredVars = {
  frontend: {
    development: ['VITE_API_URL', 'VITE_WS_URL', 'VITE_APP_NAME'],
    production: [
      'VITE_API_URL', 'VITE_WS_URL', 'VITE_APP_NAME', 
      'VITE_GOOGLE_ANALYTICS_ID', 'VITE_MIXPANEL_TOKEN'
    ]
  },
  backend: {
    development: ['PORT', 'NODE_ENV', 'FRONTEND_URL', 'MONGODB_URI', 'JWT_SECRET'],
    production: [
      'PORT', 'NODE_ENV', 'FRONTEND_URL', 'MONGODB_URI', 'JWT_SECRET',
      'TURN_SERVER_URL', 'SMTP_PASS'
    ]
  }
};

function validateEnvFile(filePath, requiredVars, envName) {
  console.log(`\n🔍 Validating ${envName}...`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${filePath} not found`);
    return false;
  }
  
  const envContent = fs.readFileSync(filePath, 'utf8');
  const envVars = {};
  
  // Parse environment variables
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && !key.startsWith('#')) {
      envVars[key.trim()] = value?.trim();
    }
  });
  
  let isValid = true;
  
  requiredVars.forEach(varName => {
    if (!envVars[varName] || envVars[varName] === '') {
      console.error(`❌ Missing or empty: ${varName}`);
      isValid = false;
    } else if (envVars[varName].includes('your-') || envVars[varName].includes('_here')) {
      console.warn(`⚠️  Placeholder detected: ${varName}`);
    } else {
      console.log(`✅ ${varName}`);
    }
  });
  
  return isValid;
}

// Validate environments
const env = process.argv[2] || 'development';
let allValid = true;

// Frontend validation
const frontendFile = env === 'production' ? '.env.production' : '.env';
if (!validateEnvFile(frontendFile, requiredVars.frontend[env], `Frontend (${frontendFile})`)) {
  allValid = false;
}

// Backend validation
const backendFile = `server/${frontendFile}`;
if (!validateEnvFile(backendFile, requiredVars.backend[env], `Backend (${backendFile})`)) {
  allValid = false;
}

if (allValid) {
  console.log('\n🎉 All environment variables are properly configured!');
  process.exit(0);
} else {
  console.log('\n🚨 Please fix the missing or placeholder values above');
  process.exit(1);
}
EOF

chmod +x scripts/validate-env.js

echo -e "${GREEN}✅ Environment validation script created${NC}"

# Final instructions
echo -e "\n${PURPLE}🎯 Next Steps:${NC}"
echo "1. Review and update the generated .env files"
echo "2. Replace any placeholder values with real credentials"
echo "3. Run validation: node scripts/validate-env.js [development|production]"
echo "4. Never commit .env files to git!"
echo ""
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo "• Keep your JWT_SECRET secure and unique per environment"
echo "• Use strong, unique passwords for databases"
echo "• Enable 2FA on all service accounts"
echo "• Rotate secrets regularly"
echo ""
echo -e "${GREEN}🔥 Environment setup complete! Ready to get freaky! 🔥${NC}"