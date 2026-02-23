import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// ─── Face mesh landmark groups ─────────────────────────────────────────────
const FACE_OVAL   = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,
                     379,378,400,377,152,148,176,149,150,136,172,58,132,93,
                     234,127,162,21,54,103,67,109]
const LEFT_EYE    = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
const RIGHT_EYE   = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]
const LIPS_OUTER  = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]

const LM_FOREHEAD    = 10
const LM_CHIN        = 152
const LM_LEFT_EAR    = 234
const LM_RIGHT_EAR   = 454
const LM_NOSE_BRIDGE = 168
const LM_NOSE_TIP    = 4
const LM_LEFT_CHEEK  = 50
const LM_RIGHT_CHEEK = 280
const LM_MOUTH_LEFT  = 61

// ─── Characters ─────────────────────────────────────────────────────────────
export interface Character {
  id: string; emoji: string; label: string; skin: string; eyeRing?: string; cheek?: string
}

export const CHARACTERS: Character[] = [
  { id: 'peanut',  emoji: '🥜', label: 'Peanut',  skin: 'rgba(196,162,82,0.95)',  eyeRing: '#8B6914' },
  { id: 'pickle',  emoji: '🥒', label: 'Pickle',  skin: 'rgba(74,124,63,0.95)',   eyeRing: '#2d5a1b' },
  { id: 'alien',   emoji: '👽', label: 'Alien',   skin: 'rgba(139,195,74,0.95)',  eyeRing: '#1a1a1a' },
  { id: 'frog',    emoji: '🐸', label: 'Frog',    skin: 'rgba(76,175,80,0.95)',   eyeRing: '#1b5e20' },
  { id: 'clown',   emoji: '🤡', label: 'Clown',   skin: 'rgba(255,255,255,0.97)', eyeRing: '#cc0000', cheek: '#ff4444' },
  { id: 'skull',   emoji: '💀', label: 'Skull',   skin: 'rgba(240,240,240,0.97)', eyeRing: '#111' },
  { id: 'ghost',   emoji: '👾', label: 'Ghost',   skin: 'rgba(120,80,200,0.92)',  eyeRing: '#ff00ff' },
  { id: 'robot',   emoji: '🤖', label: 'Robot',   skin: 'rgba(100,181,246,0.95)', eyeRing: '#0d47a1' },
  { id: 'bear',    emoji: '🐻', label: 'Bear',    skin: 'rgba(121,85,72,0.95)',   eyeRing: '#3e2723' },
  { id: 'panda',   emoji: '🐼', label: 'Panda',   skin: 'rgba(240,240,240,0.97)', eyeRing: '#111' },
  { id: 'fox',     emoji: '🦊', label: 'Fox',     skin: 'rgba(230,100,30,0.95)',  eyeRing: '#bf360c', cheek: 'rgba(255,255,255,0.75)' },
  { id: 'cat',     emoji: '🐱', label: 'Cat',     skin: 'rgba(200,180,150,0.95)', eyeRing: '#795548' },
  { id: 'devil',   emoji: '😈', label: 'Devil',   skin: 'rgba(180,30,30,0.95)',   eyeRing: '#880000' },
  { id: 'cowboy',  emoji: '🤠', label: 'Cowboy',  skin: 'rgba(210,160,100,0.95)', eyeRing: '#5d4037' },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon',  skin: 'rgba(100,50,150,0.95)',  eyeRing: '#ff9800' },
  { id: 'fire',    emoji: '🔥', label: 'Fire',    skin: 'rgba(255,100,0,0.92)',   eyeRing: '#ffcc00' },
]

// ─── Accessories ─────────────────────────────────────────────────────────────
export type AccessoryCategory = 'head' | 'face' | 'mouth' | 'neck' | 'ears'
export interface Accessory {
  id: string; emoji: string; label: string; category: AccessoryCategory
  scaleFW: number; dy: number; dx?: number; rotate?: number
}
export const ACCESSORIES: Accessory[] = [
  { id: 'halo-helmet', emoji: '🪖', label: 'Halo Helmet', category: 'head',  scaleFW: 1.5,  dy: -0.55 },
  { id: 'crown',       emoji: '👑', label: 'Crown',        category: 'head',  scaleFW: 0.95, dy: -0.48 },
  { id: 'top-hat',     emoji: '🎩', label: 'Top Hat',      category: 'head',  scaleFW: 1.0,  dy: -0.58 },
  { id: 'cap',         emoji: '🧢', label: 'Cap',          category: 'head',  scaleFW: 1.05, dy: -0.50 },
  { id: 'grad-cap',    emoji: '🎓', label: 'Grad Cap',     category: 'head',  scaleFW: 1.05, dy: -0.50 },
  { id: 'party-hat',   emoji: '🎉', label: 'Party Hat',    category: 'head',  scaleFW: 0.80, dy: -0.55 },
  { id: 'wizard-hat',  emoji: '🧙', label: 'Wizard Hat',   category: 'head',  scaleFW: 0.90, dy: -0.58 },
  { id: 'pirate-hat',  emoji: '🏴‍☠️',label: 'Pirate',       category: 'head',  scaleFW: 1.05, dy: -0.50 },
  { id: 'santa',       emoji: '🎅', label: 'Santa Hat',    category: 'head',  scaleFW: 1.0,  dy: -0.50 },
  { id: 'fedora',      emoji: '🤠', label: 'Fedora',       category: 'head',  scaleFW: 1.05, dy: -0.50 },
  { id: 'sunglasses',  emoji: '🕶️', label: 'Sunglasses',  category: 'face',  scaleFW: 0.85, dy: 0.0  },
  { id: 'glasses',     emoji: '👓', label: 'Glasses',      category: 'face',  scaleFW: 0.85, dy: 0.0  },
  { id: 'monocle',     emoji: '🧐', label: 'Monocle',      category: 'face',  scaleFW: 0.55, dy: -0.05 },
  { id: 'mask',        emoji: '😷', label: 'Mask',         category: 'face',  scaleFW: 0.85, dy: 0.15 },
  { id: 'cigarette',   emoji: '🚬', label: 'Cigarette',    category: 'mouth', scaleFW: 0.38, dy: 0.06, dx: 0.18 },
  { id: 'lollipop',    emoji: '🍭', label: 'Lollipop',     category: 'mouth', scaleFW: 0.38, dy: 0.04, dx: -0.20 },
  { id: 'straw',       emoji: '🧃', label: 'Drink',        category: 'mouth', scaleFW: 0.30, dy: 0.04, dx: -0.16 },
  { id: 'chain',       emoji: '📿', label: 'Chain',        category: 'neck',  scaleFW: 0.90, dy: 0.12 },
  { id: 'bow-tie',     emoji: '🎀', label: 'Bow Tie',      category: 'neck',  scaleFW: 0.65, dy: 0.10 },
  { id: 'tie',         emoji: '👔', label: 'Tie',          category: 'neck',  scaleFW: 0.55, dy: 0.18 },
  { id: 'mic',         emoji: '🎤', label: 'Mic',          category: 'neck',  scaleFW: 0.30, dy: 0.15, dx: 0.25 },
  { id: 'headphones',  emoji: '🎧', label: 'Headphones',   category: 'ears',  scaleFW: 1.35, dy: 0.05 },
  { id: 'earrings',    emoji: '💎', label: 'Earrings',     category: 'ears',  scaleFW: 0.20, dy: 0.15 },
]
export const ACCESSORY_CATEGORIES: { id: AccessoryCategory; label: string }[] = [
  { id: 'head',  label: '🎩 Head'  },
  { id: 'face',  label: '👓 Face'  },
  { id: 'mouth', label: '🚬 Mouth' },
  { id: 'neck',  label: '📿 Neck'  },
  { id: 'ears',  label: '🎧 Ears'  },
]

// ─── Backgrounds ─────────────────────────────────────────────────────────────
export interface Background {
  id: string; label: string; emoji: string
}
export const BACKGROUNDS: Background[] = [
  { id: 'none',   label: 'None',       emoji: '📷' },
  { id: 'blur',   label: 'Blur',       emoji: '🌫️' },
  { id: 'black',  label: 'Black',      emoji: '⬛' },
  { id: 'pink',   label: 'Freaky',     emoji: '🩷' },
  { id: 'space',  label: 'Space',      emoji: '🚀' },
  { id: 'matrix', label: 'Matrix',     emoji: '💚' },
  { id: 'gaming', label: 'Gaming',     emoji: '🎮' },
  { id: 'neon',   label: 'Neon City',  emoji: '🌆' },
  { id: 'beach',  label: 'Beach',      emoji: '🏖️' },
  { id: 'fire',   label: 'Fire',       emoji: '🔥' },
  { id: 'forest', label: 'Forest',     emoji: '🌲' },
]

// Precomputed star positions (stable — no flicker)
const STARS = Array.from({ length: 200 }, () => ({
  x: Math.random(), y: Math.random(),
  r: Math.random() * 1.8 + 0.3,
  a: 0.4 + Math.random() * 0.6,
}))

function renderBackground(ctx: CanvasRenderingContext2D, bgId: string, W: number, H: number, t: number) {
  switch (bgId) {
    case 'black': {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); break
    }
    case 'pink': {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#1a0010'); g.addColorStop(0.5, '#3d0030'); g.addColorStop(1, '#1a0020')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      // Freaky logo area
      ctx.fillStyle = 'rgba(255,20,147,0.08)'
      ctx.beginPath(); ctx.arc(W/2, H/2, H*0.45, 0, Math.PI*2); ctx.fill()
      break
    }
    case 'space': {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#000005'); g.addColorStop(1, '#000820')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      // Stars
      STARS.forEach(s => {
        const twinkle = 0.7 + 0.3 * Math.sin(t * 0.002 + s.x * 100)
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${s.a * twinkle})`; ctx.fill()
      })
      // Nebula glow
      const ng = ctx.createRadialGradient(W*0.3, H*0.4, 0, W*0.3, H*0.4, H*0.35)
      ng.addColorStop(0, 'rgba(80,0,120,0.25)'); ng.addColorStop(1, 'transparent')
      ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H)
      break
    }
    case 'matrix': {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(0,255,70,0.06)'
      const cols = 40, cw = W / cols
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 30; r++) {
          const a = Math.sin(t * 0.003 + c * 0.7 + r * 0.5) > 0.3 ? 1 : 0
          if (a) {
            ctx.fillStyle = `rgba(0,255,70,${0.04 + Math.random() * 0.08})`
            ctx.fillRect(c * cw, r * (H/30), cw-1, H/30-1)
          }
        }
      }
      // Green scanlines
      ctx.fillStyle = 'rgba(0,255,70,0.015)'
      for (let y = 0; y < H; y += 4) { ctx.fillRect(0, y, W, 2) }
      break
    }
    case 'gaming': {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#0a0015'); g.addColorStop(1, '#150030')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      // Grid floor
      ctx.strokeStyle = 'rgba(180,0,255,0.18)'; ctx.lineWidth = 1
      const gridSize = 60
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      // Neon glow circles
      ;[
        [W*0.15, H*0.25, 80, 'rgba(0,255,255,0.12)'],
        [W*0.85, H*0.7, 100, 'rgba(255,0,255,0.10)'],
        [W*0.5, H*0.85, 120, 'rgba(0,100,255,0.10)'],
      ].forEach(([x, y, r, c]) => {
        const gg = ctx.createRadialGradient(x as number, y as number, 0, x as number, y as number, r as number)
        gg.addColorStop(0, c as string); gg.addColorStop(1, 'transparent')
        ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H)
      })
      break
    }
    case 'neon': {
      // City skyline silhouette
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#000820'); g.addColorStop(0.7, '#060320'); g.addColorStop(1, '#0a0530')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      // Building silhouettes
      const buildings = [
        [0, 0.4, 0.12, 0.6], [0.1, 0.25, 0.08, 0.75], [0.17, 0.35, 0.1, 0.65],
        [0.27, 0.15, 0.07, 0.85], [0.33, 0.3, 0.12, 0.7], [0.44, 0.2, 0.09, 0.8],
        [0.52, 0.1, 0.08, 0.9], [0.6, 0.28, 0.11, 0.72], [0.7, 0.38, 0.1, 0.62],
        [0.8, 0.22, 0.09, 0.78], [0.88, 0.32, 0.12, 0.68],
      ]
      ctx.fillStyle = '#050215'
      buildings.forEach(([x, topY, w, h]) => {
        ctx.fillRect(x*W, topY*H, w*W, h*H)
      })
      // Neon window glow
      ctx.fillStyle = 'rgba(0,200,255,0.6)'
      buildings.forEach(([x, topY, w]) => {
        for (let r = 0; r < 8; r++) {
          if (Math.random() > 0.5) {
            ctx.fillRect((x + Math.random()*w*0.8)*W, (topY + Math.random()*0.5)*H, w*W*0.06, H*0.015)
          }
        }
      })
      // Horizontal neon lines
      ;['rgba(255,0,100,0.4)','rgba(0,200,255,0.3)'].forEach((c, i) => {
        const ly = H * (0.68 + i * 0.06)
        ctx.strokeStyle = c; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke()
        const sg = ctx.createLinearGradient(0, ly-8, 0, ly+8)
        sg.addColorStop(0, 'transparent'); sg.addColorStop(0.5, c.replace('0.', '0.1')); sg.addColorStop(1, 'transparent')
        ctx.fillStyle = sg; ctx.fillRect(0, ly-8, W, 16)
      })
      break
    }
    case 'beach': {
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H*0.65)
      sky.addColorStop(0, '#0077cc'); sky.addColorStop(1, '#55aaff')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H*0.65)
      // Sun
      const sun = ctx.createRadialGradient(W*0.8, H*0.2, 0, W*0.8, H*0.2, H*0.12)
      sun.addColorStop(0, '#fffaaa'); sun.addColorStop(0.3, '#ffdd44'); sun.addColorStop(1, 'transparent')
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H)
      // Ocean
      const ocean = ctx.createLinearGradient(0, H*0.62, 0, H*0.78)
      ocean.addColorStop(0, '#0088dd'); ocean.addColorStop(1, '#005599')
      ctx.fillStyle = ocean; ctx.fillRect(0, H*0.62, W, H*0.16)
      // Waves
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
      for (let w = 0; w < 4; w++) {
        ctx.beginPath()
        for (let x = 0; x <= W; x += 20) {
          const y = H*(0.65 + w*0.015) + Math.sin((x/W + t*0.001)*Math.PI*4 + w) * 5
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      // Sand
      const sand = ctx.createLinearGradient(0, H*0.78, 0, H)
      sand.addColorStop(0, '#f4d03f'); sand.addColorStop(1, '#e8b84b')
      ctx.fillStyle = sand; ctx.fillRect(0, H*0.78, W, H*0.22)
      break
    }
    case 'fire': {
      ctx.fillStyle = '#0a0000'; ctx.fillRect(0, 0, W, H)
      // Fire gradient
      for (let i = 0; i < 5; i++) {
        const fx = W * (0.1 + i * 0.2)
        const phase = t * 0.003 + i * 1.2
        const fy = H * (0.5 + 0.05 * Math.sin(phase))
        const fr = H * (0.5 + 0.1 * Math.sin(phase * 0.7))
        const fg = ctx.createRadialGradient(fx, H, 0, fx, fy, fr)
        fg.addColorStop(0, 'rgba(255,200,0,0.25)')
        fg.addColorStop(0.4, 'rgba(255,80,0,0.20)')
        fg.addColorStop(0.7, 'rgba(200,0,0,0.15)')
        fg.addColorStop(1, 'transparent')
        ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H)
      }
      // Ember particles (time-based positions)
      for (let e = 0; e < 20; e++) {
        const et = (t * 0.001 + e * 0.3) % 1
        const ex = (Math.sin(e * 2.1) * 0.5 + 0.5) * W
        const ey = H * (1 - et)
        const er = 2 + Math.sin(e * 3.7) * 1.5
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,${100 + Math.floor(et*155)},0,${0.8 - et})`; ctx.fill()
      }
      break
    }
    case 'forest': {
      // Sky through canopy
      const sky = ctx.createLinearGradient(0, 0, 0, H*0.4)
      sky.addColorStop(0, '#1a3a1a'); sky.addColorStop(1, '#2d5a2d')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)
      // Trees (simplified silhouette)
      const treeColor = '#0d2b0d'
      const trees = [[0.05, 0.15], [0.15, 0.08], [0.28, 0.12], [0.5, 0.05], [0.68, 0.1], [0.82, 0.08], [0.92, 0.15]]
      trees.forEach(([tx, topY]) => {
        const tw = 0.09
        ctx.fillStyle = treeColor
        ctx.beginPath()
        ctx.moveTo(tx*W + tw*W/2, topY*H)
        ctx.lineTo(tx*W, H*0.7)
        ctx.lineTo(tx*W + tw*W, H*0.7)
        ctx.closePath(); ctx.fill()
      })
      // Ground
      const ground = ctx.createLinearGradient(0, H*0.68, 0, H)
      ground.addColorStop(0, '#1a3a0a'); ground.addColorStop(1, '#0d2005')
      ctx.fillStyle = ground; ctx.fillRect(0, H*0.68, W, H*0.32)
      // Light rays
      for (let r = 0; r < 5; r++) {
        const rx = W * (0.2 + r * 0.16)
        const rg = ctx.createLinearGradient(rx - 30, 0, rx + 30, H*0.7)
        rg.addColorStop(0, 'rgba(150,255,100,0.06)'); rg.addColorStop(1, 'transparent')
        ctx.fillStyle = rg; ctx.fillRect(rx - 30, 0, 60, H*0.7)
      }
      break
    }
    default: break // 'none' and 'blur' handled separately
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lm(landmarks: NormalizedLandmark[], idx: number, W: number, H: number) {
  const p = landmarks[idx]
  return { x: (1 - p.x) * W, y: p.y * H }
}
function tracePoly(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[],
                   indices: number[], W: number, H: number) {
  ctx.beginPath()
  indices.forEach((i, n) => {
    const p = lm(landmarks, i, W, H)
    n === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
}
function expandPoly(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[],
                    indices: number[], W: number, H: number, expand: number) {
  const pts = indices.map(i => lm(landmarks, i, W, H))
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  ctx.beginPath()
  pts.forEach((p, n) => {
    const dx = p.x - cx, dy = p.y - cy, len = Math.sqrt(dx*dx+dy*dy) || 1
    const nx = p.x + (dx/len)*expand, ny = p.y + (dy/len)*expand
    n === 0 ? ctx.moveTo(nx, ny) : ctx.lineTo(nx, ny)
  })
  ctx.closePath()
}

// ─── Character body drawing ───────────────────────────────────────────────────
// Draws the character "body" beyond just the face oval — head + neck + shoulder area
function drawCharacterBody(ctx: CanvasRenderingContext2D, char: Character,
                           landmarks: NormalizedLandmark[], W: number, H: number) {
  const forehead  = lm(landmarks, LM_FOREHEAD, W, H)
  const chin      = lm(landmarks, LM_CHIN, W, H)
  const leftEar   = lm(landmarks, LM_LEFT_EAR, W, H)
  const rightEar  = lm(landmarks, LM_RIGHT_EAR, W, H)
  const faceH     = chin.y - forehead.y
  const faceW     = Math.abs(rightEar.x - leftEar.x)
  const faceCX    = (leftEar.x + rightEar.x) / 2

  ctx.save()

  if (char.id === 'peanut') {
    // Classic 2-bump peanut shape: upper head + pinch + lower body
    const headR  = faceW * 0.5
    const bodyR  = faceW * 0.55
    const headCY = forehead.y + faceH * 0.35
    const pinchY = chin.y + faceH * 0.12
    const bodyCY = chin.y + faceH * 0.55

    // Lower body oval
    ctx.beginPath()
    ctx.ellipse(faceCX, bodyCY, bodyR, faceH * 0.45, 0, 0, Math.PI * 2)
    ctx.fillStyle = char.skin; ctx.fill()

    // Pinch connector
    ctx.beginPath()
    ctx.ellipse(faceCX, pinchY, faceW * 0.32, faceH * 0.18, 0, 0, Math.PI * 2)
    ctx.fillStyle = char.skin; ctx.fill()

    // Upper head oval (matches face area)
    ctx.beginPath()
    ctx.ellipse(faceCX, headCY, headR * 1.05, faceH * 0.55, 0, 0, Math.PI * 2)
    ctx.fillStyle = char.skin; ctx.fill()

    // Peanut texture bumps
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    const bumps = [
      [0, -0.3], [-0.28, -0.1], [0.28, -0.1], [-0.2, 0.15], [0.2, 0.15],
      [0, 0.35], [-0.28, 0.45], [0.28, 0.45], [0, 0.65],
    ]
    bumps.forEach(([bx, by]) => {
      ctx.beginPath()
      ctx.arc(faceCX + (bx as number)*faceW*0.5, headCY + (by as number)*faceH, faceW*0.065, 0, Math.PI*2)
      ctx.fill()
    })
    // Body bumps
    const bodyBumps = [[-0.3, 0], [0, 0], [0.3, 0], [-0.2, 0.25], [0.2, 0.25]]
    bodyBumps.forEach(([bx, by]) => {
      ctx.beginPath()
      ctx.arc(faceCX + (bx as number)*faceW*0.5, bodyCY + (by as number)*faceH*0.5, faceW*0.065, 0, Math.PI*2)
      ctx.fill()
    })

  } else if (char.id === 'pickle') {
    // Elongated cylinder pickle body
    const bodyW = faceW * 0.52
    const bodyTop = forehead.y - faceH * 0.15
    const bodyH = faceH * 2.0
    ctx.beginPath()
    ctx.ellipse(faceCX, bodyTop + bodyH/2, bodyW, bodyH/2, 0, 0, Math.PI*2)
    ctx.fillStyle = char.skin; ctx.fill()
    // Pickle bumps (warts)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    for (let i = 0; i < 12; i++) {
      const bx = faceCX + (Math.cos(i * 1.3) * bodyW * 0.65)
      const by = bodyTop + (i / 12) * bodyH
      ctx.beginPath(); ctx.arc(bx, by, faceW * 0.04, 0, Math.PI*2); ctx.fill()
    }
    // Pickle top (stem)
    ctx.fillStyle = 'rgba(40,100,30,0.9)'
    ctx.fillRect(faceCX - faceW*0.06, bodyTop - faceH*0.1, faceW*0.12, faceH*0.12)

  } else if (char.id === 'alien') {
    // Elongated alien head + slender body
    const alienW = faceW * 0.5
    ctx.beginPath()
    ctx.ellipse(faceCX, forehead.y - faceH * 0.15, alienW, faceH * 0.72, 0, 0, Math.PI*2)
    ctx.fillStyle = char.skin; ctx.fill()
    // Slender body/neck
    ctx.beginPath()
    ctx.ellipse(faceCX, chin.y + faceH * 0.45, faceW * 0.28, faceH * 0.45, 0, 0, Math.PI*2)
    ctx.fillStyle = char.skin; ctx.fill()

  } else {
    // Generic: draw neck + shoulder extension below chin
    const neckW = faceW * 0.35
    const shoulderW = faceW * 0.75
    const neckTop = chin.y
    const neckH = faceH * 0.25
    const shoulderH = faceH * 0.2

    // Neck rectangle
    ctx.fillStyle = char.skin
    ctx.fillRect(faceCX - neckW/2, neckTop, neckW, neckH)
    // Shoulder ellipse
    ctx.beginPath()
    ctx.ellipse(faceCX, neckTop + neckH + shoulderH/2, shoulderW/2, shoulderH/2, 0, 0, Math.PI*2)
    ctx.fill()
  }

  ctx.restore()
}

// ─── Accessories ─────────────────────────────────────────────────────────────
function drawAccessories(ctx: CanvasRenderingContext2D, accessoryIds: string[],
                          landmarks: NormalizedLandmark[], W: number, H: number) {
  if (!accessoryIds.length) return
  const forehead   = lm(landmarks, LM_FOREHEAD,    W, H)
  const chin       = lm(landmarks, LM_CHIN,        W, H)
  const leftEar    = lm(landmarks, LM_LEFT_EAR,    W, H)
  const rightEar   = lm(landmarks, LM_RIGHT_EAR,   W, H)
  const noseBridge = lm(landmarks, LM_NOSE_BRIDGE, W, H)
  const noseTip    = lm(landmarks, LM_NOSE_TIP,    W, H)
  const mouthL     = lm(landmarks, LM_MOUTH_LEFT,  W, H)
  const faceH      = chin.y - forehead.y
  const faceW      = Math.abs(rightEar.x - leftEar.x)
  const faceCX     = (leftEar.x + rightEar.x) / 2
  const accs       = ACCESSORIES.filter(a => accessoryIds.includes(a.id))
  ctx.save()
  accs.forEach(acc => {
    const size = faceW * acc.scaleFW
    let ax = faceCX + (acc.dx ?? 0) * faceW, ay: number
    switch (acc.category) {
      case 'head':  ax = forehead.x; ay = forehead.y + faceH * acc.dy; break
      case 'face':
        if (acc.id === 'monocle') { ax = noseTip.x + faceW*0.15; ay = noseBridge.y + faceH*acc.dy }
        else if (acc.id === 'mask' || acc.id === 'clown-nose') { ax = noseTip.x; ay = noseTip.y + faceH*acc.dy }
        else { ax = noseBridge.x; ay = noseBridge.y + faceH*acc.dy }
        break
      case 'mouth': ax = mouthL.x + faceW*(acc.dx ?? 0); ay = mouthL.y + faceH*acc.dy; break
      case 'neck':  ax = chin.x + faceW*(acc.dx ?? 0);   ay = chin.y + faceH*acc.dy;   break
      case 'ears':  ax = faceCX; ay = ((leftEar.y+rightEar.y)/2) + faceH*acc.dy;       break
    }
    ctx.font = `${size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (acc.rotate) {
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(acc.rotate*Math.PI/180)
      ctx.fillText(acc.emoji, 0, 0); ctx.restore()
    } else { ctx.fillText(acc.emoji, ax, ay) }
  })
  ctx.restore()
}

// ─── Character decorations (ears, whiskers, etc.) ────────────────────────────
function drawDecorations(ctx: CanvasRenderingContext2D, char: Character,
                          landmarks: NormalizedLandmark[], W: number, H: number) {
  const forehead = lm(landmarks, LM_FOREHEAD, W, H)
  const leftEar  = lm(landmarks, LM_LEFT_EAR, W, H)
  const rightEar = lm(landmarks, LM_RIGHT_EAR, W, H)
  const chin     = lm(landmarks, LM_CHIN, W, H)
  const noseTip  = lm(landmarks, LM_NOSE_TIP, W, H)
  const faceH    = chin.y - forehead.y
  const earR     = faceH * 0.13
  ctx.save()
  switch (char.id) {
    case 'cat': {
      const earH = faceH*0.28, earW = faceH*0.14
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath(); ctx.moveTo(ear.x-earW,ear.y); ctx.lineTo(ear.x+earW,ear.y); ctx.lineTo(ear.x,ear.y-earH); ctx.closePath()
        ctx.fillStyle = char.skin; ctx.fill()
        ctx.beginPath(); ctx.moveTo(ear.x-earW*0.5,ear.y-earH*0.1); ctx.lineTo(ear.x+earW*0.5,ear.y-earH*0.1); ctx.lineTo(ear.x,ear.y-earH*0.75); ctx.closePath()
        ctx.fillStyle = 'rgba(255,150,150,0.7)'; ctx.fill()
      })
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2
      ;[-1,1].forEach(side => {
        const wx = noseTip.x + side*faceH*0.05
        for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.moveTo(wx,noseTip.y+i*faceH*0.03); ctx.lineTo(wx+side*faceH*0.22,noseTip.y+i*faceH*0.05); ctx.stroke() }
      }); break
    }
    case 'bear': {
      ;[leftEar,rightEar].forEach(ear => {
        ctx.beginPath(); ctx.arc(ear.x,ear.y-earR*0.5,earR,0,Math.PI*2); ctx.fillStyle=char.skin; ctx.fill()
        ctx.beginPath(); ctx.arc(ear.x,ear.y-earR*0.5,earR*0.55,0,Math.PI*2); ctx.fillStyle='rgba(80,50,30,0.9)'; ctx.fill()
      })
      ctx.beginPath(); ctx.ellipse(noseTip.x,noseTip.y,faceH*0.07,faceH*0.05,0,0,Math.PI*2); ctx.fillStyle='#1a0a00'; ctx.fill(); break
    }
    case 'panda': {
      ;[leftEar,rightEar].forEach(ear => {
        ctx.beginPath(); ctx.arc(ear.x,ear.y-earR*0.5,earR,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill()
      })
      const leye=lm(landmarks,468,W,H),reye=lm(landmarks,473,W,H)
      ;[leye,reye].forEach(eye => { ctx.beginPath(); ctx.arc(eye.x,eye.y,faceH*0.13,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill() })
      ctx.beginPath(); ctx.ellipse(noseTip.x,noseTip.y,faceH*0.06,faceH*0.04,0,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill(); break
    }
    case 'frog': {
      const eyeR = faceH*0.14
      ;[leftEar,rightEar].forEach((ear, idx) => {
        const ex=idx===0?leftEar.x+faceH*0.08:rightEar.x-faceH*0.08, ey=forehead.y-eyeR*0.6
        ctx.beginPath(); ctx.arc(ex,ey,eyeR,0,Math.PI*2); ctx.fillStyle='#4CAF50'; ctx.fill()
        ctx.beginPath(); ctx.arc(ex,ey,eyeR*0.6,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill()
        ctx.beginPath(); ctx.arc(ex,ey,eyeR*0.3,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill()
        ctx.beginPath(); ctx.arc(ex-eyeR*0.1,ey-eyeR*0.15,eyeR*0.12,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill()
      })
      ;[-1,1].forEach(side => { ctx.beginPath(); ctx.arc(noseTip.x+side*faceH*0.04,noseTip.y,faceH*0.025,0,Math.PI*2); ctx.fillStyle='#1b5e20'; ctx.fill() }); break
    }
    case 'alien': {
      ;[-1,1].forEach(side => { ctx.beginPath(); ctx.ellipse(noseTip.x+side*faceH*0.03,noseTip.y,faceH*0.015,faceH*0.035,0.3,0,Math.PI*2); ctx.fillStyle='rgba(0,60,0,0.8)'; ctx.fill() }); break
    }
    case 'devil': {
      ;[leftEar,rightEar].forEach(ear => {
        ctx.beginPath(); ctx.moveTo(ear.x-faceH*0.07,ear.y-faceH*0.05); ctx.lineTo(ear.x+faceH*0.07,ear.y-faceH*0.05); ctx.lineTo(ear.x,ear.y-faceH*0.33); ctx.closePath()
        ctx.fillStyle='#c62828'; ctx.fill()
      }); break
    }
    case 'clown': {
      ctx.beginPath(); ctx.arc(noseTip.x,noseTip.y,faceH*0.075,0,Math.PI*2)
      const g=ctx.createRadialGradient(noseTip.x-faceH*0.025,noseTip.y-faceH*0.025,0,noseTip.x,noseTip.y,faceH*0.075)
      g.addColorStop(0,'#ff6666'); g.addColorStop(1,'#cc0000'); ctx.fillStyle=g; ctx.fill()
      const lc=lm(landmarks,LM_LEFT_CHEEK,W,H),rc=lm(landmarks,LM_RIGHT_CHEEK,W,H)
      ;[lc,rc].forEach(c => { ctx.beginPath(); ctx.arc(c.x,c.y,faceH*0.09,0,Math.PI*2); ctx.fillStyle='rgba(255,70,70,0.5)'; ctx.fill() })
      const colors=['#f00','#f80','#ff0','#0c0','#00f','#80f']
      const hairY=forehead.y-faceH*0.05, hairW=faceH*0.55
      colors.forEach((col,i) => { const hx=(forehead.x-hairW/2)+(i+0.5)*(hairW/colors.length); ctx.beginPath(); ctx.arc(hx,hairY,faceH*0.07,Math.PI,0); ctx.fillStyle=col; ctx.fill() }); break
    }
    case 'robot': {
      ctx.strokeStyle='#0d47a1'; ctx.lineWidth=faceH*0.025
      ctx.beginPath(); ctx.moveTo(forehead.x,forehead.y-faceH*0.02); ctx.lineTo(forehead.x,forehead.y-faceH*0.22); ctx.stroke()
      ctx.beginPath(); ctx.arc(forehead.x,forehead.y-faceH*0.24,faceH*0.04,0,Math.PI*2); ctx.fillStyle='#f44336'; ctx.fill()
      ;[leftEar,rightEar].forEach(ear => {
        ctx.beginPath(); ctx.arc(ear.x,ear.y,faceH*0.04,0,Math.PI*2); ctx.fillStyle='#0d47a1'; ctx.fill()
        ctx.beginPath(); ctx.arc(ear.x,ear.y,faceH*0.025,0,Math.PI*2); ctx.fillStyle='#bbdefb'; ctx.fill()
      }); break
    }
    case 'skull': {
      ;[-1,1].forEach(side => { ctx.beginPath(); ctx.ellipse(noseTip.x+side*faceH*0.04,noseTip.y,faceH*0.028,faceH*0.045,0,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill() })
      ctx.beginPath(); ctx.ellipse(forehead.x,forehead.y,faceH*0.22,faceH*0.12,0,Math.PI,0); ctx.fillStyle='rgba(240,240,240,0.97)'; ctx.fill(); break
    }
    case 'cowboy': {
      const brimW=faceH*0.65,crownW=faceH*0.38,crownH=faceH*0.28,hatY=forehead.y-faceH*0.04
      ctx.beginPath(); ctx.ellipse(forehead.x,hatY,brimW/2,faceH*0.08,0,0,Math.PI*2); ctx.fillStyle='#5d4037'; ctx.fill()
      ctx.beginPath(); if(ctx.roundRect)ctx.roundRect(forehead.x-crownW/2,hatY-crownH,crownW,crownH,faceH*0.06); ctx.fillStyle='#6d4c41'; ctx.fill()
      ctx.fillStyle='#3e2723'; ctx.fillRect(forehead.x-crownW/2,hatY-crownH*0.22,crownW,crownH*0.18); break
    }
    default: break
  }
  ctx.restore()
}

function drawCheeks(ctx: CanvasRenderingContext2D, char: Character,
                    landmarks: NormalizedLandmark[], W: number, H: number) {
  if (!char.cheek) return
  const lc=lm(landmarks,LM_LEFT_CHEEK,W,H),rc=lm(landmarks,LM_RIGHT_CHEEK,W,H)
  const faceH=(lm(landmarks,LM_CHIN,W,H).y-lm(landmarks,LM_FOREHEAD,W,H).y)
  ctx.save()
  ;[lc,rc].forEach(c => { ctx.beginPath(); ctx.arc(c.x,c.y,faceH*0.1,0,Math.PI*2); ctx.fillStyle=char.cheek!; ctx.fill() })
  ctx.restore()
}

function drawNameTag(ctx: CanvasRenderingContext2D, char: Character,
                     landmarks: NormalizedLandmark[], W: number, H: number) {
  const chin=lm(landmarks,LM_CHIN,W,H)
  // Name tag y is pushed down to clear the body
  const tagY = chin.y + (lm(landmarks,LM_CHIN,W,H).y-lm(landmarks,LM_FOREHEAD,W,H).y)*0.15
  const text=char.label.toUpperCase()
  ctx.font='bold 16px sans-serif'
  const tw=ctx.measureText(text).width,px=12,py=6,r=11,bw=tw+px*2,bh=16+py*2
  const bx=chin.x-bw/2
  ctx.fillStyle='rgba(0,0,0,0.65)'
  ctx.beginPath(); if(ctx.roundRect)ctx.roundRect(bx,tagY,bw,bh,r); else ctx.rect(bx,tagY,bw,bh); ctx.fill()
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(text,chin.x,tagY+bh/2)
}

// ─── Main hook ────────────────────────────────────────────────────────────────
interface UseCharacterOverlayOptions {
  localStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
}

export function useCharacterOverlay({ localStream }: UseCharacterOverlayOptions) {
  const [activeCharacter,    setActiveCharacter]    = useState<Character | null>(null)
  const [activeAccessories,  setActiveAccessories]  = useState<string[]>([])
  const [activeBackground,   setActiveBackground]   = useState<string>('none')

  const canvasRef         = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef   = useRef<MediaStream | null>(null)
  const rafRef            = useRef<number | null>(null)
  const activeCharRef     = useRef<Character | null>(null)
  const activeAccRef      = useRef<string[]>([])
  const activeBgRef       = useRef<string>('none')
  const landmarkerRef     = useRef<FaceLandmarker | null>(null)
  const landmarkerReady   = useRef(false)
  const segmenterRef      = useRef<ImageSegmenter | null>(null)
  const segmenterReady    = useRef(false)

  useEffect(() => { activeCharRef.current  = activeCharacter    }, [activeCharacter])
  useEffect(() => { activeAccRef.current   = activeAccessories  }, [activeAccessories])
  useEffect(() => { activeBgRef.current    = activeBackground   }, [activeBackground])

  // ── Init MediaPipe models ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        // FaceLandmarker
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO', numFaces: 1,
          outputFaceBlendshapes: false,
          minFaceDetectionConfidence: 0.5, minFacePresenceScore: 0.5, minTrackingConfidence: 0.5,
        })
        // ImageSegmenter (for background replacement)
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        })
        if (!cancelled) {
          landmarkerRef.current  = fl;  landmarkerReady.current  = true
          segmenterRef.current   = seg; segmenterReady.current   = true
        }
      } catch (e) { console.warn('[FaceFilter] MediaPipe init failed', e) }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Canvas render loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStream) return

    const canvas = document.createElement('canvas')
    canvas.width = 1280; canvas.height = 720
    canvasRef.current = canvas
    canvasStreamRef.current = canvas.captureStream(30)
    const ctx = canvas.getContext('2d')!

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = 1280; maskCanvas.height = 720
    const mctx = maskCanvas.getContext('2d')!

    // Segmentation canvas for person cutout
    const segCanvas = document.createElement('canvas')
    segCanvas.width = 1280; segCanvas.height = 720
    const sctx = segCanvas.getContext('2d')!

    const vid = document.createElement('video')
    vid.srcObject = localStream; vid.autoplay = true; vid.muted = true
    vid.playsInline = true; vid.play().catch(() => {})
    const W = canvas.width, H = canvas.height

    const draw = () => {
      const char  = activeCharRef.current
      const accs  = activeAccRef.current
      const bg    = activeBgRef.current
      const ready = vid.readyState >= 2
      const t     = performance.now()

      if (!ready) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
        rafRef.current = requestAnimationFrame(draw); return
      }

      // ── Background layer ──────────────────────────────────────────────
      if (bg === 'none') {
        // Normal mirrored video
        ctx.save(); ctx.translate(W,0); ctx.scale(-1,1); ctx.drawImage(vid,0,0,W,H); ctx.restore()

      } else if (bg === 'blur') {
        // Blurred background, then sharp person on top
        ctx.save(); ctx.filter = 'blur(18px)'
        ctx.translate(W,0); ctx.scale(-1,1); ctx.drawImage(vid,0,0,W,H)
        ctx.restore()
        // Overlay sharp person using segmentation mask
        if (segmenterReady.current && segmenterRef.current) {
          try {
            const result = segmenterRef.current.segmentForVideo(vid, t)
            const maskData = result.confidenceMasks![0].getAsFloat32Array()
            sctx.save(); sctx.translate(W,0); sctx.scale(-1,1); sctx.drawImage(vid,0,0,W,H); sctx.restore()
            const fd = sctx.getImageData(0,0,W,H)
            for (let i = 0; i < maskData.length; i++) { fd.data[i*4+3] = Math.round(maskData[i]*255) }
            sctx.putImageData(fd, 0, 0)
            ctx.drawImage(segCanvas, 0, 0)
          } catch (_) { /* skip frame */ }
        }

      } else {
        // Preset background + person cutout via segmentation
        renderBackground(ctx, bg, W, H, t)
        if (segmenterReady.current && segmenterRef.current) {
          try {
            const result = segmenterRef.current.segmentForVideo(vid, t)
            const maskData = result.confidenceMasks![0].getAsFloat32Array()
            sctx.save(); sctx.translate(W,0); sctx.scale(-1,1); sctx.drawImage(vid,0,0,W,H); sctx.restore()
            const fd = sctx.getImageData(0,0,W,H)
            for (let i = 0; i < maskData.length; i++) { fd.data[i*4+3] = Math.round(maskData[i]*255) }
            sctx.putImageData(fd, 0, 0)
            ctx.drawImage(segCanvas, 0, 0)
          } catch (_) { /* skip frame */ }
        } else {
          // Fallback: just show mirrored video
          ctx.save(); ctx.translate(W,0); ctx.scale(-1,1); ctx.drawImage(vid,0,0,W,H); ctx.restore()
        }
      }

      // ── Character + accessories on top of video/bg ────────────────────
      const hasFilter = !!char || accs.length > 0
      if (hasFilter && landmarkerReady.current && landmarkerRef.current) {
        let landmarks: NormalizedLandmark[] | null = null
        try {
          const result = landmarkerRef.current.detectForVideo(vid, t)
          landmarks = result.faceLandmarks[0] ?? null
        } catch (_) {}

        if (landmarks) {
          if (char) {
            // Character body (extended shape beyond face oval)
            drawCharacterBody(ctx, char, landmarks, W, H)

            // Face mask on offscreen canvas with eye/mouth cutouts
            mctx.clearRect(0, 0, W, H)
            drawCheeks(mctx as unknown as CanvasRenderingContext2D, char, landmarks, W, H)
            mctx.fillStyle = char.skin
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, FACE_OVAL, W, H); mctx.fill()
            if (char.eyeRing) {
              const expand = (lm(landmarks,LM_CHIN,W,H).y-lm(landmarks,LM_FOREHEAD,W,H).y)*0.025
              mctx.fillStyle = char.eyeRing
              expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,  W, H, expand); mctx.fill()
              expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE, W, H, expand); mctx.fill()
            }
            mctx.globalCompositeOperation = 'destination-out'
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,   W, H); mctx.fill()
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE,  W, H); mctx.fill()
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LIPS_OUTER, W, H); mctx.fill()
            mctx.globalCompositeOperation = 'source-over'
            ctx.drawImage(maskCanvas, 0, 0)
            drawDecorations(ctx, char, landmarks, W, H)
            drawNameTag(ctx, char, landmarks, W, H)
          }
          if (accs.length > 0) drawAccessories(ctx, accs, landmarks, W, H)
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '15px sans-serif'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('Move into frame', W/2, H*0.92)
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      vid.srcObject = null; canvasStreamRef.current = null; canvasRef.current = null
    }
  }, [localStream])

  const getCanvasVideoTrack = useCallback((): MediaStreamTrack | null => canvasStreamRef.current?.getVideoTracks()[0] ?? null, [])
  const getCanvasStream     = useCallback((): MediaStream | null => canvasStreamRef.current, [])
  const selectCharacter     = useCallback((char: Character | null) => setActiveCharacter(char), [])
  const toggleAccessory     = useCallback((id: string) =>
    setActiveAccessories(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]), [])
  const clearAccessories    = useCallback(() => setActiveAccessories([]), [])
  const selectBackground    = useCallback((id: string) => setActiveBackground(id), [])

  return {
    activeCharacter, selectCharacter,
    activeAccessories, toggleAccessory, clearAccessories,
    activeBackground, selectBackground,
    getCanvasVideoTrack, getCanvasStream,
    CHARACTERS,
  }
}
