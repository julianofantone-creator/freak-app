import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, SkipForward, X, MessageSquare, Video, VideoOff, Mic, MicOff, Settings, Palette, Layout } from 'lucide-react'
import toast from 'react-hot-toast'
import { User, ConnectionState } from '../types'
import { Theme } from '../App'

interface VideoChatProps {
  user: User
  onConnectionSuccess: () => void
  connectionState: ConnectionState
  setConnectionState: (state: ConnectionState) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  availableThemes: Theme[]
}

type LayoutMode = 'fullscreen' | 'split' | 'corner'

const VideoChat: React.FC<VideoChatProps> = ({
  user,
  onConnectionSuccess,
  connectionState,
  setConnectionState,
  theme,
  onThemeChange,
  availableThemes
}) => {
  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [currentPartner, setCurrentPartner] = useState<User | null>(null)
  
  // Media state
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  
  // UI customization
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('fullscreen')
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [messages, setMessages] = useState<Array<{id: string, text: string, sender: 'me' | 'partner', timestamp: Date}>>([])
  
  // Animation and effects
  const [connectionCount, setConnectionCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)

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
        toast.error('Camera access required')
      }
    }

    initializeMedia()

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Start search with smooth animation
  const startSearch = useCallback(() => {
    setIsSearching(true)
    setConnectionState('searching')
    
    // Smooth search animation
    const searchTime = 2000 + Math.random() * 2000
    
    setTimeout(() => {
      const mockPartner: User = {
        id: Date.now().toString(),
        username: `User${Math.floor(Math.random() * 9999)}`,
        interests: [],
        joinedAt: new Date(),
        connectionsCount: Math.floor(Math.random() * 100)
      }
      
      setCurrentPartner(mockPartner)
      setIsConnected(true)
      setIsSearching(false)
      setConnectionState('connected')
      setConnectionCount(prev => prev + 1)
      onConnectionSuccess()
      toast.success(`Connected to ${mockPartner.username}! 🎉`)
    }, searchTime)
  }, [onConnectionSuccess, setConnectionState])

  const skipConnection = useCallback(() => {
    if (currentPartner) {
      toast(`👋 Skipped ${currentPartner.username}`)
    }
    
    setIsConnected(false)
    setCurrentPartner(null)
    setMessages([])
    setShowChat(false)
    
    setTimeout(() => startSearch(), 300)
  }, [currentPartner, startSearch])

  const endConnection = useCallback(() => {
    if (currentPartner) {
      toast(`Disconnected from ${currentPartner.username}`)
    }
    
    setIsConnected(false)
    setCurrentPartner(null)
    setConnectionState('idle')
    setMessages([])
    setShowChat(false)
  }, [currentPartner, setConnectionState])

  const likeUser = useCallback(() => {
    if (currentPartner) {
      toast(`💖 Liked ${currentPartner.username}!`)
      // Add heart animation
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

  const sendMessage = useCallback(() => {
    if (!chatMessage.trim() || !currentPartner) return
    
    const newMessage = {
      id: Date.now().toString(),
      text: chatMessage.trim(),
      sender: 'me' as const,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    setChatMessage('')
    
    // Mock partner response
    if (Math.random() > 0.6) {
      setTimeout(() => {
        const responses = ['hey! 👋', 'lol 😂', 'nice!', 'cool 😎', 'same here']
        const response = {
          id: (Date.now() + 1).toString(),
          text: responses[Math.floor(Math.random() * responses.length)],
          sender: 'partner' as const,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, response])
      }, 500 + Math.random() * 1500)
    }
  }, [chatMessage, currentPartner])

  // Layout configurations
  const layoutConfigs = {
    fullscreen: { 
      containerClass: 'h-screen w-full',
      yourVideoClass: 'absolute bottom-4 right-4 w-48 h-36',
      partnerVideoClass: 'w-full h-full'
    },
    split: {
      containerClass: 'h-screen w-full grid grid-cols-2 gap-2 p-2',
      yourVideoClass: 'w-full h-full',
      partnerVideoClass: 'w-full h-full'
    },
    corner: {
      containerClass: 'h-screen w-full',
      yourVideoClass: 'absolute top-4 right-4 w-64 h-48',
      partnerVideoClass: 'w-full h-full'
    }
  }

  const config = layoutConfigs[layoutMode]

  return (
    <div className={`min-h-screen ${theme.background} relative`}>
      {/* Main Video Container */}
      <div className={config.containerClass}>
        
        {/* Partner Video */}
        <div className={`relative ${layoutMode === 'split' ? '' : 'h-full'} bg-gray-900 rounded-lg overflow-hidden`}>
          {isConnected && currentPartner ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`${config.partnerVideoClass} object-cover`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isSearching ? (
                <motion.div
                  className="text-center"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <motion.div 
                    className="text-6xl mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    🌎
                  </motion.div>
                  <p className={`${theme.text} text-2xl font-medium`}>Finding someone...</p>
                  <div className="mt-4 w-32 h-1 bg-gray-700 rounded-full mx-auto">
                    <motion.div 
                      className="h-full bg-pink-500 rounded-full"
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  className="text-center"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  <motion.div 
                    className="text-8xl mb-6"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    💭
                  </motion.div>
                  <motion.button
                    onClick={startSearch}
                    className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 px-12 py-4 rounded-2xl text-white text-2xl font-bold shadow-xl"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start Chatting
                  </motion.button>
                  {connectionCount > 0 && (
                    <p className="text-gray-400 mt-4">
                      {connectionCount} connection{connectionCount !== 1 ? 's' : ''} made 🎉
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          )}
          
          {/* Partner Info Overlay */}
          {isConnected && currentPartner && (
            <motion.div 
              className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full text-white"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span className="font-medium">{currentPartner.username}</span>
            </motion.div>
          )}
        </div>

        {/* Your Video */}
        <motion.div 
          className={`${config.yourVideoClass} ${layoutMode === 'split' ? '' : 'absolute'} bg-black rounded-lg overflow-hidden border-2 ${theme.border} shadow-2xl`}
          whileHover={{ scale: layoutMode === 'fullscreen' ? 1.02 : 1 }}
          layout
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm font-medium">
            {user.username}
          </div>
        </motion.div>
      </div>

      {/* Action Buttons - Top Right */}
      {isConnected && currentPartner && (
        <div className="absolute top-6 right-6 flex space-x-3">
          <motion.button
            onClick={likeUser}
            className="p-4 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 rounded-full text-white shadow-lg"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            title="Like"
          >
            <Heart className="w-5 h-5" />
          </motion.button>

          <motion.button
            onClick={skipConnection}
            className={`p-4 ${theme.secondary} rounded-full text-white shadow-lg`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Next"
          >
            <SkipForward className="w-5 h-5" />
          </motion.button>

          <motion.button
            onClick={endConnection}
            className="p-4 bg-gray-600 hover:bg-gray-700 rounded-full text-white shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Stop"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
      )}

      {/* Controls - Bottom Center */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3">
        <motion.button
          onClick={toggleVideo}
          className={`p-4 rounded-full shadow-lg ${isVideoOn ? theme.secondary : 'bg-red-500 hover:bg-red-600'}`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
        </motion.button>

        <motion.button
          onClick={toggleAudio}
          className={`p-4 rounded-full shadow-lg ${isAudioOn ? theme.secondary : 'bg-red-500 hover:bg-red-600'}`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isAudioOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
        </motion.button>

        {isConnected && (
          <motion.button
            onClick={() => setShowChat(!showChat)}
            className="p-4 bg-blue-500 hover:bg-blue-600 rounded-full text-white shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}

        <motion.button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-4 ${theme.secondary} rounded-full text-white shadow-lg`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Settings className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute top-6 left-6 bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-gray-200 min-w-80"
            initial={{ opacity: 0, scale: 0.9, x: -50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -50 }}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Customize Your Stream
            </h3>

            {/* Theme Selection */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center">
                <Palette className="w-4 h-4 mr-1" />
                Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {availableThemes.map((themeOption) => (
                  <motion.button
                    key={themeOption.id}
                    onClick={() => onThemeChange(themeOption)}
                    className={`p-3 rounded-lg border-2 text-xs font-medium ${
                      theme.id === themeOption.id ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {themeOption.name}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Layout Selection */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center">
                <Layout className="w-4 h-4 mr-1" />
                Layout
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'fullscreen', name: 'Full Screen', icon: '🖥️' },
                  { id: 'split', name: 'Split View', icon: '⚡' },
                  { id: 'corner', name: 'Corner', icon: '📱' }
                ].map((layout) => (
                  <motion.button
                    key={layout.id}
                    onClick={() => setLayoutMode(layout.id as LayoutMode)}
                    className={`p-3 rounded-lg border-2 text-xs font-medium ${
                      layoutMode === layout.id ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-lg mb-1">{layout.icon}</div>
                    {layout.name}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button
              onClick={() => setShowSettings(false)}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Done
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Overlay */}
      <AnimatePresence>
        {showChat && isConnected && (
          <motion.div
            className="absolute bottom-20 right-6 w-80 h-96 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 shadow-2xl flex flex-col"
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 50 }}
          >
            <div className="p-4 border-b border-gray-200">
              <h4 className="font-medium text-gray-800 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat with {currentPartner?.username}
              </h4>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                      message.sender === 'me'
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {message.text}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-100 text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  maxLength={200}
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!chatMessage.trim()}
                  className="bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed px-4 py-2 rounded-lg"
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-white text-sm font-medium">Send</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default VideoChat