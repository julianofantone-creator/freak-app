import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, Tv } from 'lucide-react'

interface StreamerBannerProps {
  streamerName: string
  daysLeft: number
  onDismiss: () => void
}

export default function StreamerBanner({ streamerName, daysLeft, onDismiss }: StreamerBannerProps) {
  const [visible, setVisible] = useState(true)

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-4 left-1/2 z-50 w-full max-w-sm px-4"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="bg-freak-surface border border-freak-pink/40 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
            {/* Icon */}
            <div className="w-9 h-9 rounded-xl bg-freak-pink/20 flex items-center justify-center shrink-0 mt-0.5">
              <Tv size={18} className="text-freak-pink" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">
                Welcome to <span className="text-freak-pink">{streamerName}</span>'s community 🎮
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Zap size={12} className="text-freak-pink shrink-0" />
                <p className="text-freak-muted text-xs">
                  <span className="text-white font-medium">Freaky+ free for {daysLeft} days</span>
                  {' '}· stream plays while you chat
                </p>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="text-freak-muted hover:text-white transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
