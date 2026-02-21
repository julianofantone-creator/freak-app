import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Heart } from 'lucide-react'
import { Crush, ChatMessage } from '../types'
import CrushChat from './CrushChat'

const EMOJI_AVATARS = [
  // Faces
  '😀','😂','🥰','😍','🤩','😎','🥳','🤪','😏','🫠',
  '🤯','😈','👿','💀','🤠','🥸','🤓','😴','🥺','🫡',
  // Animals
  '🐶','🐱','🐻','🐼','🦊','🐯','🦁','🐸','🐵','🐺',
  '🦄','🐉','🐙','🦈','🦭','🦜','🦋','🐨','🐧','🦅',
  // Hearts & vibes
  '❤️','🧡','💛','💚','💙','💜','🖤','💕','💖','💘',
  // Icons
  '👑','💎','🔥','⚡','🌈','🌙','⭐','💫','🎭','👾',
]

interface CrushesPanelProps {
  crushes: Crush[]
  messages: Record<string, ChatMessage[]>
  onSendMessage: (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  onUpdateCrushEmoji: (crushId: string, emoji: string) => void
  onClose: () => void
}

const CrushesPanel: React.FC<CrushesPanelProps> = ({ crushes, messages, onSendMessage, onUpdateCrushEmoji, onClose }) => {
  const [activeCrush, setActiveCrush] = useState<Crush | null>(null)
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null)

  const formatTime = (d?: Date) => {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return date.toLocaleDateString()
  }

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 bg-freak-bg flex flex-col"
    >
      <AnimatePresence mode="wait">
        {activeCrush ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            <CrushChat
              crush={activeCrush}
              messages={messages[activeCrush.id] || []}
              onSendMessage={onSendMessage}
              onBack={() => setActiveCrush(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-freak-border">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-freak-pink fill-freak-pink" />
                <h2 className="text-white font-bold text-lg">Crushes</h2>
                {crushes.length > 0 && (
                  <span className="bg-freak-pink text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {crushes.length}
                  </span>
                )}
              </div>
              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.9 }}
                className="text-freak-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {crushes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-5xl mb-4"
                  >
                    💕
                  </motion.div>
                  <p className="text-white font-semibold mb-2">No crushes yet</p>
                  <p className="text-freak-muted text-sm">
                    Tap the heart button when you meet someone you like!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-freak-border">
                  {crushes.map((crush) => {
                    const convo = messages[crush.id] || []
                    const lastMsg = convo[convo.length - 1]

                    return (
                      <motion.button
                        key={crush.id}
                        onClick={() => setActiveCrush(crush)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-freak-surface transition-colors text-left"
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Avatar — tap emoji to open picker */}
                        <div className="relative flex-shrink-0">
                          <motion.button
                            onClick={(e) => { e.stopPropagation(); setEmojiPickerFor(crush.id) }}
                            whileTap={{ scale: 0.9 }}
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${crush.avatar ? 'bg-freak-surface border border-freak-border text-2xl' : 'bg-freak-pink text-white'}`}
                            title="Change avatar"
                          >
                            {crush.avatar ?? crush.username[0]?.toUpperCase()}
                          </motion.button>
                          {crush.online && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-freak-bg" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-white font-semibold truncate">{crush.username}</p>
                            <p className="text-freak-muted text-xs flex-shrink-0 ml-2">
                              {formatTime(lastMsg?.timestamp || crush.addedAt)}
                            </p>
                          </div>
                          <p className="text-freak-muted text-sm truncate">
                            {lastMsg
                              ? lastMsg.type === 'text'
                                ? lastMsg.text
                                : lastMsg.type === 'gif'
                                ? '🎞 GIF'
                                : '🖼 Photo'
                              : 'Say hi! 👋'}
                          </p>
                        </div>

                        {/* Unread badge */}
                        {crush.unread > 0 && (
                          <div className="flex-shrink-0 w-5 h-5 bg-freak-pink rounded-full flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold">{crush.unread}</span>
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EMOJI AVATAR PICKER ── */}
      <AnimatePresence>
        {emojiPickerFor && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/60"
              onClick={() => setEmojiPickerFor(null)}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="absolute bottom-0 left-0 right-0 z-50 bg-freak-surface rounded-t-3xl pb-safe"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-freak-border" />
              </div>

              {/* Title */}
              <div className="flex items-center justify-between px-5 py-3">
                <p className="text-white font-bold text-base">Pick an avatar</p>
                <motion.button
                  onClick={() => setEmojiPickerFor(null)}
                  whileTap={{ scale: 0.9 }}
                  className="text-freak-muted hover:text-white"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Emoji grid */}
              <div className="grid grid-cols-8 gap-1 px-4 pb-6">
                {EMOJI_AVATARS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    onClick={() => {
                      onUpdateCrushEmoji(emojiPickerFor, emoji)
                      setEmojiPickerFor(null)
                    }}
                    whileTap={{ scale: 0.8 }}
                    whileHover={{ scale: 1.2 }}
                    className="aspect-square flex items-center justify-center text-2xl rounded-xl hover:bg-freak-card transition-colors"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {/* Remove custom avatar option */}
              {crushes.find(c => c.id === emojiPickerFor)?.avatar && (
                <div className="px-4 pb-5">
                  <motion.button
                    onClick={() => {
                      onUpdateCrushEmoji(emojiPickerFor, '')
                      setEmojiPickerFor(null)
                    }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3 border border-freak-border rounded-2xl text-freak-muted text-sm font-medium hover:border-red-500 hover:text-red-400 transition-colors"
                  >
                    Remove avatar
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default CrushesPanel
