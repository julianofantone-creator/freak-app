import dotenv from 'dotenv'

dotenv.config()

export const config = {
  // Server
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/freaky',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  
  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    SOCKET_POINTS: parseInt(process.env.SOCKET_RATE_LIMIT_POINTS) || 50,
    SOCKET_DURATION: parseInt(process.env.SOCKET_RATE_LIMIT_DURATION) || 60
  },
  
  // WebRTC
  TURN_SERVER: {
    URL: process.env.TURN_SERVER_URL,
    USERNAME: process.env.TURN_SERVER_USERNAME,
    CREDENTIAL: process.env.TURN_SERVER_CREDENTIAL
  },
  
  // Matching Algorithm
  MATCHING: {
    MAX_QUEUE_TIME: parseInt(process.env.MAX_QUEUE_TIME) || 300000, // 5 minutes
    INTEREST_WEIGHT: parseFloat(process.env.INTEREST_WEIGHT) || 0.7,
    DISTANCE_WEIGHT: parseFloat(process.env.DISTANCE_WEIGHT) || 0.3,
    MAX_DISTANCE_KM: parseInt(process.env.MAX_DISTANCE_KM) || 50
  },
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  
  // Redis (for production scaling)
  REDIS_URL: process.env.REDIS_URL,
  
  // Monitoring
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}

// Validate critical config
if (config.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'MONGODB_URI']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
  
  if (config.JWT_SECRET.includes('fallback') || config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be a strong secret key in production')
  }
}

export default config