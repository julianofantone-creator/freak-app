import User from '../models/User.js'
import { generateToken } from '../middleware/auth.js'
import config from '../config/config.js'

// Register new user
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        ...(email ? [{ email: email.toLowerCase() }] : [])
      ]
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.username.toLowerCase() === username.toLowerCase() 
          ? 'Username already exists' 
          : 'Email already registered'
      })
    }

    // Create user
    const user = await User.create({
      username: username.toLowerCase(),
      email: email ? email.toLowerCase() : undefined,
      password,
      profile: {
        displayName: username
      }
    })

    // Generate JWT token
    const token = generateToken(user._id)

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        createdAt: user.createdAt
      },
      token
    })

    console.log(`✅ New user registered: ${username}`)
  } catch (error) {
    console.error('Registration error:', error)
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0]
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      })
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      })
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed'
    })
  }
}

// Login user
export const login = async (req, res) => {
  try {
    const { username, password } = req.body

    // Find user (username or email)
    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() }
      ]
    }).select('+password')

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to failed login attempts',
        lockUntil: user.lockUntil
      })
    }

    // Check if account is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is banned',
        reason: user.banReason,
        banExpires: user.banExpires
      })
    }

    // Verify password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      await user.incLoginAttempts()
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Reset failed login attempts on successful login
    await user.resetLoginAttempts()

    // Update last login info
    await user.updateOne({
      lastActive: new Date(),
      lastLoginIP: req.ip,
      lastLoginDevice: req.get('User-Agent') || 'Unknown'
    })

    // Generate JWT token
    const token = generateToken(user._id)

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        stats: user.stats,
        lastActive: user.lastActive
      },
      token
    })

    console.log(`🔑 User logged in: ${user.username}`)
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      message: 'Login failed'
    })
  }
}

// Logout user
export const logout = async (req, res) => {
  try {
    // Clear the cookie
    res.clearCookie('token')
    
    // Update user's online status
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        currentSocketId: null
      })
    }

    res.json({
      success: true,
      message: 'Logout successful'
    })

    if (req.user) {
      console.log(`👋 User logged out: ${req.user.username}`)
    }
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    })
  }
}

// Get current user profile
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        stats: user.stats,
        lastActive: user.lastActive,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    })
  }
}

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const {
      displayName,
      bio,
      interests,
      age,
      gender,
      location
    } = req.body

    const updateData = {}

    // Update profile fields
    if (displayName !== undefined) updateData['profile.displayName'] = displayName
    if (bio !== undefined) updateData['profile.bio'] = bio
    if (interests !== undefined) updateData['profile.interests'] = interests
    if (age !== undefined) updateData['profile.age'] = age
    if (gender !== undefined) updateData['profile.gender'] = gender
    if (location !== undefined) updateData['profile.location'] = location

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        stats: user.stats
      }
    })

    console.log(`📝 Profile updated for user: ${user.username}`)
  } catch (error) {
    console.error('Update profile error:', error)
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    })
  }
}

// Update user preferences
export const updatePreferences = async (req, res) => {
  try {
    const {
      ageRange,
      genderPreference,
      maxDistance,
      interests
    } = req.body

    const updateData = {}

    // Update preference fields
    if (ageRange !== undefined) updateData['preferences.ageRange'] = ageRange
    if (genderPreference !== undefined) updateData['preferences.genderPreference'] = genderPreference
    if (maxDistance !== undefined) updateData['preferences.maxDistance'] = maxDistance
    if (interests !== undefined) updateData['preferences.interests'] = interests

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    })

    console.log(`⚙️ Preferences updated for user: ${user.username}`)
  } catch (error) {
    console.error('Update preferences error:', error)
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    })
  }
}

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      })
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password')
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.json({
      success: true,
      message: 'Password changed successfully'
    })

    console.log(`🔒 Password changed for user: ${user.username}`)
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    })
  }
}

// Delete account
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation required'
      })
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password')
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Verify password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      })
    }

    // Soft delete - deactivate account instead of hard delete
    await User.findByIdAndUpdate(user._id, {
      isActive: false,
      isOnline: false,
      email: null, // Clear email to allow reuse
      username: `deleted_${user._id}`, // Rename username
      deletedAt: new Date()
    })

    // Clear cookie
    res.clearCookie('token')

    res.json({
      success: true,
      message: 'Account deleted successfully'
    })

    console.log(`🗑️ Account deleted for user: ${user.username}`)
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    })
  }
}

// Refresh token
export const refreshToken = async (req, res) => {
  try {
    // User is already authenticated by middleware
    const user = req.user

    // Generate new token
    const token = generateToken(user._id)

    // Set new cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    })
  }
}

export default {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updatePreferences,
  changePassword,
  deleteAccount,
  refreshToken
}