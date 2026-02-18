# 🔥 Production Deployment Guide

## Quick Start (5 Minutes to Live)

```bash
# 1. Environment setup
./scripts/setup-env.sh

# 2. Validate configuration
node scripts/validate-env.js production

# 3. Deploy everything
./deploy-production.sh
```

**That's it! Your app should be live.** 🚀

---

## Detailed Deployment Process

### Phase 1: Pre-Deployment Setup (15 minutes)

#### 1.1 Domain & DNS
- [ ] Purchase domain (recommended: `freaky.app`)
- [ ] Configure DNS records (see `DOMAIN-SETUP.md`)
- [ ] Set up Cloudflare (optional but recommended)

#### 1.2 Service Accounts
Create accounts on these platforms:

**Essential Services:**
- [ ] [Netlify](https://netlify.com) - Frontend hosting
- [ ] [Railway](https://railway.app) - Backend hosting  
- [ ] [MongoDB Atlas](https://mongodb.com/atlas) - Database

**Analytics & Monitoring:**
- [ ] [Google Analytics](https://analytics.google.com)
- [ ] [Mixpanel](https://mixpanel.com) - User analytics
- [ ] [Sentry](https://sentry.io) - Error tracking

**Optional Enhancement:**
- [ ] [SendGrid](https://sendgrid.com) - Email delivery
- [ ] [Metered.ca](https://metered.ca) - TURN servers
- [ ] [UptimeRobot](https://uptimerobot.com) - Uptime monitoring

#### 1.3 Environment Configuration
```bash
# Run the interactive setup
./scripts/setup-env.sh

# Choose option 3 (Both development and production)
# Fill in all the API keys and secrets when prompted
```

### Phase 2: Platform Configuration (10 minutes)

#### 2.1 Netlify Setup
1. Connect your GitHub repository
2. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** `20`
3. Add environment variables from `.env.production`
4. Enable branch deploys for `staging`

#### 2.2 Railway Setup
1. Connect your GitHub repository
2. Select the `server/` directory as root
3. Add environment variables from `server/.env.production`
4. Enable automatic deployments
5. Configure custom domain: `api.freaky.app`

#### 2.3 MongoDB Atlas
1. Create a new cluster
2. Create database user with read/write permissions
3. Whitelist Railway's IP ranges (or use 0.0.0.0/0 for simplicity)
4. Get connection string and update `MONGODB_URI`

### Phase 3: Deployment (5 minutes)

#### 3.1 Automated Deployment
```bash
# This script handles everything
./deploy-production.sh
```

#### 3.2 Manual Deployment (if needed)
```bash
# Frontend to Netlify
npm install
npm run build
netlify deploy --prod --dir=dist

# Backend to Railway (push to main branch)
git push origin main
```

#### 3.3 Verification
```bash
# Check frontend
curl -I https://freaky.app

# Check backend API
curl https://api.freaky.app/health

# Check WebSocket
wscat -c wss://api.freaky.app
```

### Phase 4: Post-Deployment (10 minutes)

#### 4.1 Monitoring Setup
```bash
# Verify all services
node scripts/validate-env.js production

# Check SSL ratings (should be A+)
curl -s "https://api.ssllabs.com/api/v3/analyze?host=freaky.app"
```

#### 4.2 Analytics Verification
- [ ] Test Google Analytics events
- [ ] Verify Mixpanel tracking
- [ ] Check Sentry error capture
- [ ] Test email delivery (if configured)

#### 4.3 Performance Optimization
- [ ] Run Lighthouse audit (score >90)
- [ ] Test mobile performance
- [ ] Verify CDN caching
- [ ] Check Core Web Vitals

---

## Environment Variables Reference

### Frontend (.env.production)
```bash
# Core application
VITE_API_URL=https://api.freaky.app
VITE_WS_URL=wss://api.freaky.app
VITE_APP_NAME=Freaky
VITE_ENVIRONMENT=production

# Analytics
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_MIXPANEL_TOKEN=your_mixpanel_token
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CRASH_REPORTING=true
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_key

# Branding
VITE_APP_URL=https://freaky.app
VITE_SUPPORT_EMAIL=support@freaky.app
```

### Backend (server/.env.production)
```bash
# Core server
PORT=8080
NODE_ENV=production
FRONTEND_URL=https://freaky.app

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/freaky

# Security
JWT_SECRET=your-ultra-secure-jwt-secret-here
BCRYPT_ROUNDS=12
COOKIE_SECRET=your-cookie-secret

# WebRTC
TURN_SERVER_URL=turns:relay.metered.ca:443
TURN_SERVER_USERNAME=your_metered_username
TURN_SERVER_CREDENTIAL=your_metered_credential

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@freaky.app

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
MIXPANEL_TOKEN=your_mixpanel_token
LOG_LEVEL=info
```

---

## CI/CD Pipeline

### GitHub Actions Setup
The included workflow (`.github/workflows/deploy-production.yml`) handles:
- ✅ Frontend testing & building
- ✅ Backend testing & deployment
- ✅ Security scanning
- ✅ Performance monitoring
- ✅ Slack notifications

### Required GitHub Secrets
Add these to your repository settings:
```
NETLIFY_SITE_ID=your_netlify_site_id
NETLIFY_AUTH_TOKEN=your_netlify_token
RAILWAY_TOKEN=your_railway_token
GA_MEASUREMENT_ID=G-XXXXXXXXXX
MIXPANEL_TOKEN=your_mixpanel_token
SENTRY_DSN=https://xxx@sentry.io/xxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx
UPTIMEROBOT_API_KEY=your_uptimerobot_key
```

### Automatic Deployments
- **Main branch push** → Production deployment
- **Pull request** → Preview deployment  
- **Manual trigger** → Deploy with options

---

## Monitoring & Maintenance

### Essential Monitoring
1. **Uptime:** UptimeRobot checks every 30 seconds
2. **Errors:** Sentry alerts for critical errors
3. **Performance:** Weekly Lighthouse reports
4. **Security:** Monthly vulnerability scans

### Key Metrics to Track
- **User Engagement:** Session duration, return rate
- **Technical:** Uptime, response times, error rates
- **Business:** User registrations, feature usage
- **Performance:** Core Web Vitals, mobile scores

### Maintenance Schedule
- **Daily:** Check error rates and performance
- **Weekly:** Review analytics and user feedback
- **Monthly:** Security updates and dependency patches
- **Quarterly:** Performance optimization review

---

## Troubleshooting

### Common Issues

#### Frontend Not Loading
```bash
# Check build logs in Netlify
# Verify environment variables are set
# Check for CORS issues in browser console
```

#### Backend API Errors
```bash
# Check Railway deployment logs
# Verify MongoDB connection
# Test JWT secret configuration
```

#### WebSocket Connection Fails
```bash
# Check CORS settings in backend
# Verify WSS URLs match in frontend
# Test firewall/proxy settings
```

#### Analytics Not Working
```bash
# Verify tracking IDs in environment variables
# Check for ad blockers in testing
# Confirm event firing in browser console
```

### Emergency Procedures

#### Quick Rollback
```bash
# Netlify: Redeploy previous build from dashboard
# Railway: Redeploy previous commit
# Database: Restore from latest backup
```

#### Service Outage Response
1. Check status pages of all services
2. Notify users via status page
3. Switch to backup/fallback services
4. Document incident for post-mortem

---

## Security Checklist

### Pre-Launch Security
- [ ] All secrets properly configured (no defaults/placeholders)
- [ ] SSL/TLS certificates valid and A+ rated
- [ ] Security headers configured
- [ ] CORS properly restricted
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS protection enabled

### Ongoing Security
- [ ] Regular dependency updates
- [ ] Security monitoring alerts
- [ ] Regular backups
- [ ] Access control reviews
- [ ] Incident response plan

---

## Performance Targets

### Core Web Vitals
- **LCP (Largest Contentful Paint):** <2.5s
- **FID (First Input Delay):** <100ms  
- **CLS (Cumulative Layout Shift):** <0.1

### Application Performance
- **Time to Interactive:** <3s
- **Page Load Time:** <2s
- **API Response Time:** <200ms
- **WebSocket Connection:** <1s

### Lighthouse Scores (Mobile)
- **Performance:** >90
- **Accessibility:** >95
- **Best Practices:** >90
- **SEO:** >90
- **PWA:** >80

---

## Cost Estimation

### Monthly Operating Costs
| Service | Cost | Usage |
|---------|------|-------|
| Netlify Pro | $19 | Unlimited builds, forms |
| Railway Pro | $20 | Backend hosting, databases |
| MongoDB Atlas | $0-57 | Shared cluster → Dedicated |
| Cloudflare Pro | $20 | CDN, security, analytics |
| SendGrid | $15 | 40K emails/month |
| Sentry | $26 | 10K errors/month |
| **Total** | **$100-157** | Professional setup |

### Scaling Costs
- **10K users:** ~$200/month
- **50K users:** ~$500/month  
- **100K users:** ~$1000/month

---

## Launch Strategy

### Phase 1: Soft Launch (Week 1)
- [ ] Deploy to production
- [ ] Test with small group (friends/family)
- [ ] Monitor for critical bugs
- [ ] Gather initial feedback

### Phase 2: Public Launch (Week 2)
- [ ] Social media announcement
- [ ] Product Hunt submission
- [ ] Reddit marketing
- [ ] Influencer outreach

### Phase 3: Growth (Month 1)
- [ ] Content marketing
- [ ] SEO optimization
- [ ] Feature iterations
- [ ] User acquisition campaigns

---

## Success Metrics

### Week 1 Targets
- [ ] 100+ unique users
- [ ] 95%+ uptime
- [ ] <5 critical bugs
- [ ] Positive user feedback

### Month 1 Targets  
- [ ] 1,000+ unique users
- [ ] 20%+ user retention
- [ ] 5+ viral moments
- [ ] Media coverage

### Month 3 Targets
- [ ] 10,000+ unique users
- [ ] Revenue stream launched
- [ ] Mobile app development
- [ ] Series A considerations

---

## 🎉 You're Ready to Launch!

With this deployment setup, you have:
- ✅ **Professional infrastructure** (Netlify + Railway + MongoDB)
- ✅ **Comprehensive monitoring** (Sentry + Analytics + Uptime)  
- ✅ **Automated deployments** (GitHub Actions CI/CD)
- ✅ **Security hardening** (SSL + Headers + Rate limiting)
- ✅ **Performance optimization** (CDN + Caching + Monitoring)
- ✅ **Scalability planning** (Environment configs + Documentation)

**Time to get freaky! 🔥🔥🔥**

---

**Need help?** Check the troubleshooting section or reach out to the team.
**Found a bug?** Report it with full context and reproduction steps.
**Have ideas?** Document them and prioritize based on user feedback.