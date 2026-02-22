import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, CheckCircle } from 'lucide-react'

const CATEGORIES = [
  { value: 'video', label: '📹 Video / Camera' },
  { value: 'audio', label: '🎤 Audio / Mic' },
  { value: 'connection', label: '🔌 Connection / Matching' },
  { value: 'chat', label: '💬 Chat / Messages' },
  { value: 'ui', label: '🎨 UI / Visual glitch' },
  { value: 'other', label: '🐛 Other' },
]

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://freak-app-production.up.railway.app'

const ReportIssue: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim()) return
    setLoading(true)
    try {
      const meta = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        timestamp: new Date().toISOString(),
      }
      await fetch(`${BACKEND_URL}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, description, meta }),
      })
      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setSubmitted(false)
        setDescription('')
        setCategory('other')
      }, 2000)
    } catch {
      // silent fail — don't interrupt user experience
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Top-left text button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-4 z-50 text-white/30 hover:text-white/70 text-xs font-medium transition-colors"
      >
        Report an issue
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-white/10 rounded-t-2xl p-6 max-w-lg mx-auto"
              onClick={e => e.stopPropagation()}
            >
              {submitted ? (
                <div className="flex flex-col items-center py-6 gap-3 text-center">
                  <CheckCircle className="text-pink-500" size={40} />
                  <p className="text-white font-semibold text-lg">Report sent!</p>
                  <p className="text-white/50 text-sm">Thanks for helping us fix things 🙏</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-white font-bold text-lg">Report an Issue</h2>
                      <p className="text-white/40 text-sm">Help us make Freak better</p>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      className="p-1.5 rounded-full hover:bg-white/10 text-white/50 transition"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Category */}
                  <div className="mb-4">
                    <label className="text-white/60 text-xs font-medium uppercase tracking-wide mb-2 block">
                      What broke?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          onClick={() => setCategory(cat.value)}
                          className={`px-3 py-2 rounded-xl text-sm text-left transition-all border ${
                            category === cat.value
                              ? 'bg-pink-600/30 border-pink-500 text-white'
                              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-5">
                    <label className="text-white/60 text-xs font-medium uppercase tracking-wide mb-2 block">
                      Describe what happened
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g. My camera showed black screen after skipping..."
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-pink-500 transition"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!description.trim() || loading}
                    className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
                  >
                    <Send size={16} />
                    {loading ? 'Sending...' : 'Send Report'}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default ReportIssue
