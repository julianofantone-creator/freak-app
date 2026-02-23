import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Twitch, Youtube, Link, Copy, Check, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://freak-app-production.up.railway.app'

interface StreamerModalProps {
  onClose: () => void
}

export default function StreamerModal({ onClose }: StreamerModalProps) {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [streamerName, setStreamerName] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ code: string; refUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleRegister = async () => {
    if (!streamerName.trim()) { toast.error('Enter your streamer name'); return }
    if (!streamUrl.trim()) { toast.error('Paste your stream URL (Twitch, YouTube, Kick)'); return }

    setLoading(true)
    try {
      const res = await fetch(`${SERVER_URL}/api/streamer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamerName: streamerName.trim(), streamUrl: streamUrl.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setResult(data)
      setStep('done')
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!result) return
    navigator.clipboard.writeText(result.refUrl)
    setCopied(true)
    toast.success('Link copied! Drop it in your stream 🔥')
    setTimeout(() => setCopied(false), 2000)
  }

  const detectPlatform = (url: string) => {
    if (url.includes('twitch.tv')) return 'twitch'
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
    if (url.includes('kick.com')) return 'kick'
    if (url.includes('tiktok.com')) return 'tiktok'
    return null
  }

  const platform = detectPlatform(streamUrl)

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="bg-freak-surface border border-freak-border rounded-3xl w-full max-w-md overflow-hidden"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
        >
          {/* Header */}
          <div className="relative p-6 pb-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-freak-muted hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-freak-pink/20 flex items-center justify-center">
                <Zap size={20} className="text-freak-pink" />
              </div>
              <div>
                <h2 className="text-white font-bold text-xl">Streamer Mode 🎮</h2>
                <p className="text-freak-muted text-xs">Connect with your viewers. Farm the clips.</p>
              </div>
            </div>
          </div>

          {step === 'form' && (
            <div className="p-6 space-y-4">
              {/* Pitch */}
              <div className="bg-freak-pink/10 border border-freak-pink/20 rounded-2xl p-4 space-y-2">
                <p className="text-white text-sm font-medium leading-snug">
                  Your viewers jump on Freaky — random video calls, live, while watching your stream in the corner.
                </p>
                <p className="text-freak-muted text-xs leading-relaxed">
                  The reactions. The chaos. The clips. Growth at your stature — share one link and let it run. 🔥
                </p>
              </div>

              {/* Streamer name */}
              <div className="space-y-2">
                <label className="text-freak-muted text-xs uppercase tracking-wider">Your streamer name</label>
                <input
                  type="text"
                  placeholder="e.g. xQc, Pokimane, YourName"
                  value={streamerName}
                  onChange={(e) => setStreamerName(e.target.value)}
                  maxLength={30}
                  className="w-full bg-black/40 border border-freak-border text-white placeholder-freak-muted rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-freak-pink transition-colors"
                />
              </div>

              {/* Stream URL */}
              <div className="space-y-2">
                <label className="text-freak-muted text-xs uppercase tracking-wider">Your stream URL</label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://twitch.tv/yourname"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    className="w-full bg-black/40 border border-freak-border text-white placeholder-freak-muted rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-freak-pink transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-freak-muted">
                    {platform === 'twitch' ? (
                      <Twitch size={16} className="text-purple-400" />
                    ) : platform === 'youtube' ? (
                      <Youtube size={16} className="text-red-400" />
                    ) : platform === 'tiktok' ? (
                      <span className="text-sm">🎵</span>
                    ) : (
                      <Link size={16} />
                    )}
                  </div>
                </div>
                {platform === 'tiktok' ? (
                  <p className="text-freak-muted text-xs">🎵 TikTok LIVE — viewers get a link to watch you live while they chat</p>
                ) : (
                  <p className="text-freak-muted text-xs">Twitch, YouTube, Kick, TikTok — all supported</p>
                )}
              </div>

              {/* Submit */}
              <motion.button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-freak-pink text-white font-bold py-4 rounded-2xl shadow-pink disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
              >
                {loading ? 'Generating...' : 'Get My Link ⚡'}
              </motion.button>
            </div>
          )}

          {step === 'done' && result && (
            <div className="p-6 space-y-5">
              {/* Success */}
              <div className="text-center">
                <div className="text-4xl mb-2">🔥</div>
                <h3 className="text-white font-bold text-lg">Let's get it, {streamerName}!</h3>
                <p className="text-freak-muted text-sm">Drop this in chat. Your viewers connect with strangers, live, while watching you. Clip season.</p>
              </div>

              {/* Link box */}
              <div className="bg-black/40 border border-freak-pink/30 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-freak-pink font-mono text-sm flex-1 break-all">{result.refUrl}</span>
                <button
                  onClick={copyLink}
                  className="shrink-0 w-9 h-9 rounded-xl bg-freak-pink/20 hover:bg-freak-pink/30 flex items-center justify-center transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-freak-pink" />}
                </button>
              </div>

              {/* Stats link */}
              <p className="text-center text-freak-muted text-xs">
                Check your stats anytime:{' '}
                <a
                  href={`${SERVER_URL}/api/streamer/${result.code}/stats`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-freak-pink hover:underline"
                >
                  view clicks & referrals
                </a>
              </p>

              {/* What viewers get */}
              <div className="bg-freak-surface border border-freak-border rounded-2xl p-4 space-y-2.5 text-sm">
                <p className="text-white font-bold text-xs uppercase tracking-wider">What your chat gets 👇</p>
                <div className="flex items-center gap-2 text-freak-muted">
                  <Zap size={14} className="text-freak-pink shrink-0" />
                  <span><span className="text-white">Freaky+ free for 7 days</span> — the moment they click your link</span>
                </div>
                <div className="flex items-center gap-2 text-freak-muted">
                  <span className="text-freak-pink shrink-0">🎮</span>
                  <span><span className="text-white">Your stream in the corner</span> — they watch you while they chat strangers</span>
                </div>
                <div className="flex items-center gap-2 text-freak-muted">
                  <span className="text-freak-pink shrink-0">⚡</span>
                  <span><span className="text-white">Priority queue</span> — skip the wait, jump straight in</span>
                </div>
                <div className="flex items-center gap-2 text-freak-muted">
                  <span className="text-freak-pink shrink-0">📈</span>
                  <span><span className="text-white">You get the clips</span> — wild reactions, unfiltered moments, real content</span>
                </div>
              </div>

              <motion.button
                onClick={onClose}
                className="w-full bg-freak-surface border border-freak-border text-freak-muted font-medium py-3 rounded-2xl hover:border-freak-pink/50 hover:text-white transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                Done
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
