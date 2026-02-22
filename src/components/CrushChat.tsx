import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Image, X, Search, Check, CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Crush, ChatMessage } from '../types'

// Compress image to max 800px wide, JPEG 0.75 quality (~30-80KB output)
async function compressImage(dataUrl: string, maxWidth = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

const TENOR_KEY = 'LIVDSRZULELA' // demo key — replace with your own

interface CrushChatProps {
  crush: Crush
  messages: ChatMessage[]
  onSendMessage: (crushId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  onBack: () => void
  status?: 'sent' | 'delivered' | 'queued' | 'read'
}

const CrushChat: React.FC<CrushChatProps> = ({ crush, messages, onSendMessage, onBack, status }) => {
  const [text, setText] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageCompressing, setImageCompressing] = useState(false)
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
    // Reject files over 20MB before even reading
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image too large (max 20MB)')
      return
    }
    setImageCompressing(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string
        const compressed = await compressImage(raw)
        setImagePreview(compressed)
      } catch {
        toast.error('Could not load image')
      } finally {
        setImageCompressing(false)
      }
    }
    reader.onerror = () => {
      toast.error('Could not read image')
      setImageCompressing(false)
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const sendImage = () => {
    if (!imagePreview || imageCompressing) return
    onSendMessage(crush.id, { type: 'image', mediaUrl: imagePreview, sender: 'me' })
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatTime = (d: Date) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Index of last message sent by 'me' (for showing read receipt)
  const lastMyMsgIdx = messages.reduce((last, m, i) => m.sender === 'me' ? i : last, -1)

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

        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${crush.avatar ? 'bg-freak-surface border border-freak-border text-2xl' : 'bg-freak-pink text-white text-lg'}`}>
          {crush.avatar ?? crush.username[0]?.toUpperCase()}
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

        {messages.map((msg, idx) => {
          const isLastMine = msg.sender === 'me' && idx === lastMyMsgIdx
          return (
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

                <div className="flex items-center gap-1 px-1">
                  <span className="text-[10px] text-freak-muted">
                    {formatTime(msg.timestamp)}
                  </span>
                  {/* Read receipt — only on last message I sent */}
                  {isLastMine && status && (
                    <span className="flex items-center">
                      {status === 'sent' && <Check size={11} className="text-freak-muted" />}
                      {status === 'queued' && <Check size={11} className="text-freak-muted" />}
                      {status === 'delivered' && <CheckCheck size={11} className="text-freak-muted" />}
                      {status === 'read' && <CheckCheck size={11} className="text-freak-pink" />}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      <AnimatePresence>
        {(imagePreview || imageCompressing) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 py-3 border-t border-freak-border bg-freak-surface flex items-center gap-3"
          >
            {imageCompressing ? (
              <div className="w-16 h-16 rounded-xl bg-freak-card flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-freak-pink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <img src={imagePreview!} alt="preview" className="w-16 h-16 object-cover rounded-xl" />
            )}
            <div className="flex-1">
              <p className="text-white text-sm">{imageCompressing ? 'Compressing...' : 'Ready to send'}</p>
            </div>
            <motion.button
              onClick={() => { setImagePreview(null); setImageCompressing(false) }}
              whileTap={{ scale: 0.9 }}
              className="text-freak-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={sendImage}
              disabled={imageCompressing || !imagePreview}
              whileTap={{ scale: 0.9 }}
              className="bg-freak-pink disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold"
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
