import { useState, useCallback, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import WelcomeScreen from './components/WelcomeScreen'
import VideoChat from './components/VideoChat'
import ReportIssue from './components/ReportIssue'
import OnboardingModal from './components/OnboardingModal'
import StreamerBanner from './components/StreamerBanner'
import Mascot from './components/Mascot'
import { User, ConnectionState, Crush, ChatMessage } from './types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://freak-app-production.up.railway.app'

interface StreamerInfo {
  streamerName: string
  streamUrl: string
  code: string
}

interface PremiumState {
  isPremium: boolean
  expiresAt?: string
  streamerName?: string
  daysLeft?: number
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('freak_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')

  // Crushes state
  const [crushes, setCrushes] = useState<Crush[]>(() => {
    try {
      const saved = localStorage.getItem('freak_crushes')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  const [crushMessages, setCrushMessages] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('freak_crush_messages')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Streamer / premium state
  const [streamerInfo, setStreamerInfo] = useState<StreamerInfo | null>(null)
  const [premium, setPremium] = useState<PremiumState>({ isPremium: false })
  const [showBanner, setShowBanner] = useState(false)

  // ── On mount: check for ?ref= code ────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const refCode = params.get('ref')
    if (!refCode) return

    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname)

    const stored = localStorage.getItem('freak_ref_code')
    if (stored === refCode) {
      // Already redeemed — just load the streamer info again
      loadStreamerInfo(refCode)
      checkPremium()
      return
    }

    // New ref — fetch streamer info + redeem
    loadStreamerInfo(refCode, true)
  }, [])

  // ── On mount: click tracking beacon ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const src = params.get('src') || params.get('s') || 'organic'
    // Fire and forget — log every visit with its source
    fetch(`${SERVER_URL}/api/clicks/ping?src=${encodeURIComponent(src)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src }),
    }).catch(() => {/* silent */})
    // Clean tracking params from URL (keep others like ?ref=)
    if (params.has('src') || params.has('s')) {
      const clean = new URLSearchParams(window.location.search)
      clean.delete('src')
      clean.delete('s')
      const q = clean.toString()
      window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : ''))
    }
  }, [])

  // ── On mount: check existing premium ──────────────────────────────────────
  useEffect(() => {
    checkPremium()
  }, [user])

  async function loadStreamerInfo(code: string, redeem = false) {
    try {
      const res = await fetch(`${SERVER_URL}/api/streamer/${code}`)
      if (!res.ok) return
      const data = await res.json()
      setStreamerInfo({ streamerName: data.streamerName, streamUrl: data.streamUrl, code })
      localStorage.setItem('freak_stream_url', data.streamUrl)
      localStorage.setItem('freak_streamer_name', data.streamerName)
      localStorage.setItem('freak_ref_code', code)

      if (redeem) {
        await redeemRef(code)
      } else {
        checkPremium()
      }
    } catch { /* silently fail */ }
  }

  async function redeemRef(code: string) {
    const userId = user?.id || localStorage.getItem('freak_anon_id') || generateAnonId()
    try {
      const res = await fetch(`${SERVER_URL}/api/streamer/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        const daysLeft = Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        setPremium({ isPremium: true, expiresAt: data.expiresAt, streamerName: data.streamerName, daysLeft })
        localStorage.setItem('freak_premium', JSON.stringify({ expiresAt: data.expiresAt, streamerName: data.streamerName }))
        setShowBanner(true)
      }
    } catch { /* silently fail */ }
  }

  async function checkPremium() {
    // Check localStorage cache first
    try {
      const cached = localStorage.getItem('freak_premium')
      if (cached) {
        const p = JSON.parse(cached)
        if (new Date(p.expiresAt) > new Date()) {
          const daysLeft = Math.ceil((new Date(p.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          setPremium({ isPremium: true, expiresAt: p.expiresAt, streamerName: p.streamerName, daysLeft })

          // Restore streamer info if available
          const streamUrl = localStorage.getItem('freak_stream_url')
          const streamerName = localStorage.getItem('freak_streamer_name')
          const code = localStorage.getItem('freak_ref_code')
          if (streamUrl && streamerName && code) {
            setStreamerInfo({ streamerName, streamUrl, code })
          }
          return
        } else {
          localStorage.removeItem('freak_premium')
        }
      }
    } catch { /* silently fail */ }
  }

  function generateAnonId() {
    const id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    localStorage.setItem('freak_anon_id', id)
    return id
  }

  const handleStart = useCallback((username: string, tags: string[] = []) => {
    const anonId = localStorage.getItem('freak_anon_id') || generateAnonId()
    const u: User = {
      id: anonId,
      username,
      interests: tags,
      joinedAt: new Date(),
      connectionsCount: 0,
    }
    setUser(u)
    localStorage.setItem('freak_user', JSON.stringify(u))

    // Redeem any pending ref
    const refCode = localStorage.getItem('freak_ref_code')
    const alreadyPremium = localStorage.getItem('freak_premium')
    if (refCode && !alreadyPremium) {
      redeemRef(refCode)
    }
  }, [])

  const handleAddCrush = useCallback((crush: Crush) => {
    setCrushes((prev) => {
      if (prev.find((c) => c.id === crush.id)) return prev
      const next = [crush, ...prev]
      localStorage.setItem('freak_crushes', JSON.stringify(next))
      return next
    })
  }, [])

  const handleUpdateCrushEmoji = useCallback((crushId: string, emoji: string) => {
    setCrushes((prev) => {
      const next = prev.map(c => c.id === crushId ? { ...c, avatar: emoji || undefined } : c)
      localStorage.setItem('freak_crushes', JSON.stringify(next))
      return next
    })
  }, [])

  const handleDeleteCrush = useCallback((crushId: string) => {
    setCrushes((prev) => {
      const next = prev.filter(c => c.id !== crushId)
      localStorage.setItem('freak_crushes', JSON.stringify(next))
      return next
    })
    setCrushMessages((prev) => {
      const next = { ...prev }
      delete next[crushId]
      localStorage.setItem('freak_crush_messages', JSON.stringify(next))
      return next
    })
  }, [])

  const handleBlockUser = useCallback((username: string) => {
    try {
      const blocked: string[] = JSON.parse(localStorage.getItem('freak_blocked') || '[]')
      if (!blocked.includes(username)) {
        blocked.push(username)
        localStorage.setItem('freak_blocked', JSON.stringify(blocked))
      }
    } catch {}
  }, [])

  const handleSendCrushMessage = useCallback(
    (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      const full: ChatMessage = {
        ...msg,
        id: Date.now().toString(),
        timestamp: new Date(),
      }
      setCrushMessages((prev) => {
        const next = { ...prev, [crushId]: [...(prev[crushId] || []), full] }
        localStorage.setItem('freak_crush_messages', JSON.stringify(next))
        return next
      })
    },
    []
  )

  return (
    <div className="min-h-screen bg-black">
      <AnimatePresence mode="wait">
        {!user ? (
          <WelcomeScreen key="welcome" onStart={handleStart} premium={premium} streamerInfo={streamerInfo} />
        ) : (
          <VideoChat
            key="chat"
            user={user}
            connectionState={connectionState}
            setConnectionState={setConnectionState}
            crushes={crushes}
            crushMessages={crushMessages}
            onAddCrush={handleAddCrush}
            onSendCrushMessage={handleSendCrushMessage}
            onUpdateCrushEmoji={handleUpdateCrushEmoji}
            onDeleteCrush={handleDeleteCrush}
            onBlockUser={handleBlockUser}
            premium={premium}
            streamerInfo={streamerInfo}
          />
        )}
      </AnimatePresence>

      {/* Streamer welcome banner */}
      {showBanner && premium.streamerName && (
        <StreamerBanner
          streamerName={premium.streamerName}
          daysLeft={premium.daysLeft ?? 7}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <OnboardingModal />
      <ReportIssue />

      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#141414', color: '#fff', border: '1px solid #1f1f1f' },
          duration: 2500,
        }}
      />

      {/* Mascot — lives on the site, reacts to app state */}
      <Mascot
        appState={
          connectionState === 'connected' ? 'connected' :
          connectionState === 'searching' ? 'searching' :
          connectionState === 'disconnected' ? 'disconnected' :
          'idle'
        }
      />
    </div>
  )
}

export default App
