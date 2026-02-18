# 🚀 Production Deployment Checklist

This checklist ensures a smooth and secure deployment of the Freak Video Chat Server.

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Generate a strong JWT secret (64+ characters)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database URL (MongoDB Atlas recommended)
- [ ] Set up Redis instance for scaling (Redis Cloud recommended)
- [ ] Configure TURN servers for WebRTC (Twilio/Xirsys/Metered.ca)
- [ ] Set proper `FRONTEND_URL` for CORS
- [ ] Configure rate limiting parameters for expected load
- [ ] Set up proper logging level (`LOG_LEVEL=error` for production)

### 2. Database Setup
- [ ] Create production MongoDB cluster
- [ ] Configure database user with minimal required permissions
- [ ] Set up database backups and monitoring
- [ ] Create proper indexes (automatically handled by the app)
- [ ] Test database connectivity from deployment environment

### 3. Infrastructure
- [ ] Set up SSL/TLS certificates (Let's Encrypt recommended)
- [ ] Configure reverse proxy (Nginx/Apache)
- [ ] Set up firewall rules (only necessary ports open)
- [ ] Configure load balancer (if using multiple instances)
- [ ] Set up monitoring (PM2, New Relic, DataDog, etc.)
- [ ] Configure log rotation and storage

### 4. Security
- [ ] Review and update all passwords and secrets
- [ ] Configure admin IP whitelist (if applicable)
- [ ] Enable security headers (already configured in app)
- [ ] Set up DDoS protection (Cloudflare recommended)
- [ ] Configure rate limiting based on expected traffic
- [ ] Review CORS settings for production domains

## Deployment Process

### Option 1: Docker Deployment (Recommended)

1. **Build and Deploy**
   ```bash
   # Clone repository
   git clone <repository-url>
   cd server
   
   # Set environment variables
   export JWT_SECRET=your-generated-secret
   export MONGODB_URI=your-production-db-url
   export REDIS_URL=your-redis-url
   
   # Deploy with Docker Compose
   docker-compose up -d
   ```

2. **Verify Deployment**
   ```bash
   # Check service status
   docker-compose ps
   
   # Check logs
   docker-compose logs freak-server
   
   # Test health endpoint
   curl https://your-domain.com/health
   ```

### Option 2: PM2 Deployment

1. **Install Dependencies**
   ```bash
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 globally
   npm install -g pm2
   ```

2. **Deploy Application**
   ```bash
   # Clone and install
   git clone <repository-url>
   cd server
   npm ci --only=production
   
   # Start with PM2
   pm2 start src/index.js --name freak-server
   pm2 save
   pm2 startup
   ```

### Option 3: Kubernetes Deployment

1. **Create Kubernetes Manifests**
   ```yaml
   # k8s/deployment.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: freak-server
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: freak-server
     template:
       metadata:
         labels:
           app: freak-server
       spec:
         containers:
         - name: freak-server
           image: your-registry/freak-server:latest
           ports:
           - containerPort: 8080
           env:
           - name: NODE_ENV
             value: "production"
           - name: JWT_SECRET
             valueFrom:
               secretKeyRef:
                 name: freak-secrets
                 key: jwt-secret
           # Add other environment variables
   ```

2. **Deploy to Kubernetes**
   ```bash
   kubectl apply -f k8s/
   kubectl get pods
   kubectl logs -l app=freak-server
   ```

## Post-Deployment Verification

### 1. Health Checks
- [ ] Health endpoint responds: `GET /health`
- [ ] Stats endpoint works: `GET /api/stats`
- [ ] Database connection successful
- [ ] Redis connection working (if configured)
- [ ] WebRTC TURN servers accessible

### 2. API Testing
- [ ] User registration works
- [ ] User login/logout works
- [ ] JWT token validation working
- [ ] Rate limiting functioning
- [ ] WebSocket connections successful
- [ ] Error handling working properly

### 3. Performance Testing
- [ ] Load test with expected concurrent users
- [ ] Memory usage within acceptable limits
- [ ] Database query performance acceptable
- [ ] WebRTC connection establishment working
- [ ] Rate limiting prevents abuse

### 4. Security Testing
- [ ] SSL/TLS properly configured
- [ ] Security headers present
- [ ] Rate limiting blocks excessive requests
- [ ] Input validation preventing injections
- [ ] Authentication required for protected endpoints
- [ ] CORS configured correctly

## Monitoring Setup

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs freak-server

# Restart if needed
pm2 restart freak-server
```

### 2. Database Monitoring
- [ ] Set up MongoDB monitoring (Atlas monitoring or custom)
- [ ] Configure alerts for high CPU/memory usage
- [ ] Monitor connection pool usage
- [ ] Set up backup verification

### 3. System Monitoring
- [ ] CPU and memory usage alerts
- [ ] Disk space monitoring
- [ ] Network traffic monitoring
- [ ] SSL certificate expiration alerts

## Maintenance Tasks

### Daily
- [ ] Check application logs for errors
- [ ] Monitor system resource usage
- [ ] Verify backup completion

### Weekly
- [ ] Review security logs
- [ ] Check for dependency updates
- [ ] Performance metrics review

### Monthly
- [ ] Security audit and penetration testing
- [ ] Database optimization and cleanup
- [ ] Infrastructure cost review
- [ ] Disaster recovery testing

## Rollback Plan

### Quick Rollback
```bash
# Docker rollback
docker-compose down
docker-compose pull  # Get previous version
docker-compose up -d

# PM2 rollback
pm2 stop freak-server
# Deploy previous version
pm2 start freak-server
```

### Database Rollback
- [ ] Restore from latest backup
- [ ] Verify data integrity
- [ ] Update connection strings if needed

## Scaling Considerations

### Horizontal Scaling
- [ ] Configure Redis for session sharing
- [ ] Set up load balancer with sticky sessions for WebRTC
- [ ] Use MongoDB replica set for high availability
- [ ] Configure auto-scaling based on CPU/memory

### Performance Optimization
- [ ] Enable database connection pooling
- [ ] Configure Redis for rate limiting
- [ ] Optimize WebRTC TURN server locations
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets

## Troubleshooting

### Common Issues
1. **Database Connection Issues**
   - Check MongoDB connection string
   - Verify network connectivity
   - Check database user permissions

2. **WebRTC Connection Failures**
   - Verify TURN server configuration
   - Check firewall rules for WebRTC ports
   - Test with different network conditions

3. **High Memory Usage**
   - Check for memory leaks in logs
   - Monitor Socket.IO connections
   - Restart application if necessary

4. **Rate Limiting Issues**
   - Check Redis connection
   - Adjust rate limits based on traffic
   - Monitor for DDoS attacks

### Emergency Contacts
- [ ] Database administrator
- [ ] Infrastructure team
- [ ] Security team
- [ ] On-call developer

## Success Criteria

Deployment is successful when:
- [ ] All health checks pass
- [ ] Users can register and login
- [ ] Video chat functionality works
- [ ] Rate limiting prevents abuse
- [ ] Error rates are below 1%
- [ ] Response times are under 200ms for API calls
- [ ] WebRTC connections establish within 5 seconds
- [ ] No security vulnerabilities detected