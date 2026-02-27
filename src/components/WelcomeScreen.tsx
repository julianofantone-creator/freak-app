import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Tv, X, Hash } from 'lucide-react'
import StreamerModal from './StreamerModal'

interface WelcomeScreenProps {
  onStart: (username: string, tags: string[]) => void
  premium?: { isPremium: boolean; streamerName?: string; daysLeft?: number }
  streamerInfo?: { streamerName: string; streamUrl: string; code: string } | null
}

const POPULAR_TAGS = [
  '🎮 gaming', '🎵 music', '🍿 movies', '📺 anime', '💪 fitness',
  '🎨 art', '💻 coding', '📸 photography', '🤣 memes', '☕ chill',
  '🏀 sports', '🎤 rap', '🌮 food', '✈️ travel', '🐾 pets',
]

const MAX_TAGS = 5

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, premium, streamerInfo }) => {
  const [username, setUsername] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showStreamerModal, setShowStreamerModal] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    // Strip emoji prefix added to popular tags (e.g. "🎮 gaming" → "gaming")
    const clean = raw.replace(/^[\p{Emoji}\s]+/u, '').trim().toLowerCase()
    if (!clean || tags.includes(clean) || tags.length >= MAX_TAGS) return
    setTags(prev => [...prev, clean])
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag))

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const handleStart = () => {
    const name = username.trim() || `User${Math.floor(Math.random() * 9999)}`
    onStart(name, tags)
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

        {/* Streamer context */}
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

      {/* Premium badge */}
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

      {/* Inputs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-xs space-y-3"
      >
        {/* Username */}
        <input
          type="text"
          placeholder="your name (optional)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          maxLength={20}
          className="w-full bg-freak-surface border border-freak-border text-white placeholder-freak-muted rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-freak-pink transition-colors"
        />

        {/* Interests section */}
        <div className="space-y-2">
          {/* Tag input box */}
          <div
            className="w-full bg-freak-surface border border-freak-border rounded-2xl px-4 py-3 flex flex-wrap gap-2 cursor-text focus-within:border-freak-pink transition-colors"
            onClick={() => tagInputRef.current?.focus()}
          >
            <Hash size={16} className="text-freak-muted mt-0.5 shrink-0" />
            {tags.map(tag => (
              <motion.span
                key={tag}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="inline-flex items-center gap-1 bg-freak-pink/20 border border-freak-pink/40 text-freak-pink text-sm rounded-full px-2.5 py-0.5"
              >
                {tag}
                <button onClick={(e) => { e.stopPropagation(); removeTag(tag) }} className="hover:text-white transition-colors">
                  <X size={11} />
                </button>
              </motion.span>
            ))}
            {tags.length < MAX_TAGS && (
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder={tags.length === 0 ? 'add interests to find your people…' : 'add more…'}
                className="flex-1 min-w-[120px] bg-transparent text-white placeholder-freak-muted text-sm focus:outline-none"
                maxLength={20}
              />
            )}
          </div>

          {/* Popular tag chips */}
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TAGS.filter(pt => {
              const clean = pt.replace(/^[\p{Emoji}\s]+/u, '').trim().toLowerCase()
              return !tags.includes(clean)
            }).slice(0, 10).map(pt => (
              <button
                key={pt}
                onClick={() => addTag(pt)}
                disabled={tags.length >= MAX_TAGS}
                className="text-xs bg-freak-surface border border-freak-border text-freak-muted hover:text-freak-pink hover:border-freak-pink/50 rounded-full px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pt}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <p className="text-freak-muted text-xs text-center">
              we'll try to match you with people who like the same things 🎯
            </p>
          )}
        </div>

        {/* Start button */}
        <motion.button
          onClick={handleStart}
          className="w-full bg-freak-pink text-white font-bold text-xl py-4 rounded-2xl shadow-pink"
          whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(255,0,102,0.5)' }}
          whileTap={{ scale: 0.97 }}
        >
          Start
        </motion.button>

        {/* Streamer mode */}
        <motion.button
          onClick={() => setShowStreamerModal(true)}
          className="w-full flex items-center justify-center gap-2 text-freak-muted text-sm py-2 hover:text-freak-pink transition-colors group"
          whileTap={{ scale: 0.97 }}
        >
          <Tv size={14} className="group-hover:text-freak-pink transition-colors" />
          <span>Streamers — connect with your viewers 🎮</span>
        </motion.button>
      </motion.div>

      {/* Footer */}
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
