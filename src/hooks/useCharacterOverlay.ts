import { useEffect, useRef, useState, useCallback } from 'react'

export interface Character {
  id: string
  emoji: string
  label: string
  bgColor: string
}

export const CHARACTERS: Character[] = [
  { id: 'pickle',  emoji: '🥒', label: 'Pickle',  bgColor: '#2d5a1b' },
  { id: 'peanut',  emoji: '🥜', label: 'Peanut',  bgColor: '#8B6914' },
  { id: 'alien',   emoji: '👽', label: 'Alien',   bgColor: '#1a3a1a' },
  { id: 'clown',   emoji: '🤡', label: 'Clown',   bgColor: '#8B0000' },
  { id: 'ghost',   emoji: '👾', label: 'Ghost',   bgColor: '#2a0a4a' },
  { id: 'frog',    emoji: '🐸', label: 'Frog',    bgColor: '#1a4a1a' },
  { id: 'skull',   emoji: '💀', label: 'Skull',   bgColor: '#1a1a1a' },
  { id: 'robot',   emoji: '🤖', label: 'Robot',   bgColor: '#0a2a3a' },
  { id: 'bear',    emoji: '🐻', label: 'Bear',    bgColor: '#3a2010' },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon',  bgColor: '#1a0a2a' },
  { id: 'fox',     emoji: '🦊', label: 'Fox',     bgColor: '#5a2a00' },
  { id: 'panda',   emoji: '🐼', label: 'Panda',   bgColor: '#1a1a1a' },
  { id: 'cat',     emoji: '🐱', label: 'Cat',     bgColor: '#3a3a2a' },
  { id: 'devil',   emoji: '😈', label: 'Devil',   bgColor: '#4a0000' },
  { id: 'cowboy',  emoji: '🤠', label: 'Cowboy',  bgColor: '#3a2000' },
  { id: 'fire',    emoji: '🔥', label: 'Fire',    bgColor: '#4a1a00' },
]

interface UseCharacterOverlayOptions {
  localStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
}

export function useCharacterOverlay({ localStream, videoRef }: UseCharacterOverlayOptions) {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const activeCharacterRef = useRef<Character | null>(null)

  // Keep ref in sync for RAF loop
  useEffect(() => { activeCharacterRef.current = activeCharacter }, [activeCharacter])

  // Main render loop — runs whenever localStream exists
  useEffect(() => {
    if (!localStream) return

    // Create canvas matching video dimensions (default HD)
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    canvasRef.current = canvas

    // Create canvas stream at 30fps
    canvasStreamRef.current = canvas.captureStream(30)

    const ctx = canvas.getContext('2d')!
    const sourceVideo = document.createElement('video')
    sourceVideo.srcObject = localStream
    sourceVideo.autoplay = true
    sourceVideo.muted = true
    sourceVideo.playsInline = true
    sourceVideo.play().catch(() => {})

    const draw = () => {
      const char = activeCharacterRef.current

      if (!char) {
        // No character — just draw the video frame (mirrored)
        if (sourceVideo.readyState >= 2) {
          ctx.save()
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        }
      } else {
        // Draw darkened background from video
        if (sourceVideo.readyState >= 2) {
          ctx.save()
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        }

        // Dark overlay to de-emphasize the background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Character emoji — large, centered, upper portion (face position)
        const emojiSize = Math.min(canvas.width, canvas.height) * 0.55
        const centerX = canvas.width / 2
        const centerY = canvas.height * 0.42

        // Colored glow circle behind character
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, emojiSize * 0.7)
        gradient.addColorStop(0, char.bgColor + 'cc')
        gradient.addColorStop(1, char.bgColor + '00')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(centerX, centerY, emojiSize * 0.7, 0, Math.PI * 2)
        ctx.fill()

        // Draw emoji
        ctx.font = `${emojiSize}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(char.emoji, centerX, centerY)

        // Character name tag at bottom
        const tagPad = 16
        const tagH = 42
        const tagY = canvas.height - tagH - 20
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        const tagW = ctx.measureText(char.label).width + tagPad * 2 + 10
        const tagX = (canvas.width - tagW) / 2
        ctx.beginPath()
        const r = tagH / 2
        ctx.moveTo(tagX + r, tagY)
        ctx.lineTo(tagX + tagW - r, tagY)
        ctx.arcTo(tagX + tagW, tagY, tagX + tagW, tagY + tagH, r)
        ctx.lineTo(tagX + tagW, tagY + tagH - r)
        ctx.arcTo(tagX + tagW, tagY + tagH, tagX + tagW - r, tagY + tagH, r)
        ctx.lineTo(tagX + r, tagY + tagH)
        ctx.arcTo(tagX, tagY + tagH, tagX, tagY + tagH - r, r)
        ctx.lineTo(tagX, tagY + r)
        ctx.arcTo(tagX, tagY, tagX + r, tagY, r)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 22px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(char.label, canvas.width / 2, tagY + tagH / 2)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      sourceVideo.srcObject = null
      canvasStreamRef.current = null
      canvasRef.current = null
    }
  }, [localStream])

  // Get the canvas video track (to replace WebRTC track)
  const getCanvasVideoTrack = useCallback((): MediaStreamTrack | null => {
    if (!canvasStreamRef.current) return null
    return canvasStreamRef.current.getVideoTracks()[0] ?? null
  }, [])

  // Get canvas stream for local preview
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
