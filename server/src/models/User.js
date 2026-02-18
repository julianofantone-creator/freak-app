import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores']
  },
  
  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness when present
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  
  profile: {
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters']
    },
    
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    
    interests: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    
    age: {
      type: Number,
      min: [13, 'Must be at least 13 years old'],
      max: [100, 'Age cannot exceed 100']
    },
    
    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
      default: 'prefer-not-to-say'
    },
    
    location: {
      country: String,
      city: String,
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      }
    }
  },
  
  preferences: {
    ageRange: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 99 }
    },
    
    genderPreference: [{
      type: String,
      enum: ['male', 'female', 'non-binary', 'any']
    }],
    
    maxDistance: {
      type: Number,
      default: 50 // km
    },
    
    interests: [{
      type: String,
      trim: true
    }]
  },
  
  // Moderation & Safety
  reports: [{
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  blocked: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Account status
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  banReason: String,
  banExpires: Date,
  
  // Statistics
  stats: {
    totalMatches: { type: Number, default: 0 },
    totalChatTime: { type: Number, default: 0 }, // in minutes
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  
  // Session management
  lastActive: { type: Date, default: Date.now },
  currentSocketId: String,
  isOnline: { type: Boolean, default: false },
  
  // Security
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  // Device info for security
  lastLoginIP: String,
  lastLoginDevice: String

}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password
      delete ret.loginAttempts
      delete ret.lockUntil
      delete ret.__v
      return ret
    }
  }
})

// Indexes for performance
userSchema.index({ username: 1 })
userSchema.index({ email: 1 })
userSchema.index({ 'profile.location.coordinates': '2dsphere' })
userSchema.index({ lastActive: -1 })
userSchema.index({ isActive: 1, isBanned: 1 })

// Virtual for account locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  
  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false
  return bcrypt.compare(candidatePassword, this.password)
}

// Method to handle failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    })
  }
  
  const updates = { $inc: { loginAttempts: 1 } }
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 } // 2 hours
  }
  
  return this.updateOne(updates)
}

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  })
}

// Method to update activity
userSchema.methods.updateActivity = function(socketId = null) {
  return this.updateOne({
    lastActive: new Date(),
    isOnline: true,
    ...(socketId && { currentSocketId: socketId })
  })
}

// Static method to find users for matching
userSchema.statics.findMatchCandidates = function(user, options = {}) {
  const query = {
    _id: { $ne: user._id },
    isActive: true,
    isBanned: false,
    isOnline: true,
    'blocked.user': { $ne: user._id }
  }
  
  // Age preferences
  if (user.preferences.ageRange) {
    query['profile.age'] = {
      $gte: user.preferences.ageRange.min,
      $lte: user.preferences.ageRange.max
    }
  }
  
  // Gender preferences
  if (user.preferences.genderPreference?.length && 
      !user.preferences.genderPreference.includes('any')) {
    query['profile.gender'] = { $in: user.preferences.genderPreference }
  }
  
  let queryBuilder = this.find(query).select('username profile preferences stats lastActive')
  
  // Geographic filtering
  if (user.profile.location?.coordinates && user.preferences.maxDistance) {
    queryBuilder = queryBuilder.where('profile.location.coordinates').near({
      center: user.profile.location.coordinates,
      maxDistance: user.preferences.maxDistance * 1000 // Convert km to meters
    })
  }
  
  return queryBuilder.limit(options.limit || 50)
}

export default mongoose.model('User', userSchema)