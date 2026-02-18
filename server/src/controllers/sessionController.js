import ChatSession from '../models/ChatSession.js'
import User from '../models/User.js'
import MatchingService from '../services/MatchingService.js'

// Join the matching queue
export const joinQueue = async (req, res) => {
  try {
    const user = req.user
    const { preferences } = req.body

    // Check if user is already in queue
    const existingEntry = MatchingService.activeQueue.get(user._id.toString())
    if (existingEntry) {
      return res.json({
        success: true,
        message: 'Already in queue',
        queueEntry: {
          position: Array.from(MatchingService.activeQueue.keys()).indexOf(user._id.toString()) + 1,
          waitTime: Date.now() - existingEntry.joinedAt,
          priority: existingEntry.priority
        }
      })
    }

    // Add to matching queue
    const queueEntry = await MatchingService.addToQueue(user, preferences)

    res.json({
      success: true,
      message: 'Added to matching queue',
      queueEntry: {
        position: Array.from(MatchingService.activeQueue.keys()).indexOf(user._id.toString()) + 1,
        waitTime: 0,
        priority: queueEntry.priority,
        estimatedWaitTime: MatchingService.getAverageWaitTime() * 1000 // Convert to ms
      }
    })

    console.log(`🔍 User ${user.username} joined matching queue`)
  } catch (error) {
    console.error('Join queue error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to join matching queue'
    })
  }
}

// Leave the matching queue
export const leaveQueue = async (req, res) => {
  try {
    const user = req.user

    MatchingService.removeFromQueue(user._id)

    res.json({
      success: true,
      message: 'Removed from matching queue'
    })

    console.log(`❌ User ${user.username} left matching queue`)
  } catch (error) {
    console.error('Leave queue error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to leave matching queue'
    })
  }
}

// Get queue status
export const getQueueStatus = async (req, res) => {
  try {
    const user = req.user
    const userEntry = MatchingService.activeQueue.get(user._id.toString())
    
    if (!userEntry) {
      return res.json({
        success: true,
        inQueue: false,
        message: 'Not in queue'
      })
    }

    const position = Array.from(MatchingService.activeQueue.keys()).indexOf(user._id.toString()) + 1
    const waitTime = Date.now() - userEntry.joinedAt

    res.json({
      success: true,
      inQueue: true,
      queueEntry: {
        position,
        waitTime,
        priority: userEntry.priority,
        estimatedWaitTime: MatchingService.getAverageWaitTime() * 1000,
        attempts: userEntry.attempts
      }
    })
  } catch (error) {
    console.error('Get queue status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status'
    })
  }
}

// Get current session
export const getCurrentSession = async (req, res) => {
  try {
    const user = req.user

    const session = await ChatSession.findOne({
      'participants.user': user._id,
      status: { $in: ['matched', 'active'] }
    })
    .populate('participants.user', 'username profile.displayName profile.interests')
    .sort({ createdAt: -1 })

    if (!session) {
      return res.json({
        success: true,
        session: null,
        message: 'No active session'
      })
    }

    // Get partner info
    const partner = session.participants.find(p => !p.user._id.equals(user._id))

    res.json({
      success: true,
      session: {
        id: session._id,
        status: session.status,
        matchedAt: session.matchedAt,
        startedAt: session.startedAt,
        duration: session.duration,
        partner: partner ? {
          id: partner.user._id,
          username: partner.user.username,
          displayName: partner.user.profile.displayName,
          interests: partner.user.profile.interests
        } : null,
        matchScore: session.matchScore,
        matchCriteria: session.matchCriteria
      }
    })
  } catch (error) {
    console.error('Get current session error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get current session'
    })
  }
}

// End current session
export const endSession = async (req, res) => {
  try {
    const user = req.user
    const { rating, feedback } = req.body

    const session = await ChatSession.findOne({
      'participants.user': user._id,
      status: 'active'
    })

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found'
      })
    }

    // Mark user as left and add rating
    session.markUserLeft(user._id)
    if (rating) {
      session.rateSession(user._id, rating, feedback)
    }

    await session.save()

    // Update user's average rating
    await updateUserRating(user._id)

    res.json({
      success: true,
      message: 'Session ended successfully',
      session: {
        id: session._id,
        duration: session.duration,
        status: session.status
      }
    })

    console.log(`🏁 Session ${session._id} ended by user ${user.username}`)
  } catch (error) {
    console.error('End session error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to end session'
    })
  }
}

// Report a user/session
export const reportSession = async (req, res) => {
  try {
    const user = req.user
    const { sessionId, reportedUser, reason, description } = req.body

    const session = await ChatSession.findById(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      })
    }

    // Verify user is part of the session
    const userInSession = session.participants.some(p => p.user.equals(user._id))
    if (!userInSession) {
      return res.status(403).json({
        success: false,
        message: 'You are not part of this session'
      })
    }

    // Add report to session
    session.reportSession(user._id, reportedUser, reason, description)
    await session.save()

    // Add report to reported user's profile
    await User.findByIdAndUpdate(reportedUser, {
      $push: {
        reports: {
          reportedBy: user._id,
          reason,
          timestamp: new Date()
        }
      }
    })

    res.json({
      success: true,
      message: 'Report submitted successfully'
    })

    console.log(`🚨 User ${user.username} reported session ${sessionId}`)
  } catch (error) {
    console.error('Report session error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to submit report'
    })
  }
}

// Block a user
export const blockUser = async (req, res) => {
  try {
    const user = req.user
    const { userId } = req.body

    if (userId === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself'
      })
    }

    // Check if user exists
    const userToBlock = await User.findById(userId)
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Check if already blocked
    const alreadyBlocked = user.blocked.some(b => b.user.equals(userId))
    if (alreadyBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked'
      })
    }

    // Add to blocked list
    await User.findByIdAndUpdate(user._id, {
      $push: {
        blocked: {
          user: userId,
          timestamp: new Date()
        }
      }
    })

    // Remove from queue if currently in queue
    MatchingService.removeFromQueue(user._id)

    res.json({
      success: true,
      message: 'User blocked successfully'
    })

    console.log(`🚫 User ${user.username} blocked user ${userToBlock.username}`)
  } catch (error) {
    console.error('Block user error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    })
  }
}

// Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const user = req.user
    const { userId } = req.body

    // Remove from blocked list
    await User.findByIdAndUpdate(user._id, {
      $pull: {
        blocked: { user: userId }
      }
    })

    res.json({
      success: true,
      message: 'User unblocked successfully'
    })

    console.log(`✅ User ${user.username} unblocked user ${userId}`)
  } catch (error) {
    console.error('Unblock user error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    })
  }
}

// Get session history
export const getSessionHistory = async (req, res) => {
  try {
    const user = req.user
    const { page = 1, limit = 20 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const sessions = await ChatSession.getUserHistory(user._id, {
      skip,
      limit: parseInt(limit)
    })

    // Format sessions for response
    const formattedSessions = sessions.map(session => {
      const partner = session.participants.find(p => !p.user._id.equals(user._id))
      const userParticipant = session.participants.find(p => p.user._id.equals(user._id))

      return {
        id: session._id,
        partner: partner ? {
          username: partner.user.username,
          displayName: partner.user.profile?.displayName
        } : null,
        duration: session.durationMinutes,
        matchedAt: session.matchedAt,
        endedAt: session.endedAt,
        rating: userParticipant.rating,
        feedback: userParticipant.feedback,
        matchScore: session.matchScore,
        status: session.status
      }
    })

    // Get total count for pagination
    const totalSessions = await ChatSession.countDocuments({
      'participants.user': user._id,
      status: { $in: ['ended', 'reported'] }
    })

    res.json({
      success: true,
      sessions: formattedSessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalSessions / parseInt(limit)),
        totalSessions,
        hasNext: skip + formattedSessions.length < totalSessions,
        hasPrev: parseInt(page) > 1
      }
    })
  } catch (error) {
    console.error('Get session history error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get session history'
    })
  }
}

// Get matching statistics
export const getMatchingStats = async (req, res) => {
  try {
    const queueStats = MatchingService.getQueueStats()
    
    res.json({
      success: true,
      stats: queueStats
    })
  } catch (error) {
    console.error('Get matching stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get matching statistics'
    })
  }
}

// Helper function to update user's average rating
async function updateUserRating(userId) {
  try {
    const sessions = await ChatSession.find({
      'participants.user': userId,
      status: 'ended'
    })

    const ratings = []
    sessions.forEach(session => {
      const participant = session.participants.find(p => p.user.equals(userId))
      if (participant && participant.rating) {
        ratings.push(participant.rating)
      }
    })

    if (ratings.length > 0) {
      const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      
      await User.findByIdAndUpdate(userId, {
        'stats.averageRating': averageRating,
        'stats.ratingCount': ratings.length
      })
    }
  } catch (error) {
    console.error('Error updating user rating:', error)
  }
}

export default {
  joinQueue,
  leaveQueue,
  getQueueStatus,
  getCurrentSession,
  endSession,
  reportSession,
  blockUser,
  unblockUser,
  getSessionHistory,
  getMatchingStats
}