import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import xss from 'xss'
import validator from 'validator'
import config from '../config/config.js'

// XSS sanitization function
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    })
  }
  return input
}

// Deep sanitization for objects
export const sanitizeObject = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = sanitizeInput(obj[key])
        if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key])
        }
      }
    }
  }
  return obj
}

// Input sanitization middleware
export const sanitizeInputs = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject({ ...req.body })
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject({ ...req.query })
    }
    
    // Sanitize params
    if (req.params) {
      req.params = sanitizeObject({ ...req.params })
    }
    
    next()
  } catch (error) {
    console.error('Input sanitization error:', error)
    res.status(400).json({
      success: false,
      message: 'Invalid input format'
    })
  }
}

// Validation helpers
export const validators = {
  username: (username) => {
    if (!username || typeof username !== 'string') return false
    return /^[a-zA-Z0-9_-]{3,30}$/.test(username)
  },
  
  email: (email) => {
    if (!email || typeof email !== 'string') return false
    return validator.isEmail(email) && email.length <= 254
  },
  
  password: (password) => {
    if (!password || typeof password !== 'string') return false
    // At least 6 characters, max 128
    return password.length >= 6 && password.length <= 128
  },
  
  displayName: (name) => {
    if (!name) return true // Optional field
    if (typeof name !== 'string') return false
    return name.length >= 1 && name.length <= 50
  },
  
  bio: (bio) => {
    if (!bio) return true // Optional field
    if (typeof bio !== 'string') return false
    return bio.length <= 500
  },
  
  age: (age) => {
    if (!age) return true // Optional field
    const numAge = parseInt(age)
    return !isNaN(numAge) && numAge >= 13 && numAge <= 100
  },
  
  interests: (interests) => {
    if (!interests) return true // Optional field
    if (!Array.isArray(interests)) return false
    return interests.length <= 20 && interests.every(interest => 
      typeof interest === 'string' && interest.length <= 50
    )
  },
  
  coordinates: (coords) => {
    if (!coords) return true // Optional field
    if (!Array.isArray(coords) || coords.length !== 2) return false
    const [lng, lat] = coords
    return !isNaN(lng) && !isNaN(lat) && 
           lng >= -180 && lng <= 180 && 
           lat >= -90 && lat <= 90
  },
  
  socketId: (id) => {
    if (!id || typeof id !== 'string') return false
    return /^[a-zA-Z0-9_-]{10,30}$/.test(id)
  },
  
  objectId: (id) => {
    if (!id || typeof id !== 'string') return false
    return /^[0-9a-fA-F]{24}$/.test(id)
  }
}

// Validation middleware creator
export const validateInput = (schema) => {
  return (req, res, next) => {
    const errors = []
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field]
      
      // Check required fields
      if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors.push(`${field} is required`)
        continue
      }
      
      // Skip validation for optional empty fields
      if (!rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        continue
      }
      
      // Apply custom validator
      if (rules.validator && !rules.validator(value)) {
        errors.push(rules.message || `${field} is invalid`)
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      })
    }
    
    next()
  }
}

// Common validation schemas
export const validationSchemas = {
  register: {
    username: {
      required: true,
      validator: validators.username,
      message: 'Username must be 3-30 characters, letters, numbers, hyphens, and underscores only'
    },
    email: {
      required: false,
      validator: validators.email,
      message: 'Please provide a valid email address'
    },
    password: {
      required: true,
      validator: validators.password,
      message: 'Password must be at least 6 characters'
    }
  },
  
  login: {
    username: {
      required: true,
      validator: (value) => typeof value === 'string' && value.trim().length > 0,
      message: 'Username or email is required'
    },
    password: {
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0,
      message: 'Password is required'
    }
  },
  
  profileUpdate: {
    displayName: {
      required: false,
      validator: validators.displayName,
      message: 'Display name cannot exceed 50 characters'
    },
    bio: {
      required: false,
      validator: validators.bio,
      message: 'Bio cannot exceed 500 characters'
    },
    age: {
      required: false,
      validator: validators.age,
      message: 'Age must be between 13 and 100'
    },
    interests: {
      required: false,
      validator: validators.interests,
      message: 'Maximum 20 interests, each up to 50 characters'
    }
  },
  
  report: {
    reportedUser: {
      required: true,
      validator: validators.objectId,
      message: 'Valid reported user ID is required'
    },
    reason: {
      required: true,
      validator: (value) => {
        const validReasons = ['inappropriate_content', 'harassment', 'spam', 'fake_profile', 'underage', 'other']
        return validReasons.includes(value)
      },
      message: 'Valid reason is required'
    },
    description: {
      required: false,
      validator: (value) => !value || (typeof value === 'string' && value.length <= 1000),
      message: 'Description cannot exceed 1000 characters'
    }
  }
}

// Socket message validation
export const validateSocketMessage = (eventName, data) => {
  const errors = []
  
  switch (eventName) {
    case 'join-queue':
      if (!data.username || !validators.username(data.username)) {
        errors.push('Valid username required')
      }
      if (data.interests && !validators.interests(data.interests)) {
        errors.push('Invalid interests format')
      }
      break
      
    case 'chat-message':
      if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
        errors.push('Message cannot be empty')
      }
      if (data.message && data.message.length > 1000) {
        errors.push('Message too long (max 1000 characters)')
      }
      if (!data.to || !validators.socketId(data.to)) {
        errors.push('Valid recipient required')
      }
      break
      
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      if (!data.to || !validators.socketId(data.to)) {
        errors.push('Valid recipient required')
      }
      break
  }
  
  return errors
}

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for SharedArrayBuffer in WebRTC
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})

// IP whitelist for admin endpoints
export const adminIPWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (config.NODE_ENV !== 'production') {
      return next() // Skip in development
    }
    
    const clientIP = req.ip || req.connection.remoteAddress
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.warn(`Admin access attempt from unauthorized IP: ${clientIP}`)
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP address'
      })
    }
    
    next()
  }
}

// Request size limiter
export const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length']
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength)
      const maxSizeInBytes = maxSize.includes('mb') ? 
        parseInt(maxSize) * 1024 * 1024 : 
        parseInt(maxSize)
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          success: false,
          message: `Request too large. Maximum size: ${maxSize}`
        })
      }
    }
    
    next()
  }
}

// MongoDB injection protection
export const mongoSanitization = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Potential NoSQL injection attempt: ${key}`)
  }
})

export default {
  sanitizeInput,
  sanitizeObject,
  sanitizeInputs,
  validators,
  validateInput,
  validationSchemas,
  validateSocketMessage,
  securityHeaders,
  adminIPWhitelist,
  requestSizeLimit,
  mongoSanitization
}