import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { Character, CHARACTERS } from '../hooks/useCharacterOverlay'

interface CharacterPickerProps {
  activeCharacter: Character | null
  onSelect: (char: Character | null) => void
  onClose: () => void
}

export default function CharacterPicker({ activeCharacter, onSelect, onClose }: CharacterPickerProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Handle + Header */}
        <div className="flex-shrink-0 pt-3 pb-4 px-5 border-b border-freak-border">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-freak-border" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-xl">Face Masks 🎭</h2>
              <p className="text-freak-muted text-xs mt-0.5">Pick a character. Farm the clips.</p>
            </div>
            <button onClick={onClose} className="text-freak-muted hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* No mask option */}
          <div>
            <p className="text-freak-muted text-xs uppercase tracking-wider mb-3">Current</p>
            <motion.button
              onClick={() => { onSelect(null); onClose() }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl border transition-colors ${
                !activeCharacter
                  ? 'border-freak-pink bg-freak-pink/10'
                  : 'border-freak-border bg-freak-surface hover:border-freak-pink/50'
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <div className="w-12 h-12 rounded-full bg-freak-border flex items-center justify-center text-xl">
                📷
              </div>
              <div className="text-left">
                <p className={`font-semibold text-sm ${!activeCharacter ? 'text-freak-pink' : 'text-white'}`}>
                  Real Face
                </p>
                <p className="text-freak-muted text-xs">Show your actual camera</p>
              </div>
              {!activeCharacter && (
                <div className="ml-auto w-2 h-2 rounded-full bg-freak-pink" />
              )}
            </motion.button>
          </div>

          {/* Character grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={12} className="text-freak-pink" />
              <p className="text-freak-muted text-xs uppercase tracking-wider">Characters</p>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {CHARACTERS.map((char) => {
                const isActive = activeCharacter?.id === char.id
                return (
                  <motion.button
                    key={char.id}
                    onClick={() => { onSelect(char); onClose() }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-colors ${
                      isActive
                        ? 'border-freak-pink bg-freak-pink/15'
                        : 'border-freak-border bg-freak-surface hover:border-freak-pink/40'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                  >
                    <span className="text-3xl">{char.emoji}</span>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-freak-pink' : 'text-freak-muted'}`}>
                      {char.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeDot"
                        className="w-1.5 h-1.5 rounded-full bg-freak-pink"
                      />
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Tip */}
          <div className="bg-freak-surface border border-freak-border rounded-2xl p-4">
            <p className="text-white text-xs font-medium mb-1">💡 How to farm clips</p>
            <p className="text-freak-muted text-xs leading-relaxed">
              Pick a character → go live → let the chaos happen. Your real face stays hidden. Post the reactions on TikTok.{' '}
              <span className="text-freak-pink">That's the whole game.</span>
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
