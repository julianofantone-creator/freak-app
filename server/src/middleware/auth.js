import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import config from '../config/config.js'

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
    issuer: 'freaky-app',
    audience: 'freaky-users'
  })
}

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET, {
    issuer: 'freaky-app',
    audience: 'freaky-users'
  })
}

// Express middleware to protect routes
export const protect = async (req, res, next) => {
  try {
    let token

    // Check for token in Authorization header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }
    // Check for token in cookies
    else if (req.cookies?.token) {
      token = req.cookies.token
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
    }

    try {
      const decoded = verifyToken(token)
      
      // Get user from database
      const user = await User.findById(decoded.id).select('-password')
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. User not found.'
        })
      }

      if (!user.isActive || user.isBanned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Account is inactive or banned.'
        })
      }

      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to failed login attempts.'
        })
      }

      // Update last active
      await user.updateActivity()
      
      req.user = user
      next()
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Token expired.'
        })
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Invalid token.'
        })
      } else {
        throw jwtError
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    })
  }
}

// Socket.IO authentication middleware
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token

    if (!token) {
      return next(new Error('Authentication error: No token provided'))
    }

    const decoded = verifyToken(token)

    // Guest users — no DB lookup needed
    if (decoded.isGuest) {
      socket.user = {
        _id: decoded.id,
        id: decoded.id,
        username: decoded.username,
        isGuest: true,
        isActive: true,
        isBanned: false,
        isLocked: false,
        updateActivity: async () => {}
      }
      return next()
    }

    // Registered users — look up in DB
    const user = await User.findById(decoded.id).select('-password')

    if (!user) {
      return next(new Error('Authentication error: User not found'))
    }

    if (!user.isActive || user.isBanned) {
      return next(new Error('Authentication error: Account inactive or banned'))
    }

    if (user.isLocked) {
      return next(new Error('Authentication error: Account locked'))
    }

    await user.updateActivity(socket.id)
    socket.user = user
    next()
  } catch (error) {
    console.error('Socket auth error:', error)
    if (error.name === 'TokenExpiredError') {
      next(new Error('Authentication error: Token expired'))
    } else if (error.name === 'JsonWebTokenError') {
      next(new Error('Authentication error: Invalid token'))
    } else {
      next(new Error('Authentication error'))
    }
  }
}

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    } else if (req.cookies?.token) {
      token = req.cookies.token
    }

    if (token) {
      try {
        const decoded = verifyToken(token)
        const user = await User.findById(decoded.id).select('-password')
        
        if (user && user.isActive && !user.isBanned && !user.isLocked) {
          req.user = user
          await user.updateActivity()
        }
      } catch (jwtError) {
        // Ignore token errors for optional auth
        console.log('Optional auth token error (ignored):', jwtError.message)
      }
    }

    next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    next() // Continue without authentication
  }
}

// Admin middleware
export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication required.'
    })
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    })
  }

  next()
}

export default {
  generateToken,
  verifyToken,
  protect,
  socketAuth,
  optionalAuth,
  adminOnly
}