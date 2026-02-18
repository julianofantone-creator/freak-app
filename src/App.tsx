import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import VideoChat from './components/VideoChat'
import { User, ConnectionState } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  
  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('chatUser')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleQuickStart = useCallback(() => {
    if (!username.trim()) return
    
    const userData: User = {
      id: Date.now().toString(),
      username: username.trim(),
      interests: [], // No interests needed - pure random
      joinedAt: new Date(),
      connectionsCount: 0
    }
    
    setUser(userData)
    localStorage.setItem('chatUser', JSON.stringify(userData))
  }, [username])

  const handleConnectionSuccess = useCallback(() => {
    // Could add streak counter here later
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          className="max-w-md w-full mx-auto px-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Freak</h1>
            <p className="text-gray-400">Meet someone instantly</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuickStart()}
              maxLength={15}
            />
            
            <motion.button
              onClick={handleQuickStart}
              disabled={!username.trim()}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg text-white font-semibold transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Start
            </motion.button>
          </div>
        </motion.div>
        <Toaster position="top-center" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <VideoChat 
        user={user}
        onConnectionSuccess={handleConnectionSuccess}
        connectionState={connectionState}
        setConnectionState={setConnectionState}
      />
      
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-gray-800 text-white',
          duration: 2000,
        }}
      />
    </div>
  )
}

export default App