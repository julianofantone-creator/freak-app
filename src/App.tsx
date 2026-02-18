import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import VideoChat from './components/VideoChat'
import { User, ConnectionState } from './types'

// Theme system for customization
export type Theme = {
  id: string
  name: string
  background: string
  accent: string
  secondary: string
  text: string
  border: string
}

export const themes: Theme[] = [
  {
    id: 'dark-pink',
    name: 'Dark Pink',
    background: 'bg-gray-900',
    accent: 'bg-pink-500 hover:bg-pink-600',
    secondary: 'bg-gray-800 hover:bg-gray-700',
    text: 'text-white',
    border: 'border-gray-700'
  },
  {
    id: 'clean-white',
    name: 'Clean White',
    background: 'bg-white',
    accent: 'bg-pink-500 hover:bg-pink-600',
    secondary: 'bg-gray-100 hover:bg-gray-200',
    text: 'text-gray-900',
    border: 'border-gray-300'
  },
  {
    id: 'minimal-grey',
    name: 'Minimal Grey',
    background: 'bg-gray-100',
    accent: 'bg-pink-600 hover:bg-pink-700',
    secondary: 'bg-white hover:bg-gray-50',
    text: 'text-gray-800',
    border: 'border-gray-200'
  }
]

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0])
  
  // Load user and theme from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('chatUser')
    const savedTheme = localStorage.getItem('chatTheme')
    
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    
    if (savedTheme) {
      const theme = themes.find(t => t.id === savedTheme) || themes[0]
      setCurrentTheme(theme)
    }
  }, [])

  const handleQuickStart = useCallback(() => {
    if (!username.trim()) return
    
    const userData: User = {
      id: Date.now().toString(),
      username: username.trim(),
      interests: [],
      joinedAt: new Date(),
      connectionsCount: 0
    }
    
    setUser(userData)
    localStorage.setItem('chatUser', JSON.stringify(userData))
  }, [username])

  const handleThemeChange = useCallback((theme: Theme) => {
    setCurrentTheme(theme)
    localStorage.setItem('chatTheme', theme.id)
  }, [])

  if (!user) {
    return (
      <div className={`min-h-screen ${currentTheme.background} flex items-center justify-center`}>
        <motion.div
          className="max-w-md w-full mx-auto px-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-center mb-8">
            <motion.h1 
              className={`text-5xl font-bold ${currentTheme.text} mb-2`}
              whileHover={{ scale: 1.05 }}
            >
              Freak
            </motion.h1>
            <p className="text-gray-400 text-lg">Meet someone instantly</p>
          </div>
          
          <div className="space-y-4">
            <motion.input
              type="text"
              placeholder="Enter username"
              className={`w-full ${currentTheme.secondary} ${currentTheme.border} border rounded-xl px-6 py-4 ${currentTheme.text} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 text-lg`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuickStart()}
              maxLength={15}
              whileFocus={{ scale: 1.02 }}
            />
            
            <motion.button
              onClick={handleQuickStart}
              disabled={!username.trim()}
              className={`w-full ${currentTheme.accent} disabled:bg-gray-500 disabled:cursor-not-allowed px-10 py-5 rounded-xl text-white text-xl font-bold shadow-xl transition-all min-h-[70px]`}
              whileHover={{ scale: 1.03, y: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              Start Chatting
            </motion.button>
          </div>

          {/* Theme Selector */}
          <div className="mt-8">
            <p className="text-gray-400 text-sm mb-3 text-center">Choose your style</p>
            <div className="flex justify-center space-x-3">
              {themes.map((theme) => (
                <motion.button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    currentTheme.id === theme.id ? 'border-pink-500 scale-110' : 'border-gray-400'
                  } ${theme.id === 'dark-pink' ? 'bg-gray-900' : theme.id === 'clean-white' ? 'bg-white' : 'bg-gray-100'}`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  title={theme.name}
                />
              ))}
            </div>
          </div>
        </motion.div>
        <Toaster position="top-center" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${currentTheme.background}`}>
      <VideoChat 
        user={user}
        onConnectionSuccess={() => {}}
        connectionState={connectionState}
        setConnectionState={setConnectionState}
        theme={currentTheme}
        onThemeChange={handleThemeChange}
        availableThemes={themes}
      />
      
      <Toaster 
        position="top-center"
        toastOptions={{
          className: currentTheme.id === 'clean-white' ? 'bg-white text-gray-900 border border-gray-200' : 'bg-gray-800 text-white',
          duration: 2000,
        }}
      />
    </div>
  )
}

export default App