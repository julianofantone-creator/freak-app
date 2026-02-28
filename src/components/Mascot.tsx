/**
 * FREAK MASCOT — The little AI that lives inside freak.cool
 * - Crawls the DOM, sits on buttons, bounces on UI elements
 * - Listens to conversations, detects silence + dry chat
 * - AI wingman powered by Groq llama-3.1-8b-instant (cheapest model)
 * - Audio silence detection via Web Audio API
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://freak-app-production.up.railway.app'

interface MascotProps {
  appState: 'idle' | 'searching' | 'connected' | 'disconnected'
}

type Emotion = 'idle' | 'walking' | 'excited' | 'connected' | 'sad' | 'wingman' | 'shrug' | 'sleep' | 'search' | 'dance' | 'blink'

interface Pos { x: number; y: number }

// ── DOM target finder ──────────────────────────────────────────────────────
function findDOMTargets(): Pos[] {
  const targets: Pos[] = []
  const seen = new Set<string>()

  const add = (x: number, y: number, label: string) => {
    const key = `${Math.round(x)},${Math.round(y)}`
    if (!seen.has(key) && x > 40 && y > 40 && x < window.innerWidth - 40 && y < window.innerHeight - 40) {
      seen.add(key)
      targets.push({ x, y })
    }
  }

  // Buttons
  document.querySelectorAll('button').forEach(btn => {
    const r = btn.getBoundingClientRect()
    if (r.width > 30 && r.height > 20) add(r.left + r.width / 2, r.top - 18, 'btn')
  })

  // Video elements (sit on top edge)
  document.querySelectorAll('video').forEach(vid => {
    const r = vid.getBoundingClientRect()
    if (r.width > 80) add(r.left + r.width * 0.25, r.top + 20, 'vid')
  })

  return targets
}

// ── Wingman API ─────────────────────────────────────────────────────────────
async function fetchWingmanSuggestion(msgs: MascotProps['chatMessages']): Promise<string> {
  try {
    const res = await fetch(`${SERVER_URL}/api/wingman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs?.slice(-6) || [], situation: 'dry' }),
    })
    const data = await res.json()
    return data.suggestion || "Say something! 👀"
  } catch {
    return "Ask what they're up to! 😄"
  }
}

// ── SVG Face ────────────────────────────────────────────────────────────────
function MascotFace({ emotion, blink }: { emotion: Emotion; blink: boolean }) {
  const eyeY = 28
  const eyeR = blink || emotion === 'sleep' ? 1 : 5

  const leftEye = () => {
    if (emotion === 'connected') return <text x="18" y="34" fontSize="10" textAnchor="middle">♥</text>
    if (emotion === 'excited') return <text x="18" y="34" fontSize="10" textAnchor="middle">★</text>
    if (emotion === 'wingman') return <text x="18" y="34" fontSize="9" textAnchor="middle">👁</text>
    return <ellipse cx="18" cy={eyeY} rx={blink ? 5 : 4} ry={eyeR} fill="#1a001a" />
  }
  const rightEye = () => {
    if (emotion === 'connected') return <text x="42" y="34" fontSize="10" textAnchor="middle">♥</text>
    if (emotion === 'excited') return <text x="42" y="34" fontSize="10" textAnchor="middle">★</text>
    if (emotion === 'wingman') return <text x="42" y="34" fontSize="9" textAnchor="middle">👁</text>
    return <ellipse cx="42" cy={eyeY} rx={blink ? 5 : 4} ry={eyeR} fill="#1a001a" />
  }

  // Pupils (follow direction slightly)
  const pupilOffset = emotion === 'search' ? 2 : emotion === 'wingman' ? -1 : 0

  // Mouth path
  const mouth = () => {
    if (emotion === 'sad' || emotion === 'sleep') {
      return <path d="M18 46 Q30 40 42 46" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    }
    if (emotion === 'excited' || emotion === 'connected') {
      return <path d="M16 42 Q30 52 44 42" stroke="#1a001a" strokeWidth="2.5" fill="#ff69b4" strokeLinecap="round" />
    }
    if (emotion === 'search') {
      return <ellipse cx="30" cy="44" rx="5" ry="5" fill="#1a001a" />
    }
    if (emotion === 'shrug') {
      return <path d="M20 44 Q30 44 40 44" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    }
    // idle / walking / dance / wingman
    return <path d="M18 43 Q30 50 42 43" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  }

  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{ display: 'block' }}>
      {/* Body */}
      <ellipse cx="30" cy="32" rx="26" ry="26" fill="url(#grad)" />
      <defs>
        <radialGradient id="grad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#ff69b4" />
          <stop offset="100%" stopColor="#ff1493" />
        </radialGradient>
      </defs>

      {/* Blush */}
      <ellipse cx="10" cy="40" rx="7" ry="4" fill="rgba(255,100,160,0.4)" />
      <ellipse cx="50" cy="40" rx="7" ry="4" fill="rgba(255,100,160,0.4)" />

      {/* Eyes */}
      {leftEye()}
      {rightEye()}

      {/* Pupils — only for normal eyes */}
      {emotion !== 'connected' && emotion !== 'excited' && emotion !== 'wingman' && !blink && (
        <>
          <ellipse cx={18 + pupilOffset} cy={eyeY} rx="2" ry="2.5" fill="white" opacity="0.7" />
          <ellipse cx={42 + pupilOffset} cy={eyeY} rx="2" ry="2.5" fill="white" opacity="0.7" />
        </>
      )}

      {/* Mouth */}
      {mouth()}

      {/* Sleep Zzz eye closed line */}
      {emotion === 'sleep' && (
        <>
          <line x1="13" y1="28" x2="23" y2="28" stroke="#1a001a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="37" y1="28" x2="47" y2="28" stroke="#1a001a" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// ── Main Mascot ─────────────────────────────────────────────────────────────
export default function Mascot({ appState }: MascotProps) {
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; from: string; ts: number }>>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  // Listen to custom events from socket hook + VideoChat
  useEffect(() => {
    const onChat = (e: Event) => {
      const { from, text, ts } = (e as CustomEvent).detail
      setChatMessages(prev => [...prev.slice(-10), { from, text, ts }])
    }
    const onStream = (e: Event) => setLocalStream((e as CustomEvent).detail)
    window.addEventListener('freak:chat', onChat)
    window.addEventListener('freak:stream', onStream)
    return () => {
      window.removeEventListener('freak:chat', onChat)
      window.removeEventListener('freak:stream', onStream)
    }
  }, [])
  const [pos, setPos] = useState<Pos>({ x: window.innerWidth - 90, y: window.innerHeight - 90 })
  const [targetPos, setTargetPos] = useState<Pos>({ x: window.innerWidth - 90, y: window.innerHeight - 90 })
  const [emotion, setEmotion] = useState<Emotion>('idle')
  const [blink, setBlink] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [floating, setFloating] = useState<string | null>(null)
  const [tilt, setTilt] = useState(0) // walking direction
  const [scale, setScale] = useState(1)

  const prevAppState = useRef(appState)
  const wingmanTimer = useRef<ReturnType<typeof setTimeout>>()
  const wanderTimer = useRef<ReturnType<typeof setTimeout>>()
  const blinkTimer = useRef<ReturnType<typeof setTimeout>>()
  const sleepTimer = useRef<ReturnType<typeof setTimeout>>()
  const audioCtx = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout>>()
  const lastSpeechRef = useRef(Date.now())
  const isWingmanActive = useRef(false)
  const lastChatTime = useRef(Date.now())

  // ── Emotion helper ─────────────────────────────────────────────────────
  const setEmotionFor = useCallback((e: Emotion, ms: number, then: Emotion = 'idle') => {
    setEmotion(e)
    setTimeout(() => setEmotion(then), ms)
  }, [])

  // ── Float emote ────────────────────────────────────────────────────────
  const floatEmote = useCallback((emoji: string) => {
    setFloating(emoji)
    setTimeout(() => setFloating(null), 1200)
  }, [])

  // ── Move to position ───────────────────────────────────────────────────
  const moveTo = useCallback((newPos: Pos) => {
    setEmotion('walking')
    setTilt(newPos.x > pos.x ? 12 : -12)
    setTargetPos(newPos)
    setTimeout(() => {
      setPos(newPos)
      setEmotion('idle')
      setTilt(0)
      // Land bounce
      setScale(1.15)
      setTimeout(() => setScale(1), 200)
    }, 1800)
  }, [pos.x])

  // ── Wander to DOM targets ──────────────────────────────────────────────
  const wander = useCallback(() => {
    const targets = findDOMTargets()
    const validTargets = targets.length > 0 ? targets : [
      { x: 80, y: 80 },
      { x: window.innerWidth - 80, y: 80 },
      { x: 80, y: window.innerHeight - 80 },
      { x: window.innerWidth - 80, y: window.innerHeight - 80 },
      { x: window.innerWidth / 2, y: window.innerHeight - 80 },
    ]
    const pick = validTargets[Math.floor(Math.random() * validTargets.length)]
    moveTo(pick)
  }, [moveTo])

  // ── Wander loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      wanderTimer.current = setTimeout(() => {
        if (appState !== 'searching') wander()
        loop()
      }, 25000 + Math.random() * 35000)
    }
    loop()
    return () => clearTimeout(wanderTimer.current)
  }, [appState, wander])

  // ── Blink loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      blinkTimer.current = setTimeout(() => {
        if (!['connected', 'excited', 'sleep'].includes(emotion)) {
          setBlink(true)
          setTimeout(() => setBlink(false), 150)
        }
        loop()
      }, 2500 + Math.random() * 2500)
    }
    loop()
    return () => clearTimeout(blinkTimer.current)
  }, [emotion])

  // ── Sleep when idle too long ───────────────────────────────────────────
  useEffect(() => {
    clearTimeout(sleepTimer.current)
    if (appState === 'idle') {
      sleepTimer.current = setTimeout(() => {
        setEmotion('sleep')
        floatEmote('💤')
      }, 90000)
    }
    return () => clearTimeout(sleepTimer.current)
  }, [appState, chatMessages, floatEmote])

  // ── React to appState changes ──────────────────────────────────────────
  useEffect(() => {
    const prev = prevAppState.current
    prevAppState.current = appState

    if (appState === 'searching' && prev !== 'searching') {
      setEmotion('search')
      floatEmote('🔍')
      // Run to center-ish
      moveTo({ x: window.innerWidth / 2 + (Math.random() - 0.5) * 100, y: window.innerHeight * 0.6 })
    }
    if (appState === 'connected' && prev !== 'connected') {
      setEmotionFor('connected', 2500, 'dance')
      floatEmote('✨')
      setScale(1.3)
      setTimeout(() => setScale(1), 400)
      lastChatTime.current = Date.now()
    }
    if (appState === 'disconnected' && prev !== 'disconnected') {
      setEmotionFor('sad', 2500)
      floatEmote('😢')
      isWingmanActive.current = false
      setBubble(null)
      clearTimeout(wingmanTimer.current)
    }
    if (appState === 'idle' && prev !== 'idle') {
      setEmotion('idle')
      setBubble(null)
      isWingmanActive.current = false
    }
  }, [appState, setEmotionFor, floatEmote, moveTo])

  // ── React to new chat messages ─────────────────────────────────────────
  useEffect(() => {
    if (!chatMessages?.length) return
    const last = chatMessages[chatMessages.length - 1]
    if (!last) return
    lastChatTime.current = Date.now()
    isWingmanActive.current = false
    clearTimeout(wingmanTimer.current)
    setBubble(null)

    // Dance on message
    if (appState === 'connected') {
      setEmotionFor('dance', 800)
      floatEmote('💬')
    }

    // Reset dry timer
    wingmanTimer.current = setTimeout(async () => {
      if (appState !== 'connected') return
      if (isWingmanActive.current) return
      isWingmanActive.current = true
      setEmotion('wingman')
      floatEmote('💡')

      // Crawl to chat area
      const chatEl = document.querySelector('[placeholder]') as HTMLElement
      if (chatEl) {
        const r = chatEl.getBoundingClientRect()
        moveTo({ x: r.left - 40, y: r.top - 10 })
      }

      const suggestion = await fetchWingmanSuggestion(chatMessages)
      setBubble(suggestion)
    }, 35000) // 35s dry = wingman activates
  }, [chatMessages, appState, setEmotionFor, floatEmote, moveTo])

  // ── Wingman on connect (opener) ────────────────────────────────────────
  useEffect(() => {
    if (appState !== 'connected') return
    // 8 seconds after connecting with no chat: give opener
    const t = setTimeout(async () => {
      if (chatMessages?.length) return // already chatting, skip
      if (isWingmanActive.current) return
      isWingmanActive.current = true
      setEmotion('wingman')
      const suggestion = await fetchWingmanSuggestion([])
      setBubble(suggestion)
      floatEmote('💬')
    }, 12000)
    return () => clearTimeout(t)
  }, [appState]) // eslint-disable-line

  // ── Audio silence detection ────────────────────────────────────────────
  useEffect(() => {
    if (!localStream || appState !== 'connected') return

    try {
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(localStream)
      const an = ctx.createAnalyser()
      an.fftSize = 256
      src.connect(an)
      audioCtx.current = ctx
      analyser.current = an

      const data = new Uint8Array(an.frequencyBinCount)
      lastSpeechRef.current = Date.now()

      const check = () => {
        if (!analyser.current) return
        analyser.current.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b) / data.length
        if (avg > 8) lastSpeechRef.current = Date.now()

        const silenceSecs = (Date.now() - lastSpeechRef.current) / 1000
        if (silenceSecs > 20 && appState === 'connected' && !isWingmanActive.current) {
          isWingmanActive.current = true
          setEmotion('shrug')
          floatEmote('🤫')
          fetchWingmanSuggestion(chatMessages).then(s => setBubble(s))
        }
        silenceTimer.current = setTimeout(check, 2000)
      }
      check()
    } catch { /* audio not available, skip */ }

    return () => {
      clearTimeout(silenceTimer.current)
      audioCtx.current?.close()
      audioCtx.current = null
      analyser.current = null
    }
  }, [localStream, appState]) // eslint-disable-line

  // ── Random excited bursts ──────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const t = setTimeout(() => {
        if (['idle', 'dance'].includes(appState === 'connected' ? 'connected' : emotion)) {
          setEmotionFor('excited', 1500)
          floatEmote(['⭐', '🔥', '💫', '✨'][Math.floor(Math.random() * 4)])
          setScale(1.2)
          setTimeout(() => setScale(1), 400)
        }
        loop()
      }, 40000 + Math.random() * 40000)
      return t
    }
    const t = loop()
    return () => clearTimeout(t)
  }, [appState, emotion, setEmotionFor, floatEmote])

  // ── Dismiss bubble on click ────────────────────────────────────────────
  const dismissBubble = () => {
    setBubble(null)
    isWingmanActive.current = false
    setEmotion('idle')
  }

  const charStyle: React.CSSProperties = {
    position: 'fixed',
    left: targetPos.x - 30,
    top: targetPos.y - 30,
    zIndex: 9998,
    pointerEvents: 'none',
    transition: 'left 1.8s cubic-bezier(0.4,0,0.2,1), top 1.8s cubic-bezier(0.4,0,0.2,1)',
    transform: `rotate(${tilt}deg) scale(${scale})`,
    transformOrigin: 'center bottom',
    transitionProperty: 'left, top',
  }

  return (
    <>
      <style>{`
        @keyframes m-bounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.05)} }
        @keyframes m-dance { 0%,100%{transform:translateX(-5px) rotate(-8deg)} 50%{transform:translateX(5px) rotate(8deg)} }
        @keyframes m-spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes m-excited { 0%{transform:translateY(0) scale(1)} 25%{transform:translateY(-20px) scale(1.2)} 50%{transform:translateY(-8px) scale(1.1)} 75%{transform:translateY(-16px) scale(1.15)} 100%{transform:translateY(0) scale(1)} }
        @keyframes m-sad { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px) scale(0.95)} }
        @keyframes m-shrug { 0%,100%{transform:rotate(0)} 33%{transform:rotate(-10deg)} 66%{transform:rotate(10deg)} }
        @keyframes m-float-up { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-30px);opacity:0} }
        @keyframes m-bubble-in { 0%{transform:scale(0) translateY(10px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes m-walk { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
        @keyframes m-sleep { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(3px) scale(0.97)} }
        .m-idle { animation: m-bounce 2s ease-in-out infinite }
        .m-dance { animation: m-dance 0.35s ease-in-out infinite }
        .m-search { animation: m-spin 0.7s linear infinite }
        .m-excited { animation: m-excited 0.5s ease-in-out 2 }
        .m-connected { animation: m-excited 0.4s ease-in-out 3 }
        .m-sad { animation: m-sad 0.6s ease-in-out 2 }
        .m-wingman { animation: m-shrug 0.5s ease-in-out 2 }
        .m-shrug { animation: m-shrug 0.6s ease-in-out 3 }
        .m-walking { animation: m-walk 0.4s ease-in-out infinite }
        .m-sleep { animation: m-sleep 3s ease-in-out infinite }
        .m-blink {}
        .m-float { animation: m-float-up 1.1s ease-out forwards; position:absolute; top:-36px; left:50%; transform:translateX(-50%); font-size:20px; pointer-events:none; }
        .m-bubble { animation: m-bubble-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; background:#141414; border:1.5px solid #ff1493; border-radius:14px; padding:8px 12px; font-size:12px; font-weight:600; color:#fff; white-space:nowrap; max-width:200px; white-space:normal; line-height:1.4; cursor:pointer; pointer-events:all; box-shadow:0 4px 20px rgba(255,20,147,0.35); }
        .m-bubble::after { content:''; position:absolute; bottom:-8px; left:20px; border:4px solid transparent; border-top-color:#ff1493; }
        .m-glow { filter: drop-shadow(0 0 8px rgba(255,20,147,0.6)); }
      `}</style>

      {/* Bubble (above character, clickable) */}
      {bubble && (
        <div
          onClick={dismissBubble}
          style={{
            position: 'fixed',
            left: targetPos.x - 80,
            top: targetPos.y - 90,
            zIndex: 9999,
            pointerEvents: 'all',
            transition: 'left 1.8s cubic-bezier(0.4,0,0.2,1), top 1.8s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div className="m-bubble" style={{ position: 'relative' }}>
            <span style={{ marginRight: 6 }}>💬</span>
            {bubble}
            <div style={{ fontSize: 10, color: '#ff69b4', marginTop: 3 }}>tap to dismiss</div>
          </div>
        </div>
      )}

      {/* Character */}
      <div style={charStyle}>
        <div style={{ position: 'relative', display: 'inline-block' }}>

          {/* Floating emoji */}
          {floating && <div className="m-float">{floating}</div>}

          {/* The character */}
          <div className={`m-${emotion} ${(emotion === 'wingman' || emotion === 'excited' || emotion === 'connected') ? 'm-glow' : ''}`}>
            <MascotFace emotion={emotion} blink={blink} />
          </div>
        </div>
      </div>
    </>
  )
}
