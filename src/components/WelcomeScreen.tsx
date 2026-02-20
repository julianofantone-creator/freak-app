import React, { useState } from 'react'
import { motion } from 'framer-motion'

interface WelcomeScreenProps {
  onStart: (username: string) => void
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [username, setUsername] = useState('')

  const handleStart = () => {
    const name = username.trim() || `User${Math.floor(Math.random() * 9999)}`
    onStart(name)
  }

  return (
    <div className="min-h-screen bg-freak-bg flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-12 text-center"
      >
        <h1 className="text-8xl font-black tracking-tighter text-freak-pink">
          freak
        </h1>
        <p className="text-freak-muted text-lg mt-3 tracking-wide">
          meet strangers. make sparks.
        </p>
      </motion.div>

      {/* Input + Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-xs space-y-4"
      >
        <input
          type="text"
          placeholder="your name (optional)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          maxLength={20}
          className="w-full bg-freak-surface border border-freak-border text-white placeholder-freak-muted rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-freak-pink transition-colors"
        />

        <motion.button
          onClick={handleStart}
          className="w-full bg-freak-pink text-white font-bold text-xl py-4 rounded-2xl shadow-pink"
          whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(255,0,102,0.5)' }}
          whileTap={{ scale: 0.97 }}
        >
          Start
        </motion.button>
      </motion.div>

      {/* Subtle footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 text-freak-muted text-xs"
      >
        18+ only · be kind · have fun
      </motion.p>
    </div>
  )
}

export default WelcomeScreen
