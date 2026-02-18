import User from '../models/User.js'
import ChatSession from '../models/ChatSession.js'
import config from '../config/config.js'

class MatchingService {
  constructor() {
    this.activeQueue = new Map() // userId -> queue entry
    this.priorityQueue = [] // sorted by priority score
    this.matchingInProgress = new Set() // users being matched
    
    // Start background processes
    this.startQueueCleanup()
    this.startPriorityMatching()
  }

  // Add user to matching queue
  async addToQueue(user, preferences = {}) {
    try {
      // Remove from queue if already present
      this.removeFromQueue(user._id)

      // Create queue entry
      const queueEntry = {
        userId: user._id.toString(),
        user: user,
        preferences: {
          ...user.preferences,
          ...preferences
        },
        joinedAt: Date.now(),
        attempts: 0,
        priority: this.calculateInitialPriority(user)
      }

      this.activeQueue.set(user._id.toString(), queueEntry)
      this.insertIntoPriorityQueue(queueEntry)

      console.log(`👤 User ${user.username} added to matching queue (priority: ${queueEntry.priority})`)
      
      // Try immediate matching
      await this.attemptMatch(queueEntry)
      
      return queueEntry
    } catch (error) {
      console.error('Error adding user to queue:', error)
      throw error
    }
  }

  // Remove user from queue
  removeFromQueue(userId) {
    const userIdStr = userId.toString()
    const queueEntry = this.activeQueue.get(userIdStr)
    
    if (queueEntry) {
      this.activeQueue.delete(userIdStr)
      this.removeFromPriorityQueue(queueEntry)
      this.matchingInProgress.delete(userIdStr)
      console.log(`❌ User removed from matching queue: ${userIdStr}`)
    }
  }

  // Calculate initial priority for user
  calculateInitialPriority(user) {
    let priority = 100 // Base priority

    // Boost for new users (better experience)
    if (user.stats.totalMatches < 5) {
      priority += 50
    }

    // Boost for highly rated users
    if (user.stats.averageRating > 4.0) {
      priority += user.stats.averageRating * 10
    }

    // Penalty for users with recent reports
    const recentReports = user.reports.filter(
      report => Date.now() - report.timestamp < 24 * 60 * 60 * 1000
    )
    if (recentReports.length > 0) {
      priority -= recentReports.length * 20
    }

    // Boost for complete profiles
    if (user.profile.bio && user.profile.interests?.length > 0) {
      priority += 20
    }

    return Math.max(priority, 10) // Minimum priority
  }

  // Insert entry into priority queue (sorted by priority descending)
  insertIntoPriorityQueue(entry) {
    let inserted = false
    for (let i = 0; i < this.priorityQueue.length; i++) {
      if (entry.priority > this.priorityQueue[i].priority) {
        this.priorityQueue.splice(i, 0, entry)
        inserted = true
        break
      }
    }
    if (!inserted) {
      this.priorityQueue.push(entry)
    }
  }

  // Remove entry from priority queue
  removeFromPriorityQueue(entry) {
    const index = this.priorityQueue.findIndex(e => e.userId === entry.userId)
    if (index !== -1) {
      this.priorityQueue.splice(index, 1)
    }
  }

  // Attempt to find a match for a user
  async attemptMatch(queueEntry) {
    if (this.matchingInProgress.has(queueEntry.userId)) {
      return null // Already being matched
    }

    try {
      this.matchingInProgress.add(queueEntry.userId)

      // Find potential matches
      const candidates = await this.findMatchCandidates(queueEntry)
      
      if (candidates.length === 0) {
        console.log(`🔍 No matches found for user ${queueEntry.user.username}`)
        return null
      }

      // Score and sort candidates
      const scoredCandidates = await this.scoreCandidates(queueEntry, candidates)
      
      // Try to match with best candidate
      for (const candidate of scoredCandidates) {
        const match = await this.createMatch(queueEntry, candidate)
        if (match) {
          return match
        }
      }

      return null
    } finally {
      this.matchingInProgress.delete(queueEntry.userId)
    }
  }

  // Find potential match candidates
  async findMatchCandidates(queueEntry) {
    const user = queueEntry.user
    
    // Get users in queue who could match
    const queueCandidates = Array.from(this.activeQueue.values())
      .filter(entry => 
        entry.userId !== queueEntry.userId &&
        !this.matchingInProgress.has(entry.userId) &&
        this.isBasicCompatible(queueEntry, entry)
      )

    // If not enough in queue, search database for online users
    if (queueCandidates.length < 3) {
      try {
        const dbCandidates = await User.findMatchCandidates(user, { limit: 20 })
        
        // Convert to queue-like entries
        const additionalCandidates = dbCandidates
          .filter(dbUser => !this.activeQueue.has(dbUser._id.toString()))
          .map(dbUser => ({
            userId: dbUser._id.toString(),
            user: dbUser,
            preferences: dbUser.preferences,
            joinedAt: Date.now(),
            fromDB: true
          }))

        return [...queueCandidates, ...additionalCandidates]
      } catch (error) {
        console.error('Error finding DB candidates:', error)
        return queueCandidates
      }
    }

    return queueCandidates
  }

  // Check basic compatibility
  isBasicCompatible(entry1, entry2) {
    const user1 = entry1.user
    const user2 = entry2.user

    // Age preferences
    if (entry1.preferences.ageRange && user2.profile.age) {
      if (user2.profile.age < entry1.preferences.ageRange.min || 
          user2.profile.age > entry1.preferences.ageRange.max) {
        return false
      }
    }

    if (entry2.preferences.ageRange && user1.profile.age) {
      if (user1.profile.age < entry2.preferences.ageRange.min || 
          user1.profile.age > entry2.preferences.ageRange.max) {
        return false
      }
    }

    // Gender preferences
    if (entry1.preferences.genderPreference?.length && 
        !entry1.preferences.genderPreference.includes('any') &&
        !entry1.preferences.genderPreference.includes(user2.profile.gender)) {
      return false
    }

    if (entry2.preferences.genderPreference?.length && 
        !entry2.preferences.genderPreference.includes('any') &&
        !entry2.preferences.genderPreference.includes(user1.profile.gender)) {
      return false
    }

    // Check if users have blocked each other
    if (user1.blocked.some(b => b.user.equals(user2._id)) ||
        user2.blocked.some(b => b.user.equals(user1._id))) {
      return false
    }

    return true
  }

  // Score match candidates
  async scoreCandidates(queueEntry, candidates) {
    const scores = await Promise.all(
      candidates.map(candidate => this.calculateMatchScore(queueEntry, candidate))
    )

    // Sort by score descending
    const scoredCandidates = candidates.map((candidate, index) => ({
      ...candidate,
      matchScore: scores[index]
    })).sort((a, b) => b.matchScore - a.matchScore)

    return scoredCandidates
  }

  // Calculate compatibility score between two users
  async calculateMatchScore(entry1, entry2) {
    let score = 0
    const user1 = entry1.user
    const user2 = entry2.user

    // Interest compatibility (0-40 points)
    const interestScore = this.calculateInterestCompatibility(
      user1.profile.interests || [],
      user2.profile.interests || []
    )
    score += interestScore * 40

    // Location proximity (0-20 points)
    if (user1.profile.location?.coordinates && user2.profile.location?.coordinates) {
      const distance = this.calculateDistance(
        user1.profile.location.coordinates,
        user2.profile.location.coordinates
      )
      const maxDistance = Math.max(
        entry1.preferences.maxDistance || config.MATCHING.MAX_DISTANCE_KM,
        entry2.preferences.maxDistance || config.MATCHING.MAX_DISTANCE_KM
      )
      
      if (distance <= maxDistance) {
        const proximityScore = Math.max(0, (maxDistance - distance) / maxDistance)
        score += proximityScore * 20
      }
    }

    // Age compatibility (0-15 points)
    const ageScore = this.calculateAgeCompatibility(user1.profile.age, user2.profile.age)
    score += ageScore * 15

    // User quality score (0-15 points)
    const quality1 = this.getUserQualityScore(user1)
    const quality2 = this.getUserQualityScore(user2)
    const avgQuality = (quality1 + quality2) / 2
    score += avgQuality * 15

    // Queue time bonus (0-10 points) - prioritize users waiting longer
    const waitTime1 = Date.now() - entry1.joinedAt
    const waitTime2 = Date.now() - entry2.joinedAt
    const avgWaitTime = (waitTime1 + waitTime2) / 2
    const waitTimeBonus = Math.min(10, avgWaitTime / (60 * 1000)) // 1 point per minute, max 10
    score += waitTimeBonus

    // Randomness factor (0-5 points) - prevent too predictable matching
    score += Math.random() * 5

    return Math.min(100, Math.max(0, score))
  }

  // Calculate interest compatibility score (0-1)
  calculateInterestCompatibility(interests1, interests2) {
    if (!interests1.length || !interests2.length) {
      return 0.1 // Small base score for no interests
    }

    const common = interests1.filter(interest => 
      interests2.some(i2 => i2.toLowerCase() === interest.toLowerCase())
    ).length

    const total = new Set([...interests1, ...interests2]).size
    return common / Math.max(total - common, 1)
  }

  // Calculate age compatibility (0-1)
  calculateAgeCompatibility(age1, age2) {
    if (!age1 || !age2) return 0.5 // Neutral if age unknown
    
    const ageDiff = Math.abs(age1 - age2)
    return Math.max(0, 1 - (ageDiff / 20)) // Decrease compatibility as age difference increases
  }

  // Calculate distance between coordinates in km
  calculateDistance(coords1, coords2) {
    const [lng1, lat1] = coords1
    const [lng2, lat2] = coords2
    
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Get user quality score (0-1)
  getUserQualityScore(user) {
    let score = 0.5 // Base score

    // Profile completeness
    if (user.profile.bio) score += 0.1
    if (user.profile.interests?.length > 0) score += 0.1
    if (user.profile.age) score += 0.1

    // User reputation
    if (user.stats.averageRating > 0) {
      score += (user.stats.averageRating - 2.5) / 5 // -0.5 to +0.5
    }

    // Account age and activity
    const accountAge = Date.now() - new Date(user.createdAt).getTime()
    if (accountAge > 7 * 24 * 60 * 60 * 1000) score += 0.1 // 1 week old

    return Math.min(1, Math.max(0, score))
  }

  // Create a match between two users
  async createMatch(entry1, entry2) {
    try {
      // Double-check availability
      if (this.matchingInProgress.has(entry2.userId) && !entry2.fromDB) {
        return null // Other user is being matched
      }

      // Create chat session
      const session = new ChatSession({
        participants: [
          { user: entry1.user._id },
          { user: entry2.user._id }
        ],
        status: 'matched',
        matchedAt: new Date(),
        matchScore: entry2.matchScore,
        matchCriteria: {
          interests: this.getCommonInterests(
            entry1.user.profile.interests || [],
            entry2.user.profile.interests || []
          ),
          distance: entry1.user.profile.location?.coordinates && 
                   entry2.user.profile.location?.coordinates ?
                   this.calculateDistance(
                     entry1.user.profile.location.coordinates,
                     entry2.user.profile.location.coordinates
                   ) : null
        },
        queueTime: Math.floor((Date.now() - entry1.joinedAt) / 1000)
      })

      await session.save()

      // Remove both users from queue
      this.removeFromQueue(entry1.userId)
      if (!entry2.fromDB) {
        this.removeFromQueue(entry2.userId)
      }

      // Update user stats
      await Promise.all([
        User.findByIdAndUpdate(entry1.user._id, { $inc: { 'stats.totalMatches': 1 } }),
        User.findByIdAndUpdate(entry2.user._id, { $inc: { 'stats.totalMatches': 1 } })
      ])

      console.log(`🤝 Match created: ${entry1.user.username} ↔ ${entry2.user.username} (score: ${entry2.matchScore?.toFixed(1)})`)

      return {
        session,
        user1: entry1.user,
        user2: entry2.user
      }
    } catch (error) {
      console.error('Error creating match:', error)
      return null
    }
  }

  // Get common interests between users
  getCommonInterests(interests1, interests2) {
    return interests1.filter(interest => 
      interests2.some(i2 => i2.toLowerCase() === interest.toLowerCase())
    )
  }

  // Background process to clean up stale queue entries
  startQueueCleanup() {
    setInterval(() => {
      const now = Date.now()
      const maxQueueTime = config.MATCHING.MAX_QUEUE_TIME

      for (const [userId, entry] of this.activeQueue) {
        if (now - entry.joinedAt > maxQueueTime) {
          console.log(`⏰ Removing stale queue entry: ${userId}`)
          this.removeFromQueue(userId)
        }
      }
    }, 60000) // Run every minute
  }

  // Background process to boost priority for waiting users
  startPriorityMatching() {
    setInterval(() => {
      const now = Date.now()
      
      // Boost priority for users waiting longer
      for (const entry of this.priorityQueue) {
        const waitTime = now - entry.joinedAt
        const waitMinutes = waitTime / (60 * 1000)
        
        if (waitMinutes > 2) { // After 2 minutes
          const oldPriority = entry.priority
          entry.priority = Math.min(200, entry.priority + (waitMinutes * 2))
          
          if (entry.priority !== oldPriority) {
            // Re-sort the priority queue
            this.removeFromPriorityQueue(entry)
            this.insertIntoPriorityQueue(entry)
          }
        }
      }

      // Attempt matching for high-priority users
      const topUsers = this.priorityQueue.slice(0, 5)
      topUsers.forEach(entry => {
        if (!this.matchingInProgress.has(entry.userId)) {
          this.attemptMatch(entry).catch(console.error)
        }
      })
    }, 30000) // Run every 30 seconds
  }

  // Get queue statistics
  getQueueStats() {
    return {
      totalInQueue: this.activeQueue.size,
      matchingInProgress: this.matchingInProgress.size,
      averageWaitTime: this.getAverageWaitTime(),
      priorityDistribution: this.getPriorityDistribution()
    }
  }

  // Calculate average wait time
  getAverageWaitTime() {
    if (this.activeQueue.size === 0) return 0
    
    const now = Date.now()
    const totalWaitTime = Array.from(this.activeQueue.values())
      .reduce((sum, entry) => sum + (now - entry.joinedAt), 0)
    
    return Math.floor(totalWaitTime / this.activeQueue.size / 1000) // seconds
  }

  // Get priority distribution
  getPriorityDistribution() {
    const priorities = Array.from(this.activeQueue.values()).map(e => e.priority)
    if (priorities.length === 0) return { min: 0, max: 0, avg: 0 }
    
    return {
      min: Math.min(...priorities),
      max: Math.max(...priorities),
      avg: priorities.reduce((sum, p) => sum + p, 0) / priorities.length
    }
  }
}

// Singleton instance
export default new MatchingService()