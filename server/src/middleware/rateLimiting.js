import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'
import config from '../config/config.js'

let redis = null

// Initialize Redis if URL is provided (for production scaling)
if (config.REDIS_URL) {
  try {
    redis = new Redis(config.REDIS_URL)
    console.log('🔴 Redis connected for rate limiting')
  } catch (error) {
    console.error('Redis connection failed, falling back to memory:', error)
  }
}

// Different rate limiters for different endpoints
const createRateLimiter = (points, duration, blockDuration = duration) => {
  const options = {
    points,
    duration,
    blockDuration
  }

  if (redis) {
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'freaky_rl',
      ...options
    })
  } else {
    return new RateLimiterMemory(options)
  }
}

// Rate limiters for different scenarios
export const rateLimiters = {
  // General API requests
  general: createRateLimiter(100, 60), // 100 requests per minute
  
  // Authentication attempts
  auth: createRateLimiter(5, 900, 3600), // 5 attempts per 15 min, block for 1 hour
  
  // Registration attempts
  register: createRateLimiter(3, 3600), // 3 registrations per hour
  
  // Socket connections
  socket: createRateLimiter(50, 60), // 50 socket events per minute
  
  // Matching/queue operations
  matching: createRateLimiter(10, 60), // 10 queue joins per minute
  
  // Message sending
  messaging: createRateLimiter(30, 60), // 30 messages per minute
  
  // Report submissions
  reports: createRateLimiter(5, 3600), // 5 reports per hour
  
  // Profile updates
  profile: createRateLimiter(10, 3600), // 10 profile updates per hour
  
  // Admin operations (more lenient)
  admin: createRateLimiter(200, 60) // 200 requests per minute for admin
}

// Generic rate limiting middleware
export const createRateLimit = (limiterName, options = {}) => {
  return async (req, res, next) => {
    try {
      const limiter = rateLimiters[limiterName]
      if (!limiter) {
        console.error(`Rate limiter '${limiterName}' not found`)
        return next()
      }

      // Determine the key for rate limiting
      let key = req.ip
      
      // Use user ID if authenticated for better tracking
      if (req.user) {
        key = `user_${req.user._id}`
      }
      
      // Add endpoint-specific suffix if specified
      if (options.suffix) {
        key += `_${options.suffix}`
      }

      await limiter.consume(key)
      next()
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
      
      // Set retry-after header
      res.set('Retry-After', String(secs))
      
      // Different messages for different scenarios
      let message = 'Too many requests'
      
      if (limiterName === 'auth') {
        message = 'Too many login attempts. Please try again later.'
      } else if (limiterName === 'register') {
        message = 'Registration limit reached. Please try again later.'
      } else if (limiterName === 'messaging') {
        message = 'Message rate limit exceeded. Please slow down.'
      } else if (limiterName === 'reports') {
        message = 'Report submission limit reached.'
      }

      res.status(429).json({
        success: false,
        message,
        retryAfter: secs
      })
    }
  }
}

// Socket.IO rate limiting
export const socketRateLimit = async (socket, eventName, data) => {
  try {
    const limiter = rateLimiters.socket
    const key = socket.user ? `user_${socket.user._id}` : `ip_${socket.handshake.address}`
    
    await limiter.consume(key)
    return true
  } catch (rejRes) {
    socket.emit('rate_limit_exceeded', {
      message: 'Too many events. Please slow down.',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    })
    return false
  }
}

// Socket message validation and sanitization
export const validateSocketMessage = (eventName, data) => {
  // Basic validation rules
  const validations = {
    'chat-message': (data) => {
      if (!data || typeof data.message !== 'string') return false
      if (data.message.length > 500) return false // Max 500 chars
      if (!data.to || typeof data.to !== 'string') return false
      return true
    },
    
    'offer': (data) => {
      if (!data || !data.offer || !data.to) return false
      if (typeof data.to !== 'string') return false
      return true
    },
    
    'answer': (data) => {
      if (!data || !data.answer || !data.to) return false
      if (typeof data.to !== 'string') return false
      return true
    },
    
    'ice-candidate': (data) => {
      if (!data || !data.candidate || !data.to) return false
      if (typeof data.to !== 'string') return false
      return true
    },
    
    'join-queue': (data) => {
      if (!data || !data.username || typeof data.username !== 'string') return false
      if (data.username.length > 20 || data.username.length < 1) return false
      return true
    },
    
    'leave-queue': () => true, // No data needed
    
    'disconnect': () => true // No data needed
  }
  
  // Check if event is allowed
  if (!validations[eventName]) {
    console.warn(`Unknown socket event: ${eventName}`)
    return false
  }
  
  // Validate the data
  return validations[eventName](data)
}

// Specific rate limiting middleware for common endpoints
export const authRateLimit = createRateLimit('auth')
export const registerRateLimit = createRateLimit('register')
export const generalRateLimit = createRateLimit('general')
export const matchingRateLimit = createRateLimit('matching')
export const messagingRateLimit = createRateLimit('messaging')
export const reportsRateLimit = createRateLimit('reports')
export const profileRateLimit = createRateLimit('profile')
export const adminRateLimit = createRateLimit('admin')

// Progressive rate limiting based on user behavior
export const adaptiveRateLimit = (baseLimiter) => {
  return async (req, res, next) => {
    try {
      let multiplier = 1
      
      // Reduce limits for new users
      if (req.user && req.user.stats.totalMatches < 5) {
        multiplier = 0.5
      }
      
      // Increase limits for trusted users
      if (req.user && req.user.stats.averageRating > 4.5 && req.user.stats.totalMatches > 50) {
        multiplier = 2
      }
      
      // Apply penalty for users with recent reports
      if (req.user && req.user.reports.length > 0) {
        const recentReports = req.user.reports.filter(
          report => Date.now() - report.timestamp < 24 * 60 * 60 * 1000 // 24 hours
        )
        if (recentReports.length > 0) {
          multiplier = 0.3
        }
      }
      
      const limiter = rateLimiters[baseLimiter]
      const key = req.user ? `user_${req.user._id}` : req.ip
      
      // Create temporary limiter with adjusted points
      const adjustedPoints = Math.ceil(limiter.points * multiplier)
      const tempLimiter = redis ? 
        new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: `freaky_adaptive_${baseLimiter}`,
          points: adjustedPoints,
          duration: limiter.duration,
          blockDuration: limiter.blockDuration
        }) :
        new RateLimiterMemory({
          points: adjustedPoints,
          duration: limiter.duration,
          blockDuration: limiter.blockDuration
        })
      
      await tempLimiter.consume(key)
      next()
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
      res.set('Retry-After', String(secs))
      res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
        retryAfter: secs
      })
    }
  }
}

// DDoS protection - very strict limits
export const ddosProtection = createRateLimit('general', { suffix: 'ddos' })

// Rate limit info middleware (adds headers with current usage)
export const rateLimitInfo = (limiterName) => {
  return async (req, res, next) => {
    try {
      const limiter = rateLimiters[limiterName]
      if (limiter) {
        const key = req.user ? `user_${req.user._id}` : req.ip
        const resRateLimiter = await limiter.get(key)
        
        if (resRateLimiter) {
          res.set({
            'X-RateLimit-Limit': limiter.points,
            'X-RateLimit-Remaining': resRateLimiter.remainingPoints || 0,
            'X-RateLimit-Reset': new Date(Date.now() + resRateLimiter.msBeforeNext)
          })
        }
      }
      next()
    } catch (error) {
      console.error('Rate limit info error:', error)
      next() // Continue even if rate limit info fails
    }
  }
}

export default {
  rateLimiters,
  createRateLimit,
  socketRateLimit,
  validateSocketMessage,
  authRateLimit,
  registerRateLimit,
  generalRateLimit,
  matchingRateLimit,
  messagingRateLimit,
  reportsRateLimit,
  profileRateLimit,
  adminRateLimit,
  adaptiveRateLimit,
  ddosProtection,
  rateLimitInfo
}