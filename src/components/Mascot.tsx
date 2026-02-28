import { useState, useEffect, useRef } from 'react'

interface MascotProps {
  appState: 'idle' | 'searching' | 'connected' | 'disconnected'
  newChat?: boolean
}

type MascotEmotion = 'idle' | 'blink' | 'searching' | 'connected' | 'disconnected' | 'excited' | 'dancing' | 'sleeping'

const CORNERS = [
  { bottom: '24px', right: '24px', left: 'auto', top: 'auto' },
  { bottom: '24px', left: '24px', right: 'auto', top: 'auto' },
  { top: '80px', right: '24px', left: 'auto', bottom: 'auto' },
  { top: '80px', left: '24px', right: 'auto', bottom: 'auto' },
]

export default function Mascot({ appState, newChat }: MascotProps) {
  const [emotion, setEmotion] = useState<MascotEmotion>('idle')
  const [pos, setPos] = useState(0)
  const [visible, setVisible] = useState(true)
  const [zFloat, setZFloat] = useState(false)
  const prevAppState = useRef(appState)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>()
  const wanderTimer = useRef<ReturnType<typeof setTimeout>>()
  const exciteTimer = useRef<ReturnType<typeof setTimeout>>()

  // React to appState changes
  useEffect(() => {
    const prev = prevAppState.current
    prevAppState.current = appState

    if (appState === 'searching' && prev !== 'searching') {
      setEmotion('searching')
    } else if (appState === 'connected' && prev !== 'connected') {
      setEmotion('connected')
      setTimeout(() => setEmotion('idle'), 2500)
    } else if (appState === 'disconnected' && prev !== 'disconnected') {
      setEmotion('disconnected')
      setTimeout(() => setEmotion('idle'), 2000)
    } else if (appState === 'idle' && prev !== 'idle') {
      setEmotion('idle')
    }
  }, [appState])

  // React to new chat messages
  useEffect(() => {
    if (newChat && appState === 'connected') {
      setEmotion('dancing')
      setTimeout(() => setEmotion('idle'), 1500)
    }
  }, [newChat, appState])

  // Random blink while idle
  useEffect(() => {
    const blinkLoop = () => {
      idleTimer.current = setTimeout(() => {
        if (emotion === 'idle') {
          setEmotion('blink')
          setTimeout(() => setEmotion('idle'), 300)
        }
        blinkLoop()
      }, 2500 + Math.random() * 2000)
    }
    blinkLoop()
    return () => clearTimeout(idleTimer.current)
  }, [emotion])

  // Random excited burst every 30-60s while idle
  useEffect(() => {
    const exciteLoop = () => {
      exciteTimer.current = setTimeout(() => {
        if (appState === 'idle') {
          setEmotion('excited')
          setZFloat(true)
          setTimeout(() => {
            setEmotion('idle')
            setZFloat(false)
          }, 1800)
        }
        exciteLoop()
      }, 30000 + Math.random() * 30000)
    }
    exciteLoop()
    return () => clearTimeout(exciteTimer.current)
  }, [appState])

  // Wander to new corner every 60-90s
  useEffect(() => {
    const wanderLoop = () => {
      wanderTimer.current = setTimeout(() => {
        setPos(p => {
          const choices = [0, 1, 2, 3].filter(i => i !== p)
          return choices[Math.floor(Math.random() * choices.length)]
        })
        wanderLoop()
      }, 60000 + Math.random() * 30000)
    }
    wanderLoop()
    return () => clearTimeout(wanderTimer.current)
  }, [])

  const corner = CORNERS[pos]

  const eyes = () => {
    if (emotion === 'blink' || emotion === 'sleeping') return '—  —'
    if (emotion === 'connected') return '♥  ♥'
    if (emotion === 'disconnected') return '╥  ╥'
    if (emotion === 'excited') return '★  ★'
    if (emotion === 'searching') return '◉  ◉'
    return '●  ●'
  }

  const mouth = () => {
    if (emotion === 'disconnected') return '︵'
    if (emotion === 'connected' || emotion === 'excited') return '◡'
    if (emotion === 'searching') return '○'
    return '‿'
  }

  const getAnimation = () => {
    if (emotion === 'searching') return 'mascot-spin 0.6s linear infinite'
    if (emotion === 'connected') return 'mascot-jump 0.4s ease-out 3'
    if (emotion === 'excited') return 'mascot-jump 0.3s ease-out 4'
    if (emotion === 'dancing') return 'mascot-dance 0.3s ease-in-out 4'
    if (emotion === 'disconnected') return 'mascot-droop 0.5s ease-in-out'
    return 'mascot-bounce 2s ease-in-out infinite'
  }

  return (
    <>
      <style>{`
        @keyframes mascot-bounce {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes mascot-jump {
          0% { transform: translateY(0px) scale(1); }
          30% { transform: translateY(-28px) scale(1.15); }
          60% { transform: translateY(-14px) scale(1.05); }
          100% { transform: translateY(0px) scale(1); }
        }
        @keyframes mascot-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes mascot-dance {
          0%, 100% { transform: translateX(0px) rotate(-5deg); }
          50% { transform: translateX(6px) rotate(5deg); }
        }
        @keyframes mascot-droop {
          0% { transform: translateY(0px); }
          40% { transform: translateY(6px) scale(0.95); }
          100% { transform: translateY(0px); }
        }
        @keyframes mascot-float {
          0%, 100% { transform: translateY(0px); opacity: 1; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
        @keyframes mascot-sparkle {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.5) rotate(45deg); opacity: 0; }
        }
        .mascot-wrapper {
          position: fixed;
          z-index: 9999;
          pointer-events: none;
          transition: top 1.5s cubic-bezier(.4,0,.2,1), bottom 1.5s cubic-bezier(.4,0,.2,1), left 1.5s cubic-bezier(.4,0,.2,1), right 1.5s cubic-bezier(.4,0,.2,1);
          user-select: none;
        }
        .mascot-body {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #ff1493 0%, #ff69b4 100%);
          border-radius: 50% 50% 48% 52% / 55% 55% 45% 45%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(255,20,147,0.45), 0 0 0 2px rgba(255,20,147,0.2);
          position: relative;
          gap: 2px;
        }
        .mascot-eyes {
          font-size: 11px;
          color: #1a001a;
          letter-spacing: 3px;
          line-height: 1;
          font-weight: 900;
        }
        .mascot-mouth {
          font-size: 13px;
          color: #1a001a;
          line-height: 1;
          font-weight: 900;
        }
        .mascot-cheeks {
          position: absolute;
          bottom: 14px;
          width: 100%;
          display: flex;
          justify-content: space-between;
          padding: 0 6px;
          pointer-events: none;
        }
        .mascot-cheek {
          width: 10px;
          height: 6px;
          background: rgba(255,100,170,0.55);
          border-radius: 50%;
        }
        .mascot-float-text {
          position: absolute;
          top: -28px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 16px;
          animation: mascot-float 1.2s ease-out forwards;
          pointer-events: none;
        }
        .mascot-sparkle {
          position: absolute;
          font-size: 14px;
          animation: mascot-sparkle 0.8s ease-out forwards;
          pointer-events: none;
        }
      `}</style>

      <div
        className="mascot-wrapper"
        style={{
          bottom: corner.bottom,
          top: corner.top,
          left: corner.left,
          right: corner.right,
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* Float indicators */}
          {emotion === 'searching' && (
            <div className="mascot-float-text">?</div>
          )}
          {emotion === 'connected' && (
            <>
              <div className="mascot-float-text" style={{ animationDelay: '0s' }}>✨</div>
              <span className="mascot-sparkle" style={{ top: '-10px', left: '-10px', animationDelay: '0.1s' }}>⭐</span>
              <span className="mascot-sparkle" style={{ top: '-10px', right: '-10px', animationDelay: '0.2s' }}>✨</span>
            </>
          )}
          {emotion === 'excited' && (
            <>
              <span className="mascot-sparkle" style={{ top: '-14px', left: '-8px', animationDelay: '0s' }}>⭐</span>
              <span className="mascot-sparkle" style={{ top: '-14px', right: '-8px', animationDelay: '0.15s' }}>✨</span>
              <span className="mascot-sparkle" style={{ top: '-24px', left: '50%', animationDelay: '0.05s' }}>💫</span>
            </>
          )}
          {emotion === 'sleeping' && (
            <div className="mascot-float-text" style={{ fontSize: 12 }}>Zzz</div>
          )}

          {/* Body */}
          <div
            className="mascot-body"
            style={{ animation: getAnimation() }}
          >
            <div className="mascot-eyes">{eyes()}</div>
            <div className="mascot-mouth">{mouth()}</div>
            <div className="mascot-cheeks">
              <div className="mascot-cheek" />
              <div className="mascot-cheek" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
