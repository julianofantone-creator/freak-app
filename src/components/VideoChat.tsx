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

  // ── Character overlay ──────────────────────────────────────────────────────
  const {
    activeCharacter, selectCharacter,
    activeAccessories, toggleAccessory, clearAccessories,
    activeBackground, selectBackground,
    getCanvasVideoTrack, getCanvasStream
  } = useCharacterOverlay({
    localStream,
    videoRef: localVideoRef,
  })

  // Map username → crushId for fast lookup
  const usernameToCrushId = useCallback((uname: string) => crushes.find(c => c.username === uname)?.id, [crushes])

  // Re-attach local stream whenever it changes or we enter connected view
  // (React re-mounts the video element on state transitions, srcObject gets lost)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, isConnected])

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
    onConnected: (partner) => {
      setCurrentPartner({ id: partner.id, username: partner.username, interests: [], joinedAt: new Date(), connectionsCount: 0 })
      setIsConnected(true)
      setIsSearching(false)
      setCrushedCurrentPartner(false)
      setConnectionState('connected')
    },
    onDisconnected: () => {
      setIsConnected(false)
      setIsSearching(false)
      setCurrentPartner(null)
      setCrushedCurrentPartner(false)
      setConnectionState('idle')
      setIncomingCrush(null)
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

  // When character changes: replace WebRTC track + swap local video preview to canvas
  // (must be after useFreakSocket so replaceVideoTrack is in scope)
  // Swap WebRTC track to canvas when character OR accessories are active
  useEffect(() => {
    if (!localStream) return
    const hasFilter = !!activeCharacter || activeAccessories.length > 0 || activeBackground !== 'none'
    if (hasFilter) {
      const canvasTrack = getCanvasVideoTrack()
      if (canvasTrack) replaceVideoTrack(canvasTrack)
      const canvasStream = getCanvasStream()
      if (canvasStream && localVideoRef.current) {
        localVideoRef.current.srcObject = canvasStream
      }
    } else {
      replaceVideoTrack(null)
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream
      }
    }
  }, [activeCharacter, activeAccessories, activeBackground, localStream, getCanvasVideoTrack, getCanvasStream, replaceVideoTrack])

  const startSearch = useCallback(async () => {
    const stream = await initMedia()
    if (!stream) return
    joinQueue()
  }, [initMedia, joinQueue])

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
    sendCrushRequest() // notify partner
    toast.success(`💕 Crush sent to ${currentPartner.username}!`, {
      style: { background: '#FF0066', color: '#fff' },
    })
  }, [currentPartner, crushedCurrentPartner, onAddCrush, sendCrushRequest])

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
            </div>

            {/* Divider */}
            <div className="h-px md:h-auto md:w-px bg-freak-pink/40 flex-shrink-0" />

            {/* ── LOCAL VIDEO (bottom on mobile / right on desktop) ── */}
            <div className="flex-1 relative bg-freak-surface min-h-0">
              <video
                ref={localVideoRef}
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
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.h2 className="text-freak-pink text-5xl font-black mb-3 tracking-tighter"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              freaky
            </motion.h2>
            <p className="text-freak-muted text-base mb-10">who are you meeting today?</p>
            <motion.button onClick={startSearch}
              className="px-14 py-4 bg-freak-pink text-white text-xl font-bold rounded-2xl shadow-pink"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {serverOffline ? 'Connecting...' : 'Start'}
            </motion.button>
            {/* Live online counter */}
            {liveStats && liveStats.online > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex items-center gap-2 text-freak-muted text-sm"
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

          <motion.button onClick={toggleVideo} whileTap={{ scale: 0.9 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${isVideoOn ? 'bg-freak-surface border border-freak-border' : 'bg-red-500'}`}>
            {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
          </motion.button>

          {/* Face Mask button */}
          <motion.button
            onClick={() => setShowCharacterPicker(true)}
            whileTap={{ scale: 0.9 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center relative ${(activeCharacter || activeAccessories.length > 0 || activeBackground !== 'none') ? 'bg-freak-pink shadow-pink' : 'bg-freak-surface border border-freak-border'}`}
            title="Face Masks"
          >
            <Sparkles className="w-5 h-5 text-white" />
            {activeCharacter && (
              <span className="absolute -top-1 -right-1 text-sm">{activeCharacter.emoji}</span>
            )}
            {!activeCharacter && activeAccessories.length > 0 && (
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
            onSelect={selectCharacter}
            onToggleAccessory={toggleAccessory}
            onClearAccessories={clearAccessories}
            onSelectBackground={selectBackground}
            onClose={() => setShowCharacterPicker(false)}
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
