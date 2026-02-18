import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Video, Heart, Users, Zap } from 'lucide-react'

interface WelcomeScreenProps {
  onNext: () => void
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
  // Memoize features array to prevent recreation on every render
  const features = useMemo(() => [
    { icon: Video, title: "HD Video", desc: "Crystal clear chaos" },
    { icon: Zap, title: "Instant Match", desc: "No boring waits" },
    { icon: Heart, title: "Like & Add", desc: "Collect the wild ones" },
    { icon: Users, title: "Freak & Fun", desc: "Edgy but safe" },
  ], [])

  // Memoize background particles to prevent recreation
  const backgroundParticles = useMemo(() => 
    [...Array(20)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    }))
  , [])

  return (
    <motion.div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0">
        {backgroundParticles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            style={{
              left: particle.left,
              top: particle.top,
            }}
            animate={{
              y: [-20, -100, -20],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 sm:px-6 safe-area-inset">
        {/* Hero Section */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <motion.h1 
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-4 sm:mb-6"
            whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <span className="bg-gradient-to-r from-red-400 to-purple-500 bg-clip-text text-transparent">Freak</span>
          </motion.h1>
          
          <motion.p 
            className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Meet wild people instantly. One click, infinite chaos.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-12 px-2"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-center mobile-optimized-tap"
              whileHover={{ 
                scale: window.innerWidth > 768 ? 1.05 : 1.02,
                backgroundColor: "rgba(255, 255, 255, 0.15)"
              }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-primary-400 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">{feature.title}</h3>
              <p className="text-gray-400 text-xs sm:text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Social Proof */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex justify-center items-center space-x-8 text-gray-300">
            <div className="text-center">
              <motion.div 
                className="text-3xl font-bold text-primary-400"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                50K+
              </motion.div>
              <div className="text-sm">Active Users</div>
            </div>
            <div className="text-center">
              <motion.div 
                className="text-3xl font-bold text-accent-400"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              >
                1M+
              </motion.div>
              <div className="text-sm">Connections Made</div>
            </div>
            <div className="text-center">
              <motion.div 
                className="text-3xl font-bold text-green-400"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              >
                99%
              </motion.div>
              <div className="text-sm">Uptime</div>
            </div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          onClick={onNext}
          className="bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 active:from-primary-700 active:to-accent-700 px-8 sm:px-12 py-3 sm:py-4 rounded-full text-white font-bold text-lg sm:text-xl shadow-2xl relative overflow-hidden mobile-optimized-tap min-h-[52px] mx-4"
          whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          {/* Button animation overlay */}
          <motion.div
            className="absolute inset-0 bg-white/20"
            animate={{
              x: [-100, 100],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 3,
            }}
            style={{
              transform: 'skewX(-45deg)',
            }}
          />
          <span className="relative z-10">Get Freak 🔥</span>
        </motion.button>

        <motion.p 
          className="text-gray-400 text-sm mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          Free forever • No downloads • Safe & secure
        </motion.p>
      </div>
    </motion.div>
  )
}

export default React.memo(WelcomeScreen)