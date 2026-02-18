#!/usr/bin/env node
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import config from '../src/config/config.js'
import User from '../src/models/User.js'
import ChatSession from '../src/models/ChatSession.js'

const sampleInterests = [
  'gaming', 'music', 'movies', 'travel', 'cooking', 'reading', 'sports',
  'photography', 'art', 'technology', 'fitness', 'nature', 'dancing',
  'writing', 'comedy', 'fashion', 'food', 'animals', 'learning', 'adventure'
]

const sampleNames = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage',
  'River', 'Phoenix', 'Harper', 'Blake', 'Cameron', 'Dakota', 'Finley'
]

const sampleBios = [
  "Love meeting new people and having great conversations!",
  "Adventure seeker looking for interesting chats",
  "Creative soul who enjoys deep discussions",
  "Always up for a good laugh and fun times",
  "Curious about the world and the people in it",
  "Friendly and open-minded, let's talk!",
  "Here to make new connections and friends"
]

async function createSampleUsers(count = 10) {
  console.log(`Creating ${count} sample users...`)
  
  const users = []
  
  for (let i = 0; i < count; i++) {
    const username = `${sampleNames[i % sampleNames.length].toLowerCase()}${Math.floor(Math.random() * 1000)}`
    const password = await bcrypt.hash('password123', 12)
    
    const user = {
      username,
      password,
      profile: {
        displayName: sampleNames[i % sampleNames.length],
        bio: sampleBios[i % sampleBios.length],
        age: Math.floor(Math.random() * 30) + 18, // 18-48 years old
        gender: ['male', 'female', 'non-binary'][Math.floor(Math.random() * 3)],
        interests: getRandomInterests(),
        location: {
          country: 'US',
          city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)],
          coordinates: [
            -122.4194 + (Math.random() * 10), // Longitude around SF Bay Area
            37.7749 + (Math.random() * 5)     // Latitude around SF Bay Area
          ]
        }
      },
      preferences: {
        ageRange: {
          min: 18,
          max: Math.floor(Math.random() * 20) + 35 // 35-55
        },
        genderPreference: ['any'],
        maxDistance: Math.floor(Math.random() * 50) + 25, // 25-75 km
        interests: getRandomInterests(3)
      },
      stats: {
        totalMatches: Math.floor(Math.random() * 50),
        totalChatTime: Math.floor(Math.random() * 1000),
        averageRating: 3.5 + (Math.random() * 1.5), // 3.5-5.0
        ratingCount: Math.floor(Math.random() * 20)
      },
      isActive: true,
      lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Within last week
    }
    
    users.push(user)
  }
  
  const createdUsers = await User.insertMany(users)
  console.log(`✅ Created ${createdUsers.length} sample users`)
  return createdUsers
}

function getRandomInterests(count = 5) {
  const shuffled = [...sampleInterests].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.floor(Math.random() * count) + 1)
}

async function createSampleSessions(users, count = 20) {
  console.log(`Creating ${count} sample chat sessions...`)
  
  const sessions = []
  
  for (let i = 0; i < count; i++) {
    // Pick two random users
    const user1 = users[Math.floor(Math.random() * users.length)]
    let user2 = users[Math.floor(Math.random() * users.length)]
    
    // Ensure different users
    while (user2._id.equals(user1._id)) {
      user2 = users[Math.floor(Math.random() * users.length)]
    }
    
    const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Within last 30 days
    const duration = Math.floor(Math.random() * 1800) + 60 // 1-30 minutes
    const endTime = new Date(startTime.getTime() + duration * 1000)
    
    const session = {
      participants: [
        {
          user: user1._id,
          joinedAt: startTime,
          leftAt: endTime,
          rating: Math.floor(Math.random() * 5) + 1,
          feedback: Math.random() > 0.5 ? "Great conversation!" : ""
        },
        {
          user: user2._id,
          joinedAt: startTime,
          leftAt: endTime,
          rating: Math.floor(Math.random() * 5) + 1,
          feedback: Math.random() > 0.5 ? "Had a nice chat" : ""
        }
      ],
      status: 'ended',
      matchedAt: startTime,
      startedAt: startTime,
      endedAt: endTime,
      duration,
      messageCount: Math.floor(Math.random() * 50) + 5,
      matchScore: Math.random() * 100,
      matchCriteria: {
        interests: getRandomInterests(2),
        distance: Math.random() * 50,
        ageCompatibility: Math.random()
      },
      queueTime: Math.floor(Math.random() * 300), // 0-5 minutes
      approximateDistance: Math.random() * 100,
      featuresUsed: [
        { feature: 'video', timestamp: startTime },
        { feature: 'chat', timestamp: new Date(startTime.getTime() + 30000) }
      ]
    }
    
    sessions.push(session)
  }
  
  const createdSessions = await ChatSession.insertMany(sessions)
  console.log(`✅ Created ${createdSessions.length} sample sessions`)
  return createdSessions
}

async function seed() {
  try {
    console.log('🌱 Starting database seeding...')
    
    // Connect to database
    await mongoose.connect(config.MONGODB_URI)
    console.log('📊 Connected to database')
    
    // Check if data already exists
    const existingUsers = await User.countDocuments()
    const existingSessions = await ChatSession.countDocuments()
    
    if (existingUsers > 0 || existingSessions > 0) {
      console.log(`⚠️  Database already contains ${existingUsers} users and ${existingSessions} sessions`)
      console.log('Use --force flag to clear existing data')
      
      if (!process.argv.includes('--force')) {
        process.exit(0)
      }
      
      console.log('🗑️  Clearing existing data...')
      await User.deleteMany({})
      await ChatSession.deleteMany({})
    }
    
    // Create sample data
    const users = await createSampleUsers(15)
    const sessions = await createSampleSessions(users, 30)
    
    console.log('✅ Database seeding completed!')
    console.log(`📊 Summary:`)
    console.log(`   - ${users.length} users created`)
    console.log(`   - ${sessions.length} sessions created`)
    console.log(`   - Sample credentials: username: alex123, password: password123`)
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
}