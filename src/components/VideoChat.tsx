import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, SkipForward, Square, Video, VideoOff, Mic, MicOff, Zap, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { User, ConnectionState, Crush, ChatMessage } from '../types'
import CrushesPanel from './CrushesPanel'
import StreamOverlay from './StreamOverlay'
import CharacterPicker from './CharacterPicker'
import { useFreakSocket } from '../hooks/useFreakSocket'
import { useCharacterOverlay } from '../hooks/useCharacterOverlay'

interface VideoChatProps {
  user: User
  connectionState: ConnectionState
  setConnectionState: (state: ConnectionState) => void
  crushes: Crush[]
  crushMessages: Record<string, ChatMessage[]>
  onAddCrush: (crush: Crush) => void
  onSendCrushMessage: (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  onUpdateCrushEmoji: (crushId: string, emoji: string) => void
  onDeleteCrush?: (crushId: string) => void
  onBlockUser?: (username: string) => void
  premium?: { isPremium: boolean; streamerName?: string; daysLeft?: number }
  streamerInfo?: { streamerName: string; streamUrl: string; code: string } | null
}

// ── Feature flags ─────────────────────────────────────────────────────────────
const DATE_MODE_ENABLED = false  // flip to true when ready to launch

const VideoChat: React.FC<VideoChatProps> = ({
  user: _user,
  setConnectionState,
  crushes,
  crushMessages,
  onAddCrush,
  onSendCrushMessage,
  onUpdateCrushEmoji,
  onDeleteCrush,
  onBlockUser,
  premium,
  streamerInfo,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)  // always-current ref for callback ref below
  const pendingCrushIdRef = useRef<string | null>(null) // tracks last crush we sent a msg to (for ack mapping)

  const [isConnected, setIsConnected] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [currentPartner, setCurrentPartner] = useState<User | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [showCrushes, setShowCrushes] = useState(false)
  const [crushedCurrentPartner, setCrushedCurrentPartner] = useState(false)
  const [incomingCrush, setIncomingCrush] = useState<{ username: string } | null>(null)
  // Per-crush delivery/read status: crushId → status (for the last sent message)
  const [crushStatuses, setCrushStatuses] = useState<Record<string, 'sent' | 'delivered' | 'queued' | 'read'>>({})
  const [showStream, setShowStream] = useState(true)
  const [showCharacterPicker, setShowCharacterPicker] = useState(false)
  const [chatMode, setChatMode] = useState<'random' | 'date'>('random')
  const [dateTimeLeft, setDateTimeLeft] = useState<number | null>(null)
  const [showDateEndOverlay, setShowDateEndOverlay] = useState(false)
  const [mutualCrush, setMutualCrush] = useState(false)

  // ── Character overlay ──────────────────────────────────────────────────────
  const {
    activeCharacter, selectCharacter,
    activeAccessories, toggleAccessory, clearAccessories,
    activeBackground, selectBackground,
    activeDistortion, setDistortionFilter,
    getCanvasVideoTrack,
    filterReady, filterError,
    isMerging, startMerge, stopMerge,
  } = useCharacterOverlay({
    localStream,
    displayCanvasRef: previewCanvasRef,
    remoteVideoRef,
  })

  // Map username → crushId for fast lookup
  const usernameToCrushId = useCallback((uname: string) => crushes.find(c => c.username === uname)?.id, [crushes])

  // Camera init — must be on user tap for iOS/Android
  const initMedia = useCallback(async () => {
    if (localStream) return localStream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      setLocalStream(stream)
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      return stream
    } catch (err: any) {
      toast.error(err.name === 'NotAllowedError' ? 'Allow camera & mic to continue' : 'Camera not available', { duration: 4000 })
      return null
    }
  }, [localStream])

  useEffect(() => {
    return () => { localStream?.getTracks().forEach(t => t.stop()) }
  }, [localStream])

  const { joinQueue, skip, stop, serverOffline, liveStats, sendCrushRequest, acceptCrushRequest, sendDirectCrushMessage, sendReadReceipt, replaceVideoTrack } = useFreakSocket({
    username: _user.username,
    localStream,
    remoteVideoRef,
    onConnected: (partner, mode) => {
      setCurrentPartner({ id: partner.id, username: partner.username, interests: [], joinedAt: new Date(), connectionsCount: 0 })
      setIsConnected(true)
      setIsSearching(false)
      setCrushedCurrentPartner(false)
      setConnectionState('connected')
      setChatMode(mode)
      setMutualCrush(false)
      setShowDateEndOverlay(false)
      if (mode === 'date') setDateTimeLeft(180)
      else setDateTimeLeft(null)
    },
    onDisconnected: () => {
      setIsConnected(false)
      setIsSearching(false)
      setCurrentPartner(null)
      setCrushedCurrentPartner(false)
      setConnectionState('idle')
      setIncomingCrush(null)
      setDateTimeLeft(null)
      setShowDateEndOverlay(false)
      setMutualCrush(false)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    },
    onSearching: () => {
      setIsSearching(true)
      setIsConnected(false)
      setCurrentPartner(null)
      setCrushedCurrentPartner(false)
      setConnectionState('searching')
    },
    onCrushRequest: (from) => {
      setIncomingCrush({ username: from })
    },
    // Incoming direct crush message (routed by username, works anytime)
    onCrushMessage: ({ type, text, mediaUrl }, from) => {
      const crushId = usernameToCrushId(from)
      if (crushId) {
        onSendCrushMessage(crushId, { type: type as 'text' | 'image' | 'gif', text, mediaUrl, sender: 'them' })
      }
    },
    // Server ack — update delivery status for this crush's last message
    onMessageAck: (_id, status) => {
      // status from server: 'delivered' (online) or 'queued' (offline)
      // We update the most-recently-messaged crush's status
      // (simple: we set it per the stored pendingCrushId ref)
      if (pendingCrushIdRef.current) {
        setCrushStatuses(prev => ({ ...prev, [pendingCrushIdRef.current!]: status === 'delivered' ? 'delivered' : 'queued' }))
      }
    },
    // They read our messages
    onMessageRead: (fromUsername) => {
      const crushId = usernameToCrushId(fromUsername)
      if (crushId) setCrushStatuses(prev => ({ ...prev, [crushId]: 'read' }))
    },
  })

  // Keep localStreamRef current so callback ref can always access latest stream
  useEffect(() => { localStreamRef.current = localStream }, [localStream])

  // ── Local video srcObject (in-call + idle preview) ──────────────────────
  useEffect(() => {
    if (localStream) {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
        localVideoRef.current.play().catch(() => {})
      }
      if (previewVideoRef.current) {
        previewVideoRef.current.muted = true   // React muted prop doesn't set DOM attr reliably
        previewVideoRef.current.srcObject = localStream
        previewVideoRef.current.play().catch(() => {})
      }
    }
  }, [localStream, isConnected])

  // Callback ref for in-call local video — fires the instant the element mounts,
  // regardless of React batching. Guarantees srcObject is set even if localStream
  // didn't change between renders.
  // NOTE: React's `muted` JSX prop doesn't reliably set the DOM attribute — we set
  // it explicitly here so desktop Chrome doesn't block autoplay on "unmuted" video.
  const localVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el
    if (el) {
      el.muted = true          // must set via DOM — React JSX muted prop is broken
      el.playsInline = true
      el.autoplay = true
      if (localStreamRef.current) {
        el.srcObject = localStreamRef.current
        el.play().catch(() => {})
      }
    }
  }, [])

  // ── WebRTC track swap ────────────────────────────────────────────────────
  // Replaces the outgoing video track with the canvas track when a filter is
  // active so the remote peer sees the filtered video.
  // isConnected is in deps so if a filter was active before connecting, we
  // swap the track as soon as the RTCPeerConnection is ready.
  useEffect(() => {
    if (!localStream || !isConnected) return
    const hasFilter = !!activeCharacter || activeAccessories.length > 0 || activeBackground !== 'none' || !!activeDistortion
    if (hasFilter) {
      const canvasTrack = getCanvasVideoTrack()
      if (canvasTrack) replaceVideoTrack(canvasTrack)
    } else {
      replaceVideoTrack(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacter, activeAccessories, activeBackground, activeDistortion, localStream, isConnected, getCanvasVideoTrack, replaceVideoTrack])

  // Mutual crush detection in date mode (both liked each other → celebrate)
  useEffect(() => {
    if (incomingCrush && crushedCurrentPartner && chatMode === 'date') {
      setMutualCrush(true)
    }
  }, [incomingCrush, crushedCurrentPartner, chatMode])

  // Date mode countdown
  useEffect(() => {
    if (dateTimeLeft === null || dateTimeLeft <= 0) {
      if (dateTimeLeft === 0 && isConnected) setShowDateEndOverlay(true)
      return
    }
    const t = setTimeout(() => setDateTimeLeft(n => (n ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [dateTimeLeft, isConnected])

  const startSearch = useCallback(async (mode: 'random' | 'date' = chatMode) => {
    const stream = await initMedia()
    if (!stream) return
    joinQueue(mode)
  }, [initMedia, joinQueue, chatMode])

  // Send message to crush — always routes via socket by username (works even if not in same call)
  const handleSendCrushMessage = useCallback(
    (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      onSendCrushMessage(crushId, msg)
      // Find crush by id to get their username
      const crush = crushes.find(c => c.id === crushId)
      if (crush && msg.sender === 'me') {
        const msgId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
        pendingCrushIdRef.current = crushId
        setCrushStatuses(prev => ({ ...prev, [crushId]: 'sent' }))
        sendDirectCrushMessage(crush.username, { id: msgId, type: msg.type, text: msg.text, mediaUrl: msg.mediaUrl })
      }
    },
    [onSendCrushMessage, crushes, sendDirectCrushMessage]
  )

  const addCrush = useCallback(() => {
    if (!currentPartner || crushedCurrentPartner) return
    const crush: Crush = {
      id: currentPartner.id,
      username: currentPartner.username,
      addedAt: new Date(),
      unread: 0,
      online: true,
    }
    onAddCrush(crush)
    setCrushedCurrentPartner(true)
    sendCrushRequest()
    const msg = chatMode === 'date'
      ? `💕 You liked ${currentPartner.username}! Waiting for them to like back...`
      : `💕 Crush sent to ${currentPartner.username}!`
    toast.success(msg, { style: { background: '#FF0066', color: '#fff' } })
  }, [currentPartner, crushedCurrentPartner, onAddCrush, sendCrushRequest, chatMode])

  const handleAcceptCrush = useCallback(() => {
    if (!incomingCrush) return
    // Add them to our crushes
    const crush: Crush = {
      id: currentPartner?.id || Date.now().toString(),
      username: incomingCrush.username,
      addedAt: new Date(),
      unread: 0,
      online: true,
    }
    onAddCrush(crush)
    acceptCrushRequest()
    setIncomingCrush(null)
    toast.success(`💕 Crushed back! You're in each other's lists`, {
      style: { background: '#FF0066', color: '#fff' },
    })
  }, [incomingCrush, currentPartner, onAddCrush, acceptCrushRequest])

  const toggleVideo = useCallback(() => {
    if (!localStream) return
    const track = localStream.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; setIsVideoOn(track.enabled) }
  }, [localStream])

  const toggleAudio = useCallback(() => {
    if (!localStream) return
    const track = localStream.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setIsAudioOn(track.enabled) }
  }, [localStream])

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">

      {/* ─── VIDEO AREA ─── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {isConnected && currentPartner ? (
          <>
            {/* ── REMOTE VIDEO (top on mobile / left on desktop) ── */}
            <div className="flex-1 relative bg-black min-h-0">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Partner name badge */}
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-white text-sm font-semibold">{currentPartner.username}</span>
              </div>
              {/* Date mode timer + badge — hidden until DATE_MODE_ENABLED */}
              {DATE_MODE_ENABLED && chatMode === 'date' && dateTimeLeft !== null && dateTimeLeft > 0 && (
                <motion.div
                  className={`absolute top-3 right-3 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-bold text-sm ${dateTimeLeft < 30 ? 'bg-red-500 text-white' : 'bg-black/60 backdrop-blur-sm text-white border border-freak-pink/40'}`}
                  animate={dateTimeLeft < 30 ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <span>💕</span>
                  <span>{Math.floor(dateTimeLeft / 60)}:{String(dateTimeLeft % 60).padStart(2, '0')}</span>
                </motion.div>
              )}
              {DATE_MODE_ENABLED && chatMode === 'date' && (
                <div className="absolute bottom-3 left-3 bg-freak-pink/90 px-2.5 py-1 rounded-full">
                  <span className="text-white text-xs font-bold">💕 Date Mode</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px md:h-auto md:w-px bg-freak-pink/40 flex-shrink-0" />

            {/* ── LOCAL VIDEO (bottom on mobile / right on desktop) ── */}
            <div className="flex-1 relative bg-freak-surface min-h-0">
              <video
                ref={localVideoCallbackRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {!isVideoOn && (
                <div className="absolute inset-0 bg-freak-surface flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-freak-muted" />
                </div>
              )}
              {/* Your name badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-white text-sm font-semibold">{_user.username} (you)</span>
                </div>
                {premium?.isPremium && (
                  <div className="bg-freak-pink/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3 text-white fill-white" />
                    <span className="text-white text-xs font-bold">Freaky+</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : isSearching ? (
          /* ─── QUEUE ANIMATION ─── */
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center mb-8">
              <motion.div className="absolute w-32 h-32 rounded-full border-2 border-freak-pink opacity-20"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
              <motion.div className="absolute w-32 h-32 rounded-full border-2 border-freak-pink opacity-20"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }} />
              <motion.div className="absolute w-32 h-32 rounded-full border-2 border-freak-pink opacity-20"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }} />
              <div className="w-16 h-16 rounded-full bg-freak-pink flex items-center justify-center shadow-pink">
                <motion.div className="w-8 h-8 rounded-full bg-white"
                  animate={{ scale: [1, 0.8, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              </div>
            </div>
            <motion.p className="text-white text-lg font-medium tracking-wide"
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
              Looking for your next freak...
            </motion.p>
            {liveStats && liveStats.online > 0 && (
              <p className="mt-3 text-freak-muted text-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                {liveStats.online.toLocaleString()} online · {liveStats.searching} searching
              </p>
            )}
            <motion.button onClick={stop}
              className="mt-8 px-6 py-2.5 border border-freak-border text-freak-muted rounded-full text-sm hover:border-freak-pink hover:text-white transition-colors"
              whileTap={{ scale: 0.95 }}>
              Cancel
            </motion.button>
          </div>
        ) : (
          /* ─── IDLE ─── */
          <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">

            {/* ── Camera preview pane ── */}
            {localStream ? (
              /* Camera on — canvas shows face-tracked filter output (MediaPipe) */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-freak-pink/50 relative bg-black shadow-pink flex-shrink-0"
                style={{ aspectRatio: '4/3' }}
              >
                {/* Raw video underneath — visible while MediaPipe loads */}
                <video
                  ref={previewVideoRef}
                  autoPlay muted playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Canvas on top — face-tracked filter output (hook blits every frame) */}
                {/* Fades in once filterReady; draws raw video + any active filter on top */}
                <canvas
                  ref={previewCanvasRef}
                  width={640} height={480}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    display: 'block',
                    opacity: filterReady ? 1 : 0,
                    transition: 'opacity 0.4s ease',
                    transform: 'scaleX(-1)',  // mirror for self-view; WebRTC stream stays natural
                  }}
                />

                {/* Spinner while MediaPipe loads */}
                {!filterReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl">
                      <svg className="animate-spin w-5 h-5 text-freak-pink" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      <span className="text-white text-xs font-medium">Loading filters…</span>
                    </div>
                  </div>
                )}

                {/* Filter button — bottom-right */}
                <motion.button
                  onClick={async () => { await initMedia(); setShowCharacterPicker(true) }}
                  whileTap={{ scale: 0.88 }}
                  className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                    (activeCharacter || activeAccessories.length > 0 || activeBackground !== 'none' || activeDistortion)
                      ? 'bg-freak-pink text-white'
                      : 'bg-black/60 backdrop-blur-sm text-white border border-white/20'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {activeCharacter ? activeCharacter.label : activeDistortion ? '✨ Warp' : activeBackground !== 'none' ? '🌆 BG' : 'Filters'}
                </motion.button>

                {/* Your name badge */}
                <div className="absolute top-2.5 left-2.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <span className="text-white text-xs font-semibold">you</span>
                </div>

                {/* Active filter badge */}
                {(activeCharacter || activeAccessories.length > 0 || activeBackground !== 'none' || activeDistortion) && (
                  <div className="absolute top-2.5 right-2.5 bg-freak-pink/90 px-2 py-0.5 rounded-full">
                    <span className="text-white text-xs font-bold">
                      {activeCharacter ? activeCharacter.emoji : activeDistortion ? '✨' : activeBackground !== 'none' ? '🌆' : `+${activeAccessories.length}`}
                    </span>
                  </div>
                )}
              </motion.div>
            ) : (
              /* No camera yet — placeholder */
              <motion.button
                onClick={() => initMedia()}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileTap={{ scale: 0.96 }}
                className="w-full max-w-sm rounded-2xl border-2 border-dashed border-freak-border bg-freak-surface flex flex-col items-center justify-center gap-3 flex-shrink-0 hover:border-freak-pink/50 transition-colors"
                style={{ aspectRatio: '4/3' }}
              >
                <div className="w-14 h-14 rounded-full bg-freak-border flex items-center justify-center">
                  <Video className="w-6 h-6 text-freak-muted" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">Preview Camera</p>
                  <p className="text-freak-muted text-xs mt-0.5">See yourself before you connect</p>
                </div>
              </motion.button>
            )}

            {/* ── Logo + subtitle ── */}
            <div className="text-center">
              <motion.h2 className="text-freak-pink text-4xl font-black tracking-tighter"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                freaky
              </motion.h2>
              <p className="text-freak-muted text-sm mt-0.5">who are you meeting today?</p>
            </div>

            {/* Mode picker — hidden until DATE_MODE_ENABLED */}
            {DATE_MODE_ENABLED && (
              <>
                <div className="flex gap-3 w-full max-w-xs">
                  <motion.button
                    onClick={() => setChatMode('random')}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-colors ${chatMode === 'random' ? 'border-freak-pink bg-freak-pink/15' : 'border-freak-border bg-freak-surface'}`}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span className="text-2xl">🎲</span>
                    <span className={`text-xs font-bold ${chatMode === 'random' ? 'text-freak-pink' : 'text-freak-muted'}`}>Random</span>
                  </motion.button>
                  <motion.button
                    onClick={() => setChatMode('date')}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-colors ${chatMode === 'date' ? 'border-freak-pink bg-freak-pink/15' : 'border-freak-border bg-freak-surface'}`}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span className="text-2xl">💕</span>
                    <span className={`text-xs font-bold ${chatMode === 'date' ? 'text-freak-pink' : 'text-freak-muted'}`}>Date Mode</span>
                  </motion.button>
                </div>
                {chatMode === 'date' && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="text-freak-muted text-xs text-center max-w-xs leading-relaxed"
                  >
                    💡 3-min speed dates. Both swipe 💕 to match. Built for the eDating era.
                  </motion.p>
                )}
              </>
            )}

            {/* Start button */}
            <motion.button onClick={() => startSearch(chatMode)}
              className="px-14 py-4 bg-freak-pink text-white text-xl font-bold rounded-2xl shadow-pink"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {serverOffline ? 'Connecting...' : 'Start'}
            </motion.button>

            {/* Live online counter */}
            {liveStats && liveStats.online > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 text-freak-muted text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                <span>
                  <span className="text-white font-semibold">{liveStats.online.toLocaleString()}</span> online
                  {liveStats.inCalls > 0 && (
                    <span className="text-freak-muted"> · {liveStats.inCalls} in calls</span>
                  )}
                </span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* (self preview is now embedded in the idle screen — no floating overlay needed) */}

      {/* ─── DATE MODE: MUTUAL CRUSH / IT'S A MATCH ─── */}
      <AnimatePresence>
        {DATE_MODE_ENABLED && mutualCrush && chatMode === 'date' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setMutualCrush(false)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="bg-freak-surface border-2 border-freak-pink rounded-3xl p-8 mx-6 flex flex-col items-center gap-4 shadow-pink max-w-xs w-full text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: 3 }}
                className="text-6xl"
              >
                💕
              </motion.div>
              <div>
                <h2 className="text-freak-pink font-black text-3xl tracking-tight mb-1">It's a Match!</h2>
                <p className="text-freak-muted text-sm">You and <span className="text-white font-semibold">{currentPartner?.username}</span> liked each other 🔥</p>
              </div>
              <p className="text-freak-muted text-xs">They're now in your Crushes. Tap anywhere to keep chatting.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DATE MODE: TIME'S UP OVERLAY ─── */}
      <AnimatePresence>
        {DATE_MODE_ENABLED && showDateEndOverlay && chatMode === 'date' && isConnected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="bg-freak-surface border border-freak-pink rounded-3xl p-8 mx-6 flex flex-col items-center gap-5 shadow-pink max-w-sm w-full">
              <span className="text-5xl">⏰</span>
              <div className="text-center">
                <h2 className="text-white font-black text-2xl mb-1">Time's Up!</h2>
                <p className="text-freak-muted text-sm">3-minute date complete. What do you think?</p>
              </div>
              <div className="flex gap-3 w-full">
                <motion.button
                  onClick={() => { setShowDateEndOverlay(false); addCrush() }}
                  disabled={crushedCurrentPartner}
                  className="flex-1 py-3.5 bg-freak-pink text-white font-bold rounded-2xl shadow-pink flex items-center justify-center gap-2 disabled:opacity-50"
                  whileTap={{ scale: 0.96 }}
                >
                  💕 Like
                </motion.button>
                <motion.button
                  onClick={() => { setShowDateEndOverlay(false); skip() }}
                  className="flex-1 py-3.5 border-2 border-freak-border text-freak-muted font-bold rounded-2xl flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.96 }}
                >
                  ⏭️ Pass
                </motion.button>
              </div>
              <button
                onClick={() => setShowDateEndOverlay(false)}
                className="text-freak-muted text-xs hover:text-white transition-colors"
              >
                Keep chatting →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── INCOMING CRUSH NOTIFICATION ─── */}
      <AnimatePresence>
        {incomingCrush && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-freak-surface border border-freak-pink rounded-2xl px-5 py-4 shadow-pink flex items-center gap-4"
          >
            <span className="text-2xl">💕</span>
            <div>
              <p className="text-white font-semibold text-sm">{incomingCrush.username} added you as a crush!</p>
              <p className="text-freak-muted text-xs">Crush them back?</p>
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={handleAcceptCrush}
                whileTap={{ scale: 0.95 }}
                className="bg-freak-pink text-white text-xs font-bold px-3 py-1.5 rounded-xl"
              >
                Crush Back 💕
              </motion.button>
              <motion.button
                onClick={() => setIncomingCrush(null)}
                whileTap={{ scale: 0.95 }}
                className="border border-freak-border text-freak-muted text-xs px-3 py-1.5 rounded-xl"
              >
                Later
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── BOTTOM BAR ─── */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-md px-6 pt-3 safe-bottom z-10 border-t border-freak-border">
        <div className="flex items-center justify-center gap-4">
          <motion.button onClick={toggleAudio} whileTap={{ scale: 0.9 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${isAudioOn ? 'bg-freak-surface border border-freak-border' : 'bg-red-500'}`}>
            {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
          </motion.button>

          {(isConnected || isSearching) && (
            <motion.button onClick={skip} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2 px-8 py-3 rounded-2xl border-2 border-freak-pink text-freak-pink font-bold text-base">
              <SkipForward className="w-5 h-5" /> SKIP
            </motion.button>
          )}

          {(isConnected || isSearching) && (
            <motion.button onClick={stop} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-freak-pink text-white font-bold text-base shadow-pink">
              <Square className="w-4 h-4 fill-white" /> STOP
            </motion.button>
          )}

          {isConnected && (
            <motion.button onClick={addCrush} whileTap={{ scale: 0.9 }} disabled={crushedCurrentPartner}
              className={`w-11 h-11 rounded-full flex items-center justify-center ${crushedCurrentPartner ? 'bg-freak-pink/30' : 'bg-freak-pink shadow-pink'}`}>
              <Heart className="w-5 h-5 text-white fill-white" />
            </motion.button>
          )}

          {/* FACE MERGE button — only while connected */}
          {isConnected && (
            <motion.button
              onClick={() => { isMerging ? stopMerge() : startMerge(); if (!isMerging) toast('Merging faces... 👾', { icon: '✨' }) }}
              whileTap={{ scale: 0.88 }}
              animate={isMerging ? { scale: [1, 1.08, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.9 }}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg relative overflow-hidden ${
                isMerging
                  ? 'bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-[0_0_16px_rgba(180,0,255,0.7)]'
                  : 'bg-freak-surface border border-purple-500/50'
              }`}
              title="Face Merge — morph faces together"
            >
              <span>👾</span>
              {isMerging && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-fuchsia-400"
                  animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                  transition={{ repeat: Infinity, duration: 0.85 }}
                />
              )}
            </motion.button>
          )}

          <motion.button
            onClick={localStream ? toggleVideo : () => initMedia()}
            whileTap={{ scale: 0.9 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              !localStream ? 'bg-freak-surface border border-freak-border border-dashed' :
              isVideoOn ? 'bg-freak-surface border border-freak-border' : 'bg-red-500'
            }`}
            title={!localStream ? 'Start camera preview' : isVideoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoOn || !localStream ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
          </motion.button>

          {/* Face Mask button — also pre-starts camera so filter preview works */}
          <motion.button
            onClick={async () => { await initMedia(); setShowCharacterPicker(true) }}
            whileTap={{ scale: 0.9 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center relative ${(activeCharacter || activeAccessories.length > 0 || activeBackground !== 'none' || activeDistortion) ? 'bg-freak-pink shadow-pink' : 'bg-freak-surface border border-freak-border'}`}
            title="Face Masks"
          >
            <Sparkles className="w-5 h-5 text-white" />
            {activeCharacter && (
              <span className="absolute -top-1 -right-1 text-sm">{activeCharacter.emoji}</span>
            )}
            {!activeCharacter && activeDistortion && (
              <span className="absolute -top-1 -right-1 text-sm">✨</span>
            )}
            {!activeCharacter && !activeDistortion && activeAccessories.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-[9px] font-bold text-freak-pink">
                {activeAccessories.length}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      {/* ─── CRUSHES TAB — visible in idle and connected ─── */}
      {!isSearching && (
        <motion.button
          onClick={() => setShowCrushes(true)}
          className="absolute bottom-24 left-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-freak-border px-3 py-2 rounded-full"
          whileTap={{ scale: 0.9 }}
        >
          <Heart className="w-4 h-4 text-freak-pink fill-freak-pink" />
          <span className="text-white text-xs font-medium">{crushes.length > 0 ? crushes.length : 'Crushes'}</span>
        </motion.button>
      )}

      <AnimatePresence>
        {showCrushes && (
          <CrushesPanel crushes={crushes} messages={crushMessages}
            onSendMessage={handleSendCrushMessage}
            onUpdateCrushEmoji={onUpdateCrushEmoji}
            onDeleteCrush={onDeleteCrush}
            onBlockUser={onBlockUser}
            onClose={() => setShowCrushes(false)}
            crushStatuses={crushStatuses}
            onSendReadReceipt={sendReadReceipt} />
        )}
      </AnimatePresence>

      {/* ─── CHARACTER / FACE MASK PICKER ─── */}
      <AnimatePresence>
        {showCharacterPicker && (
          <CharacterPicker
            activeCharacter={activeCharacter}
            activeAccessories={activeAccessories}
            activeBackground={activeBackground}
            activeDistortion={activeDistortion}
            onSelect={selectCharacter}
            onToggleAccessory={toggleAccessory}
            onClearAccessories={clearAccessories}
            onSelectBackground={selectBackground}
            onSelectDistortion={setDistortionFilter}
            onClose={() => setShowCharacterPicker(false)}
            filterReady={filterReady}
            filterError={filterError}
          />
        )}
      </AnimatePresence>

      {/* ─── STREAM OVERLAY — shown for Freaky+ viewers ─── */}
      <AnimatePresence>
        {premium?.isPremium && streamerInfo && showStream && (
          <StreamOverlay
            streamerName={streamerInfo.streamerName}
            streamUrl={streamerInfo.streamUrl}
            onClose={() => setShowStream(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── STREAM RESTORE BUTTON — if overlay was closed ─── */}
      {premium?.isPremium && streamerInfo && !showStream && (
        <motion.button
          onClick={() => setShowStream(true)}
          className="absolute bottom-24 right-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-freak-pink/40 px-3 py-2 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Zap className="w-3.5 h-3.5 text-freak-pink" />
          <span className="text-freak-pink text-xs font-medium">Stream</span>
        </motion.button>
      )}
    </div>
  )
}

export default VideoChat
