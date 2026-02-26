import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props { active: boolean }

function playBoom() {
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate

    // ── Low rumble (the "BOOM" body) ─────────────────────────────
    const bufLen = sr * 0.8
    const buf = ctx.createBuffer(1, bufLen, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      // white noise decaying rapidly
      data[i] = (Math.random() * 2 - 1) * Math.pow(Math.max(0, 1 - i / (bufLen * 0.6)), 1.2)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf

    // Low-pass — makes it feel like a real explosion not just static
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(600, ctx.currentTime)
    lp.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5)

    // Big gain punch
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7)

    noise.connect(lp); lp.connect(gain); gain.connect(ctx.destination)
    noise.start()

    // ── High crack (the initial impact "crack") ──────────────────
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.2)
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(2, ctx.currentTime)
    oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
    osc.connect(oscGain); oscGain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.2)
  } catch { /* AudioContext blocked — silent fallback */ }
}

export default function ExplosionOverlay({ active }: Props) {
  useEffect(() => { if (active) playBoom() }, [active])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="absolute inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.7 }}
        >
          {/* White flash — the initial impact */}
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          />

          {/* Expanding fireball */}
          <motion.div
            className="absolute inset-0 rounded-none"
            style={{
              background: 'radial-gradient(circle, #FFF176 0%, #FF8C00 25%, #FF3D00 55%, #B71C1C 75%, transparent 90%)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 0.6, 2.5], opacity: [0, 1, 0] }}
            transition={{ duration: 0.65, times: [0, 0.2, 1], ease: 'easeOut' }}
          />

          {/* Shockwave ring */}
          <motion.div
            className="absolute w-32 h-32 rounded-full border-4 border-orange-400"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: [0, 4, 8], opacity: [0.8, 0.4, 0] }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute w-32 h-32 rounded-full border-2 border-yellow-300"
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: [0, 3, 7], opacity: [0.6, 0.3, 0] }}
            transition={{ duration: 0.55, delay: 0.05, ease: 'easeOut' }}
          />

          {/* The emoji — big and fast */}
          <motion.div
            className="text-[10rem] select-none relative z-10 drop-shadow-2xl"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: [0, 2.2, 1.8], rotate: [0, 15, -8, 0] }}
            transition={{ duration: 0.4, times: [0, 0.35, 1], ease: 'backOut' }}
          >
            💥
          </motion.div>

          {/* Debris particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-sm"
              style={{ background: ['#FF8C00','#FF3D00','#FFF176','#B71C1C'][i % 4] }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i / 12) * Math.PI * 2) * (120 + Math.random() * 100),
                y: Math.sin((i / 12) * Math.PI * 2) * (120 + Math.random() * 100),
                opacity: 0,
                scale: 0.2,
                rotate: Math.random() * 720,
              }}
              transition={{ duration: 0.6 + Math.random() * 0.3, ease: 'easeOut' }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
