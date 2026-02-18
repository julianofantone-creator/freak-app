#!/usr/bin/env node
import mongoose from 'mongoose'
import config from '../src/config/config.js'
import User from '../src/models/User.js'
import ChatSession from '../src/models/ChatSession.js'

async function clean() {
  try {
    console.log('🧹 Starting database cleanup...')
    
    // Connect to database
    await mongoose.connect(config.MONGODB_URI)
    console.log('📊 Connected to database')
    
    // Get current counts
    const userCount = await User.countDocuments()
    const sessionCount = await ChatSession.countDocuments()
    
    console.log(`📊 Current data:`)
    console.log(`   - ${userCount} users`)
    console.log(`   - ${sessionCount} sessions`)
    
    if (userCount === 0 && sessionCount === 0) {
      console.log('✅ Database is already clean')
      process.exit(0)
    }
    
    // Confirm deletion in production
    if (config.NODE_ENV === 'production' && !process.argv.includes('--force')) {
      console.log('⚠️  Production environment detected!')
      console.log('Use --force flag to proceed with cleanup in production')
      process.exit(1)
    }
    
    // Clean up sessions first (due to foreign key references)
    console.log('🗑️  Removing chat sessions...')
    const deletedSessions = await ChatSession.deleteMany({})
    console.log(`✅ Removed ${deletedSessions.deletedCount} sessions`)
    
    // Clean up users
    console.log('🗑️  Removing users...')
    const deletedUsers = await User.deleteMany({})
    console.log(`✅ Removed ${deletedUsers.deletedCount} users`)
    
    console.log('✅ Database cleanup completed!')
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  clean()
}