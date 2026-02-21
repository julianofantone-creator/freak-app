import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, SkipForward, Square, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { User, ConnectionState, Crush, ChatMessage } from '../types'
import CrushesPanel from './CrushesPanel'
import { useFreakSocket } from '../hooks/useFreakSocket'

interface VideoChatProps {
  user: User
  connectionState: ConnectionState
  setConnectionState: (state: ConnectionState) => void
  crushes: Crush[]
  crushMessages: Record<string, ChatMessage[]>
  onAddCrush: (crush: Crush) => void
  onSendCrushMessage: (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
}

const VideoChat: React.FC<VideoChatProps> = ({
  user: _user,
  setConnectionState,
  crushes,
  crushMessages,
  onAddCrush,
  onSendCrushMessage,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [currentPartner, setCurrentPartner] = useState<User | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [showCrushes, setShowCrushes] = useState(false)
  const [crushedCurrentPartner, setCrushedCurrentPartner] = useState(false)

  // Initialize webcam — called on user interaction (required for iOS/Android)
  const initMedia = useCallback(async () => {
    if (localStream) return localStream // already have it
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      setLocalStream(stream)
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      return stream
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error('Please allow camera & mic access', { duration: 4000 })
      } else {
        toast.error('Camera not available')
      }
      return null
    }
  }, [localStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => { localStream?.getTracks().forEach(t => t.stop()) }
  }, [localStream])

  // Real socket/WebRTC hook
  const { joinQueue, skip, stop, serverOffline } = useFreakSocket({
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
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    },
    onSearching: () => {
      setIsSearching(true)
      setIsConnected(false)
      setCurrentPartner(null)
      setCrushedCurrentPartner(false)
      setConnectionState('searching')
    },
  })

  const startSearch = useCallback(async () => {
    // Get camera first (must be triggered by user tap — required on mobile)
    const stream = await initMedia()
    if (!stream) return // permission denied
    joinQueue()
  }, [initMedia, joinQueue])

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
    toast.success(`💕 ${currentPartner.username} added to crushes!`, {
      style: { background: '#FF0066', color: '#fff' },
    })
  }, [currentPartner, crushedCurrentPartner, onAddCrush])

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
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* ─── PARTNER VIDEO (fullscreen) ─── */}
      <div className="absolute inset-0">
        {isConnected && currentPartner ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : isSearching ? (
          /* ─── QUEUE / LOADING STATE ─── */
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center mb-8">
              {/* Pulsing rings */}
              <motion.div
                className="absolute w-32 h-32 rounded-full border-2 border-freak-pink opacity-20"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute w-32 h-32 rounded-full border-2 border-freak-pink opacity-20"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              />
              <motion.div
                className="absolute w-32 h-32 rounded-full border-2 border-freak-pink opacity-20"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
              />
              {/* Center dot */}
              <div className="w-16 h-16 rounded-full bg-freak-pink flex items-center justify-center shadow-pink">
                <motion.div
                  className="w-8 h-8 rounded-full bg-white"
                  animate={{ scale: [1, 0.8, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </div>
            </div>
            <motion.p
              className="text-white text-lg font-medium tracking-wide"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Looking for your next freak...
            </motion.p>

            {/* Stop search button */}
            <motion.button
              onClick={stop}
              className="mt-8 px-6 py-2.5 border border-freak-border text-freak-muted rounded-full text-sm hover:border-freak-pink hover:text-white transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              Cancel
            </motion.button>
          </div>
        ) : (
          /* ─── IDLE / START STATE ─── */
          <div className="w-full h-full flex flex-col items-center justify-center">
            <motion.h2
              className="text-freak-pink text-5xl font-black mb-3 tracking-tighter"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              freak
            </motion.h2>
            <p className="text-freak-muted text-base mb-10">who are you meeting today?</p>

            <motion.button
              onClick={startSearch}
              className="px-14 py-4 bg-freak-pink text-white text-xl font-bold rounded-2xl shadow-pink"
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255,0,102,0.5)' }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {serverOffline ? 'Connecting...' : 'Start'}
            </motion.button>
          </div>
        )}
      </div>

      {/* ─── SELF PiP (bottom-right) ─── */}
      <motion.div
        className="absolute bottom-24 right-4 w-40 h-56 rounded-2xl overflow-hidden border-2 border-freak-pink/40 shadow-2xl z-10"
        whileHover={{ scale: 1.03 }}
      >
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
            <VideoOff className="w-6 h-6 text-freak-muted" />
          </div>
        )}
      </motion.div>

      {/* ─── PARTNER NAME (top-left when connected) ─── */}
      <AnimatePresence>
        {isConnected && currentPartner && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-5 left-5 z-10 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full"
          >
            <span className="text-white text-sm font-medium">{currentPartner.username}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ADD CRUSH (top-right when connected) ─── */}
      <AnimatePresence>
        {isConnected && currentPartner && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={addCrush}
            disabled={crushedCurrentPartner}
            className={`absolute top-5 right-5 z-10 flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all ${
              crushedCurrentPartner
                ? 'bg-freak-pink/30 text-freak-pink cursor-default'
                : 'bg-freak-pink text-white shadow-pink'
            }`}
            whileHover={crushedCurrentPartner ? {} : { scale: 1.05 }}
            whileTap={crushedCurrentPartner ? {} : { scale: 0.95 }}
          >
            <Heart className={`w-4 h-4 ${crushedCurrentPartner ? 'fill-freak-pink' : 'fill-white'}`} />
            {crushedCurrentPartner ? 'Crushed!' : 'Crush'}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── BOTTOM BAR ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Gradient fade */}
        <div className="h-28 bg-gradient-to-t from-black/80 to-transparent" />

        <div className="bg-black/80 backdrop-blur-md px-6 pt-3 safe-bottom">
          <div className="flex items-center justify-center gap-4">
            {/* Mic toggle */}
            <motion.button
              onClick={toggleAudio}
              whileTap={{ scale: 0.9 }}
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                isAudioOn ? 'bg-freak-surface border border-freak-border' : 'bg-red-500'
              }`}
            >
              {isAudioOn
                ? <Mic className="w-5 h-5 text-white" />
                : <MicOff className="w-5 h-5 text-white" />}
            </motion.button>

            {/* SKIP */}
            {(isConnected || isSearching) && (
              <motion.button
                onClick={skip}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl border-2 border-freak-pink text-freak-pink font-bold text-base"
              >
                <SkipForward className="w-5 h-5" />
                SKIP
              </motion.button>
            )}

            {/* STOP */}
            {(isConnected || isSearching) && (
              <motion.button
                onClick={stop}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-freak-pink text-white font-bold text-base shadow-pink"
              >
                <Square className="w-4 h-4 fill-white" />
                STOP
              </motion.button>
            )}

            {/* Video toggle */}
            <motion.button
              onClick={toggleVideo}
              whileTap={{ scale: 0.9 }}
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                isVideoOn ? 'bg-freak-surface border border-freak-border' : 'bg-red-500'
              }`}
            >
              {isVideoOn
                ? <Video className="w-5 h-5 text-white" />
                : <VideoOff className="w-5 h-5 text-white" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── CRUSHES TAB (tucked bottom-left) ─── */}
      <motion.button
        onClick={() => setShowCrushes(true)}
        className="absolute bottom-24 left-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-freak-border px-3 py-2 rounded-full"
        whileTap={{ scale: 0.9 }}
        whileHover={{ borderColor: '#FF0066' }}
      >
        <Heart className="w-4 h-4 text-freak-pink fill-freak-pink" />
        <span className="text-white text-xs font-medium">
          {crushes.length > 0 ? crushes.length : 'Crushes'}
        </span>
      </motion.button>

      {/* ─── CRUSHES PANEL (slides over) ─── */}
      <AnimatePresence>
        {showCrushes && (
          <CrushesPanel
            crushes={crushes}
            messages={crushMessages}
            onSendMessage={onSendCrushMessage}
            onClose={() => setShowCrushes(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default VideoChat
