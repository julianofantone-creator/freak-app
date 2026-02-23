import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

export interface Character {
  id: string
  emoji: string
  label: string
}

export const CHARACTERS: Character[] = [
  { id: 'pickle',  emoji: '🥒', label: 'Pickle'  },
  { id: 'peanut',  emoji: '🥜', label: 'Peanut'  },
  { id: 'alien',   emoji: '👽', label: 'Alien'   },
  { id: 'clown',   emoji: '🤡', label: 'Clown'   },
  { id: 'ghost',   emoji: '👾', label: 'Ghost'   },
  { id: 'frog',    emoji: '🐸', label: 'Frog'    },
  { id: 'skull',   emoji: '💀', label: 'Skull'   },
  { id: 'robot',   emoji: '🤖', label: 'Robot'   },
  { id: 'bear',    emoji: '🐻', label: 'Bear'    },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon'  },
  { id: 'fox',     emoji: '🦊', label: 'Fox'     },
  { id: 'panda',   emoji: '🐼', label: 'Panda'   },
  { id: 'cat',     emoji: '🐱', label: 'Cat'     },
  { id: 'devil',   emoji: '😈', label: 'Devil'   },
  { id: 'cowboy',  emoji: '🤠', label: 'Cowboy'  },
  { id: 'fire',    emoji: '🔥', label: 'Fire'    },
]

interface UseCharacterOverlayOptions {
  localStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
}

export function useCharacterOverlay({ localStream }: UseCharacterOverlayOptions) {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const activeCharacterRef = useRef<Character | null>(null)
  const detectorRef = useRef<FaceDetector | null>(null)
  const detectorReadyRef = useRef(false)
  const lastDetectionRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const smoothRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  // Keep character ref in sync for RAF loop
  useEffect(() => { activeCharacterRef.current = activeCharacter }, [activeCharacter])

  // Init MediaPipe FaceDetector once
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        })
        if (!cancelled) {
          detectorRef.current = detector
          detectorReadyRef.current = true
        }
      } catch (err) {
        console.warn('[FaceDetector] init failed — falling back to centered emoji', err)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Main canvas render loop
  useEffect(() => {
    if (!localStream) return

    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    canvasRef.current = canvas
    canvasStreamRef.current = canvas.captureStream(30)

    const ctx = canvas.getContext('2d')!

    const sourceVideo = document.createElement('video')
    sourceVideo.srcObject = localStream
    sourceVideo.autoplay = true
    sourceVideo.muted = true
    sourceVideo.playsInline = true
    sourceVideo.play().catch(() => {})

    // Lerp helper for smooth tracking
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const draw = () => {
      const char = activeCharacterRef.current
      const ready = sourceVideo.readyState >= 2
      const W = canvas.width
      const H = canvas.height

      // Always draw mirrored video frame
      if (ready) {
        ctx.save()
        ctx.translate(W, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(sourceVideo, 0, 0, W, H)
        ctx.restore()
      } else {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
      }

      if (char && ready) {
        // Run face detection ~every frame in VIDEO mode
        if (detectorReadyRef.current && detectorRef.current) {
          try {
            const result = detectorRef.current.detectForVideo(sourceVideo, performance.now())
            const det = result.detections[0]
            if (det?.boundingBox) {
              const box = det.boundingBox
              const vw = sourceVideo.videoWidth || W
              const vh = sourceVideo.videoHeight || H
              const scaleX = W / vw
              const scaleY = H / vh

              // Mirror X because canvas is drawn mirrored
              const rawX = (vw - box.originX - box.width) * scaleX
              const rawY = box.originY * scaleY
              const rawW = box.width * scaleX
              const rawH = box.height * scaleY

              lastDetectionRef.current = { x: rawX, y: rawY, w: rawW, h: rawH }
            }
          } catch (_) { /* ignore per-frame errors */ }
        }

        // Smooth tracking — interpolate toward last known face position
        const target = lastDetectionRef.current
        if (target) {
          const prev = smoothRef.current ?? target
          const t = 0.25 // smoothing factor (0=no move, 1=instant)
          smoothRef.current = {
            x: lerp(prev.x, target.x, t),
            y: lerp(prev.y, target.y, t),
            w: lerp(prev.w, target.w, t),
            h: lerp(prev.h, target.h, t),
          }
        }

        const face = smoothRef.current

        let cx: number, cy: number, emojiSize: number

        if (face) {
          // Face detected — emoji goes ON the face
          cx = face.x + face.w / 2
          cy = face.y + face.h / 2 - face.h * 0.08 // slightly up (forehead area)
          emojiSize = Math.max(face.w, face.h) * 1.5
        } else {
          // No face detected — center fallback, smaller
          cx = W / 2
          cy = H * 0.4
          emojiSize = Math.min(W, H) * 0.35
          // Subtle "searching" indicator
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.font = '14px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('Move into frame', W / 2, H * 0.88)
        }

        // Draw emoji on face
        ctx.font = `${emojiSize}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(char.emoji, cx, cy)

        // Name tag pill below face
        const tagText = char.label.toUpperCase()
        ctx.font = 'bold 18px sans-serif'
        const textW = ctx.measureText(tagText).width
        const tagPadX = 14
        const tagPadY = 8
        const tagH = 18 + tagPadY * 2
        const tagW = textW + tagPadX * 2
        const tagX = cx - tagW / 2
        const tagY = face ? face.y + face.h + 8 : cy + emojiSize * 0.55 + 8

        const rr = tagH / 2
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.beginPath()
        ctx.moveTo(tagX + rr, tagY)
        ctx.lineTo(tagX + tagW - rr, tagY)
        ctx.arcTo(tagX + tagW, tagY, tagX + tagW, tagY + tagH, rr)
        ctx.lineTo(tagX + tagW, tagY + tagH - rr)
        ctx.arcTo(tagX + tagW, tagY + tagH, tagX + tagW - rr, tagY + tagH, rr)
        ctx.lineTo(tagX + rr, tagY + tagH)
        ctx.arcTo(tagX, tagY + tagH, tagX, tagY + tagH - rr, rr)
        ctx.lineTo(tagX, tagY + rr)
        ctx.arcTo(tagX, tagY, tagX + rr, tagY, rr)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(tagText, cx, tagY + tagH / 2)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      sourceVideo.srcObject = null
      canvasStreamRef.current = null
      canvasRef.current = null
      smoothRef.current = null
      lastDetectionRef.current = null
    }
  }, [localStream])

  const getCanvasVideoTrack = useCallback((): MediaStreamTrack | null => {
    return canvasStreamRef.current?.getVideoTracks()[0] ?? null
  }, [])

  const getCanvasStream = useCallback((): MediaStream | null => {
    return canvasStreamRef.current
  }, [])

  const selectCharacter = useCallback((char: Character | null) => {
    setActiveCharacter(char)
  }, [])

  return {
    activeCharacter,
    selectCharacter,
    getCanvasVideoTrack,
    getCanvasStream,
    CHARACTERS,
  }
}
