import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'

// Internal imports
import config from './config/config.js'
import connectDB from './config/database.js'
import { socketAuth } from './middleware/auth.js'
import { 
  securityHeaders,
  mongoSanitization,
  requestSizeLimit 
} from './middleware/security.js'
import { 
  generalRateLimit, 
  socketRateLimit, 
  validateSocketMessage 
} from './middleware/rateLimiting.js'
import MatchingService from './services/MatchingService.js'
import WebRTCService from './services/WebRTCService.js'

// Routes
import authRoutes from './routes/auth.js'
import sessionRoutes from './routes/sessions.js'
import guestRoutes from './routes/guest.js'
import clicksRoutes from './routes/clicks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class FreakyServer {
  constructor() {
    this.app = express()
    this.server = createServer(this.app)
    this.io = new Server(this.server, {
      cors: {
        origin: config.FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    })
    
    this.webRTCService = null
    this.isShuttingDown = false
    
    this.setupMiddleware()
    this.setupRoutes()
    this.setupDatabase()
    this.setupSocketHandlers()
    this.setupErrorHandlers()
    this.setupGracefulShutdown()
  }

  // Setup Express middleware
  setupMiddleware() {
    // Security middleware (must be first)
    this.app.use(securityHeaders)
    this.app.use(mongoSanitization)
    
    // Trust proxy (important for rate limiting and IP detection)
    this.app.set('trust proxy', 1)
    
    // Request logging
    if (config.NODE_ENV !== 'production') {
      this.app.use(morgan('dev'))
    } else {
      this.app.use(morgan('combined'))
    }
    
    // Body parsing and compression
    this.app.use(compression())
    this.app.use(requestSizeLimit('10mb'))
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))
    this.app.use(cookieParser())
    
    // CORS
    this.app.use(cors({
      origin: config.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }))
    
    // General rate limiting
    this.app.use(generalRateLimit)
  }

  // Setup API routes
  setupRoutes() {
    // Health check (before rate limiting)
    this.app.get('/health', (req, res) => {
      const dbStatus = this.isDatabaseConnected() ? 'connected' : 'disconnected'
      const memoryUsage = process.memoryUsage()
      const uptime = process.uptime()
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        environment: config.NODE_ENV,
        database: dbStatus,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        activeUsers: this.getActiveUserCount(),
        queueSize: MatchingService.getQueueStats().totalInQueue,
        activeSessions: this.webRTCService?.getSessionStats().totalActiveSessions || 0
      })
    })

    // API routes
    this.app.use('/api/auth', authRoutes)
    this.app.use('/api/sessions', sessionRoutes)
    this.app.use('/api/guest', guestRoutes)
    this.app.use('/api/clicks', clicksRoutes)

    // Stats endpoint (public but limited)
    this.app.get('/api/stats', generalRateLimit, (req, res) => {
      res.json({
        success: true,
        stats: {
          activeUsers: this.getActiveUserCount(),
          queueStats: MatchingService.getQueueStats(),
          sessionStats: this.webRTCService?.getSessionStats() || {},
          serverUptime: Math.floor(process.uptime())
        }
      })
    })

    // Serve static files in production
    if (config.NODE_ENV === 'production') {
      const buildPath = path.join(__dirname, '../../client/build')
      this.app.use(express.static(buildPath))
      
      // Catch-all handler for client-side routing
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'))
      })
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      })
    })
  }

  // Setup database connection
  async setupDatabase() {
    try {
      await connectDB()
      console.log('📊 Database connected successfully')
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      if (config.NODE_ENV === 'production') {
        process.exit(1)
      }
    }
  }

  // Setup Socket.IO handlers
  setupSocketHandlers() {
    // Authentication middleware for all socket connections
    this.io.use(socketAuth)
    
    // Initialize WebRTC service
    this.webRTCService = new WebRTCService(this.io)

    this.io.on('connection', (socket) => {
      const user = socket.user
      console.log(`👤 User connected: ${user.username} (${socket.id})`)

      // Rate limiting wrapper for socket events
      const rateLimitedHandler = (handler) => {
        return async (...args) => {
          const canProceed = await socketRateLimit(socket)
          if (canProceed) {
            try {
              await handler(...args)
            } catch (error) {
              console.error('Socket handler error:', error)
              socket.emit('error', { message: 'Internal server error' })
            }
          }
        }
      }

      // Enhanced matching system
      socket.on('join-queue', rateLimitedHandler(async (userData) => {
        const errors = validateSocketMessage('join-queue', userData)
        if (errors.length > 0) {
          return socket.emit('validation-error', { errors })
        }

        console.log(`🔍 User ${user.username} joined matching queue`)
        
        try {
          const queueEntry = await MatchingService.addToQueue(user, userData.preferences)
          
          socket.emit('queue-joined', {
            message: 'Added to matching queue',
            position: Array.from(MatchingService.activeQueue.keys()).indexOf(user._id.toString()) + 1,
            estimatedWaitTime: MatchingService.getAverageWaitTime() * 1000,
            priority: queueEntry.priority
          })

          // Try to find a match immediately
          const match = await MatchingService.attemptMatch(queueEntry)
          if (match) {
            this.handleMatchFound(match)
          }
        } catch (error) {
          console.error('Join queue error:', error)
          socket.emit('queue-error', { message: 'Failed to join queue' })
        }
      }))

      socket.on('leave-queue', rateLimitedHandler(async () => {
        console.log(`❌ User ${user.username} left matching queue`)
        MatchingService.removeFromQueue(user._id)
        socket.emit('queue-left', { message: 'Removed from matching queue' })
      }))

      // Chat messages with enhanced validation
      socket.on('chat-message', rateLimitedHandler(async (data) => {
        const errors = validateSocketMessage('chat-message', data)
        if (errors.length > 0) {
          return socket.emit('validation-error', { errors })
        }

        // Find recipient socket
        const recipientSocket = Array.from(this.io.sockets.sockets.values())
          .find(s => s.user && s.user._id.toString() === data.to)

        if (recipientSocket) {
          recipientSocket.emit('chat-message', {
            message: data.message,
            from: user._id.toString(),
            fromUsername: user.username,
            timestamp: Date.now()
          })

          // Acknowledge to sender
          socket.emit('message-sent', { 
            messageId: data.messageId,
            timestamp: Date.now()
          })
        } else {
          socket.emit('message-error', { 
            messageId: data.messageId,
            error: 'Recipient not found or offline'
          })
        }
      }))

      // Enhanced disconnect handling
      socket.on('disconnect', (reason) => {
        console.log(`👋 User disconnected: ${user.username} (${reason})`)
        
        // Remove from queue
        MatchingService.removeFromQueue(user._id)
        
        // Update user status (skip for guest users — plain objects)
        if (!user.isGuest && typeof user.updateOne === 'function') {
          user.updateOne({ 
            isOnline: false,
            currentSocketId: null 
          }).catch(console.error)
        }
        
        // Notify partners in active sessions
        this.notifyPartners(socket, 'user-disconnected', {
          userId: user._id.toString(),
          username: user.username,
          reason
        })
      })

      // Handle reconnection
      socket.on('reconnect-request', rateLimitedHandler(async (data) => {
        try {
          // Update user's socket ID
          await user.updateActivity(socket.id)
          
          // Check for active sessions
          const currentSession = await ChatSession.findOne({
            'participants.user': user._id,
            status: 'active'
          }).populate('participants.user', 'username profile.displayName')

          if (currentSession) {
            const partner = currentSession.participants.find(p => !p.user._id.equals(user._id))
            
            socket.emit('session-resumed', {
              session: {
                id: currentSession._id,
                partner: partner ? {
                  id: partner.user._id,
                  username: partner.user.username,
                  displayName: partner.user.profile.displayName
                } : null,
                startedAt: currentSession.startedAt
              }
            })
          }
        } catch (error) {
          console.error('Reconnect error:', error)
          socket.emit('reconnect-error', { message: 'Failed to restore session' })
        }
      }))
    })
  }

  // Handle successful matches
  handleMatchFound(match) {
    const { session, user1, user2 } = match

    // Find sockets for both users
    const user1Socket = Array.from(this.io.sockets.sockets.values())
      .find(s => s.user && s.user._id.equals(user1._id))
    const user2Socket = Array.from(this.io.sockets.sockets.values())
      .find(s => s.user && s.user._id.equals(user2._id))

    if (user1Socket) {
      user1Socket.emit('match-found', {
        sessionId: session._id,
        partner: {
          id: user2._id,
          username: user2.username,
          displayName: user2.profile.displayName,
          interests: user2.profile.interests
        },
        matchScore: match.matchScore || session.matchScore,
        matchCriteria: session.matchCriteria,
        iceServers: this.webRTCService.getIceServers()
      })
    }

    if (user2Socket) {
      user2Socket.emit('match-found', {
        sessionId: session._id,
        partner: {
          id: user1._id,
          username: user1.username,
          displayName: user1.profile.displayName,
          interests: user1.profile.interests
        },
        matchScore: match.matchScore || session.matchScore,
        matchCriteria: session.matchCriteria,
        iceServers: this.webRTCService.getIceServers()
      })
    }

    console.log(`🤝 Match notification sent to ${user1.username} and ${user2.username}`)
  }

  // Notify partners in sessions
  notifyPartners(socket, event, data) {
    // Find user's active sessions and notify partners
    const userId = socket.user._id.toString()
    
    Array.from(this.io.sockets.sockets.values())
      .forEach(partnerSocket => {
        if (partnerSocket.user && 
            partnerSocket.user._id.toString() !== userId &&
            this.areUsersInSession(userId, partnerSocket.user._id.toString())) {
          partnerSocket.emit(event, data)
        }
      })
  }

  // Check if users are in the same session
  areUsersInSession(userId1, userId2) {
    // This would check active WebRTC sessions
    return this.webRTCService?.activeSessions && 
           Array.from(this.webRTCService.activeSessions.values())
             .some(session => 
               session.participants.includes(userId1) && 
               session.participants.includes(userId2)
             )
  }

  // Setup error handlers
  setupErrorHandlers() {
    // Express error handler
    this.app.use((err, req, res, next) => {
      console.error('Express error:', err)
      
      // Rate limit errors
      if (err.name === 'RateLimiterError') {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          retryAfter: err.retryAfter
        })
      }

      // Validation errors
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: Object.values(err.errors).map(e => e.message)
        })
      }

      // MongoDB errors
      if (err.name === 'MongoError') {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        })
      }

      // Default error response
      res.status(err.status || 500).json({
        success: false,
        message: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        ...(config.NODE_ENV !== 'production' && { stack: err.stack })
      })
    })

    // Socket.IO error handler
    this.io.engine.on('connection_error', (err) => {
      console.error('Socket.IO connection error:', err)
    })

    // Process error handlers
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err)
      this.gracefulShutdown('SIGTERM')
    })

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      this.gracefulShutdown('SIGTERM')
    })
  }

  // Setup graceful shutdown
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2']
    
    signals.forEach(signal => {
      process.on(signal, () => {
        console.log(`Received ${signal}, shutting down gracefully...`)
        this.gracefulShutdown(signal)
      })
    })
  }

  // Graceful shutdown handler
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    console.log('Starting graceful shutdown...')

    try {
      // Stop accepting new connections
      this.server.close(() => {
        console.log('HTTP server closed')
      })

      // Disconnect all sockets
      this.io.sockets.sockets.forEach(socket => {
        socket.emit('server-shutdown', { 
          message: 'Server is shutting down. Please reconnect in a moment.' 
        })
        socket.disconnect(true)
      })

      // Close Socket.IO
      this.io.close()
      console.log('Socket.IO closed')

      // Close database connection
      await this.closeDatabaseConnection()

      console.log('Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      console.error('Error during graceful shutdown:', error)
      process.exit(1)
    }
  }

  // Helper methods
  isDatabaseConnected() {
    return mongoose.connection.readyState === 1
  }

  async closeDatabaseConnection() {
    try {
      await mongoose.connection.close()
      console.log('Database connection closed')
    } catch (error) {
      console.error('Error closing database connection:', error)
    }
  }

  getActiveUserCount() {
    return this.io.sockets.sockets.size
  }

  // Start the server
  start() {
    this.server.listen(config.PORT, () => {
      console.log(`🔥 Freaky server running on port ${config.PORT}`)
      console.log(`📊 Environment: ${config.NODE_ENV}`)
      console.log(`🌐 Frontend URL: ${config.FRONTEND_URL}`)
      console.log(`💾 Database: ${config.MONGODB_URI ? 'Configured' : 'Not configured'}`)
      console.log(`🔴 Redis: ${config.REDIS_URL ? 'Configured' : 'Memory-based'}`)
      console.log(`🔒 JWT: ${config.JWT_SECRET.includes('fallback') ? '⚠️  Using fallback secret' : 'Configured'}`)
      console.log(`🎥 TURN Server: ${config.TURN_SERVER.URL ? 'Configured' : 'STUN only'}`)
    })
  }
}

// Import mongoose for database connection checking
import mongoose from 'mongoose'
import ChatSession from './models/ChatSession.js'

// Start the server
const server = new FreakyServer()
server.start()

// Export for testing
export default server