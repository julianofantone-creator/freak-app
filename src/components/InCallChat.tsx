import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send } from 'lucide-react'

export interface CallMessage {
  id: string
  text: string
  from: 'me' | 'them'
  ts: number
}

interface Props {
  messages: CallMessage[]
  onSend: (text: string) => void
  partnerName: string
}

export default function InCallChat({ messages, onSend, partnerName }: Props) {
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const send = () => {
    const t = input.trim()
    if (!t) return
    onSend(t)
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Only show last 6 messages to keep it clean
  const visible = messages.slice(-6)

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col pointer-events-none">

      {/* Messages list — floats above input */}
      <div
        ref={listRef}
        className="flex flex-col gap-1.5 px-3 pb-2 max-h-48 overflow-y-auto scrollbar-none pointer-events-none"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)' }}
      >
        <AnimatePresence initial={false}>
          {visible.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-3 py-1.5 rounded-2xl text-sm font-medium leading-snug break-words shadow-lg
                  ${msg.from === 'me'
                    ? 'bg-[#FF0066] text-white rounded-br-sm'
                    : 'bg-black/70 text-white border border-white/10 rounded-bl-sm backdrop-blur-sm'
                  }`}
              >
                {msg.from === 'them' && (
                  <span className="text-[#FF0066] text-xs font-bold block mb-0.5">{partnerName}</span>
                )}
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div
        className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-md border-t border-white/8"
        onClick={() => setInputFocused(true)}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Say something..."
          maxLength={200}
          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#FF0066]/60 transition-colors"
          style={{ fontSize: '16px' }} // prevents iOS zoom
        />
        <motion.button
          onClick={send}
          whileTap={{ scale: 0.9 }}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-xl bg-[#FF0066] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
        >
          <Send className="w-4 h-4 text-white" />
        </motion.button>
      </div>
    </div>
  )
}
