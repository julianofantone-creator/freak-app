import React from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ConnectionAnimationProps {
  progress: number
  onCancel: () => void
}

const ConnectionAnimation: React.FC<ConnectionAnimationProps> = ({ progress, onCancel }) => {
  const searchMessages = [
    "Looking for someone freaky...",
    "Finding your chaotic match...",
    "Connecting to someone wild...",
    "Almost there...",
    "Get ready for the unexpected!"
  ]

  const currentMessage = searchMessages[Math.min(Math.floor(progress / 20), searchMessages.length - 1)]

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-center max-w-md mx-auto px-6">
        {/* Cancel button */}
        <motion.button
          onClick={onCancel}
          className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X className="w-8 h-8" />
        </motion.button>

        {/* Animated circles */}
        <div className="relative mb-8">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 border-4 border-primary-500/30 rounded-full"
              style={{
                width: 120 + i * 40,
                height: 120 + i * 40,
                left: '50%',
                top: '50%',
                marginLeft: -(60 + i * 20),
                marginTop: -(60 + i * 20),
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4,
              }}
            />
          ))}
          
          {/* Center circle */}
          <div className="relative z-10 w-24 h-24 mx-auto bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
            <motion.div
              className="text-3xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              🌎
            </motion.div>
          </div>
        </div>

        {/* Progress text */}
        <motion.h2
          className="text-2xl font-bold text-white mb-4"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {currentMessage}
        </motion.h2>

        {/* Progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-3 mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full relative"
            style={{ width: `${progress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={{
                x: [-100, 100],
                opacity: [0, 0.5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                transform: 'skewX(-45deg)',
                width: '50%',
              }}
            />
          </motion.div>
        </div>

        {/* Percentage */}
        <motion.p
          className="text-primary-400 font-mono text-lg"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {Math.floor(progress)}%
        </motion.p>

        {/* Tips */}
        <motion.div
          className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <p className="text-gray-300 text-sm mb-2">💡 <strong>Pro tip:</strong></p>
          <p className="text-gray-400 text-sm">
            {progress < 50
              ? "Make sure your camera and mic are working - things are about to get wild!"
              : "Get ready to say hi! First impressions are everything 😈"
            }
          </p>
        </motion.div>

        {/* Stats ticker */}
        <motion.div
          className="mt-6 flex justify-center space-x-8 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            👥 {Math.floor(Math.random() * 100) + 200} online
          </motion.div>
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          >
            🌍 {Math.floor(Math.random() * 50) + 20} countries
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default ConnectionAnimation