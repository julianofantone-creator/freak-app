import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Smile } from 'lucide-react'
import { Message } from '../types'

interface ChatOverlayProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  onClose: () => void
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ messages, onSendMessage, onClose }) => {
  const [inputText, setInputText] = useState('')
  const [showEmojis, setShowEmojis] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const emojis = ['😊', '😂', '❤️', '👍', '🔥', '😎', '🤔', '👋', '🎉', '😍', '🤝', '💯']

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim())
      setInputText('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji)
    setShowEmojis(false)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full h-96 flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Chat</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-2xl ${
                    message.sender === 'me'
                      ? 'bg-primary-500 text-white rounded-br-md'
                      : 'bg-gray-700 text-white rounded-bl-md'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />

          {messages.length === 0 && (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-4xl mb-2">💬</div>
              <p className="text-gray-400">Start a conversation!</p>
            </motion.div>
          )}
        </div>

        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojis && (
            <motion.div
              className="px-4 pb-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="bg-gray-700 rounded-xl p-3">
                <div className="grid grid-cols-6 gap-2">
                  {emojis.map((emoji) => (
                    <motion.button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="text-2xl hover:bg-gray-600 rounded-lg p-2 transition-colors"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEmojis(!showEmojis)}
              className="text-gray-400 hover:text-white transition-colors p-2"
            >
              <Smile className="w-5 h-5" />
            </button>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full bg-gray-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
                maxLength={500}
              />
            </div>

            <motion.button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:cursor-not-allowed p-2 rounded-xl text-white transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Quick responses */}
          <div className="flex flex-wrap gap-2 mt-3">
            {['Hey! 👋', 'How are you?', 'Nice to meet you!', 'What\'s up?'].map((quickMessage) => (
              <motion.button
                key={quickMessage}
                onClick={() => onSendMessage(quickMessage)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1 rounded-full transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {quickMessage}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ChatOverlay