import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minimize2, Maximize2, X, Tv, ExternalLink } from 'lucide-react'

interface StreamOverlayProps {
  streamerName: string
  streamUrl: string
  onClose: () => void
}

export type StreamPlatform = 'twitch' | 'youtube' | 'kick' | 'tiktok' | 'unknown'

export function detectPlatform(url: string): StreamPlatform {
  if (url.includes('twitch.tv')) return 'twitch'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('kick.com')) return 'kick'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'unknown'
}

function getEmbedUrl(streamUrl: string): string | null {
  try {
    const url = new URL(streamUrl)
    const platform = detectPlatform(streamUrl)

    // Twitch: https://twitch.tv/username
    if (platform === 'twitch') {
      const channel = url.pathname.replace('/', '').split('/')[0]
      if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=true`
    }

    // YouTube live: https://youtube.com/watch?v=ID or youtu.be/ID
    if (platform === 'youtube') {
      let videoId = url.searchParams.get('v')
      if (!videoId) videoId = url.pathname.replace('/', '').split('/').pop() || null
      if (videoId && videoId !== 'watch') {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`
      }
    }

    // Kick: https://kick.com/username
    if (platform === 'kick') {
      const channel = url.pathname.replace('/', '').split('/')[0]
      if (channel) return `https://player.kick.com/${channel}?muted=true`
    }

    // TikTok LIVE — no embeds, returns null (handled separately as link)
    return null
  } catch {
    return null
  }
}

export default function StreamOverlay({ streamerName, streamUrl, onClose }: StreamOverlayProps) {
  const [minimized, setMinimized] = useState(false)
  const embedUrl = getEmbedUrl(streamUrl)

  const platform = detectPlatform(streamUrl)
  const isTikTok = platform === 'tiktok'

  if (!embedUrl) {
    // TikTok or unknown — show a branded "Watch Live" card
    return (
      <motion.div
        className="fixed bottom-20 right-4 z-40 rounded-2xl overflow-hidden shadow-2xl border border-freak-border"
        style={{ width: '200px' }}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        {/* Header */}
        <div className="bg-freak-surface flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium truncate">{streamerName}</span>
            <span className="text-freak-muted text-xs">LIVE</span>
          </div>
          <button onClick={onClose} className="text-freak-muted hover:text-white p-1">
            <X size={12} />
          </button>
        </div>
        {/* Watch button */}
        <div className={`p-4 flex flex-col items-center gap-3 ${isTikTok ? 'bg-black' : 'bg-freak-bg'}`}>
          <span className="text-3xl">{isTikTok ? '🎵' : '📺'}</span>
          <p className="text-white text-xs text-center font-medium">
            {isTikTok ? 'Watch on TikTok LIVE' : `Watch ${streamerName} live`}
          </p>
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-freak-pink text-white text-xs font-bold px-4 py-2 rounded-xl w-full justify-center"
          >
            <ExternalLink size={12} /> Watch Live
          </a>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="fixed bottom-20 right-4 z-40 rounded-2xl overflow-hidden shadow-2xl border border-freak-border"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{ width: minimized ? 'auto' : '280px' }}
    >
      {/* Header bar */}
      <div className="bg-freak-surface flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-white text-xs font-medium truncate">{streamerName}</span>
          <span className="text-freak-muted text-xs shrink-0">LIVE</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMinimized(!minimized)}
            className="text-freak-muted hover:text-white transition-colors p-1"
          >
            {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button onClick={onClose} className="text-freak-muted hover:text-white transition-colors p-1">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Stream iframe */}
      <AnimatePresence>
        {!minimized && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 158 }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <iframe
              src={embedUrl}
              width="280"
              height="158"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; encrypted-media"
              title={`${streamerName}'s stream`}
              className="block"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
