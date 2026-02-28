/**
 * FREAK — The mascot that lives inside freak.cool
 * - Full SVG body with arms, hands, expressive face
 * - Command-driven: window.freak.do('jumping_jacks') or /freak crazy in chat
 * - Detects dry chat & mic silence → AI wingman (Groq llama-3.1-8b-instant)
 * - Crawls the DOM, wanders between UI elements
 *
 * Available commands: thumbs_up, wave, jumping_jacks, crazy, lmao,
 *   dance, hype, heart, sleep, wink, shrug, facepalm, spin
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://freak-app-production.up.railway.app'

interface MascotProps {
  appState: 'idle' | 'searching' | 'connected' | 'disconnected'
}

type Emote =
  | 'idle' | 'walk' | 'blink' | 'sleep'
  | 'search' | 'excited' | 'connected' | 'sad'
  | 'dance' | 'wingman' | 'shrug'
  // commands
  | 'thumbs_up' | 'wave' | 'jumping_jacks' | 'crazy' | 'lmao'
  | 'hype' | 'heart' | 'wink' | 'facepalm' | 'spin'

interface Pos { x: number; y: number }

// ── DOM target finder ──────────────────────────────────────────────────────
function findTargets(): Pos[] {
  const out: Pos[] = []
  const seen = new Set<string>()
  const add = (x: number, y: number) => {
    const k = `${Math.round(x / 20)},${Math.round(y / 20)}`
    if (!seen.has(k) && x > 50 && y > 50 && x < window.innerWidth - 50 && y < window.innerHeight - 50) {
      seen.add(k); out.push({ x, y })
    }
  }
  document.querySelectorAll('button').forEach(b => {
    const r = b.getBoundingClientRect()
    if (r.width > 30 && r.height > 20 && r.top > 0) add(r.left + r.width / 2, r.top - 22)
  })
  document.querySelectorAll('video').forEach(v => {
    const r = v.getBoundingClientRect()
    if (r.width > 80) add(r.left + r.width * 0.3, r.top + 28)
  })
  return out
}

// ── Wingman API ─────────────────────────────────────────────────────────────
async function getWingmanLine(msgs: Array<{ text: string; from: string }>): Promise<string> {
  try {
    const r = await fetch(`${SERVER_URL}/api/wingman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs.slice(-6), situation: 'dry' }),
    })
    return (await r.json()).suggestion || 'Say something! 👀'
  } catch { return "Ask what they're vibing with tonight 🎯" }
}

// ── Command map ─────────────────────────────────────────────────────────────
const CMD_MAP: Record<string, Emote> = {
  thumbs_up: 'thumbs_up', thumbsup: 'thumbs_up', 'thumbs up': 'thumbs_up', good: 'thumbs_up',
  wave: 'wave', hi: 'wave', hey: 'wave', hello: 'wave',
  jumping_jacks: 'jumping_jacks', jj: 'jumping_jacks', jump: 'jumping_jacks', jumps: 'jumping_jacks',
  crazy: 'crazy', wild: 'crazy', chaos: 'crazy', insane: 'crazy',
  lmao: 'lmao', lol: 'lmao', dead: 'lmao', 'go crazy': 'crazy', 'lmao mode': 'lmao',
  hype: 'hype', hypeup: 'hype', 'hype up': 'hype', poggers: 'hype',
  heart: 'heart', love: 'heart',
  wink: 'wink', '😉': 'wink',
  facepalm: 'facepalm', smh: 'facepalm', 'face palm': 'facepalm',
  spin: 'spin', dizzy: 'spin', rotate: 'spin',
  sleep: 'sleep', zzz: 'sleep', tired: 'sleep',
  shrug: 'shrug', idk: 'shrug', dunno: 'shrug',
  dance: 'dance', vibe: 'dance', groove: 'dance',
}

function parseCommand(raw: string): Emote | null {
  const s = raw.toLowerCase().trim()
  if (CMD_MAP[s]) return CMD_MAP[s]
  for (const [k, v] of Object.entries(CMD_MAP)) {
    if (s.includes(k)) return v
  }
  return null
}

// ── SVG Arms ────────────────────────────────────────────────────────────────
function Arms({ emote }: { emote: Emote }) {
  // arm angles relative to shoulder
  const armConfigs: Record<string, { l: number; r: number; className?: string }> = {
    idle:         { l: 20,   r: -20 },
    walk:         { l: -30,  r: 30 },
    blink:        { l: 20,   r: -20 },
    sleep:        { l: 35,   r: -35 },
    search:       { l: -60,  r: -60, className: 'arms-search' },
    excited:      { l: -140, r: -140 },
    connected:    { l: -150, r: -150 },
    sad:          { l: 40,   r: -40 },
    dance:        { l: -80,  r: 20,  className: 'arms-dance' },
    wingman:      { l: -20,  r: -90 },
    shrug:        { l: -90,  r: -90, className: 'arms-shrug' },
    thumbs_up:    { l: 25,   r: -150 },
    wave:         { l: 20,   r: -130, className: 'arms-wave' },
    jumping_jacks:{ l: -150, r: -150, className: 'arms-jj' },
    crazy:        { l: -120, r: -50,  className: 'arms-crazy' },
    lmao:         { l: -30,  r: -30,  className: 'arms-lmao' },
    hype:         { l: -160, r: -160, className: 'arms-hype' },
    heart:        { l: -100, r: -100 },
    wink:         { l: 20,   r: -60 },
    facepalm:     { l: 20,   r: -70 },
    spin:         { l: -140, r: -140, className: 'arms-spin' },
  }
  const cfg = armConfigs[emote] || armConfigs.idle

  // Left arm: shoulder pivot at (14, 38), Right arm: (66, 38)
  const thumbRight = emote === 'thumbs_up'
  const heartHands = emote === 'heart'
  const facepalmRight = emote === 'facepalm'

  return (
    <g className={cfg.className}>
      {/* Left arm */}
      <g transform={`rotate(${cfg.l}, 14, 38)`}>
        <rect x="7" y="38" width="9" height="18" rx="4.5" fill="#ff1493" />
        {/* left hand */}
        <ellipse cx="11.5" cy="58" rx="6" ry="5.5" fill="#ff69b4" />
        {heartHands && <text x="8" y="62" fontSize="8">♥</text>}
      </g>
      {/* Right arm */}
      <g transform={`rotate(${cfg.r}, 66, 38)`} style={{ transformOrigin: '66px 38px' }}>
        <rect x="64" y="38" width="9" height="18" rx="4.5" fill="#ff1493" />
        {/* right hand */}
        <ellipse cx="68.5" cy="58" rx="6" ry="5.5" fill="#ff69b4" />
        {thumbRight && <text x="65" y="62" fontSize="9">👍</text>}
        {facepalmRight && <text x="63" y="57" fontSize="10">🤦</text>}
        {heartHands && <text x="65" y="62" fontSize="8">♥</text>}
      </g>
    </g>
  )
}

// ── SVG Face ────────────────────────────────────────────────────────────────
function Face({ emote, blink }: { emote: Emote; blink: boolean }) {
  const eyeClosed = blink || emote === 'sleep' || emote === 'facepalm'
  const eyeType = () => {
    if (eyeClosed) return 'closed'
    if (emote === 'connected' || emote === 'heart' || emote === 'hype') return 'heart'
    if (emote === 'excited') return 'star'
    if (emote === 'crazy') return 'spin'
    if (emote === 'lmao') return 'xeyes'
    if (emote === 'wink') return 'wink'
    if (emote === 'wingman') return 'wide'
    return 'normal'
  }

  const renderEye = (cx: number, wink = false) => {
    const t = eyeType()
    if (t === 'closed' || (wink && cx > 40)) return <line x1={cx - 5} y1="28" x2={cx + 5} y2="28" stroke="#1a001a" strokeWidth="2.5" strokeLinecap="round" />
    if (t === 'heart') return <text x={cx - 5} y="33" fontSize="10">♥</text>
    if (t === 'star') return <text x={cx - 5} y="33" fontSize="10">★</text>
    if (t === 'xeyes') return <><text x={cx - 5} y="33" fontSize="9">×</text></>
    if (t === 'spin') return <ellipse cx={cx} cy="28" rx="6" ry="6" fill="none" stroke="#1a001a" strokeWidth="2" strokeDasharray="3,2" />
    if (t === 'wink' && cx > 40) return <path d={`M${cx-5} 26 Q${cx} 31 ${cx+5} 26`} stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    if (t === 'wide') return <ellipse cx={cx} cy="28" rx="6.5" ry="7" fill="#1a001a" />
    // normal
    return (
      <>
        <ellipse cx={cx} cy="28" rx="5" ry="5.5" fill="#1a001a" />
        <ellipse cx={cx + 1.5} cy="26.5" rx="2" ry="2" fill="white" opacity="0.65" />
      </>
    )
  }

  const renderMouth = () => {
    if (emote === 'sad' || emote === 'facepalm') return <path d="M22 48 Q40 42 58 48" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    if (emote === 'excited' || emote === 'connected' || emote === 'hype' || emote === 'thumbs_up')
      return <path d="M22 44 Q40 55 58 44" stroke="#1a001a" strokeWidth="2.5" fill="#ff1493" strokeLinecap="round" />
    if (emote === 'search') return <ellipse cx="40" cy="46" rx="6" ry="6.5" fill="#1a001a" />
    if (emote === 'lmao') return <path d="M20 44 Q40 58 60 44" stroke="#1a001a" strokeWidth="2.5" fill="#ff1493" strokeLinecap="round" />
    if (emote === 'crazy') return <path d="M22 44 Q30 52 40 46 Q50 40 58 48" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    if (emote === 'wink') return <path d="M24 44 Q40 53 56 44" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    if (emote === 'shrug') return <path d="M28 46 Q40 46 52 46" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    if (emote === 'sleep') return <path d="M28 46 Q40 42 52 46" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    return <path d="M24 44 Q40 52 56 44" stroke="#1a001a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  }

  return (
    <>
      {renderEye(22, emote === 'wink')}
      {renderEye(58)}
      {renderMouth()}
      {/* blush */}
      <ellipse cx="10" cy="40" rx="7" ry="4" fill="rgba(255,100,160,0.35)" />
      <ellipse cx="70" cy="40" rx="7" ry="4" fill="rgba(255,100,160,0.35)" />
    </>
  )
}

// ── Main Mascot ─────────────────────────────────────────────────────────────
export default function Mascot({ appState }: MascotProps) {
  const [emote, setEmote] = useState<Emote>('idle')
  const [blink, setBlink] = useState(false)
  const [pos, setPos] = useState<Pos>({ x: window.innerWidth - 100, y: window.innerHeight - 100 })
  const [tilt, setTilt] = useState(0)
  const [scale, setScale] = useState(1)
  const [bubble, setBubble] = useState<string | null>(null)
  const [floating, setFloating] = useState<{ text: string; key: number } | null>(null)
  const [chatMsgs, setChatMsgs] = useState<Array<{ text: string; from: string }>>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const prevState  = useRef(appState)
  const wingmanRef = useRef(false)
  const audioCtx   = useRef<AudioContext | null>(null)
  const analyser   = useRef<AnalyserNode | null>(null)
  const blinkT     = useRef<ReturnType<typeof setTimeout>>()
  const wanderT    = useRef<ReturnType<typeof setTimeout>>()
  const exciteT    = useRef<ReturnType<typeof setTimeout>>()
  const wingmanT   = useRef<ReturnType<typeof setTimeout>>()
  const silenceT   = useRef<ReturnType<typeof setTimeout>>()
  const lastSpeech = useRef(Date.now())

  // ── helpers ──────────────────────────────────────────────────────────────
  const float = useCallback((text: string) => {
    setFloating({ text, key: Date.now() })
    setTimeout(() => setFloating(null), 1300)
  }, [])

  const doEmote = useCallback((e: Emote, ms = 2000, then: Emote = 'idle') => {
    setEmote(e); setScale(1.15); setTimeout(() => setScale(1), 200)
    if (ms > 0) setTimeout(() => setEmote(then), ms)
  }, [])

  const moveTo = useCallback((target: Pos) => {
    setTilt(target.x > pos.x ? 14 : -14)
    setEmote('walk')
    setPos(target)
    setTimeout(() => { setEmote('idle'); setTilt(0) }, 1800)
  }, [pos.x])

  // ── Custom events: chat + stream ──────────────────────────────────────────
  useEffect(() => {
    const onChat = (e: Event) => {
      const { from, text } = (e as CustomEvent).detail
      setChatMsgs(prev => [...prev.slice(-10), { from, text }])
    }
    const onStream = (e: Event) => setLocalStream((e as CustomEvent).detail)
    const onCmd    = (e: Event) => {
      const cmd = parseCommand((e as CustomEvent).detail || '')
      if (cmd) { doEmote(cmd, 3000); float(cmdFloat(cmd)) }
    }
    window.addEventListener('freak:chat', onChat)
    window.addEventListener('freak:stream', onStream)
    window.addEventListener('freak:command', onCmd)
    return () => {
      window.removeEventListener('freak:chat', onChat)
      window.removeEventListener('freak:stream', onStream)
      window.removeEventListener('freak:command', onCmd)
    }
  }, [doEmote, float])

  // ── Expose window.freak for console + chat commands ───────────────────────
  useEffect(() => {
    ;(window as any).freak = {
      do: (cmd: string) => window.dispatchEvent(new CustomEvent('freak:command', { detail: cmd })),
      help: () => console.log('🔥 Freak commands:\n' + Object.keys(CMD_MAP).join(', ')),
    }
    return () => { delete (window as any).freak }
  }, [])

  // ── Parse /freak commands from in-call chat ───────────────────────────────
  useEffect(() => {
    if (!chatMsgs.length) return
    const last = chatMsgs[chatMsgs.length - 1]
    if (!last?.text?.startsWith('/freak ')) return
    const cmd = parseCommand(last.text.replace('/freak ', '').trim())
    if (cmd) { doEmote(cmd, 3000); float(cmdFloat(cmd)) }
  }, [chatMsgs, doEmote, float])

  // ── App state reactions ───────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevState.current; prevState.current = appState
    if (appState === 'searching' && prev !== 'searching') {
      doEmote('search', 0); float('🔍')
      moveTo({ x: window.innerWidth / 2, y: window.innerHeight * 0.55 })
    }
    if (appState === 'connected' && prev !== 'connected') {
      doEmote('connected', 2500, 'idle'); float('✨')
      clearTimeout(wingmanT.current); wingmanRef.current = false; setBubble(null)
      // 12s opener if no chat
      wingmanT.current = setTimeout(async () => {
        if (chatMsgs.length || wingmanRef.current) return
        wingmanRef.current = true; doEmote('wingman', 0)
        const s = await getWingmanLine([]); setBubble(s); float('💬')
      }, 12000)
    }
    if (appState === 'disconnected' && prev !== 'disconnected') {
      doEmote('sad', 2500); float('😢')
      wingmanRef.current = false; clearTimeout(wingmanT.current); setBubble(null)
    }
    if (appState === 'idle' && prev !== 'idle') {
      doEmote('idle', 0); setBubble(null); wingmanRef.current = false
    }
  }, [appState]) // eslint-disable-line

  // ── Chat message reactions ────────────────────────────────────────────────
  useEffect(() => {
    if (!chatMsgs.length || appState !== 'connected') return
    const last = chatMsgs[chatMsgs.length - 1]
    if (last?.text?.startsWith('/freak ')) return // handled above
    wingmanRef.current = false; clearTimeout(wingmanT.current); setBubble(null)
    doEmote('dance', 800); float('💬')
    // dry timer reset
    wingmanT.current = setTimeout(async () => {
      if (appState !== 'connected' || wingmanRef.current) return
      wingmanRef.current = true; doEmote('wingman', 0)
      const chatEl = document.querySelector('[placeholder]') as HTMLElement
      if (chatEl) { const r = chatEl.getBoundingClientRect(); moveTo({ x: r.left - 50, y: r.top - 15 }) }
      const s = await getWingmanLine(chatMsgs); setBubble(s); float('💡')
    }, 35000)
  }, [chatMsgs]) // eslint-disable-line

  // ── Audio silence detection ───────────────────────────────────────────────
  useEffect(() => {
    if (!localStream || appState !== 'connected') return
    try {
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(localStream)
      const an  = ctx.createAnalyser(); an.fftSize = 256
      src.connect(an); audioCtx.current = ctx; analyser.current = an
      const data = new Uint8Array(an.frequencyBinCount)
      lastSpeech.current = Date.now()
      const tick = () => {
        if (!analyser.current) return
        analyser.current.getByteFrequencyData(data)
        if (data.reduce((a, b) => a + b) / data.length > 8) lastSpeech.current = Date.now()
        if ((Date.now() - lastSpeech.current) / 1000 > 22 && !wingmanRef.current) {
          wingmanRef.current = true; doEmote('shrug', 0); float('🤫')
          getWingmanLine(chatMsgs).then(s => setBubble(s))
        }
        silenceT.current = setTimeout(tick, 2200)
      }
      tick()
    } catch { /* audio unavailable */ }
    return () => { clearTimeout(silenceT.current); audioCtx.current?.close(); audioCtx.current = null; analyser.current = null }
  }, [localStream, appState]) // eslint-disable-line

  // ── Blink loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      blinkT.current = setTimeout(() => {
        if (!['crazy', 'spin', 'sleep'].includes(emote)) { setBlink(true); setTimeout(() => setBlink(false), 160) }
        loop()
      }, 2800 + Math.random() * 2500)
    }
    loop(); return () => clearTimeout(blinkT.current)
  }, [emote])

  // ── Wander loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      wanderT.current = setTimeout(() => {
        if (appState !== 'searching') {
          const ts = findTargets()
          const t = ts.length ? ts[Math.floor(Math.random() * ts.length)]
            : [{ x: 80, y: 80 }, { x: window.innerWidth - 80, y: 80 },
               { x: 80, y: window.innerHeight - 80 }, { x: window.innerWidth - 80, y: window.innerHeight - 80 }][Math.floor(Math.random() * 4)]
          moveTo(t)
        }
        loop()
      }, 28000 + Math.random() * 32000)
    }
    loop(); return () => clearTimeout(wanderT.current)
  }, [appState, moveTo])

  // ── Random excited bursts ─────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      exciteT.current = setTimeout(() => {
        if (appState === 'idle') { doEmote('excited', 1600); float(['⭐', '🔥', '💫', '✨'][Math.floor(Math.random() * 4)]) }
        loop()
      }, 45000 + Math.random() * 45000)
    }
    loop(); return () => clearTimeout(exciteT.current)
  }, [appState, doEmote, float])

  // ── CSS animation class ───────────────────────────────────────────────────
  const animClass = () => {
    const m: Record<string, string> = {
      idle: 'f-bounce', walk: 'f-walk', blink: 'f-bounce', sleep: 'f-sleep',
      search: 'f-spin', excited: 'f-jump', connected: 'f-jump', sad: 'f-droop',
      dance: 'f-dance', wingman: 'f-shrug', shrug: 'f-shrug',
      thumbs_up: 'f-jump', wave: 'f-bounce', jumping_jacks: 'f-jj',
      crazy: 'f-crazy', lmao: 'f-lmao', hype: 'f-hype',
      heart: 'f-jump', wink: 'f-bounce', facepalm: 'f-droop', spin: 'f-fullspin',
    }
    return m[emote] || 'f-bounce'
  }

  const glowing = ['connected', 'excited', 'hype', 'crazy', 'lmao', 'wingman'].includes(emote)

  return (
    <>
      <style>{`
        @keyframes f-bounce     { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-10px) rotate(2deg)} }
        @keyframes f-walk       { 0%,100%{transform:rotate(-7deg)} 50%{transform:rotate(7deg)} }
        @keyframes f-jump       { 0%{transform:translateY(0) scale(1)} 30%{transform:translateY(-28px) scale(1.2)} 60%{transform:translateY(-12px) scale(1.08)} 100%{transform:translateY(0) scale(1)} }
        @keyframes f-dance      { 0%,100%{transform:translateX(-6px) rotate(-8deg)} 50%{transform:translateX(6px) rotate(8deg)} }
        @keyframes f-spin       { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes f-fullspin   { 0%{transform:rotate(0) scale(1)} 50%{transform:rotate(180deg) scale(1.15)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes f-droop      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px) scale(0.94)} }
        @keyframes f-shrug      { 0%,100%{transform:rotate(0)} 33%{transform:rotate(-9deg)} 66%{transform:rotate(9deg)} }
        @keyframes f-sleep      { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(4px) scale(0.96)} }
        @keyframes f-jj         { 0%,100%{transform:translateY(0) scaleY(1)} 50%{transform:translateY(-22px) scaleY(1.1)} }
        @keyframes f-crazy      { 0%{transform:rotate(0) scale(1)} 20%{transform:rotate(25deg) scale(1.15)} 40%{transform:rotate(-20deg) scale(0.9)} 60%{transform:rotate(15deg) scale(1.2)} 80%{transform:rotate(-25deg) scale(0.95)} 100%{transform:rotate(0) scale(1)} }
        @keyframes f-lmao       { 0%,100%{transform:rotate(-10deg) translateY(0)} 25%{transform:rotate(12deg) translateY(-8px)} 50%{transform:rotate(-14deg) translateY(2px)} 75%{transform:rotate(10deg) translateY(-5px)} }
        @keyframes f-hype       { 0%{transform:translateY(0) scale(1)} 25%{transform:translateY(-35px) scale(1.25)} 50%{transform:translateY(-15px) scale(1.1)} 75%{transform:translateY(-28px) scale(1.2)} 100%{transform:translateY(0) scale(1)} }
        @keyframes arms-wave    { 0%,100%{transform:rotate(-130deg)} 50%{transform:rotate(-160deg)} }
        @keyframes arms-jj      { 0%,100%{transform:rotate(-150deg)} 50%{transform:rotate(-30deg)} }
        @keyframes arms-crazy   { 0%{transform:rotate(-120deg)} 33%{transform:rotate(40deg)} 66%{transform:rotate(-60deg)} 100%{transform:rotate(-120deg)} }
        @keyframes arms-lmao    { 0%,100%{transform:rotate(-30deg)} 50%{transform:rotate(-60deg)} }
        @keyframes arms-hype    { 0%,100%{transform:rotate(-160deg)} 50%{transform:rotate(-120deg)} }
        @keyframes arms-shrug   { 0%,100%{transform:rotate(-90deg)} 50%{transform:rotate(-70deg)} }
        @keyframes arms-search  { 0%,100%{transform:rotate(-60deg)} 50%{transform:rotate(-40deg)} }
        @keyframes arms-dance   { 0%,100%{transform:rotate(-80deg) scaleX(-1)} 50%{transform:rotate(-40deg) scaleX(-1)} }
        @keyframes f-floatup    { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-36px);opacity:0} }
        @keyframes f-bubblin    { 0%{transform:scale(0) translateY(8px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }

        .f-bounce     { animation: f-bounce 2.2s ease-in-out infinite }
        .f-walk       { animation: f-walk 0.4s ease-in-out infinite }
        .f-jump       { animation: f-jump 0.45s ease-out 3 }
        .f-dance      { animation: f-dance 0.38s ease-in-out infinite }
        .f-spin       { animation: f-spin 0.65s linear infinite }
        .f-fullspin   { animation: f-fullspin 0.7s linear infinite }
        .f-droop      { animation: f-droop 0.6s ease-in-out 2 }
        .f-shrug      { animation: f-shrug 0.55s ease-in-out 3 }
        .f-sleep      { animation: f-sleep 3.5s ease-in-out infinite }
        .f-jj         { animation: f-jj 0.45s ease-in-out infinite }
        .f-crazy      { animation: f-crazy 0.35s ease-in-out infinite }
        .f-lmao       { animation: f-lmao 0.3s ease-in-out infinite }
        .f-hype       { animation: f-hype 0.4s ease-out infinite }

        .arms-wave .right-arm  { animation: arms-wave 0.4s ease-in-out infinite }
        .arms-jj   .left-arm,
        .arms-jj   .right-arm  { animation: arms-jj 0.45s ease-in-out infinite }
        .arms-crazy .left-arm,
        .arms-crazy .right-arm { animation: arms-crazy 0.35s linear infinite }
        .arms-lmao .left-arm,
        .arms-lmao .right-arm  { animation: arms-lmao 0.3s ease-in-out infinite }
        .arms-hype .left-arm,
        .arms-hype .right-arm  { animation: arms-hype 0.4s ease-out infinite }
        .arms-shrug .left-arm,
        .arms-shrug .right-arm { animation: arms-shrug 0.55s ease-in-out infinite }
        .arms-search .left-arm,
        .arms-search .right-arm{ animation: arms-search 0.5s ease-in-out infinite }
        .arms-dance .left-arm  { animation: arms-dance 0.38s ease-in-out infinite }

        .f-glow { filter: drop-shadow(0 0 10px rgba(255,20,147,0.7)) }
        .f-float { animation: f-floatup 1.2s ease-out forwards; position:absolute; top:-40px; left:50%; transform:translateX(-50%); font-size:20px; pointer-events:none; white-space:nowrap }
        .f-bubble { animation: f-bubblin 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; background:#111; border:1.5px solid #ff1493; border-radius:14px 14px 14px 4px; padding:8px 12px; font-size:12px; font-weight:600; color:#fff; max-width:210px; line-height:1.45; cursor:pointer; pointer-events:all; box-shadow:0 4px 20px rgba(255,20,147,0.3) }
      `}</style>

      {/* Speech bubble */}
      {bubble && (
        <div onClick={() => { setBubble(null); wingmanRef.current = false; setEmote('idle') }}
          style={{ position: 'fixed', left: pos.x - 90, top: pos.y - 100, zIndex: 9999,
            transition: 'left 1.8s cubic-bezier(0.4,0,0.2,1), top 1.8s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: 'all' }}>
          <div className="f-bubble">
            <span style={{ marginRight: 6 }}>💬</span>{bubble}
            <div style={{ fontSize: 10, color: '#ff69b4', marginTop: 4 }}>tap to dismiss · /freak help</div>
          </div>
        </div>
      )}

      {/* Character */}
      <div style={{
        position: 'fixed', left: pos.x - 40, top: pos.y - 45, zIndex: 9998,
        transition: 'left 1.8s cubic-bezier(0.4,0,0.2,1), top 1.8s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: 'none',
        transform: `rotate(${tilt}deg) scale(${scale})`,
        transformOrigin: 'center bottom',
        transitionProperty: 'left, top',
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {floating && <div key={floating.key} className="f-float">{floating.text}</div>}

          <div className={`${animClass()} ${glowing ? 'f-glow' : ''}`}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block', overflow: 'visible' }}>
              <defs>
                <radialGradient id="fg" cx="40%" cy="35%">
                  <stop offset="0%" stopColor="#ff69b4" />
                  <stop offset="100%" stopColor="#ff1493" />
                </radialGradient>
              </defs>
              {/* Arms (behind body) */}
              <Arms emote={emote} />
              {/* Body */}
              <ellipse cx="40" cy="38" rx="26" ry="26" fill="url(#fg)" />
              {/* Face */}
              <Face emote={emote} blink={blink} />
            </svg>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Float emoji per command ──────────────────────────────────────────────────
function cmdFloat(cmd: Emote): string {
  const m: Record<string, string> = {
    thumbs_up: '👍', wave: '👋', jumping_jacks: '🏋️', crazy: '🤪',
    lmao: '💀', hype: '🔥', heart: '❤️', wink: '😉',
    facepalm: '🤦', spin: '💫', dance: '🕺', shrug: '🤷',
    sleep: '💤', excited: '⭐', connected: '✨',
  }
  return m[cmd] || '✨'
}
