import express from 'express'
import authController from '../controllers/authController.js'
import { protect, optionalAuth } from '../middleware/auth.js'
import { 
  authRateLimit, 
  registerRateLimit, 
  profileRateLimit,
  rateLimitInfo 
} from '../middleware/rateLimiting.js'
import { 
  validateInput, 
  validationSchemas,
  sanitizeInputs 
} from '../middleware/security.js'

const router = express.Router()

// Apply sanitization to all routes
router.use(sanitizeInputs)

// Public routes
router.post('/register', 
  registerRateLimit,
  rateLimitInfo('register'),
  validateInput(validationSchemas.register),
  authController.register
)

router.post('/login',
  authRateLimit,
  rateLimitInfo('auth'),
  validateInput(validationSchemas.login),
  authController.login
)

// Protected routes
router.use(protect) // All routes below require authentication

router.post('/logout', authController.logout)

router.get('/me', authController.getMe)

router.put('/profile',
  profileRateLimit,
  validateInput(validationSchemas.profileUpdate),
  authController.updateProfile
)

router.put('/preferences',
  profileRateLimit,
  authController.updatePreferences
)

router.put('/change-password',
  authRateLimit,
  authController.changePassword
)

router.delete('/delete-account',
  authRateLimit,
  authController.deleteAccount
)

router.post('/refresh-token',
  authController.refreshToken
)

export default router