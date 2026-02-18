import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import VideoChat from './components/VideoChat'
import WelcomeScreen from './components/WelcomeScreen'
import ProfileSetup from './components/ProfileSetup'
import ConnectionHistory from './components/ConnectionHistory'
import { User, ConnectionState } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [showHistory, setShowHistory] = useState(false)
  
  // Psychological hook: Connection streak counter
  const [connectionStreak, setConnectionStreak] = useState(0)
  
  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('chatUser')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleUserSetup = useCallback((userData: User) => {
    setUser(userData)
    localStorage.setItem('chatUser', JSON.stringify(userData))
  }, [])

  const handleConnectionSuccess = useCallback(() => {
    setConnectionStreak(prev => prev + 1)
  }, [])

  const handleHistoryToggle = useCallback(() => {
    setShowHistory(prev => !prev)
  }, [])

  // Memoized gradient background
  const backgroundGradient = useMemo(() => 
    "min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-red-900"
  , [])

  if (!user) {
    return (
      <div className={backgroundGradient}>
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="safe-area-inset"
          >
            <WelcomeScreen onNext={() => {}} />
            <ProfileSetup onComplete={handleUserSetup} />
          </motion.div>
        </AnimatePresence>
        <Toaster 
          position="top-center" 
          toastOptions={{
            className: 'bg-dark-800 text-white text-sm sm:text-base',
            duration: 3000,
          }}
        />
      </div>
    )
  }

  return (
    <div className={backgroundGradient}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8 safe-area-inset">
        {/* Header with psychological elements */}
        <motion.header 
          className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center space-x-3 sm:space-x-4">
            <motion.div
              className="text-xl sm:text-2xl font-bold text-white mobile-optimized-tap"
              whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🔥 Freak
            </motion.div>
            
            {/* Connection streak - psychological hook */}
            {connectionStreak > 0 && (
              <motion.div
                className="bg-accent-500 px-2 sm:px-3 py-1 rounded-full text-white text-xs sm:text-sm font-semibold"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: window.innerWidth > 768 ? 1.1 : 1.05 }}
              >
                🔥 {connectionStreak} streak
              </motion.div>
            )}
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <motion.button
              onClick={handleHistoryToggle}
              className="bg-white/10 hover:bg-white/20 active:bg-white/25 px-3 sm:px-4 py-2 rounded-lg text-white transition-colors mobile-optimized-tap min-h-[40px]"
              whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-sm sm:text-base">History</span>
            </motion.button>
            
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"></div>
              <span className="text-white font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{user.username}</span>
            </div>
          </div>
        </motion.header>

        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
            >
              <ConnectionHistory 
                user={user}
                onBack={() => setShowHistory(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="video-chat"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
            >
              <VideoChat 
                user={user}
                onConnectionSuccess={handleConnectionSuccess}
                connectionState={connectionState}
                setConnectionState={setConnectionState}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-dark-800 text-white text-sm sm:text-base',
          duration: 3000,
          style: {
            marginTop: 'env(safe-area-inset-top)',
          },
        }}
        containerClassName="safe-area-inset"
      />
    </div>
  )
}

export default App