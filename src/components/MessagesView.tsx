import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Send, Image, Video, Gift, Smile, Palette, Circle } from 'lucide-react'
import { User } from '../types'

type Theme = {
  id: string
  name: string
  background: string
  accent: string
  secondary: string
  text: string
  border: string
}

interface MessagesViewProps {
  user: User
  theme?: Theme
}

interface Conversation {
  id: string
  partnerName: string
  lastMessage: string
  timestamp: Date
  unread: number
  avatar: string
  online: boolean
}

interface Message {
  id: string
  text?: string
  image?: string
  gif?: string
  video?: string
  sender: 'me' | 'partner'
  timestamp: Date
  type: 'text' | 'image' | 'gif' | 'video'
}

const MessagesView: React.FC<MessagesViewProps> = ({ theme }) => {
  // Default luxury theme if none provided
  const currentTheme = theme || {
    id: 'luxury-dark',
    name: 'Luxury Dark',
    background: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
    accent: 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700',
    secondary: 'bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-xl',
    text: 'text-white',
    border: 'border-gray-700/50'
  }

  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mock conversations data
  const conversations: Conversation[] = [
    {
      id: '1',
      partnerName: 'MusicLover22',
      lastMessage: 'That was so fun! 😊',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      unread: 2,
      avatar: 'ML',
      online: true
    },
    {
      id: '2', 
      partnerName: 'GameMaster99',
      lastMessage: 'You seem really cool',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      unread: 0,
      avatar: 'GM',
      online: false
    },
    {
      id: '3',
      partnerName: 'ArtisticSoul',
      lastMessage: 'Added you as a crush! 💕',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      unread: 1,
      avatar: 'AS',
      online: true
    }
  ]

  // Mock messages for active conversation
  const messages: Message[] = [
    {
      id: '1',
      text: 'Hey! Nice meeting you on the video chat! 👋',
      sender: 'partner',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      type: 'text'
    },
    {
      id: '2',
      text: 'You seem really cool! Want to stay in touch?',
      sender: 'partner',
      timestamp: new Date(Date.now() - 55 * 60 * 1000),
      type: 'text'
    },
    {
      id: '3',
      text: 'Absolutely! That was so much fun 😊',
      sender: 'me',
      timestamp: new Date(Date.now() - 50 * 60 * 1000),
      type: 'text'
    },
    {
      id: '4',
      gif: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
      sender: 'partner',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      type: 'gif'
    }
  ]

  // Using global theme system now instead of local chatThemes

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    
    if (hours < 1) return 'now'
    if (hours < 24) return `${hours}h`
    
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    
    return date.toLocaleDateString()
  }

  const sendMessage = () => {
    if (!messageText.trim()) return
    
    // Here you would send the message to the backend
    console.log('Sending message:', messageText)
    setMessageText('')
  }

  const handleFileUpload = (type: 'image' | 'video') => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('accept', type === 'image' ? 'image/*' : 'video/*')
      fileInputRef.current.click()
    }
  }

  const isMinecraftTheme = currentTheme.id === 'minecraft-limited'

  return (
    <div className={`h-screen flex ${currentTheme.background} ${isMinecraftTheme ? 'minecraft-theme' : ''}`}>
      {/* Conversations Sidebar */}
      <div className={`w-80 ${currentTheme.secondary} ${currentTheme.border} border-r backdrop-blur-xl flex flex-col`}>
        {/* Search Header */}
        <div className={`p-4 border-b ${currentTheme.border}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${currentTheme.secondary} ${currentTheme.border} border rounded-xl pl-10 pr-4 py-3 ${currentTheme.text} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent backdrop-blur-sm`}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.filter(conv => 
            conv.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
          ).map((conversation) => (
            <motion.div
              key={conversation.id}
              onClick={() => setActiveConversation(conversation.id)}
              className={`p-4 border-b ${currentTheme.border} cursor-pointer transition-all ${currentTheme.secondary} hover:bg-gray-600/30 ${
                activeConversation === conversation.id ? 'bg-gray-600/50 shadow-lg' : ''
              }`}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center space-x-3">
                {/* Avatar with online status */}
                <div className="relative">
                  <div className={`w-12 h-12 ${
                    isMinecraftTheme 
                      ? 'minecraft-button text-stone-100 rounded-md' 
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 rounded-full'
                  } flex items-center justify-center text-white font-bold shadow-lg`}>
                    {isMinecraftTheme ? '🧊' : conversation.avatar}
                  </div>
                  {conversation.online && (
                    <Circle className="absolute -bottom-1 -right-1 w-4 h-4 text-green-400 fill-green-400 border-2 border-gray-900 rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`${currentTheme.text} font-semibold truncate`}>{conversation.partnerName}</h3>
                    <span className="text-gray-400 text-xs">{formatTime(conversation.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-gray-400 text-sm truncate">{conversation.lastMessage}</p>
                    {conversation.unread > 0 && (
                      <div className="bg-pink-500 text-white text-xs rounded-full px-2 py-1 min-w-5 h-5 flex items-center justify-center">
                        {conversation.unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className={`${currentTheme.secondary} ${currentTheme.border} border-b p-4 backdrop-blur-xl`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      ML
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className={`${currentTheme.text} font-semibold`}>MusicLover22</h3>
                    <p className="text-gray-400 text-sm">Online</p>
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="flex items-center space-x-2">
                  <motion.button
                    onClick={() => {/* Theme switching handled globally now */}}
                    className={`p-2 text-gray-400 hover:${currentTheme.text} rounded-lg ${currentTheme.secondary} hover:bg-gray-600/30`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Palette className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className={`flex-1 p-4 overflow-y-auto ${currentTheme.background} relative`}>
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md ${
                      message.sender === 'me' 
                        ? isMinecraftTheme 
                          ? 'creeper-gradient text-white minecraft-button rounded-md' 
                          : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl rounded-br-md shadow-pink-500/20'
                        : isMinecraftTheme
                        ? 'minecraft-button text-stone-100 rounded-md'
                        : `${currentTheme.secondary} ${currentTheme.text} rounded-2xl rounded-bl-md backdrop-blur-xl`
                    } px-4 py-3 shadow-xl`}>
                      {message.type === 'text' && (
                        <p className="text-sm">{message.text}</p>
                      )}
                      {message.type === 'gif' && (
                        <img 
                          src={message.gif} 
                          alt="GIF"
                          className="rounded-lg max-w-full h-auto"
                        />
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className={`${currentTheme.secondary} ${currentTheme.border} border-t p-4 backdrop-blur-xl`}>
              <div className="flex items-center space-x-3 max-w-4xl mx-auto">
                {/* Media Buttons */}
                <div className="flex space-x-2">
                  <motion.button
                    onClick={() => handleFileUpload('image')}
                    className={`p-2 text-gray-400 hover:${currentTheme.text} rounded-lg ${currentTheme.secondary} hover:bg-gray-600/30`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Image className="w-5 h-5" />
                  </motion.button>
                  
                  <motion.button
                    onClick={() => handleFileUpload('video')}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Video className="w-5 h-5" />
                  </motion.button>
                  
                  <motion.button
                    onClick={() => setShowGifPicker(!showGifPicker)}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Gift className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Message Input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className={`w-full ${currentTheme.secondary} ${currentTheme.border} border rounded-xl px-4 py-3 pr-12 ${currentTheme.text} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent backdrop-blur-sm`}
                  />
                  <motion.button
                    onClick={() => setShowGifPicker(!showGifPicker)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Smile className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Send Button */}
                <motion.button
                  onClick={sendMessage}
                  disabled={!messageText.trim()}
                  className={`${
                    isMinecraftTheme
                      ? 'minecraft-button text-stone-100 p-3 rounded-md'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 p-3 rounded-xl text-white shadow-xl shadow-pink-500/20'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </>
        ) : (
          /* No Conversation Selected */
          <div className={`flex-1 flex items-center justify-center ${currentTheme.background}`}>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  💬
                </motion.div>
              </div>
              <h3 className={`text-xl font-semibold ${currentTheme.text} mb-2`}>Your Messages</h3>
              <p className="text-gray-400">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          // Handle file upload
          console.log('File selected:', e.target.files?.[0])
        }}
      />

      {/* GIF Picker */}
      <AnimatePresence>
        {showGifPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-20 right-4 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 z-50"
          >
            <div className="grid grid-cols-3 gap-2">
              {['🎉', '😂', '❤️', '👍', '🔥', '😎'].map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => {
                    setMessageText(prev => prev + emoji)
                    setShowGifPicker(false)
                  }}
                  className="text-2xl p-2 hover:bg-gray-700 rounded-lg"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MessagesView