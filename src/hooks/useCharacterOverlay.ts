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
    // TheBurntPeanut — classic 2-bump peanut with burnt/roasted look
    const headR  = faceW * 0.50
    const bodyR  = faceW * 0.55
    const headCY = forehead.y + faceH * 0.35
    const pinchY = chin.y + faceH * 0.10
    const bodyCY = chin.y + faceH * 0.52

    // ── Draw each bump with burnt edge gradient ─────────────────────────
    const drawBurntBump = (cx: number, cy: number, rx: number, ry: number) => {
      // Base fill
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2)
      ctx.fillStyle = char.skin; ctx.fill()
      // Burnt edge: dark brown vignette around perimeter
      const bg = ctx.createRadialGradient(cx, cy, Math.min(rx,ry)*0.45, cx, cy, Math.max(rx,ry)*1.05)
      bg.addColorStop(0, 'rgba(0,0,0,0)')
      bg.addColorStop(0.7, 'rgba(80,30,0,0.20)')
      bg.addColorStop(1,   'rgba(50,15,0,0.70)')
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2)
      ctx.fillStyle = bg; ctx.fill()
      // Outline stroke — dark brown
      ctx.strokeStyle = '#5c3d10'; ctx.lineWidth = Math.max(2, faceW * 0.022)
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.stroke()
    }

    // Lower body bump
    drawBurntBump(faceCX, bodyCY, bodyR, faceH * 0.43)

    // Pinch / waist connector
    ctx.beginPath(); ctx.ellipse(faceCX, pinchY, faceW * 0.28, faceH * 0.16, 0, 0, Math.PI*2)
    ctx.fillStyle = char.skin; ctx.fill()
    // Darken the waist sides
    const wg = ctx.createLinearGradient(faceCX - faceW*0.28, 0, faceCX + faceW*0.28, 0)
    wg.addColorStop(0, 'rgba(60,20,0,0.55)'); wg.addColorStop(0.3, 'rgba(0,0,0,0)')
    wg.addColorStop(0.7, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(60,20,0,0.55)')
    ctx.beginPath(); ctx.ellipse(faceCX, pinchY, faceW * 0.28, faceH * 0.16, 0, 0, Math.PI*2)
    ctx.fillStyle = wg; ctx.fill()

    // Upper head bump (main face area)
    drawBurntBump(faceCX, headCY, headR * 1.05, faceH * 0.54)

    // ── Wrinkle / texture lines (peanut shell look) ──────────────────────
    ctx.save()
    ctx.strokeStyle = 'rgba(90,50,10,0.38)'; ctx.lineWidth = faceW * 0.018; ctx.lineCap = 'round'
    // Horizontal curved wrinkles on upper head
    ;[-0.22, -0.04, 0.14, 0.30].forEach(oy => {
      const wy = headCY + oy * faceH
      const ww = headR * Math.sqrt(Math.max(0, 1 - ((wy - headCY)/(faceH*0.54))**2)) * 0.72
      ctx.beginPath()
      ctx.moveTo(faceCX - ww, wy)
      ctx.bezierCurveTo(faceCX - ww*0.3, wy - faceH*0.025, faceCX + ww*0.3, wy - faceH*0.025, faceCX + ww, wy)
      ctx.stroke()
    })
    // Wrinkles on lower body
    ;[-0.15, 0.08].forEach(oy => {
      const wy = bodyCY + oy * faceH
      ctx.beginPath()
      ctx.moveTo(faceCX - bodyR*0.65, wy)
      ctx.bezierCurveTo(faceCX - bodyR*0.25, wy - faceH*0.020, faceCX + bodyR*0.25, wy - faceH*0.020, faceCX + bodyR*0.65, wy)
      ctx.stroke()
    })
    ctx.restore()

  } else if (char.id === 'pickle') {
    // Elongated pickle body — rounded rectangle with tapered ends
    const bodyW = faceW * 0.54
    const bodyTop = forehead.y - faceH * 0.22
    const bodyH = faceH * 2.2
    const bodyCY = bodyTop + bodyH / 2

    // Main pickle body (vertical ellipse)
    ctx.beginPath()
    ctx.ellipse(faceCX, bodyCY, bodyW, bodyH / 2, 0, 0, Math.PI * 2)
    const pickleGrad = ctx.createLinearGradient(faceCX - bodyW, 0, faceCX + bodyW, 0)
    pickleGrad.addColorStop(0,   'rgba(40,90,30,0.95)')
    pickleGrad.addColorStop(0.3, char.skin)
    pickleGrad.addColorStop(0.7, char.skin)
    pickleGrad.addColorStop(1,   'rgba(40,90,30,0.95)')
    ctx.fillStyle = pickleGrad; ctx.fill()

    // Darker outline
    ctx.strokeStyle = '#2d5a1b'; ctx.lineWidth = Math.max(2, faceW * 0.030)
    ctx.beginPath(); ctx.ellipse(faceCX, bodyCY, bodyW, bodyH / 2, 0, 0, Math.PI * 2); ctx.stroke()

    // Horizontal ridge lines (the classic pickle look)
    ctx.strokeStyle = 'rgba(30,70,20,0.55)'; ctx.lineWidth = faceW * 0.022
    const ridges = 9
    for (let i = 1; i < ridges; i++) {
      const ry = bodyTop + (bodyH * i) / ridges
      // Clamp ridge width to ellipse edge at that y
      const dy = Math.abs(ry - bodyCY)
      const rw = bodyW * Math.sqrt(Math.max(0, 1 - (dy / (bodyH / 2)) ** 2)) * 0.85
      ctx.beginPath()
      ctx.moveTo(faceCX - rw, ry)
      ctx.bezierCurveTo(faceCX - rw * 0.4, ry - faceH * 0.018, faceCX + rw * 0.4, ry - faceH * 0.018, faceCX + rw, ry)
      ctx.stroke()
    }

    // Wart bumps
    ctx.fillStyle = 'rgba(30,80,20,0.50)'
    const warts = [[0.2, -0.3], [-0.35, -0.1], [0.38, 0.1], [-0.2, 0.28], [0.3, 0.42], [-0.38, 0.55], [0.15, -0.55]]
    warts.forEach(([wx, wy]) => {
      ctx.beginPath()
      ctx.arc(faceCX + (wx as number) * bodyW, bodyCY + (wy as number) * (bodyH/2), faceW * 0.038, 0, Math.PI * 2)
      ctx.fill()
    })

    // Stem (top nub)
    ctx.fillStyle = '#1a4a10'
    ctx.beginPath()
    ctx.ellipse(faceCX, bodyTop - faceH * 0.04, faceW * 0.10, faceH * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2d7a1b'
    ctx.fillRect(faceCX - faceW * 0.05, bodyTop - faceH * 0.12, faceW * 0.10, faceH * 0.10)

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

// ─── Head pose estimation ─────────────────────────────────────────────────────
// Yaw: -1 (looking right) to +1 (looking left)
function computeHeadYaw(landmarks: NormalizedLandmark[], W: number, H: number): number {
  const nose    = lm(landmarks, LM_NOSE_TIP,   W, H)
  const leftEar = lm(landmarks, LM_LEFT_EAR,   W, H)
  const rightEar= lm(landmarks, LM_RIGHT_EAR,  W, H)
  const faceCX  = (leftEar.x + rightEar.x) / 2
  const faceW   = Math.abs(rightEar.x - leftEar.x)
  if (faceW < 1) return 0
  return Math.max(-1, Math.min(1, (nose.x - faceCX) / (faceW * 0.5)))
}

// Roll: radians of head tilt (clockwise = positive)
// Derived from angle of ear axis — the most visible motion in TheBurntPeanut
function computeHeadRoll(landmarks: NormalizedLandmark[], W: number, H: number): number {
  const earL = lm(landmarks, LM_LEFT_EAR,  W, H)  // right side of mirrored canvas
  const earR = lm(landmarks, LM_RIGHT_EAR, W, H)  // left side of mirrored canvas
  // Angle of vector earR → earL
  const angle = Math.atan2(earL.y - earR.y, earL.x - earR.x)
  return Math.max(-0.38, Math.min(0.38, angle))    // clamp to ±~22°
}

// ─── Eyebrow landmarks ────────────────────────────────────────────────────────
const BROW_RIGHT = [70, 63, 105, 66, 107]   // outer → inner
const BROW_LEFT  = [336, 296, 334, 293, 300]

function computeEyeEAR(
  landmarks: NormalizedLandmark[],
  vTop: number, vBot: number, hLeft: number, hRight: number,
  W: number, H: number
): number {
  const top   = lm(landmarks, vTop,   W, H)
  const bot   = lm(landmarks, vBot,   W, H)
  const left  = lm(landmarks, hLeft,  W, H)
  const right = lm(landmarks, hRight, W, H)
  const v = Math.abs(top.y - bot.y)
  const h = Math.abs(right.x - left.x) || 1
  return Math.min(1, v / h)
}

function drawEyebrows(
  ctx: CanvasRenderingContext2D, char: Character,
  landmarks: NormalizedLandmark[], W: number, H: number, faceH: number
) {
  const browColor = char.eyeRing ?? char.skin
  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ;[BROW_RIGHT, BROW_LEFT].forEach(indices => {
    const pts = indices.map(i => lm(landmarks, i, W, H))
    // Main brow stroke
    ctx.beginPath()
    pts.forEach((p, n) => n === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = browColor; ctx.lineWidth = faceH * 0.030; ctx.stroke()
    // Subtle shadow beneath for depth
    ctx.beginPath()
    pts.forEach((p, n) => n === 0 ? ctx.moveTo(p.x, p.y + faceH * 0.016) : ctx.lineTo(p.x, p.y + faceH * 0.016))
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = faceH * 0.010; ctx.stroke()
  })
  ctx.restore()
}

function drawEyelids(
  ctx: CanvasRenderingContext2D, char: Character,
  landmarks: NormalizedLandmark[], W: number, H: number, faceH: number,
  leftCenter: { x: number; y: number }, rightCenter: { x: number; y: number }
) {
  // EAR: fully open ≈ 0.28, blink < 0.10
  const rEAR = computeEyeEAR(landmarks, 159, 145, 33,  133, W, H)
  const lEAR = computeEyeEAR(landmarks, 386, 374, 362, 263, W, H)

  const drawLid = (center: { x: number; y: number }, ear: number, eyeIdx: number[]) => {
    const openness = Math.min(1, Math.max(0, (ear - 0.05) / 0.23))
    if (openness > 0.75) return  // eye open enough — nothing to draw
    const coverage = 1 - openness
    const pts  = eyeIdx.map(i => lm(landmarks, i, W, H))
    const eyeW = (Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x))) * 0.52
    const eyeH = Math.max(4, (Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y))) * 0.55)
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(center.x, center.y, eyeW, eyeH * coverage, 0, 0, Math.PI * 2)
    ctx.fillStyle = char.skin; ctx.fill()
    if (char.eyeRing) {
      ctx.strokeStyle = char.eyeRing; ctx.lineWidth = faceH * 0.012; ctx.stroke()
    }
    ctx.restore()
  }

  drawLid(rightCenter, rEAR, RIGHT_EYE)
  drawLid(leftCenter,  lEAR, LEFT_EYE)
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
  /** Optional canvas element to blit every frame into (for live preview) */
  displayCanvasRef?: React.RefObject<HTMLCanvasElement>
}

export function useCharacterOverlay({ localStream, displayCanvasRef }: UseCharacterOverlayOptions) {
  const [activeCharacter,    setActiveCharacter]    = useState<Character | null>(null)
  const [activeAccessories,  setActiveAccessories]  = useState<string[]>([])
  const [activeBackground,   setActiveBackground]   = useState<string>('none')
  const [filterReady,        setFilterReady]        = useState(false)
  const [filterError,        setFilterError]        = useState<string | null>(null)

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

    async function tryCreateFaceLandmarker(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, delegate: 'GPU' | 'CPU') {
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: false,
        minFaceDetectionConfidence: 0.3, minFacePresenceScore: 0.3, minTrackingConfidence: 0.3,
      })
    }

    async function tryCreateSegmenter(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, delegate: 'GPU' | 'CPU') {
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate,
        },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      })
    }

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        console.log('[FaceFilter] WASM loaded')

        // Load FaceLandmarker — GPU first, CPU fallback
        try {
          const fl = await tryCreateFaceLandmarker(vision, 'GPU')
          if (!cancelled) { landmarkerRef.current = fl; landmarkerReady.current = true }
          console.log('[FaceFilter] FaceLandmarker ✅ GPU')
        } catch {
          try {
            const fl = await tryCreateFaceLandmarker(vision, 'CPU')
            if (!cancelled) { landmarkerRef.current = fl; landmarkerReady.current = true }
            console.log('[FaceFilter] FaceLandmarker ✅ CPU')
          } catch (e) {
            console.error('[FaceFilter] FaceLandmarker ❌ both delegates failed', e)
          }
        }

        // Load Segmenter — GPU first, CPU fallback
        try {
          const seg = await tryCreateSegmenter(vision, 'GPU')
          if (!cancelled) { segmenterRef.current = seg; segmenterReady.current = true }
          console.log('[FaceFilter] Segmenter ✅ GPU')
        } catch {
          try {
            const seg = await tryCreateSegmenter(vision, 'CPU')
            if (!cancelled) { segmenterRef.current = seg; segmenterReady.current = true }
            console.log('[FaceFilter] Segmenter ✅ CPU')
          } catch (e) {
            console.error('[FaceFilter] Segmenter ❌ both delegates failed', e)
          }
        }

        if (!cancelled) {
          // Ready as soon as EITHER model loads — don't block UI on both
          const anyReady = landmarkerReady.current || segmenterReady.current
          setFilterReady(anyReady)
          if (!landmarkerReady.current) setFilterError('Face tracking unavailable — characters will use emoji fallback')
          console.log(`[FaceFilter] face=${landmarkerReady.current} seg=${segmenterReady.current}`)
        }
      } catch (e) {
        console.error('[FaceFilter] ❌ Init failed completely', e)
        if (!cancelled) setFilterError('Face filters unavailable on this device/browser')
      }
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

    // ── Skin texture noise (created once, reused every frame) ────────────
    const noiseSize = 192
    const noiseEl = document.createElement('canvas')
    noiseEl.width = noiseSize; noiseEl.height = noiseSize
    const nctx = noiseEl.getContext('2d')!
    const noiseImg = nctx.createImageData(noiseSize, noiseSize)
    for (let i = 0; i < noiseImg.data.length; i += 4) {
      const v = Math.random()
      const b = v > 0.5 ? 255 : 0
      noiseImg.data[i] = b; noiseImg.data[i+1] = b; noiseImg.data[i+2] = b
      noiseImg.data[i+3] = Math.floor(v * 38)  // very subtle alpha
    }
    nctx.putImageData(noiseImg, 0, 0)
    const noisePattern = mctx.createPattern(noiseEl, 'repeat')

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
      // Landmarks detection is OPTIONAL — if FaceLandmarker failed to load we
      // still show the fallback tint + emoji so the user knows the filter is ON.
      const hasFilter = !!char || accs.length > 0
      if (hasFilter) {
        let landmarks: NormalizedLandmark[] | null = null
        if (landmarkerReady.current && landmarkerRef.current) {
          try {
            const result = landmarkerRef.current.detectForVideo(vid, t)
            landmarks = result.faceLandmarks[0] ?? null
          } catch (_) {}
        }

        if (landmarks) {
          // ── Compute head pose ─────────────────────────────────────────
          const foreheadP = lm(landmarks, LM_FOREHEAD,   W, H)
          const chinP     = lm(landmarks, LM_CHIN,        W, H)
          const leftEarP  = lm(landmarks, LM_LEFT_EAR,   W, H)
          const rightEarP = lm(landmarks, LM_RIGHT_EAR,  W, H)
          const faceCX    = (leftEarP.x + rightEarP.x) / 2
          const faceCY    = (foreheadP.y + chinP.y) / 2
          const faceW     = Math.abs(rightEarP.x - leftEarP.x)
          const faceH     = chinP.y - foreheadP.y
          const yaw       = computeHeadYaw(landmarks, W, H)
          const roll      = computeHeadRoll(landmarks, W, H)
          // Perspective squeeze: face squishes when turned (3D illusion)
          const squeeze   = Math.max(0.55, 1 - Math.abs(yaw) * 0.28)

          if (char) {
            // ── Apply head-rotation transform: roll tilt + yaw squeeze ──────
            // This makes the ENTIRE character tilt with the head (TheBurntPeanut mechanic)
            ctx.save()
            ctx.translate(faceCX, faceCY)
            ctx.rotate(roll)           // tilt entire character with head roll
            ctx.scale(squeeze, 1)      // perspective foreshortening for yaw
            ctx.translate(-faceCX, -faceCY)

            // Character body (extended shape beyond face oval)
            drawCharacterBody(ctx, char, landmarks, W, H)

            // ── Face mask on offscreen canvas ──────────────────────────
            mctx.clearRect(0, 0, W, H)
            // Blur for feathered edges (makes skin-to-face transition soft)
            mctx.filter = 'blur(4px)'

            drawCheeks(mctx as unknown as CanvasRenderingContext2D, char, landmarks, W, H)

            // Face skin polygon
            mctx.fillStyle = char.skin
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, FACE_OVAL, W, H); mctx.fill()

            // Eye rings — thick character-coloured halo around each eye cutout
            if (char.eyeRing) {
              const expand = faceH * 0.055  // bigger ring = more visible
              mctx.fillStyle = char.eyeRing
              expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,  W, H, expand); mctx.fill()
              expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE, W, H, expand); mctx.fill()
            }

            // Punch eye + mouth cutouts — LARGER so real eyes/mouth clearly show through
            mctx.globalCompositeOperation = 'destination-out'
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,   W, H, faceH * 0.038); mctx.fill()
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE,  W, H, faceH * 0.038); mctx.fill()
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LIPS_OUTER, W, H, faceH * 0.028); mctx.fill()

            // ── Enhanced 3D shading ───────────────────────────────────────────
            mctx.globalCompositeOperation = 'source-atop'
            mctx.filter = 'none'

            const lightX = faceCX - faceW * (0.22 - yaw * 0.28)
            const lightY = foreheadP.y + faceH * 0.14

            // 1. Primary specular — tight bright hot spot (moves with yaw)
            const hlGrad = mctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, faceH * 0.30)
            hlGrad.addColorStop(0,    'rgba(255,255,255,0.68)')
            hlGrad.addColorStop(0.22, 'rgba(255,255,255,0.26)')
            hlGrad.addColorStop(1,    'rgba(0,0,0,0)')
            mctx.fillStyle = hlGrad; mctx.fillRect(0, 0, W, H)

            // 2. Diffuse fill — wide soft secondary light across face
            const dfGrad = mctx.createRadialGradient(
              faceCX - faceW * 0.08, foreheadP.y + faceH * 0.28, 0,
              faceCX, foreheadP.y + faceH * 0.4, faceH * 0.68)
            dfGrad.addColorStop(0,   'rgba(255,255,255,0.12)')
            dfGrad.addColorStop(0.5, 'rgba(255,255,255,0.04)')
            dfGrad.addColorStop(1,   'rgba(0,0,0,0)')
            mctx.fillStyle = dfGrad; mctx.fillRect(0, 0, W, H)

            // 3. Rim light — cool blue edge highlight on opposite side
            const rimX = faceCX + faceW * (0.42 + yaw * 0.10)
            const rimY = foreheadP.y + faceH * 0.36
            const rimGrad = mctx.createRadialGradient(rimX, rimY, 0, rimX, rimY, faceH * 0.52)
            rimGrad.addColorStop(0,   'rgba(150,205,255,0.32)')
            rimGrad.addColorStop(0.4, 'rgba(150,205,255,0.10)')
            rimGrad.addColorStop(1,   'rgba(0,0,0,0)')
            mctx.fillStyle = rimGrad; mctx.fillRect(0, 0, W, H)

            // 4. Subsurface scattering — warm orange glow bleeding through at edges
            const faceMidY = foreheadP.y + faceH * 0.45
            const sssGrad = mctx.createRadialGradient(faceCX, faceMidY, faceH*0.28, faceCX, faceMidY, faceH*0.64)
            sssGrad.addColorStop(0,    'rgba(0,0,0,0)')
            sssGrad.addColorStop(0.62, 'rgba(255,100,40,0.08)')
            sssGrad.addColorStop(1,    'rgba(220,50,10,0.20)')
            mctx.fillStyle = sssGrad; mctx.fillRect(0, 0, W, H)

            // 5. Form shadow — darkens opposite side from light source
            const shadowCX = faceCX + faceW * (0.15 + yaw * 0.16)
            const shGrad = mctx.createRadialGradient(
              shadowCX, faceMidY, faceH * 0.18,
              shadowCX, faceMidY, faceH * 0.64)
            shGrad.addColorStop(0,   'rgba(0,0,0,0)')
            shGrad.addColorStop(0.5, 'rgba(0,0,0,0.10)')
            shGrad.addColorStop(1,   'rgba(0,0,0,0.56)')
            mctx.fillStyle = shGrad; mctx.fillRect(0, 0, W, H)

            // 6. Chin / under-jaw shadow — face curves away at bottom
            const chinGrad = mctx.createLinearGradient(0, chinP.y - faceH * 0.16, 0, chinP.y + faceH * 0.05)
            chinGrad.addColorStop(0, 'rgba(0,0,0,0)')
            chinGrad.addColorStop(1, 'rgba(0,0,0,0.34)')
            mctx.fillStyle = chinGrad; mctx.fillRect(0, 0, W, H)

            // 7. Eye socket depth — darken around each eye hole for recessed look
            const leftEyeC  = { x: (lm(landmarks,385,W,H).x+lm(landmarks,386,W,H).x)/2, y: (lm(landmarks,385,W,H).y+lm(landmarks,386,W,H).y)/2 }
            const rightEyeC = { x: (lm(landmarks,160,W,H).x+lm(landmarks,159,W,H).x)/2, y: (lm(landmarks,160,W,H).y+lm(landmarks,159,W,H).y)/2 }
            ;[leftEyeC, rightEyeC].forEach(eye => {
              const sg = mctx.createRadialGradient(eye.x, eye.y, faceH*0.015, eye.x, eye.y, faceH*0.11)
              sg.addColorStop(0,   'rgba(0,0,0,0.52)')
              sg.addColorStop(0.5, 'rgba(0,0,0,0.18)')
              sg.addColorStop(1,   'rgba(0,0,0,0)')
              mctx.fillStyle = sg; mctx.fillRect(0, 0, W, H)
            })

            // 8. Skin texture noise — subtle grain breaks up flat plastic look
            if (noisePattern) {
              mctx.globalAlpha = 0.055
              mctx.fillStyle = noisePattern
              mctx.fillRect(0, 0, W, H)
              mctx.globalAlpha = 1
            }

            mctx.globalCompositeOperation = 'source-over'

            // Composite face mask onto main canvas (inherits ctx perspective transform)
            ctx.drawImage(maskCanvas, 0, 0)

            // ── Edge definition — thin stroke at face oval perimeter ──────────
            // Adds crispness where character meets real face; uses semi-transparent skin color
            ctx.save()
            tracePoly(ctx, landmarks, FACE_OVAL, W, H)
            ctx.strokeStyle = char.skin.replace(/[\d.]+\)$/, '0.40)')
            ctx.lineWidth = Math.max(2, faceH * 0.012)
            ctx.stroke()
            ctx.restore()

            // ── Face skin tint: color-grade real face to match character ──
            // Tints the real face area (visible through eye/mouth holes) with
            // the character's skin tone — makes you look like you ARE the character
            ctx.save()
            tracePoly(ctx, landmarks, FACE_OVAL, W, H)
            ctx.clip()
            // Use character skin color at low opacity over the face area
            ctx.fillStyle = char.skin.replace(/[\d.]+\)$/, '0.22)')
            ctx.fillRect(0, 0, W, H)
            ctx.restore()

            // ── Character eye outlines: draw cartoon eye rings over real eyes ──
            const leftEyeCenter  = { x: lm(landmarks,385,W,H).x * 0.5 + lm(landmarks,386,W,H).x * 0.5,
                                      y: lm(landmarks,385,W,H).y * 0.5 + lm(landmarks,386,W,H).y * 0.5 }
            const rightEyeCenter = { x: lm(landmarks,160,W,H).x * 0.5 + lm(landmarks,159,W,H).x * 0.5,
                                      y: lm(landmarks,160,W,H).y * 0.5 + lm(landmarks,159,W,H).y * 0.5 }
            const eyeR = faceH * 0.062
            ctx.save()
            ;[leftEyeCenter, rightEyeCenter].forEach(eye => {
              switch (char.id) {
                case 'skull': {
                  // Hollow black eye sockets — dark void with crack lines
                  const sg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR * 1.6)
                  sg.addColorStop(0, 'rgba(0,0,0,0.90)'); sg.addColorStop(0.7, 'rgba(20,10,10,0.65)'); sg.addColorStop(1, 'transparent')
                  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR * 1.6, 0, Math.PI*2); ctx.fill()
                  ctx.strokeStyle = '#333'; ctx.lineWidth = faceH*0.015
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR * 1.1, 0, Math.PI*2); ctx.stroke(); break
                }
                case 'robot': {
                  // LED square eye — cyan glow
                  const hw = eyeR * 1.3
                  ctx.fillStyle = 'rgba(0,20,40,0.85)'
                  ctx.fillRect(eye.x - hw, eye.y - hw*0.7, hw*2, hw*1.4)
                  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = faceH*0.018
                  ctx.strokeRect(eye.x - hw, eye.y - hw*0.7, hw*2, hw*1.4)
                  // Inner LED dot
                  const lg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR*0.5)
                  lg.addColorStop(0, 'rgba(0,255,255,0.95)'); lg.addColorStop(1, 'rgba(0,200,255,0)')
                  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*0.5, 0, Math.PI*2); ctx.fill(); break
                }
                case 'devil': {
                  // Glowing ember red eyes
                  const dg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR * 1.8)
                  dg.addColorStop(0, 'rgba(255,80,0,0.9)'); dg.addColorStop(0.4, 'rgba(200,0,0,0.6)'); dg.addColorStop(1, 'transparent')
                  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.8, 0, Math.PI*2); ctx.fill()
                  ctx.strokeStyle = '#ff2200'; ctx.lineWidth = faceH*0.014
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR, 0, Math.PI*2); ctx.stroke(); break
                }
                case 'ghost': {
                  // Purple glow rings
                  const gg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR*1.8)
                  gg.addColorStop(0, 'rgba(220,100,255,0.85)'); gg.addColorStop(0.5, 'rgba(160,0,255,0.5)'); gg.addColorStop(1, 'transparent')
                  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.8, 0, Math.PI*2); ctx.fill(); break
                }
                case 'clown': {
                  // White ring + red tear drop below
                  ctx.strokeStyle = '#fff'; ctx.lineWidth = faceH*0.028
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.2, 0, Math.PI*2); ctx.stroke()
                  // Red tear drop
                  ctx.fillStyle = 'rgba(220,0,0,0.85)'
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y + eyeR*1.8, eyeR*0.3, eyeR*0.55, 0, 0, Math.PI*2); ctx.fill(); break
                }
                case 'cat': {
                  // Almond / cat-eye outline
                  ctx.strokeStyle = char.eyeRing ?? '#795548'; ctx.lineWidth = faceH*0.024
                  ctx.beginPath(); ctx.moveTo(eye.x - eyeR*1.4, eye.y)
                  ctx.quadraticCurveTo(eye.x, eye.y - eyeR*0.9, eye.x + eyeR*1.4, eye.y)
                  ctx.quadraticCurveTo(eye.x + eyeR*1.6, eye.y - eyeR*0.2, eye.x + eyeR*1.9, eye.y - eyeR*0.5)
                  ctx.stroke()
                  ctx.beginPath(); ctx.moveTo(eye.x - eyeR*1.4, eye.y)
                  ctx.quadraticCurveTo(eye.x, eye.y + eyeR*0.8, eye.x + eyeR*1.4, eye.y); ctx.stroke(); break
                }
                case 'frog': {
                  // Protruding dome eye — big circle above eyebrow
                  const domeY = eye.y - eyeR*0.8
                  ctx.beginPath(); ctx.arc(eye.x, domeY, eyeR*1.5, 0, Math.PI*2)
                  ctx.fillStyle = '#4CAF50'; ctx.fill()
                  ctx.beginPath(); ctx.arc(eye.x, domeY, eyeR*0.9, 0, Math.PI*2)
                  ctx.fillStyle = '#fff'; ctx.fill()
                  ctx.beginPath(); ctx.arc(eye.x, domeY, eyeR*0.45, 0, Math.PI*2)
                  ctx.fillStyle = '#1b3a10'; ctx.fill()
                  // Shine
                  ctx.beginPath(); ctx.arc(eye.x - eyeR*0.25, domeY - eyeR*0.3, eyeR*0.18, 0, Math.PI*2)
                  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); break
                }
                case 'alien': {
                  // Huge black almond eye — no iris
                  ctx.fillStyle = 'rgba(0,0,0,0.92)'
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.7, eyeR*1.0, 0.2, 0, Math.PI*2); ctx.fill()
                  // Subtle green reflection line
                  ctx.strokeStyle = 'rgba(100,220,80,0.6)'; ctx.lineWidth = faceH*0.010
                  ctx.beginPath(); ctx.ellipse(eye.x - eyeR*0.3, eye.y - eyeR*0.35, eyeR*0.8, eyeR*0.25, 0.3, 0, Math.PI); ctx.stroke(); break
                }
                case 'pickle': {
                  // Round cartoon pickle eye — white sclera + green pupil
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.5, 0, Math.PI*2)
                  ctx.fillStyle = '#fff'; ctx.fill()
                  ctx.strokeStyle = '#2d5a1b'; ctx.lineWidth = faceH*0.020; ctx.stroke()
                  ctx.beginPath(); ctx.arc(eye.x + eyeR*0.15, eye.y + eyeR*0.1, eyeR*0.65, 0, Math.PI*2)
                  ctx.fillStyle = '#2d7a1b'; ctx.fill()
                  ctx.beginPath(); ctx.arc(eye.x + eyeR*0.15, eye.y + eyeR*0.1, eyeR*0.28, 0, Math.PI*2)
                  ctx.fillStyle = '#111'; ctx.fill()
                  ctx.beginPath(); ctx.arc(eye.x - eyeR*0.1, eye.y - eyeR*0.25, eyeR*0.22, 0, Math.PI*2)
                  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); break
                }
                case 'peanut': {
                  // Warm cartoon peanut eye — tan ring, heavy top eyelid
                  ctx.strokeStyle = '#7a5c20'; ctx.lineWidth = faceH*0.030
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.3, 0, Math.PI*2); ctx.stroke()
                  // Heavy top eyelid stroke
                  ctx.strokeStyle = '#4a3010'; ctx.lineWidth = faceH*0.022
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.3, Math.PI*1.15, Math.PI*1.85); ctx.stroke(); break
                }
                case 'bear':
                case 'panda': {
                  ctx.strokeStyle = char.eyeRing ?? '#333'; ctx.lineWidth = faceH*0.028
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.2, 0, Math.PI*2); ctx.stroke(); break
                }
                default: {
                  // Default cartoon ring
                  ctx.strokeStyle = char.eyeRing ?? char.skin
                  ctx.lineWidth = faceH * 0.025
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR * 1.4, 0, Math.PI*2); ctx.stroke(); break
                }
              }
            })
            ctx.restore()

            // ── Eyebrows (live expression tracking) ──────────────────────────
            drawEyebrows(ctx, char, landmarks, W, H, faceH)

            // ── Eyelids (blink tracking — covers eye holes when eye closes) ─
            drawEyelids(ctx, char, landmarks, W, H, faceH, leftEyeCenter, rightEyeCenter)

            // ── Mouth glow when talking ───────────────────────────────────────
            const innerTop  = lm(landmarks, 13, W, H)
            const innerBot  = lm(landmarks, 14, W, H)
            const mouthOpen = Math.min(1, Math.abs(innerBot.y - innerTop.y) / (faceH * 0.12))
            if (mouthOpen > 0.25) {
              const mc = { x: (innerTop.x + innerBot.x) / 2, y: (innerTop.y + innerBot.y) / 2 }
              const mg = ctx.createRadialGradient(mc.x, mc.y, 0, mc.x, mc.y, faceH * 0.1)
              mg.addColorStop(0, `rgba(255,220,150,${0.40 * mouthOpen})`)
              mg.addColorStop(1, 'transparent')
              ctx.save()
              ctx.beginPath()
              tracePoly(ctx, landmarks, LIPS_OUTER, W, H)
              ctx.fillStyle = mg; ctx.fill()
              ctx.restore()
            }

            drawDecorations(ctx, char, landmarks, W, H)
            drawNameTag(ctx, char, landmarks, W, H)

            ctx.restore()  // remove perspective transform
          }

          if (accs.length > 0) {
            // Accessories also get full head pose transform (roll + yaw)
            ctx.save()
            ctx.translate(faceCX, faceCY)
            ctx.rotate(roll); ctx.scale(squeeze, 1)
            ctx.translate(-faceCX, -faceCY)
            drawAccessories(ctx, accs, landmarks, W, H)
            ctx.restore()
          }
        } else if (char) {
          // ── Fallback: face not detected yet — show character overlay anyway ────
          // This gives immediate visual feedback even before face is tracked.
          // User sees the character filter is ON; they just need to center their face.

          // Full-frame skin tint so it's OBVIOUS the filter is active
          ctx.fillStyle = char.skin.replace(/[\d.]+\)$/, '0.35)')
          ctx.fillRect(0, 0, W, H)

          // Giant character emoji at face-height estimate (upper third)
          ctx.font = `${H * 0.28}px serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(char.emoji, W / 2, H * 0.35)

          // Character name badge
          const label = char.label.toUpperCase()
          ctx.font = `bold ${H * 0.038}px sans-serif`
          const tw = ctx.measureText(label).width
          const bx = W/2 - tw/2 - 16, by = H * 0.62 - 14, bw = tw + 32, bh = 36
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10); else ctx.rect(bx, by, bw, bh)
          ctx.fill()
          ctx.fillStyle = '#fff'; ctx.fillText(label, W/2, H * 0.62 + 4)

          // Hint text
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `${H * 0.026}px sans-serif`
          ctx.fillText(!landmarkerReady.current ? 'Loading face tracking…' : 'Center your face in frame', W/2, H * 0.74)
        }
      }

      // Blit to display canvas (preview pane) if provided
      const dc = displayCanvasRef?.current
      if (dc) {
        const dctx = dc.getContext('2d')
        if (dctx) dctx.drawImage(canvas, 0, 0, dc.width, dc.height)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      vid.srcObject = null; canvasStreamRef.current = null; canvasRef.current = null
    }
  }, [localStream, displayCanvasRef])

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
    filterReady, filterError,
    canvasRef,   // expose so VideoChat can show canvas directly in preview
    CHARACTERS,
  }
}
