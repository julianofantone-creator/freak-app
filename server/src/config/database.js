import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    // Check if MongoDB URI is provided
    if (!process.env.MONGODB_URI) {
      console.log('⚠️  No MongoDB URI provided - running in memory-only mode')
      console.log('   User data will not persist between restarts')
      return null
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    })

    console.log(`📊 MongoDB Connected: ${conn.connection.host}`)
    
    // Connection error handling
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected')
    })

    return conn
  } catch (error) {
    console.error('Database connection failed:', error)
    console.log('⚠️  Falling back to memory-only mode')
    return null
  }
}

export default connectDB