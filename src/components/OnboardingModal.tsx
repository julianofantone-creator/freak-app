import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'freaky_onboarded_v1'

const steps = [
  {
    emoji: '⚡',
    title: 'Instant matching',
    desc: 'Click Start and you\'re instantly connected to a random person. No waiting, no swiping.',
  },
  {
    emoji: '⏭️',
    title: 'Skip freely',
    desc: 'Not feeling it? Hit Skip. Nobody gets notified, no awkwardness. Move on instantly.',
  },
  {
    emoji: '💕',
    title: 'Save your crushes',
    desc: 'Meet someone you actually like? Add them as a Crush. They can message you back anytime.',
  },
]

const OnboardingModal: React.FC = () => {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Short delay so the page loads first
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  const next = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[101] flex items-center justify-center px-6"
          >
            <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

              {/* Top bar — progress dots */}
              <div className="flex gap-1.5 px-6 pt-5 pb-2">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      i <= step ? 'bg-freak-pink' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                  className="px-6 pt-4 pb-6 text-center"
                >
                  <div className="text-5xl mb-4">{steps[step].emoji}</div>
                  <h2 className="text-white font-bold text-xl mb-2">{steps[step].title}</h2>
                  <p className="text-white/60 text-sm leading-relaxed">{steps[step].desc}</p>
                </motion.div>
              </AnimatePresence>

              {/* Divider */}
              <div className="h-px bg-white/5 mx-6" />

              {/* Code of conduct */}
              <div className="px-6 py-4 bg-freak-pink/5">
                <p className="text-center text-sm font-bold text-freak-pink mb-1">
                  Stay Freaky. Keep it Friendly. 🔥
                </p>
                <p className="text-center text-white/40 text-xs">
                  No nudity, no harassment, no weird shit. Just vibes.
                </p>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6 pt-4">
                <motion.button
                  onClick={next}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-freak-pink text-white font-bold py-3.5 rounded-2xl text-base shadow-pink"
                >
                  {step < steps.length - 1 ? 'Next' : "Let's go 🔥"}
                </motion.button>

                {step === 0 && (
                  <button
                    onClick={dismiss}
                    className="w-full text-white/30 text-xs mt-3 hover:text-white/50 transition-colors"
                  >
                    Skip intro
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default OnboardingModal
