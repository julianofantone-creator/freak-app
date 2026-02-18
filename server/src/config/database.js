import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
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
    process.exit(1)
  }
}

export default connectDB