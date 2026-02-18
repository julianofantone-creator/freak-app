# 🔥 Freak Video Chat Server

A bulletproof, production-ready Node.js server for video chat applications with advanced WebRTC signaling, intelligent user matching, comprehensive security, and horizontal scalability.

## 🚀 Features

### Core Functionality
- **WebRTC Signaling**: Full peer-to-peer video/audio calling support
- **Smart Matching Algorithm**: Interest-based and location-aware user matching
- **Real-time Chat**: Socket.IO powered messaging during video calls
- **User Authentication**: JWT-based auth with secure session management

### Security & Protection
- **Multi-tier Rate Limiting**: Adaptive rate limiting based on user behavior
- **Input Sanitization**: XSS and NoSQL injection protection
- **Security Headers**: Helmet.js with CSP and HSTS
- **Account Security**: Login attempt tracking and temporary lockouts

### Production Ready
- **Horizontal Scaling**: Redis support for multi-instance deployment
- **Database Optimization**: MongoDB with proper indexing and connection pooling
- **Error Handling**: Comprehensive error handling and graceful shutdown
- **Monitoring**: Health checks, metrics, and performance monitoring

### Advanced Features
- **Matching Queue**: Priority-based queue with wait time optimization
- **Session Management**: Complete chat session lifecycle tracking
- **User Moderation**: Report system, user blocking, and admin controls
- **Analytics**: Detailed session and matching statistics

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** >= 5.0
- **Redis** >= 6.0 (optional, for production scaling)

## ⚡ Quick Start

1. **Clone and Install**
   ```bash
   cd server
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   - Start MongoDB locally or configure MongoDB Atlas
   - Update `MONGODB_URI` in `.env`

4. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:8080`

## 🏗️ Architecture

### File Structure
```
src/
├── config/           # Configuration management
│   ├── config.js     # Environment configuration
│   └── database.js   # MongoDB connection
├── controllers/      # Request handlers
│   ├── authController.js
│   └── sessionController.js
├── middleware/       # Express middleware
│   ├── auth.js       # JWT authentication
│   ├── rateLimiting.js # Rate limiting
│   └── security.js   # Input validation & sanitization
├── models/          # MongoDB schemas
│   ├── User.js      # User data model
│   └── ChatSession.js # Chat session model
├── routes/          # API routes
│   ├── auth.js      # Authentication routes
│   └── sessions.js  # Session management routes
├── services/        # Business logic
│   ├── MatchingService.js # User matching algorithm
│   └── WebRTCService.js   # WebRTC signaling
└── index.js         # Main server file
```

### Key Components

#### 🧠 Matching Algorithm
The intelligent matching system considers:
- **Interest Compatibility**: Weighted scoring based on shared interests
- **Geographic Proximity**: Distance-based matching with user preferences
- **User Quality**: Account age, ratings, and profile completeness
- **Queue Priority**: Dynamic priority adjustment based on wait time
- **Behavior Analysis**: Adaptive limits for new vs. trusted users

#### 🔒 Security Features
- **JWT Authentication**: Secure token-based authentication with refresh
- **Rate Limiting**: Multi-tier limiting (general, auth, socket, admin)
- **Input Validation**: Comprehensive validation with custom schemas
- **XSS Protection**: Input sanitization and output encoding
- **NoSQL Injection**: MongoDB query sanitization
- **Security Headers**: CSP, HSTS, and other security headers

#### 🌐 WebRTC Integration
- **STUN/TURN Support**: Configurable ICE servers for NAT traversal
- **Connection Monitoring**: Real-time connection state tracking
- **Reconnection Handling**: Graceful reconnection with session restoration
- **Data Channels**: Support for text chat during video calls
- **Screen Sharing**: Screen share signaling support

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|-----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Server port | `8080` | No |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/freak` | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes (production) |
| `REDIS_URL` | Redis connection string | - | No |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` | No |
| `TURN_SERVER_URL` | TURN server URL | - | No |

### Rate Limiting Configuration
```env
RATE_LIMIT_WINDOW_MS=60000          # 1 minute window
RATE_LIMIT_MAX_REQUESTS=100         # 100 requests per window
SOCKET_RATE_LIMIT_POINTS=50         # 50 socket events per minute
```

### Matching Algorithm Tuning
```env
MAX_QUEUE_TIME=300000               # 5 minutes max queue time
INTEREST_WEIGHT=0.7                 # 70% weight for interests
DISTANCE_WEIGHT=0.3                 # 30% weight for distance
MAX_DISTANCE_KM=50                  # 50km max distance
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/preferences` - Update matching preferences

### Session Management
- `POST /api/sessions/queue/join` - Join matching queue
- `DELETE /api/sessions/queue/leave` - Leave matching queue
- `GET /api/sessions/queue/status` - Get queue status
- `GET /api/sessions/current` - Get current session
- `POST /api/sessions/end` - End current session
- `POST /api/sessions/report` - Report user/session
- `GET /api/sessions/history` - Get session history

### System
- `GET /health` - Health check
- `GET /api/stats` - System statistics

## 🔌 Socket.IO Events

### Client → Server
- `join-queue` - Join matching queue
- `leave-queue` - Leave matching queue
- `chat-message` - Send chat message
- `webrtc:offer` - WebRTC offer
- `webrtc:answer` - WebRTC answer
- `webrtc:ice-candidate` - ICE candidate
- `webrtc:connection-state` - Connection state update

### Server → Client
- `queue-joined` - Joined queue confirmation
- `match-found` - Match found notification
- `chat-message` - Incoming chat message
- `webrtc:offer` - WebRTC offer from peer
- `webrtc:answer` - WebRTC answer from peer
- `webrtc:ice-candidate` - ICE candidate from peer
- `rate_limit_exceeded` - Rate limit warning

## 🚀 Production Deployment

### 1. Environment Setup
```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set production environment
export NODE_ENV=production
export JWT_SECRET=your-generated-secret
```

### 2. Database Configuration
```bash
# Use MongoDB Atlas or similar
export MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/freak
```

### 3. Redis Setup (Optional but Recommended)
```bash
# For horizontal scaling
export REDIS_URL=redis://your-redis-server:6379
```

### 4. TURN Server Configuration
Set up TURN servers for reliable WebRTC connections:
```bash
export TURN_SERVER_URL=turn:your-turn-server.com:3478
export TURN_SERVER_USERNAME=username
export TURN_SERVER_CREDENTIAL=password
```

### 5. Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start src/index.js --name freak-server

# Or using Docker
docker build -t freak-server .
docker run -p 8080:8080 freak-server
```

### 6. Reverse Proxy (Nginx)
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 📈 Performance Optimization

### Database Indexes
The server automatically creates optimized indexes:
- User lookup by username/email
- Geographic queries for location-based matching
- Session queries for user history
- Report tracking for moderation

### Connection Pooling
- MongoDB: Configured with optimal pool size (10 connections)
- Redis: Connection pooling for rate limiting
- Socket.IO: Optimized transport protocols

### Memory Management
- Automatic queue cleanup for stale entries
- Session data cleanup on disconnect
- Graceful memory management with periodic cleanup

## 🔍 Monitoring & Debugging

### Health Check
```bash
curl http://localhost:8080/health
```

### Statistics
```bash
curl http://localhost:8080/api/stats
```

### Logging
The server provides comprehensive logging:
- Authentication events
- Matching algorithm decisions
- WebRTC connection states
- Error tracking with stack traces
- Performance metrics

## 🛡️ Security Best Practices

1. **Always use HTTPS in production**
2. **Set strong JWT secrets (64+ characters)**
3. **Configure proper CORS origins**
4. **Use Redis for production rate limiting**
5. **Set up proper firewall rules**
6. **Monitor failed authentication attempts**
7. **Regularly update dependencies**
8. **Use environment variables for secrets**

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Errors
- Verify MongoDB is running
- Check connection string format
- Ensure network connectivity
- Verify authentication credentials

#### WebRTC Connection Failures
- Configure TURN servers for production
- Check firewall rules
- Verify ICE server configuration
- Test with different network conditions

#### Rate Limiting Issues
- Check Redis connection (if configured)
- Verify rate limit configuration
- Monitor client request patterns
- Adjust limits based on usage

#### Socket.IO Connection Problems
- Verify CORS configuration
- Check proxy settings
- Ensure WebSocket support
- Test with different transports

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the logs for error details