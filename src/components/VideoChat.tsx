import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, SkipForward, X, MessageSquare, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { User, ConnectionState } from '../types'

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
  
  // Media state
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  
  // Chat state
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState<Array<{id: string, text: string, sender: 'me' | 'partner', timestamp: Date}>>([])
  const [chatMessage, setChatMessage] = useState('')
  
  // Searching state
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

  // Mock connection search
  const startSearch = useCallback(() => {
    setIsSearching(true)
    setConnectionState('searching')
    
    // Simulate finding a match after 2-4 seconds
    const searchTime = Math.random() * 2000 + 2000
    
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
      onConnectionSuccess()
      toast.success(`Connected to ${mockPartner.username}`)
    }, searchTime)
  }, [onConnectionSuccess, setConnectionState])

  const skipConnection = useCallback(() => {
    if (currentPartner) {
      toast(`Skipped ${currentPartner.username}`)
    }
    
    setIsConnected(false)
    setCurrentPartner(null)
    setMessages([])
    setShowChat(false)
    
    // Start searching for next person immediately
    setTimeout(() => startSearch(), 500)
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
      toast(`❤️ Liked ${currentPartner.username}`)
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
    
    // Mock partner response sometimes
    if (Math.random() > 0.7) {
      setTimeout(() => {
        const responses = ['hey!', 'lol', 'nice', 'cool', 'same']
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

  return (
    <div className="min-h-screen bg-black relative">
      {/* Main Video Area - 80% of screen */}
      <div className="relative h-screen w-full">
        
        {/* Partner Video - Full Screen */}
        <div className="absolute inset-0 bg-gray-900">
          {isConnected && currentPartner ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isSearching ? (
                <motion.div
                  className="text-center"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="text-6xl mb-4">🌎</div>
                  <p className="text-white text-2xl">Finding someone...</p>
                </motion.div>
              ) : (
                <motion.div className="text-center">
                  <div className="text-8xl mb-6">💭</div>
                  <motion.button
                    onClick={startSearch}
                    className="bg-red-600 hover:bg-red-700 px-12 py-4 rounded-full text-white text-2xl font-bold"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start
                  </motion.button>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Your Video - Bottom Right Corner */}
        <motion.div 
          className="absolute bottom-6 right-6 w-48 h-36 bg-black rounded-xl overflow-hidden border-2 border-gray-700"
          whileHover={{ scale: 1.02 }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
            You
          </div>
        </motion.div>

        {/* Action Buttons - Top Right */}
        {isConnected && currentPartner && (
          <div className="absolute top-6 right-6 flex space-x-3">
            <motion.button
              onClick={likeUser}
              className="p-3 bg-red-600 hover:bg-red-700 rounded-full text-white"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Like"
            >
              <Heart className="w-5 h-5" />
            </motion.button>

            <motion.button
              onClick={skipConnection}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full text-white"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Skip"
            >
              <SkipForward className="w-5 h-5" />
            </motion.button>

            <motion.button
              onClick={endConnection}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Stop"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        )}

        {/* Controls - Bottom Center */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4">
          <motion.button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
          </motion.button>

          <motion.button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${isAudioOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isAudioOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
          </motion.button>

          {isConnected && (
            <motion.button
              onClick={() => setShowChat(!showChat)}
              className="p-4 bg-blue-600 hover:bg-blue-700 rounded-full"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MessageSquare className="w-6 h-6 text-white" />
            </motion.button>
          )}
        </div>

        {/* Partner Username - Top Left */}
        {isConnected && currentPartner && (
          <motion.div 
            className="absolute top-6 left-6 bg-black/50 px-4 py-2 rounded-full text-white"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {currentPartner.username}
          </motion.div>
        )}
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {showChat && isConnected && (
          <motion.div
            className="absolute bottom-20 right-6 w-80 h-96 bg-gray-900/95 rounded-xl border border-gray-700 flex flex-col"
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 50 }}
          >
            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                      message.sender === 'me'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
                  maxLength={200}
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!chatMessage.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg"
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-white text-sm">Send</span>
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