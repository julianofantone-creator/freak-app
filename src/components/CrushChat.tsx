import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Image, X, Search } from 'lucide-react'
import { Crush, ChatMessage } from '../types'

const TENOR_KEY = 'LIVDSRZULELA' // demo key — replace with your own

interface CrushChatProps {
  crush: Crush
  messages: ChatMessage[]
  onSendMessage: (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  onBack: () => void
}

const CrushChat: React.FC<CrushChatProps> = ({ crush, messages, onSendMessage, onBack }) => {
  const [text, setText] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const gifSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load trending GIFs on open
  useEffect(() => {
    if (showGifPicker && gifs.length === 0) {
      fetchGifs('trending')
    }
  }, [showGifPicker])

  const fetchGifs = async (query: string) => {
    setGifLoading(true)
    try {
      const endpoint = query === 'trending'
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=20&media_filter=gif`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_KEY}&q=${encodeURIComponent(query)}&limit=20&media_filter=gif`

      const res = await fetch(endpoint)
      const data = await res.json()
      const results = (data.results || []).map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url || '',
        preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
      }))
      setGifs(results)
    } catch {
      setGifs([])
    }
    setGifLoading(false)
  }

  const handleGifSearchChange = (val: string) => {
    setGifSearch(val)
    if (gifSearchRef.current) clearTimeout(gifSearchRef.current)
    gifSearchRef.current = setTimeout(() => {
      fetchGifs(val.trim() || 'trending')
    }, 400)
  }

  const sendText = () => {
    if (!text.trim()) return
    onSendMessage(crush.id, { type: 'text', text: text.trim(), sender: 'me' })
    setText('')
  }

  const sendGif = (url: string) => {
    onSendMessage(crush.id, { type: 'gif', mediaUrl: url, sender: 'me' })
    setShowGifPicker(false)
    setGifSearch('')
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const sendImage = () => {
    if (!imagePreview) return
    onSendMessage(crush.id, { type: 'image', mediaUrl: imagePreview, sender: 'me' })
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatTime = (d: Date) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col h-full bg-freak-bg">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-freak-border bg-freak-surface">
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          className="text-freak-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <div className="w-10 h-10 rounded-full bg-freak-pink flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {crush.username[0]?.toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{crush.username}</p>
          <p className={`text-xs ${crush.online ? 'text-freak-pink' : 'text-freak-muted'}`}>
            {crush.online ? 'online' : 'offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">💕</div>
            <p className="text-freak-muted text-sm">Say hi to {crush.username}!</p>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] ${msg.sender === 'me' ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
              {msg.type === 'text' && (
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  msg.sender === 'me'
                    ? 'bg-freak-pink text-white rounded-br-sm'
                    : 'bg-freak-card text-white rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              )}

              {(msg.type === 'image' || msg.type === 'gif') && (
                <div className={`rounded-2xl overflow-hidden ${
                  msg.sender === 'me' ? 'rounded-br-sm' : 'rounded-bl-sm'
                }`}>
                  <img
                    src={msg.mediaUrl}
                    alt={msg.type}
                    className="max-w-full max-h-48 object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              <span className="text-[10px] text-freak-muted px-1">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 py-3 border-t border-freak-border bg-freak-surface flex items-center gap-3"
          >
            <img src={imagePreview} alt="preview" className="w-16 h-16 object-cover rounded-xl" />
            <div className="flex-1">
              <p className="text-white text-sm">Ready to send</p>
            </div>
            <motion.button
              onClick={() => setImagePreview(null)}
              whileTap={{ scale: 0.9 }}
              className="text-freak-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={sendImage}
              whileTap={{ scale: 0.9 }}
              className="bg-freak-pink text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Send
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIF Picker */}
      <AnimatePresence>
        {showGifPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="border-t border-freak-border bg-freak-surface"
            style={{ height: 280 }}
          >
            {/* GIF search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-freak-border">
              <Search className="w-4 h-4 text-freak-muted" />
              <input
                autoFocus
                type="text"
                placeholder="Search GIFs..."
                value={gifSearch}
                onChange={(e) => handleGifSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-freak-muted text-sm focus:outline-none"
              />
              <motion.button onClick={() => setShowGifPicker(false)} whileTap={{ scale: 0.9 }}>
                <X className="w-4 h-4 text-freak-muted hover:text-white" />
              </motion.button>
            </div>

            {/* GIF grid */}
            <div className="overflow-y-auto h-[calc(280px-53px)] p-2">
              {gifLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-freak-pink border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {gifs.map((gif) => (
                    <motion.button
                      key={gif.id}
                      onClick={() => sendGif(gif.url)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="aspect-square rounded-lg overflow-hidden bg-freak-card"
                    >
                      <img src={gif.preview} alt="gif" className="w-full h-full object-cover" loading="lazy" />
                    </motion.button>
                  ))}
                  {gifs.length === 0 && !gifLoading && (
                    <div className="col-span-4 flex items-center justify-center h-24 text-freak-muted text-sm">
                      No GIFs found
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <div className="px-4 py-3 border-t border-freak-border bg-freak-surface flex items-center gap-3">
        {/* Image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          whileTap={{ scale: 0.9 }}
          className="text-freak-muted hover:text-freak-pink transition-colors"
        >
          <Image className="w-5 h-5" />
        </motion.button>

        {/* GIF button */}
        <motion.button
          onClick={() => setShowGifPicker(!showGifPicker)}
          whileTap={{ scale: 0.9 }}
          className={`text-sm font-bold transition-colors ${showGifPicker ? 'text-freak-pink' : 'text-freak-muted hover:text-freak-pink'}`}
        >
          GIF
        </motion.button>

        {/* Text input */}
        <input
          type="text"
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          className="flex-1 bg-freak-card border border-freak-border text-white placeholder-freak-muted rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-freak-pink transition-colors"
        />

        {/* Send */}
        <motion.button
          onClick={sendText}
          disabled={!text.trim()}
          whileTap={{ scale: 0.9 }}
          className="w-9 h-9 rounded-full bg-freak-pink flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 text-white" />
        </motion.button>
      </div>
    </div>
  )
}

export default CrushChat
