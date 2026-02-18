import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageSquare, SkipForward, UserPlus, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { User, ConnectionState } from '../types'
import ChatOverlay from './ChatOverlay'
import ConnectionAnimation from './ConnectionAnimation'

interface VideoChatProps {
  user: User
  onConnectionSuccess: () => void
  connectionState: ConnectionState
  setConnectionState: (state: ConnectionState) => void
}

const VideoChat: React.FC<VideoChatProps> = ({
  user,
  onConnectionSuccess,
  connectionState,
  setConnectionState
}) => {
  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [currentPartner, setCurrentPartner] = useState<User | null>(null)
  const [connectionTime, setConnectionTime] = useState(0)
  
  // Media state
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  
  // Chat state
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState<Array<{id: string, text: string, sender: 'me' | 'partner', timestamp: Date}>>([])
  
  // Psychological hooks
  const [likesReceived, setLikesReceived] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [searchProgress, setSearchProgress] = useState(0)

  // Timer for connection duration
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isConnected) {
      timer = setInterval(() => {
        setConnectionTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isConnected])

  // Initialize webcam
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing media devices:', error)
        toast.error('Camera/microphone access required')
      }
    }

    initializeMedia()

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Mock connection search with psychological tension
  const startSearch = useCallback(() => {
    setIsSearching(true)
    setConnectionState('searching')
    setSearchProgress(0)
    
    // Simulate search with variable timing for psychological tension
    const searchDuration = Math.random() * 3000 + 2000 // 2-5 seconds
    const interval = searchDuration / 100
    
    const progressTimer = setInterval(() => {
      setSearchProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer)
          // Simulate finding a match
          setTimeout(() => {
            const mockPartner: User = {
              id: Date.now().toString(),
              username: `User${Math.floor(Math.random() * 9999)}`,
              interests: ['music', 'gaming'],
              joinedAt: new Date(),
              connectionsCount: Math.floor(Math.random() * 100)
            }
            setCurrentPartner(mockPartner)
            setIsConnected(true)
            setIsSearching(false)
            setConnectionState('connected')
            onConnectionSuccess()
            toast.success(`Connected to ${mockPartner.username}!`)
          }, 500)
          return 100
        }
        return prev + (Math.random() * 3 + 1) // Variable progress speed
      })
    }, interval)
  }, [onConnectionSuccess, setConnectionState])

  const skipConnection = useCallback(() => {
    if (currentPartner) {
      toast(`Skipped ${currentPartner.username}`, { icon: '⏭️' })
    }
    setIsConnected(false)
    setCurrentPartner(null)
    setConnectionTime(0)
    setMessages([])
    setShowChat(false)
    
    // Immediately start searching for next person
    setTimeout(() => startSearch(), 500)
  }, [currentPartner, startSearch])

  const addConnection = useCallback(() => {
    if (currentPartner) {
      toast.success(`Added ${currentPartner.username} to your connections!`)
      // Here you'd save to backend
    }
  }, [currentPartner])

  const sendLike = useCallback(() => {
    if (currentPartner) {
      toast(`Sent ❤️ to ${currentPartner.username}`)
      // Simulate receiving a like back sometimes
      if (Math.random() > 0.7) {
        setTimeout(() => {
          setLikesReceived(prev => prev + 1)
          toast.success(`${currentPartner.username} liked you back! ❤️`)
        }, 1000)
      }
    }
  }, [currentPartner])

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOn(videoTrack.enabled)
      }
    }
  }, [localStream])

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioOn(audioTrack.enabled)
      }
    }
  }, [localStream])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Memoized connection display text
  const connectionDisplayText = useMemo(() => {
    return connectionState === 'searching' ? 'Finding someone freak...' : 'Ready to get freak?'
  }, [connectionState])

  // Memoized button text
  const mainButtonText = useMemo(() => {
    return isSearching ? 'Finding chaos...' : 'Get Freak 🔥'
  }, [isSearching])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Connection Animation Overlay */}
      <AnimatePresence>
        {isSearching && (
          <ConnectionAnimation 
            progress={searchProgress}
            onCancel={() => {
              setIsSearching(false)
              setConnectionState('idle')
            }}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Video Section */}
        <div className="space-y-4 sm:space-y-6">
          {/* Your Video */}
          <motion.div 
            className="relative bg-dark-800 rounded-xl sm:rounded-2xl overflow-hidden aspect-video touch-manipulation"
            whileHover={{ scale: window.innerWidth > 1024 ? 1.02 : 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
              You
            </div>
            {!isVideoOn && (
              <div className="absolute inset-0 bg-dark-900 flex items-center justify-center">
                <VideoOff className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </motion.div>

          {/* Controls */}
          <motion.div 
            className="flex justify-center space-x-3 sm:space-x-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.button
              onClick={toggleVideo}
              className={`p-3 sm:p-4 rounded-full transition-colors mobile-optimized-tap min-w-[48px] min-h-[48px] flex items-center justify-center ${
                isVideoOn ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700' : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
              }`}
              whileHover={{ scale: window.innerWidth > 768 ? 1.1 : 1.05 }}
              whileTap={{ scale: 0.9 }}
            >
              {isVideoOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
            </motion.button>

            <motion.button
              onClick={toggleAudio}
              className={`p-3 sm:p-4 rounded-full transition-colors mobile-optimized-tap min-w-[48px] min-h-[48px] flex items-center justify-center ${
                isAudioOn ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700' : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
              }`}
              whileHover={{ scale: window.innerWidth > 768 ? 1.1 : 1.05 }}
              whileTap={{ scale: 0.9 }}
            >
              {isAudioOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
            </motion.button>

            <motion.button
              onClick={() => setShowChat(!showChat)}
              className="p-3 sm:p-4 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 rounded-full transition-colors mobile-optimized-tap min-w-[48px] min-h-[48px] flex items-center justify-center"
              whileHover={{ scale: window.innerWidth > 768 ? 1.1 : 1.05 }}
              whileTap={{ scale: 0.9 }}
            >
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </motion.button>
          </motion.div>
        </div>

        {/* Partner Video & Actions */}
        <div className="space-y-4 sm:space-y-6">
          {/* Partner Video */}
          <motion.div 
            className="relative bg-dark-800 rounded-xl sm:rounded-2xl overflow-hidden aspect-video touch-manipulation"
            whileHover={{ scale: window.innerWidth > 1024 ? 1.02 : 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {isConnected && currentPartner ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                  {currentPartner.username}
                </div>
                <div className="absolute top-4 right-4 bg-green-500 px-3 py-1 rounded-full text-white text-sm">
                  ⏱️ {formatTime(connectionTime)}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <motion.div
                    className="w-24 h-24 bg-dark-700 rounded-full mx-auto mb-4 flex items-center justify-center"
                    animate={{ rotate: connectionState === 'searching' ? 360 : 0 }}
                    transition={{ duration: 2, repeat: connectionState === 'searching' ? Infinity : 0 }}
                  >
                    <Video className="w-12 h-12" />
                  </motion.div>
                  <p className="text-lg">
                    {connectionDisplayText}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div 
            className="flex flex-wrap justify-center gap-3 sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {isConnected ? (
              <>
                <motion.button
                  onClick={sendLike}
                  className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 active:bg-red-700 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-white font-semibold transition-colors mobile-optimized-tap min-h-[44px]"
                  whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-base">Like</span>
                </motion.button>

                <motion.button
                  onClick={addConnection}
                  className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 active:bg-green-700 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-white font-semibold transition-colors mobile-optimized-tap min-h-[44px]"
                  whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-base">Add</span>
                </motion.button>

                <motion.button
                  onClick={skipConnection}
                  className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 active:bg-gray-800 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-white font-semibold transition-colors mobile-optimized-tap min-h-[44px]"
                  whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-base">Next</span>
                </motion.button>
              </>
            ) : (
              <motion.button
                onClick={startSearch}
                disabled={isSearching}
                className="bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 active:from-primary-700 active:to-accent-700 px-6 sm:px-8 py-3 sm:py-4 rounded-full text-white font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all mobile-optimized-tap min-h-[48px]"
                whileHover={{ scale: window.innerWidth > 768 ? 1.05 : 1.02 }}
                whileTap={{ scale: 0.95 }}
              >
                {mainButtonText}
              </motion.button>
            )}
          </motion.div>

          {/* Likes counter - psychological validation */}
          {likesReceived > 0 && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="inline-block bg-red-500/20 px-4 py-2 rounded-full">
                <span className="text-red-400 font-semibold">❤️ {likesReceived} likes received today!</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {showChat && (
          <ChatOverlay
            messages={messages}
            onSendMessage={(text) => {
              const newMessage = {
                id: Date.now().toString(),
                text,
                sender: 'me' as const,
                timestamp: new Date()
              }
              setMessages(prev => [...prev, newMessage])
              
              // Simulate partner response sometimes
              if (Math.random() > 0.6 && currentPartner) {
                setTimeout(() => {
                  const responses = [
                    "Hey! 👋",
                    "What's up?",
                    "Nice to meet you!",
                    "How's your day going?",
                    "Cool! 😎",
                    "That's awesome!",
                    "lol 😂"
                  ]
                  const response = {
                    id: (Date.now() + 1).toString(),
                    text: responses[Math.floor(Math.random() * responses.length)],
                    sender: 'partner' as const,
                    timestamp: new Date()
                  }
                  setMessages(prev => [...prev, response])
                }, Math.random() * 2000 + 500)
              }
            }}
            onClose={() => setShowChat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default React.memo(VideoChat)