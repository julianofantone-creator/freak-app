import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Layers } from 'lucide-react'
import {
  Character, CHARACTERS,
  Accessory, ACCESSORIES, ACCESSORY_CATEGORIES, AccessoryCategory,
  Background, BACKGROUNDS,
} from '../hooks/useCharacterOverlay'

interface CharacterPickerProps {
  activeCharacter: Character | null
  activeAccessories: string[]
  activeBackground: string
  onSelect: (char: Character | null) => void
  onToggleAccessory: (id: string) => void
  onClearAccessories: () => void
  onSelectBackground: (id: string) => void
  onClose: () => void
}

export default function CharacterPicker({
  activeCharacter,
  activeAccessories,
  activeBackground,
  onSelect,
  onToggleAccessory,
  onClearAccessories,
  onSelectBackground,
  onClose,
}: CharacterPickerProps) {
  const [tab, setTab] = useState<'characters' | 'accessories' | 'backgrounds'>('characters')
  const [accCat, setAccCat] = useState<AccessoryCategory>('head')

  const filteredAccessories = ACCESSORIES.filter(a => a.category === accCat)

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
        <div className="flex-shrink-0 pt-3 pb-0 px-5 border-b border-freak-border">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-freak-border" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-bold text-xl">Face Filters 🎭</h2>
              <p className="text-freak-muted text-xs mt-0.5">Character skin + accessories. Stack them.</p>
            </div>
            <button onClick={onClose} className="text-freak-muted hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-0">
            {[
              { id: 'characters'  as const, label: '🎭 Characters' },
              { id: 'accessories' as const, label: `🪖 Fits${activeAccessories.length > 0 ? ` (${activeAccessories.length})` : ''}` },
              { id: 'backgrounds' as const, label: `🌆 Backgrounds${activeBackground !== 'none' ? ' ●' : ''}` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                  tab === t.id
                    ? 'bg-freak-surface text-freak-pink border-t border-x border-freak-border'
                    : 'text-freak-muted hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* ── Characters tab ─────────────────────────────────────────────── */}
          {tab === 'characters' && (
            <div className="space-y-4">
              {/* Real face option */}
              <motion.button
                onClick={() => { onSelect(null); onClose() }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl border transition-colors ${
                  !activeCharacter
                    ? 'border-freak-pink bg-freak-pink/10'
                    : 'border-freak-border bg-freak-surface hover:border-freak-pink/50'
                }`}
                whileTap={{ scale: 0.97 }}
              >
                <div className="w-12 h-12 rounded-full bg-freak-border flex items-center justify-center text-xl">📷</div>
                <div className="text-left">
                  <p className={`font-semibold text-sm ${!activeCharacter ? 'text-freak-pink' : 'text-white'}`}>Real Face</p>
                  <p className="text-freak-muted text-xs">Show your actual camera</p>
                </div>
                {!activeCharacter && <div className="ml-auto w-2 h-2 rounded-full bg-freak-pink" />}
              </motion.button>

              {/* Character grid */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={12} className="text-freak-pink" />
                  <p className="text-freak-muted text-xs uppercase tracking-wider">Characters</p>
                  <p className="text-freak-muted text-xs ml-auto">Eyes & mouth show through ✨</p>
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
                        {isActive && <motion.div layoutId="activeDot" className="w-1.5 h-1.5 rounded-full bg-freak-pink" />}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Tip */}
              <div className="bg-freak-surface border border-freak-border rounded-2xl p-4">
                <p className="text-white text-xs font-medium mb-1">💡 How to farm clips</p>
                <p className="text-freak-muted text-xs leading-relaxed">
                  Pick a character → stack accessories → go live → chaos happens. Post on TikTok.{' '}
                  <span className="text-freak-pink">That's the whole game.</span>
                </p>
              </div>
            </div>
          )}

          {/* ── Accessories tab ────────────────────────────────────────────── */}
          {tab === 'accessories' && (
            <div className="space-y-4">
              {/* Active accessories badge strip */}
              {activeAccessories.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {activeAccessories.map(id => {
                      const acc = ACCESSORIES.find(a => a.id === id)
                      if (!acc) return null
                      return (
                        <motion.button
                          key={id}
                          onClick={() => onToggleAccessory(id)}
                          className="flex items-center gap-1 bg-freak-pink/20 border border-freak-pink/40 rounded-full px-2.5 py-1"
                          whileTap={{ scale: 0.9 }}
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                        >
                          <span className="text-sm">{acc.emoji}</span>
                          <X size={10} className="text-freak-pink" />
                        </motion.button>
                      )
                    })}
                  </div>
                  <button
                    onClick={onClearAccessories}
                    className="text-freak-muted text-xs hover:text-white transition-colors shrink-0"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Category pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {ACCESSORY_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setAccCat(cat.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      accCat === cat.id
                        ? 'bg-freak-pink text-white'
                        : 'bg-freak-surface border border-freak-border text-freak-muted hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Accessories grid */}
              <div className="grid grid-cols-4 gap-2.5">
                {filteredAccessories.map((acc: Accessory) => {
                  const isActive = activeAccessories.includes(acc.id)
                  return (
                    <motion.button
                      key={acc.id}
                      onClick={() => onToggleAccessory(acc.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-colors relative ${
                        isActive
                          ? 'border-freak-pink bg-freak-pink/15'
                          : 'border-freak-border bg-freak-surface hover:border-freak-pink/40'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-freak-pink rounded-full flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">✓</span>
                        </div>
                      )}
                      <span className="text-3xl">{acc.emoji}</span>
                      <span className={`text-[10px] font-semibold text-center leading-tight ${isActive ? 'text-freak-pink' : 'text-freak-muted'}`}>
                        {acc.label}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              {/* Stack tip */}
              <div className="bg-freak-surface border border-freak-border rounded-2xl p-4 flex gap-3 items-start">
                <Layers size={16} className="text-freak-pink shrink-0 mt-0.5" />
                <p className="text-freak-muted text-xs leading-relaxed">
                  Stack multiple accessories. Halo helmet + sunglasses + chain all at once. The more chaotic the combo, the better the clip.
                </p>
              </div>
            </div>
          )}

          {/* ── Backgrounds tab ────────────────────────────────────────────── */}
          {tab === 'backgrounds' && (
            <div className="space-y-4">
              <div>
                <p className="text-freak-muted text-xs uppercase tracking-wider mb-1">Virtual Backgrounds</p>
                <p className="text-freak-muted text-[11px] mb-3">Replace your background. Works with or without a character.</p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {(BACKGROUNDS as Background[]).map((bg) => {
                  const isActive = activeBackground === bg.id
                  return (
                    <motion.button
                      key={bg.id}
                      onClick={() => { onSelectBackground(bg.id); onClose() }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors ${
                        isActive
                          ? 'border-freak-pink bg-freak-pink/15'
                          : 'border-freak-border bg-freak-surface hover:border-freak-pink/40'
                      }`}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      <span className="text-3xl">{bg.emoji}</span>
                      <span className={`text-[10px] font-semibold ${isActive ? 'text-freak-pink' : 'text-freak-muted'}`}>
                        {bg.label}
                      </span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-freak-pink" />}
                    </motion.button>
                  )
                })}
              </div>

              <div className="bg-freak-surface border border-freak-border rounded-2xl p-4">
                <p className="text-white text-xs font-medium mb-1">🔥 Pro combo</p>
                <p className="text-freak-muted text-xs leading-relaxed">
                  Peanut character + Space background = you're an actual peanut floating in space. That clip goes viral.{' '}
                  <span className="text-freak-pink">Stack everything.</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
