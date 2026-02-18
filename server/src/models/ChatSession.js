import mongoose from 'mongoose'

const chatSessionSchema = new mongoose.Schema({
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    rating: { type: Number, min: 1, max: 5 },
    feedback: String
  }],
  
  status: {
    type: String,
    enum: ['waiting', 'matched', 'active', 'ended', 'reported'],
    default: 'waiting'
  },
  
  matchedAt: Date,
  startedAt: Date, // When video call actually started
  endedAt: Date,
  
  // Session statistics
  duration: { type: Number, default: 0 }, // in seconds
  messageCount: { type: Number, default: 0 },
  
  // Match quality metrics
  matchScore: Number, // Algorithm confidence score
  matchCriteria: {
    interests: [String],
    distance: Number,
    ageCompatibility: Number
  },
  
  // Moderation
  reports: [{
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: ['inappropriate_content', 'harassment', 'spam', 'fake_profile', 'underage', 'other']
    },
    description: String,
    timestamp: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    }
  }],
  
  // Session metadata
  connectionType: {
    type: String,
    enum: ['video', 'audio', 'chat'],
    default: 'video'
  },
  
  // Technical data
  webRtcStats: {
    iceConnectionState: String,
    connectionState: String,
    dataChannelState: String,
    avgBitrate: Number,
    packetsLost: Number,
    jitter: Number
  },
  
  // Queue information
  queueTime: Number, // Time spent in queue before match (seconds)
  queuePriority: { type: Number, default: 0 },
  
  // Location data (for analytics, anonymized)
  approximateDistance: Number, // km between users
  
  // Features used
  featuresUsed: [{
    feature: {
      type: String,
      enum: ['video', 'audio', 'chat', 'screen_share', 'file_share']
    },
    timestamp: { type: Date, default: Date.now },
    duration: Number
  }]
  
}, {
  timestamps: true
})

// Indexes for performance
chatSessionSchema.index({ 'participants.user': 1 })
chatSessionSchema.index({ status: 1 })
chatSessionSchema.index({ createdAt: -1 })
chatSessionSchema.index({ matchedAt: -1 })
chatSessionSchema.index({ 'reports.status': 1 })

// Virtual for session duration in minutes
chatSessionSchema.virtual('durationMinutes').get(function() {
  return Math.round(this.duration / 60)
})

// Method to add participant
chatSessionSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  )
  
  if (!existingParticipant) {
    this.participants.push({ user: userId })
  }
}

// Method to mark user as left
chatSessionSchema.methods.markUserLeft = function(userId) {
  const participant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  )
  
  if (participant && !participant.leftAt) {
    participant.leftAt = new Date()
  }
  
  // Check if all users have left
  const allLeft = this.participants.every(p => p.leftAt)
  if (allLeft && this.status === 'active') {
    this.status = 'ended'
    this.endedAt = new Date()
    
    // Calculate duration
    if (this.startedAt) {
      this.duration = Math.floor((this.endedAt - this.startedAt) / 1000)
    }
  }
}

// Method to rate session
chatSessionSchema.methods.rateSession = function(userId, rating, feedback = '') {
  const participant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  )
  
  if (participant) {
    participant.rating = rating
    participant.feedback = feedback
  }
}

// Method to report session
chatSessionSchema.methods.reportSession = function(reportedBy, reportedUser, reason, description = '') {
  this.reports.push({
    reportedBy,
    reportedUser,
    reason,
    description
  })
  
  // Auto-mark as reported if serious violation
  const seriousViolations = ['harassment', 'inappropriate_content', 'underage']
  if (seriousViolations.includes(reason)) {
    this.status = 'reported'
  }
}

// Static method to find user's session history
chatSessionSchema.statics.getUserHistory = function(userId, options = {}) {
  const query = {
    'participants.user': userId,
    status: { $in: ['ended', 'reported'] }
  }
  
  return this.find(query)
    .populate('participants.user', 'username profile.displayName')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0)
}

// Static method for analytics
chatSessionSchema.statics.getAnalytics = function(dateRange = {}) {
  const matchStage = {}
  
  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {}
    if (dateRange.start) matchStage.createdAt.$gte = dateRange.start
    if (dateRange.end) matchStage.createdAt.$lte = dateRange.end
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
        },
        averageDuration: { $avg: '$duration' },
        averageQueueTime: { $avg: '$queueTime' },
        totalReports: { $sum: { $size: '$reports' } }
      }
    }
  ])
}

export default mongoose.model('ChatSession', chatSessionSchema)