import express from 'express'
import sessionController from '../controllers/sessionController.js'
import { protect } from '../middleware/auth.js'
import { 
  matchingRateLimit,
  reportsRateLimit,
  generalRateLimit,
  rateLimitInfo 
} from '../middleware/rateLimiting.js'
import { 
  validateInput, 
  validationSchemas,
  sanitizeInputs 
} from '../middleware/security.js'

const router = express.Router()

// All session routes require authentication
router.use(protect)
router.use(sanitizeInputs)

// Queue management
router.post('/queue/join',
  matchingRateLimit,
  rateLimitInfo('matching'),
  sessionController.joinQueue
)

router.delete('/queue/leave',
  sessionController.leaveQueue
)

router.get('/queue/status',
  sessionController.getQueueStatus
)

// Session management
router.get('/current',
  sessionController.getCurrentSession
)

router.post('/end',
  sessionController.endSession
)

router.get('/history',
  generalRateLimit,
  sessionController.getSessionHistory
)

// Moderation
router.post('/report',
  reportsRateLimit,
  rateLimitInfo('reports'),
  validateInput(validationSchemas.report),
  sessionController.reportSession
)

router.post('/block',
  sessionController.blockUser
)

router.post('/unblock',
  sessionController.unblockUser
)

// Statistics
router.get('/stats',
  sessionController.getMatchingStats
)

export default router