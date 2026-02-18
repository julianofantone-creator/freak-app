# 🌐 Domain Configuration Guide

## Domain Strategy

### Recommended Domain Options
1. **freaky.app** ⭐ (Premium - perfect branding)
2. **getfreaky.com** (Alternative main domain)
3. **freakyvideo.chat** (Descriptive)
4. **freaky.live** (Live streaming focus)

### Subdomain Architecture
```
freaky.app                    → Frontend (Netlify)
api.freaky.app               → Backend API (Railway)
ws.freaky.app                → WebSocket connections
staging.freaky.app           → Staging frontend
staging-api.freaky.app       → Staging backend
docs.freaky.app              → Documentation
status.freaky.app            → Status page
admin.freaky.app             → Admin panel
```

## DNS Configuration

### Required DNS Records

#### Main Production Setup
```
# Frontend (Netlify)
freaky.app                   CNAME   netlify-app.netlify.app
www.freaky.app              CNAME   netlify-app.netlify.app

# Backend (Railway) - use custom domain
api.freaky.app              CNAME   freaky-api.up.railway.app
ws.freaky.app               CNAME   freaky-api.up.railway.app

# Staging
staging.freaky.app          CNAME   staging-netlify.netlify.app
staging-api.freaky.app      CNAME   freaky-staging.up.railway.app
```

#### Security & Performance
```
# Root domain redirect
@                           A       104.248.53.131  (redirect service)

# Email & verification
_dmarc.freaky.app          TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@freaky.app"
freaky.app                 TXT     "v=spf1 include:sendgrid.net ~all"
default._domainkey.freaky.app TXT  "k=rsa; p=<DKIM_PUBLIC_KEY>"

# Security verification
freaky.app                 TXT     "google-site-verification=<GOOGLE_VERIFICATION>"
freaky.app                 TXT     "facebook-domain-verification=<FB_VERIFICATION>"
```

## SSL/TLS Configuration

### Netlify SSL (Automatic)
- ✅ Let's Encrypt certificates auto-renewed
- ✅ HTTP/2 enabled by default
- ✅ HSTS headers configured in netlify.toml

### Railway SSL (Automatic)
- ✅ Automatic HTTPS for custom domains
- ✅ TLS 1.3 support
- ✅ Certificate auto-renewal

### Security Headers Validation
Use these tools to verify your SSL setup:
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)
- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)

Target: **A+ rating** on all tests.

## CDN & Performance

### Cloudflare Setup (Recommended)
1. Add domain to Cloudflare
2. Update nameservers at registrar
3. Configure DNS records as proxy (🟠)
4. Enable these features:
   - ✅ Auto Minify (HTML, CSS, JS)
   - ✅ Brotli Compression
   - ✅ HTTP/3 (QUIC)
   - ✅ 0-RTT Connection Resumption
   - ✅ TLS 1.3

### Caching Strategy
```
# Static assets - 1 year
*.js, *.css, *.woff2, *.png, *.jpg, *.gif
Cache-Control: public, max-age=31536000, immutable

# API responses - No cache
/api/*
Cache-Control: no-cache, no-store, must-revalidate

# HTML - Revalidate
*.html
Cache-Control: public, max-age=0, must-revalidate
```

## Email Configuration

### SendGrid Setup
```bash
# DNS Records for SendGrid
em1234.freaky.app          CNAME   u1234567.wl134.sendgrid.net
s1._domainkey.freaky.app   CNAME   s1.domainkey.u1234567.wl134.sendgrid.net
s2._domainkey.freaky.app   CNAME   s2.domainkey.u1234567.wl134.sendgrid.net
```

### Email Addresses Needed
- `noreply@freaky.app` - System notifications
- `support@freaky.app` - User support
- `security@freaky.app` - Security reports
- `hello@freaky.app` - General inquiries

## Domain Verification

### Google Search Console
1. Add property for `https://freaky.app`
2. Verify via DNS TXT record
3. Submit sitemap: `https://freaky.app/sitemap.xml`

### Social Media Verification
```bash
# Facebook Domain Verification
freaky.app  TXT  "facebook-domain-verification=abc123def456"

# Twitter/X Domain Verification  
freaky.app  TXT  "twitter-domain-verification=abc123"
```

## Monitoring & Alerts

### Uptime Monitoring
Set up monitoring for:
- ✅ `https://freaky.app` (every 30 seconds)
- ✅ `https://api.freaky.app/health` (every 60 seconds)
- ✅ `wss://ws.freaky.app` (WebSocket connectivity)

### DNS Monitoring
- Monitor DNS propagation globally
- Set up alerts for DNS changes
- Track certificate expiration dates

## Domain Purchase & Setup Checklist

### Pre-Purchase
- [ ] Check domain availability on multiple registrars
- [ ] Verify trademark conflicts
- [ ] Check social media handle availability
- [ ] Estimate annual renewal costs

### Post-Purchase
- [ ] Configure registrar nameservers
- [ ] Set up domain privacy protection
- [ ] Configure auto-renewal
- [ ] Set up DNS records
- [ ] Request SSL certificates
- [ ] Configure email forwarding

### Go-Live
- [ ] Test all subdomains
- [ ] Verify SSL certificates (A+ rating)
- [ ] Check DNS propagation globally
- [ ] Test email delivery
- [ ] Set up monitoring alerts
- [ ] Update all hardcoded URLs in code

## Emergency Procedures

### DNS Failover
```bash
# Emergency backup pointing to GitHub Pages
freaky.app  A  185.199.108.153
freaky.app  A  185.199.109.153
freaky.app  A  185.199.110.153
freaky.app  A  185.199.111.153
```

### Domain Transfer
- Keep transfer authorization codes secure
- Maintain backup DNS configuration
- Document all critical DNS records
- Set up secondary DNS provider

---

## Estimated Costs

| Service | Annual Cost | Notes |
|---------|-------------|-------|
| freaky.app domain | $60-80 | Premium .app domain |
| Cloudflare Pro | $240 | Enhanced performance & security |
| SSL certificates | $0 | Free with Netlify/Railway |
| DNS hosting | $0 | Included with registrar/Cloudflare |
| **Total** | **~$300/year** | Worth it for professional setup |

---

**Ready to make Freaky officially live! 🔥**