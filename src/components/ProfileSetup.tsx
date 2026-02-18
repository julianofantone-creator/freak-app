import React, { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { User, Heart, Music, Gamepad2, Camera, Book, Coffee, Headphones } from 'lucide-react'
import toast from 'react-hot-toast'
import { User as UserType } from '../types'

interface ProfileSetupProps {
  onComplete: (user: UserType) => void
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const [username, setUsername] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [step, setStep] = useState(1)

  // Memoize interests array to prevent recreation
  const interests = useMemo(() => [
    { id: 'music', label: 'Music', icon: Music, color: 'bg-purple-500' },
    { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: 'bg-blue-500' },
    { id: 'photography', label: 'Photography', icon: Camera, color: 'bg-green-500' },
    { id: 'reading', label: 'Reading', icon: Book, color: 'bg-yellow-500' },
    { id: 'coffee', label: 'Coffee', icon: Coffee, color: 'bg-orange-500' },
    { id: 'podcasts', label: 'Podcasts', icon: Headphones, color: 'bg-red-500' },
  ], [])

  const handleInterestToggle = useCallback((interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    )
  }, [])

  const handleComplete = useCallback(() => {
    if (!username.trim()) {
      toast.error('Please enter a username')
      return
    }

    if (selectedInterests.length === 0) {
      toast.error('Please select at least one interest')
      return
    }

    const user: UserType = {
      id: Date.now().toString(),
      username: username.trim(),
      interests: selectedInterests,
      joinedAt: new Date(),
      connectionsCount: 0
    }

    toast.success(`Welcome, ${user.username}! 🎉`)
    onComplete(user)
  }, [username, selectedInterests, onComplete])

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
  }, [])

  const handleStepTwo = useCallback(() => {
    if (username.trim()) setStep(2)
  }, [username])

  const handleStepOne = useCallback(() => {
    setStep(1)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 safe-area-inset">
      <motion.div
        className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 mx-2"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="text-center mb-8">
              <motion.div
                className="w-20 h-20 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full mx-auto mb-4 flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <User className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">What should we call you?</h2>
              <p className="text-gray-300">Pick a fun username</p>
            </div>

            <motion.div className="space-y-6">
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Enter your username"
                  className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base mobile-optimized-tap"
                  maxLength={20}
                  onKeyPress={(e) => e.key === 'Enter' && handleStepTwo()}
                />
                <div className="text-right text-sm text-gray-400 mt-1">
                  {username.length}/20
                </div>
              </div>

              <motion.button
                onClick={handleStepTwo}
                disabled={!username.trim()}
                className="w-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl text-white font-semibold transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next →
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="text-center mb-8">
              <motion.div
                className="w-20 h-20 bg-gradient-to-r from-accent-500 to-primary-500 rounded-full mx-auto mb-4 flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: -5 }}
              >
                <Heart className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">What are you into?</h2>
              <p className="text-gray-300">Select your interests (helps with matching)</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
              {interests.map((interest) => (
                <motion.button
                  key={interest.id}
                  onClick={() => handleInterestToggle(interest.id)}
                  className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-xl transition-all mobile-optimized-tap min-h-[48px] ${
                    selectedInterests.includes(interest.id)
                      ? `${interest.color} text-white shadow-lg`
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 active:bg-white/25'
                  }`}
                  whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: interests.indexOf(interest) * 0.1 }}
                >
                  <interest.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium truncate">{interest.label}</span>
                </motion.button>
              ))}
            </div>

            <div className="flex space-x-3">
              <motion.button
                onClick={handleStepOne}
                className="flex-1 bg-white/10 hover:bg-white/20 active:bg-white/25 px-4 sm:px-6 py-3 rounded-xl text-white font-semibold transition-all mobile-optimized-tap min-h-[48px]"
                whileHover={{ scale: window.innerWidth > 768 ? 1.02 : 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-sm sm:text-base">← Back</span>
              </motion.button>

              <motion.button
                onClick={handleComplete}
                disabled={selectedInterests.length === 0}
                className="flex-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:from-green-700 active:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 sm:px-6 py-3 rounded-xl text-white font-semibold transition-all mobile-optimized-tap min-h-[48px]"
                whileHover={{ scale: window.innerWidth > 768 ? 1.02 : 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-sm sm:text-base">Get Freak! 🔥</span>
              </motion.button>
            </div>

            {selectedInterests.length > 0 && (
              <motion.p
                className="text-center text-green-400 text-sm mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ✨ {selectedInterests.length} interest{selectedInterests.length !== 1 ? 's' : ''} selected
              </motion.p>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

export default React.memo(ProfileSetup)