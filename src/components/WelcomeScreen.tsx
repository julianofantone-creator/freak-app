import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Tv } from 'lucide-react'
import StreamerModal from './StreamerModal'

interface WelcomeScreenProps {
  onStart: (username: string) => void
  premium?: { isPremium: boolean; streamerName?: string; daysLeft?: number }
  streamerInfo?: { streamerName: string; streamUrl: string; code: string } | null
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, premium, streamerInfo }) => {
  const [username, setUsername] = useState('')
  const [showStreamerModal, setShowStreamerModal] = useState(false)

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
        className="mb-10 text-center"
      >
        <h1 className="text-8xl font-black tracking-tighter text-freak-pink">
          freaky
        </h1>
        <p className="text-freak-muted text-lg mt-3 tracking-wide">
          meet strangers. make sparks.
        </p>

        {/* Streamer context — shown when viewing via ref link */}
        {streamerInfo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 inline-flex items-center gap-2 bg-freak-pink/10 border border-freak-pink/25 rounded-full px-4 py-1.5"
          >
            <Tv size={13} className="text-freak-pink" />
            <span className="text-white text-xs font-medium">{streamerInfo.streamerName}'s community</span>
          </motion.div>
        )}
      </motion.div>

      {/* Premium badge if active */}
      {premium?.isPremium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 flex items-center gap-2 bg-freak-pink/15 border border-freak-pink/30 rounded-2xl px-4 py-2"
        >
          <Zap size={15} className="text-freak-pink" />
          <span className="text-white text-sm font-medium">Freaky+ active</span>
          {premium.daysLeft && (
            <span className="text-freak-muted text-xs">· {premium.daysLeft}d left</span>
          )}
        </motion.div>
      )}

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

        {/* Streamer mode button */}
        <motion.button
          onClick={() => setShowStreamerModal(true)}
          className="w-full flex items-center justify-center gap-2 text-freak-muted text-sm py-2 hover:text-freak-pink transition-colors"
          whileTap={{ scale: 0.97 }}
        >
          <Tv size={14} />
          Are you a streamer? Get your link →
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

      {showStreamerModal && (
        <StreamerModal onClose={() => setShowStreamerModal(false)} />
      )}
    </div>
  )
}

export default WelcomeScreen
