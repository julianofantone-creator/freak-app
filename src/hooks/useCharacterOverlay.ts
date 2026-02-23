import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// ─── Face mesh landmark index groups ──────────────────────────────────────────
const FACE_OVAL   = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,
                     379,378,400,377,152,148,176,149,150,136,172,58,132,93,
                     234,127,162,21,54,103,67,109]
const LEFT_EYE    = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
const RIGHT_EYE   = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]
const LIPS_OUTER  = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]

// Key single-point landmarks
const LM_FOREHEAD    = 10   // top center of face/forehead
const LM_CHIN        = 152  // bottom of chin
const LM_LEFT_EAR    = 234  // left ear tragus (mirrored: appears on right of screen)
const LM_RIGHT_EAR   = 454  // right ear tragus
const LM_LEFT_BROW   = 107  // left eyebrow outer
const LM_RIGHT_BROW  = 336  // right eyebrow outer
const LM_NOSE_TIP    = 4
const LM_LEFT_CHEEK  = 50
const LM_RIGHT_CHEEK = 280

// ─── Character definitions ────────────────────────────────────────────────────
export interface Character {
  id: string
  emoji: string
  label: string
  skin: string          // face fill color (rgba)
  eyeRing?: string      // colored ring drawn around eye cutouts
  cheek?: string        // cheek patch color (optional)
}

export const CHARACTERS: Character[] = [
  { id: 'peanut',  emoji: '🥜', label: 'Peanut',  skin: 'rgba(196,162,82,0.93)',  eyeRing: '#8B6914' },
  { id: 'pickle',  emoji: '🥒', label: 'Pickle',  skin: 'rgba(74,124,63,0.93)',   eyeRing: '#2d5a1b' },
  { id: 'alien',   emoji: '👽', label: 'Alien',   skin: 'rgba(139,195,74,0.95)',  eyeRing: '#1a1a1a' },
  { id: 'frog',    emoji: '🐸', label: 'Frog',    skin: 'rgba(76,175,80,0.93)',   eyeRing: '#1b5e20' },
  { id: 'clown',   emoji: '🤡', label: 'Clown',   skin: 'rgba(255,255,255,0.95)', eyeRing: '#cc0000', cheek: '#ff4444' },
  { id: 'skull',   emoji: '💀', label: 'Skull',   skin: 'rgba(240,240,240,0.95)', eyeRing: '#111' },
  { id: 'ghost',   emoji: '👾', label: 'Ghost',   skin: 'rgba(120,80,200,0.90)',  eyeRing: '#ff00ff' },
  { id: 'robot',   emoji: '🤖', label: 'Robot',   skin: 'rgba(100,181,246,0.93)', eyeRing: '#0d47a1' },
  { id: 'bear',    emoji: '🐻', label: 'Bear',    skin: 'rgba(121,85,72,0.93)',   eyeRing: '#3e2723' },
  { id: 'panda',   emoji: '🐼', label: 'Panda',   skin: 'rgba(240,240,240,0.95)', eyeRing: '#111',   cheek: '#111' },
  { id: 'fox',     emoji: '🦊', label: 'Fox',     skin: 'rgba(230,100,30,0.93)',  eyeRing: '#bf360c', cheek: 'rgba(255,255,255,0.75)' },
  { id: 'cat',     emoji: '🐱', label: 'Cat',     skin: 'rgba(200,180,150,0.93)', eyeRing: '#795548' },
  { id: 'devil',   emoji: '😈', label: 'Devil',   skin: 'rgba(180,30,30,0.93)',   eyeRing: '#880000' },
  { id: 'cowboy',  emoji: '🤠', label: 'Cowboy',  skin: 'rgba(210,160,100,0.93)', eyeRing: '#5d4037' },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon',  skin: 'rgba(100,50,150,0.93)',  eyeRing: '#ff9800' },
  { id: 'fire',    emoji: '🔥', label: 'Fire',    skin: 'rgba(255,100,0,0.90)',   eyeRing: '#ffcc00' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Convert normalized landmark to mirrored canvas pixel coords */
function lm(landmarks: NormalizedLandmark[], idx: number, W: number, H: number) {
  const p = landmarks[idx]
  return { x: (1 - p.x) * W, y: p.y * H }
}

/** Trace a closed polygon path from landmark indices */
function tracePoly(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[],
                   indices: number[], W: number, H: number) {
  ctx.beginPath()
  indices.forEach((i, n) => {
    const p = lm(landmarks, i, W, H)
    n === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
}

/** Expand a polygon radially outward by `px` pixels */
function expandPoly(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[],
                    indices: number[], W: number, H: number, expand: number) {
  const pts = indices.map(i => lm(landmarks, i, W, H))
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  ctx.beginPath()
  pts.forEach((p, n) => {
    const dx = p.x - cx, dy = p.y - cy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = p.x + (dx / len) * expand
    const ny = p.y + (dy / len) * expand
    n === 0 ? ctx.moveTo(nx, ny) : ctx.lineTo(nx, ny)
  })
  ctx.closePath()
}

// ─── Per-character decorations ────────────────────────────────────────────────
function drawDecorations(
  ctx: CanvasRenderingContext2D,
  char: Character,
  landmarks: NormalizedLandmark[],
  W: number, H: number
) {
  const forehead = lm(landmarks, LM_FOREHEAD, W, H)
  const leftEar  = lm(landmarks, LM_LEFT_EAR, W, H)
  const rightEar = lm(landmarks, LM_RIGHT_EAR, W, H)
  const chin     = lm(landmarks, LM_CHIN, W, H)
  const noseTip  = lm(landmarks, LM_NOSE_TIP, W, H)

  // Face height for sizing decorations
  const faceH = chin.y - forehead.y
  const earR  = faceH * 0.13

  ctx.save()

  switch (char.id) {

    case 'cat': {
      // Pointy cat ears (triangles above head)
      const earH = faceH * 0.28
      const earW = faceH * 0.14
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.moveTo(ear.x - earW, ear.y)
        ctx.lineTo(ear.x + earW, ear.y)
        ctx.lineTo(ear.x, ear.y - earH)
        ctx.closePath()
        ctx.fillStyle = char.skin
        ctx.fill()
        // Inner ear
        ctx.beginPath()
        ctx.moveTo(ear.x - earW * 0.5, ear.y - earH * 0.1)
        ctx.lineTo(ear.x + earW * 0.5, ear.y - earH * 0.1)
        ctx.lineTo(ear.x, ear.y - earH * 0.75)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,150,150,0.7)'
        ctx.fill()
      })
      // Whiskers
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ;[-1, 1].forEach(side => {
        const wx = noseTip.x + side * faceH * 0.05
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.moveTo(wx, noseTip.y + i * faceH * 0.03)
          ctx.lineTo(wx + side * faceH * 0.22, noseTip.y + i * faceH * 0.05)
          ctx.stroke()
        }
      })
      break
    }

    case 'bear': {
      // Round bear ears
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.arc(ear.x, ear.y - earR * 0.5, earR, 0, Math.PI * 2)
        ctx.fillStyle = char.skin
        ctx.fill()
        ctx.beginPath()
        ctx.arc(ear.x, ear.y - earR * 0.5, earR * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(80,50,30,0.9)'
        ctx.fill()
      })
      // Bear nose
      ctx.beginPath()
      ctx.ellipse(noseTip.x, noseTip.y, faceH * 0.07, faceH * 0.05, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#1a0a00'
      ctx.fill()
      break
    }

    case 'panda': {
      // Round panda ears (black)
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.arc(ear.x, ear.y - earR * 0.5, earR, 0, Math.PI * 2)
        ctx.fillStyle = '#111'
        ctx.fill()
      })
      // Panda eye patches (black circles around the eye cutouts — drawn behind so video shows through)
      const leye = lm(landmarks, 468, W, H) // rough left eye center
      const reye = lm(landmarks, 473, W, H) // rough right eye center
      ;[leye, reye].forEach(eye => {
        ctx.beginPath()
        ctx.arc(eye.x, eye.y, faceH * 0.13, 0, Math.PI * 2)
        ctx.fillStyle = '#222'
        ctx.fill()
      })
      // Panda nose
      ctx.beginPath()
      ctx.ellipse(noseTip.x, noseTip.y, faceH * 0.06, faceH * 0.04, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#222'
      ctx.fill()
      break
    }

    case 'frog': {
      // Frog: big bulging eyes on top of head
      const eyeR = faceH * 0.14
      ;[leftEar, rightEar].forEach((ear, idx) => {
        const ex = idx === 0 ? leftEar.x + faceH * 0.08 : rightEar.x - faceH * 0.08
        const ey = forehead.y - eyeR * 0.6
        ctx.beginPath()
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2)
        ctx.fillStyle = '#4CAF50'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(ex, ey, eyeR * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(ex, ey, eyeR * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = '#111'
        ctx.fill()
        // Shine
        ctx.beginPath()
        ctx.arc(ex - eyeR * 0.1, ey - eyeR * 0.15, eyeR * 0.12, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fill()
      })
      // Nostril dots
      ;[-1, 1].forEach(side => {
        ctx.beginPath()
        ctx.arc(noseTip.x + side * faceH * 0.04, noseTip.y, faceH * 0.025, 0, Math.PI * 2)
        ctx.fillStyle = '#1b5e20'
        ctx.fill()
      })
      break
    }

    case 'alien': {
      // Alien: elongated dome head, large angled "eye shadow" marks
      // Elongated cranium
      ctx.beginPath()
      ctx.ellipse(forehead.x, forehead.y - faceH * 0.18, faceH * 0.18, faceH * 0.25, 0, Math.PI, 0)
      ctx.fillStyle = char.skin
      ctx.fill()
      // Nostril slits
      ;[-1, 1].forEach(side => {
        ctx.beginPath()
        ctx.ellipse(noseTip.x + side * faceH * 0.03, noseTip.y, faceH * 0.015, faceH * 0.035, 0.3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,60,0,0.8)'
        ctx.fill()
      })
      break
    }

    case 'devil': {
      // Horns
      ;[leftEar, rightEar].forEach(ear => {
        const hx = ear.x
        const hy = ear.y - faceH * 0.05
        ctx.beginPath()
        ctx.moveTo(hx - faceH * 0.07, hy)
        ctx.lineTo(hx + faceH * 0.07, hy)
        ctx.lineTo(hx, hy - faceH * 0.28)
        ctx.closePath()
        ctx.fillStyle = '#c62828'
        ctx.fill()
        // Horn highlight
        ctx.beginPath()
        ctx.moveTo(hx + faceH * 0.02, hy)
        ctx.lineTo(hx + faceH * 0.06, hy)
        ctx.lineTo(hx + faceH * 0.02, hy - faceH * 0.2)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,100,100,0.5)'
        ctx.fill()
      })
      break
    }

    case 'clown': {
      // Red nose ball
      ctx.beginPath()
      ctx.arc(noseTip.x, noseTip.y, faceH * 0.075, 0, Math.PI * 2)
      const noseGrad = ctx.createRadialGradient(
        noseTip.x - faceH * 0.025, noseTip.y - faceH * 0.025, 0,
        noseTip.x, noseTip.y, faceH * 0.075
      )
      noseGrad.addColorStop(0, '#ff6666')
      noseGrad.addColorStop(1, '#cc0000')
      ctx.fillStyle = noseGrad
      ctx.fill()
      // Cheek circles
      const lc = lm(landmarks, LM_LEFT_CHEEK, W, H)
      const rc = lm(landmarks, LM_RIGHT_CHEEK, W, H)
      ;[lc, rc].forEach(c => {
        ctx.beginPath()
        ctx.arc(c.x, c.y, faceH * 0.09, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,70,70,0.5)'
        ctx.fill()
      })
      // Wiggly hair above head (drawn as colorful semicircles)
      const colors = ['#ff0000','#ff8800','#ffff00','#00cc00','#0000ff','#8800ff']
      const hairY = forehead.y - faceH * 0.05
      const hairW = faceH * 0.55
      colors.forEach((col, i) => {
        const hx = (forehead.x - hairW / 2) + (i + 0.5) * (hairW / colors.length)
        ctx.beginPath()
        ctx.arc(hx, hairY, faceH * 0.07, Math.PI, 0)
        ctx.fillStyle = col
        ctx.fill()
      })
      break
    }

    case 'robot': {
      // Antenna
      ctx.strokeStyle = '#0d47a1'
      ctx.lineWidth = faceH * 0.025
      ctx.beginPath()
      ctx.moveTo(forehead.x, forehead.y - faceH * 0.02)
      ctx.lineTo(forehead.x, forehead.y - faceH * 0.22)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(forehead.x, forehead.y - faceH * 0.24, faceH * 0.04, 0, Math.PI * 2)
      ctx.fillStyle = '#f44336'
      ctx.fill()
      // Panel bolts at temples
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.arc(ear.x, ear.y, faceH * 0.04, 0, Math.PI * 2)
        ctx.fillStyle = '#0d47a1'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(ear.x, ear.y, faceH * 0.025, 0, Math.PI * 2)
        ctx.fillStyle = '#bbdefb'
        ctx.fill()
      })
      break
    }

    case 'skull': {
      // Skull: dark eye sockets around the eye cutouts, nostril holes
      ;[-1, 1].forEach(side => {
        ctx.beginPath()
        ctx.ellipse(noseTip.x + side * faceH * 0.04, noseTip.y, faceH * 0.028, faceH * 0.045, 0, 0, Math.PI * 2)
        ctx.fillStyle = '#111'
        ctx.fill()
      })
      // Cranium dome
      ctx.beginPath()
      ctx.ellipse(forehead.x, forehead.y, faceH * 0.22, faceH * 0.12, 0, Math.PI, 0)
      ctx.fillStyle = 'rgba(240,240,240,0.95)'
      ctx.fill()
      // Tooth lines at chin area
      const toothY = chin.y - faceH * 0.08
      const toothW = faceH * 0.055
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#111' : 'transparent'
        ctx.fillRect(forehead.x + i * toothW - toothW / 2, toothY, toothW, faceH * 0.07)
      }
      break
    }

    case 'cowboy': {
      // Cowboy hat
      const brimW = faceH * 0.65
      const brimH = faceH * 0.08
      const crownW = faceH * 0.38
      const crownH = faceH * 0.28
      const hatY = forehead.y - faceH * 0.04
      // Brim
      ctx.beginPath()
      ctx.ellipse(forehead.x, hatY, brimW / 2, brimH, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#5d4037'
      ctx.fill()
      // Crown
      ctx.beginPath()
      ctx.roundRect(forehead.x - crownW / 2, hatY - crownH, crownW, crownH, faceH * 0.06)
      ctx.fillStyle = '#6d4c41'
      ctx.fill()
      // Band
      ctx.fillStyle = '#3e2723'
      ctx.fillRect(forehead.x - crownW / 2, hatY - crownH * 0.22, crownW, crownH * 0.18)
      break
    }

    default:
      break
  }

  ctx.restore()
}

// ─── Cheek patches ────────────────────────────────────────────────────────────
function drawCheeks(
  ctx: CanvasRenderingContext2D,
  char: Character,
  landmarks: NormalizedLandmark[],
  W: number, H: number
) {
  if (!char.cheek) return
  const lc = lm(landmarks, LM_LEFT_CHEEK, W, H)
  const rc = lm(landmarks, LM_RIGHT_CHEEK, W, H)
  const faceH = (lm(landmarks, LM_CHIN, W, H).y - lm(landmarks, LM_FOREHEAD, W, H).y)
  ctx.save()
  ;[lc, rc].forEach(c => {
    ctx.beginPath()
    ctx.arc(c.x, c.y, faceH * 0.1, 0, Math.PI * 2)
    ctx.fillStyle = char.cheek!
    ctx.fill()
  })
  ctx.restore()
}

// ─── Name tag ─────────────────────────────────────────────────────────────────
function drawNameTag(ctx: CanvasRenderingContext2D, char: Character,
                     landmarks: NormalizedLandmark[], W: number, H: number) {
  const chin = lm(landmarks, LM_CHIN, W, H)
  const text = char.label.toUpperCase()
  ctx.font = 'bold 16px sans-serif'
  const tw = ctx.measureText(text).width
  const px = 12, py = 6, r = 11
  const bw = tw + px * 2, bh = 16 + py * 2
  const bx = chin.x - bw / 2, by = chin.y + 8
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, r)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, chin.x, by + bh / 2)
}

// ─── Main hook ────────────────────────────────────────────────────────────────
interface UseCharacterOverlayOptions {
  localStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
}

export function useCharacterOverlay({ localStream }: UseCharacterOverlayOptions) {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null)
  const canvasRef        = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef  = useRef<MediaStream | null>(null)
  const rafRef           = useRef<number | null>(null)
  const activeCharRef    = useRef<Character | null>(null)
  const landmarkerRef    = useRef<FaceLandmarker | null>(null)
  const landmarkerReady  = useRef(false)

  useEffect(() => { activeCharRef.current = activeCharacter }, [activeCharacter])

  // ── Init MediaPipe FaceLandmarker once ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode:               'VIDEO',
          numFaces:                  1,
          outputFaceBlendshapes:     false,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceScore:       0.5,
          minTrackingConfidence:      0.5,
        })
        if (!cancelled) {
          landmarkerRef.current  = fl
          landmarkerReady.current = true
        }
      } catch (e) {
        console.warn('[FaceLandmarker] init failed — emoji fallback', e)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Canvas render loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStream) return

    const canvas  = document.createElement('canvas')
    canvas.width  = 1280
    canvas.height = 720
    canvasRef.current      = canvas
    canvasStreamRef.current = canvas.captureStream(30)

    const ctx = canvas.getContext('2d')!

    // Offscreen canvas for face mask compositing (punch eye/mouth holes)
    const maskCanvas  = document.createElement('canvas')
    maskCanvas.width  = 1280
    maskCanvas.height = 720
    const mctx = maskCanvas.getContext('2d')!

    const vid = document.createElement('video')
    vid.srcObject  = localStream
    vid.autoplay   = true
    vid.muted      = true
    vid.playsInline = true
    vid.play().catch(() => {})

    const W = canvas.width
    const H = canvas.height

    const draw = () => {
      const char = activeCharRef.current
      const ready = vid.readyState >= 2

      // ── Draw mirrored video frame ──
      if (ready) {
        ctx.save()
        ctx.translate(W, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(vid, 0, 0, W, H)
        ctx.restore()
      } else {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
      }

      if (char && ready && landmarkerReady.current && landmarkerRef.current) {
        let landmarks: NormalizedLandmark[] | null = null
        try {
          const result = landmarkerRef.current.detectForVideo(vid, performance.now())
          landmarks = result.faceLandmarks[0] ?? null
        } catch (_) {}

        if (landmarks) {
          // ── Build face mask on offscreen canvas ──────────────────────────
          mctx.clearRect(0, 0, W, H)

          // 1. Cheek patches (drawn first, behind face skin)
          drawCheeks(mctx as unknown as CanvasRenderingContext2D, char, landmarks, W, H)

          // 2. Face skin (character color polygon over face oval)
          mctx.fillStyle = char.skin
          tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, FACE_OVAL, W, H)
          mctx.fill()

          // 3. Eye ring decoration (colored border around eye cutouts)
          if (char.eyeRing) {
            const ringExpand = (lm(landmarks, LM_CHIN, W, H).y - lm(landmarks, LM_FOREHEAD, W, H).y) * 0.025
            mctx.fillStyle = char.eyeRing
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,  W, H, ringExpand)
            mctx.fill()
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE, W, H, ringExpand)
            mctx.fill()
          }

          // 4. Punch eye cutouts — video shows through
          mctx.globalCompositeOperation = 'destination-out'
          tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,  W, H)
          mctx.fill()
          tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE, W, H)
          mctx.fill()

          // 5. Punch mouth cutout — teeth/expressions show through
          tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LIPS_OUTER, W, H)
          mctx.fill()

          mctx.globalCompositeOperation = 'source-over'

          // ── Composite face mask over main canvas ─────────────────────────
          ctx.drawImage(maskCanvas, 0, 0)

          // ── Character decorations on main canvas ─────────────────────────
          drawDecorations(ctx, char, landmarks, W, H)

          // ── Name tag ─────────────────────────────────────────────────────
          drawNameTag(ctx, char, landmarks, W, H)

        } else {
          // No face detected — small hint
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.font = '15px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('Move into frame', W / 2, H * 0.92)
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      vid.srcObject = null
      canvasStreamRef.current = null
      canvasRef.current       = null
    }
  }, [localStream])

  const getCanvasVideoTrack = useCallback(
    (): MediaStreamTrack | null => canvasStreamRef.current?.getVideoTracks()[0] ?? null, [])

  const getCanvasStream = useCallback(
    (): MediaStream | null => canvasStreamRef.current, [])

  const selectCharacter = useCallback((char: Character | null) => {
    setActiveCharacter(char)
  }, [])

  return { activeCharacter, selectCharacter, getCanvasVideoTrack, getCanvasStream, CHARACTERS }
}
