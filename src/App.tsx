import { useState, useCallback } from 'react'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import WelcomeScreen from './components/WelcomeScreen'
import VideoChat from './components/VideoChat'
import ReportIssue from './components/ReportIssue'
import OnboardingModal from './components/OnboardingModal'
import { User, ConnectionState, Crush, ChatMessage } from './types'

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

  // Messages per crush: { [crushId]: ChatMessage[] }
  const [crushMessages, setCrushMessages] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('freak_crush_messages')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  const handleStart = useCallback((username: string) => {
    const u: User = {
      id: Date.now().toString(),
      username,
      interests: [],
      joinedAt: new Date(),
      connectionsCount: 0,
    }
    setUser(u)
    localStorage.setItem('freak_user', JSON.stringify(u))
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

      // Messages are stored locally — real-time relay works when both users are in the same session
    },
    []
  )

  return (
    <div className="min-h-screen bg-black">
      <AnimatePresence mode="wait">
        {!user ? (
          <WelcomeScreen key="welcome" onStart={handleStart} />
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
          />
        )}
      </AnimatePresence>

      <OnboardingModal />
      <ReportIssue />

      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#141414', color: '#fff', border: '1px solid #1f1f1f' },
          duration: 2500,
        }}
      />
    </div>
  )
}

export default App
