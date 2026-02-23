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
const LM_FOREHEAD    = 10
const LM_CHIN        = 152
const LM_LEFT_EAR    = 234
const LM_RIGHT_EAR   = 454
const LM_NOSE_BRIDGE = 168
const LM_NOSE_TIP    = 4
const LM_LEFT_CHEEK  = 50
const LM_RIGHT_CHEEK = 280
const LM_MOUTH_LEFT  = 61
const LM_MOUTH_RIGHT = 291

// ─── Character definitions ────────────────────────────────────────────────────
export interface Character {
  id: string
  emoji: string
  label: string
  skin: string
  eyeRing?: string
  cheek?: string
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
  { id: 'panda',   emoji: '🐼', label: 'Panda',   skin: 'rgba(240,240,240,0.95)', eyeRing: '#111' },
  { id: 'fox',     emoji: '🦊', label: 'Fox',     skin: 'rgba(230,100,30,0.93)',  eyeRing: '#bf360c', cheek: 'rgba(255,255,255,0.75)' },
  { id: 'cat',     emoji: '🐱', label: 'Cat',     skin: 'rgba(200,180,150,0.93)', eyeRing: '#795548' },
  { id: 'devil',   emoji: '😈', label: 'Devil',   skin: 'rgba(180,30,30,0.93)',   eyeRing: '#880000' },
  { id: 'cowboy',  emoji: '🤠', label: 'Cowboy',  skin: 'rgba(210,160,100,0.93)', eyeRing: '#5d4037' },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon',  skin: 'rgba(100,50,150,0.93)',  eyeRing: '#ff9800' },
  { id: 'fire',    emoji: '🔥', label: 'Fire',    skin: 'rgba(255,100,0,0.90)',   eyeRing: '#ffcc00' },
]

// ─── Accessory definitions ────────────────────────────────────────────────────
export type AccessoryCategory = 'head' | 'face' | 'mouth' | 'neck' | 'ears'

export interface Accessory {
  id: string
  emoji: string
  label: string
  category: AccessoryCategory
  scaleFW: number   // size as fraction of face width
  dy: number        // vertical offset as fraction of face height (negative = above anchor)
  dx?: number       // horizontal offset (for mouth accessories)
  rotate?: number   // degrees to rotate the emoji
}

export const ACCESSORIES: Accessory[] = [
  // ── Head ──────────────────────────────────────────────────────────────────
  { id: 'halo-helmet',  emoji: '🪖', label: 'Halo Helmet', category: 'head', scaleFW: 1.5,  dy: -0.55 },
  { id: 'crown',        emoji: '👑', label: 'Crown',        category: 'head', scaleFW: 0.95, dy: -0.48 },
  { id: 'top-hat',      emoji: '🎩', label: 'Top Hat',      category: 'head', scaleFW: 1.0,  dy: -0.58 },
  { id: 'cap',          emoji: '🧢', label: 'Cap',          category: 'head', scaleFW: 1.05, dy: -0.50 },
  { id: 'grad-cap',     emoji: '🎓', label: 'Grad Cap',     category: 'head', scaleFW: 1.05, dy: -0.50 },
  { id: 'party-hat',    emoji: '🎉', label: 'Party Hat',    category: 'head', scaleFW: 0.80, dy: -0.55 },
  { id: 'wizard-hat',   emoji: '🧙', label: 'Wizard Hat',   category: 'head', scaleFW: 0.90, dy: -0.58 },
  { id: 'pirate-hat',   emoji: '🏴‍☠️',label: 'Pirate',       category: 'head', scaleFW: 1.05, dy: -0.50 },
  { id: 'santa-hat',    emoji: '🎅', label: 'Santa Hat',    category: 'head', scaleFW: 1.0,  dy: -0.50 },
  { id: 'halo',         emoji: '😇', label: 'Halo',         category: 'head', scaleFW: 0.70, dy: -0.42 },
  { id: 'alien-head',   emoji: '👾', label: 'Alien Head',   category: 'head', scaleFW: 1.1,  dy: -0.50 },
  { id: 'fedora',       emoji: '🤠', label: 'Fedora',       category: 'head', scaleFW: 1.05, dy: -0.50 },
  // ── Face ──────────────────────────────────────────────────────────────────
  { id: 'sunglasses',   emoji: '🕶️', label: 'Sunglasses',  category: 'face', scaleFW: 0.85, dy: 0.0 },
  { id: 'glasses',      emoji: '👓', label: 'Glasses',      category: 'face', scaleFW: 0.85, dy: 0.0 },
  { id: 'monocle',      emoji: '🧐', label: 'Monocle',      category: 'face', scaleFW: 0.55, dy: -0.05 },
  { id: 'mask',         emoji: '😷', label: 'Mask',         category: 'face', scaleFW: 0.85, dy: 0.15 },
  { id: 'clown-nose',   emoji: '🤡', label: 'Clown Nose',   category: 'face', scaleFW: 0.22, dy: 0.08 },
  // ── Mouth ─────────────────────────────────────────────────────────────────
  { id: 'cigarette',    emoji: '🚬', label: 'Cigarette',    category: 'mouth', scaleFW: 0.38, dy: 0.06, dx: 0.18 },
  { id: 'lollipop',     emoji: '🍭', label: 'Lollipop',     category: 'mouth', scaleFW: 0.38, dy: 0.04, dx: -0.20 },
  { id: 'toothpick',    emoji: '🦷', label: 'Toothpick',    category: 'mouth', scaleFW: 0.30, dy: 0.06, dx: 0.15 },
  { id: 'straw',        emoji: '🧃', label: 'Drink',        category: 'mouth', scaleFW: 0.30, dy: 0.04, dx: -0.16 },
  // ── Neck ──────────────────────────────────────────────────────────────────
  { id: 'chain',        emoji: '📿', label: 'Chain',        category: 'neck', scaleFW: 0.90, dy: 0.12 },
  { id: 'bow-tie',      emoji: '🎀', label: 'Bow Tie',      category: 'neck', scaleFW: 0.65, dy: 0.10 },
  { id: 'tie',          emoji: '👔', label: 'Tie',          category: 'neck', scaleFW: 0.55, dy: 0.18 },
  { id: 'mic',          emoji: '🎤', label: 'Mic',          category: 'neck', scaleFW: 0.30, dy: 0.15, dx: 0.25 },
  // ── Ears ──────────────────────────────────────────────────────────────────
  { id: 'headphones',   emoji: '🎧', label: 'Headphones',   category: 'ears', scaleFW: 1.35, dy: 0.05 },
  { id: 'earrings',     emoji: '💎', label: 'Earrings',     category: 'ears', scaleFW: 0.20, dy: 0.15 },
]

export const ACCESSORY_CATEGORIES: { id: AccessoryCategory; label: string }[] = [
  { id: 'head',  label: '🎩 Head'  },
  { id: 'face',  label: '👓 Face'  },
  { id: 'mouth', label: '🚬 Mouth' },
  { id: 'neck',  label: '📿 Neck'  },
  { id: 'ears',  label: '🎧 Ears'  },
]

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
    const dx = p.x - cx, dy = p.y - cy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = p.x + (dx / len) * expand
    const ny = p.y + (dy / len) * expand
    n === 0 ? ctx.moveTo(nx, ny) : ctx.lineTo(nx, ny)
  })
  ctx.closePath()
}

// ─── Accessory rendering ──────────────────────────────────────────────────────
function drawAccessories(
  ctx: CanvasRenderingContext2D,
  accessoryIds: string[],
  landmarks: NormalizedLandmark[],
  W: number, H: number
) {
  if (!accessoryIds.length) return
  const forehead  = lm(landmarks, LM_FOREHEAD,    W, H)
  const chin      = lm(landmarks, LM_CHIN,        W, H)
  const leftEar   = lm(landmarks, LM_LEFT_EAR,    W, H)
  const rightEar  = lm(landmarks, LM_RIGHT_EAR,   W, H)
  const noseBridge = lm(landmarks, LM_NOSE_BRIDGE, W, H)
  const noseTip   = lm(landmarks, LM_NOSE_TIP,    W, H)
  const mouthL    = lm(landmarks, LM_MOUTH_LEFT,  W, H)

  const faceH = chin.y - forehead.y
  const faceW = Math.abs(rightEar.x - leftEar.x)
  const faceCX = (leftEar.x + rightEar.x) / 2

  const accs = ACCESSORIES.filter(a => accessoryIds.includes(a.id))

  ctx.save()
  accs.forEach(acc => {
    const size = faceW * acc.scaleFW
    let ax = faceCX + (acc.dx ?? 0) * faceW
    let ay: number

    switch (acc.category) {
      case 'head':
        ax = forehead.x
        ay = forehead.y + faceH * acc.dy
        break
      case 'face':
        // Glasses/monocle anchor to nose bridge
        if (acc.id === 'monocle') {
          ax = noseTip.x + faceW * 0.15
          ay = noseBridge.y + faceH * acc.dy
        } else if (acc.id === 'mask') {
          ax = noseTip.x
          ay = noseTip.y + faceH * acc.dy
        } else if (acc.id === 'clown-nose') {
          ax = noseTip.x
          ay = noseTip.y + faceH * acc.dy
        } else {
          ax = noseBridge.x
          ay = noseBridge.y + faceH * acc.dy
        }
        break
      case 'mouth':
        ax = mouthL.x + faceW * (acc.dx ?? 0)
        ay = mouthL.y + faceH * acc.dy
        break
      case 'neck':
        ax = chin.x + faceW * (acc.dx ?? 0)
        ay = chin.y + faceH * acc.dy
        break
      case 'ears':
        // Headphones span both ears
        ax = faceCX
        ay = ((leftEar.y + rightEar.y) / 2) + faceH * acc.dy
        break
    }

    ctx.font = `${size}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (acc.rotate) {
      ctx.save()
      ctx.translate(ax, ay)
      ctx.rotate((acc.rotate * Math.PI) / 180)
      ctx.fillText(acc.emoji, 0, 0)
      ctx.restore()
    } else {
      ctx.fillText(acc.emoji, ax, ay)
    }
  })
  ctx.restore()
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

  const faceH = chin.y - forehead.y
  const earR  = faceH * 0.13

  ctx.save()

  switch (char.id) {
    case 'cat': {
      const earH = faceH * 0.28, earW = faceH * 0.14
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.moveTo(ear.x - earW, ear.y)
        ctx.lineTo(ear.x + earW, ear.y)
        ctx.lineTo(ear.x, ear.y - earH)
        ctx.closePath()
        ctx.fillStyle = char.skin
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(ear.x - earW * 0.5, ear.y - earH * 0.1)
        ctx.lineTo(ear.x + earW * 0.5, ear.y - earH * 0.1)
        ctx.lineTo(ear.x, ear.y - earH * 0.75)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,150,150,0.7)'
        ctx.fill()
      })
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
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.arc(ear.x, ear.y - earR * 0.5, earR, 0, Math.PI * 2)
        ctx.fillStyle = char.skin; ctx.fill()
        ctx.beginPath()
        ctx.arc(ear.x, ear.y - earR * 0.5, earR * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(80,50,30,0.9)'; ctx.fill()
      })
      ctx.beginPath()
      ctx.ellipse(noseTip.x, noseTip.y, faceH * 0.07, faceH * 0.05, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#1a0a00'; ctx.fill()
      break
    }
    case 'panda': {
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.arc(ear.x, ear.y - earR * 0.5, earR, 0, Math.PI * 2)
        ctx.fillStyle = '#111'; ctx.fill()
      })
      const leye = lm(landmarks, 468, W, H)
      const reye = lm(landmarks, 473, W, H)
      ;[leye, reye].forEach(eye => {
        ctx.beginPath()
        ctx.arc(eye.x, eye.y, faceH * 0.13, 0, Math.PI * 2)
        ctx.fillStyle = '#222'; ctx.fill()
      })
      ctx.beginPath()
      ctx.ellipse(noseTip.x, noseTip.y, faceH * 0.06, faceH * 0.04, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#222'; ctx.fill()
      break
    }
    case 'frog': {
      const eyeR = faceH * 0.14
      ;[leftEar, rightEar].forEach((ear, idx) => {
        const ex = idx === 0 ? leftEar.x + faceH * 0.08 : rightEar.x - faceH * 0.08
        const ey = forehead.y - eyeR * 0.6
        ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2)
        ctx.fillStyle = '#4CAF50'; ctx.fill()
        ctx.beginPath(); ctx.arc(ex, ey, eyeR * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
        ctx.beginPath(); ctx.arc(ex, ey, eyeR * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = '#111'; ctx.fill()
        ctx.beginPath(); ctx.arc(ex - eyeR * 0.1, ey - eyeR * 0.15, eyeR * 0.12, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill()
      })
      ;[-1, 1].forEach(side => {
        ctx.beginPath()
        ctx.arc(noseTip.x + side * faceH * 0.04, noseTip.y, faceH * 0.025, 0, Math.PI * 2)
        ctx.fillStyle = '#1b5e20'; ctx.fill()
      })
      break
    }
    case 'alien': {
      ctx.beginPath()
      ctx.ellipse(forehead.x, forehead.y - faceH * 0.18, faceH * 0.18, faceH * 0.25, 0, Math.PI, 0)
      ctx.fillStyle = char.skin; ctx.fill()
      ;[-1, 1].forEach(side => {
        ctx.beginPath()
        ctx.ellipse(noseTip.x + side * faceH * 0.03, noseTip.y, faceH * 0.015, faceH * 0.035, 0.3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,60,0,0.8)'; ctx.fill()
      })
      break
    }
    case 'devil': {
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath()
        ctx.moveTo(ear.x - faceH * 0.07, ear.y - faceH * 0.05)
        ctx.lineTo(ear.x + faceH * 0.07, ear.y - faceH * 0.05)
        ctx.lineTo(ear.x, ear.y - faceH * 0.33)
        ctx.closePath()
        ctx.fillStyle = '#c62828'; ctx.fill()
      })
      break
    }
    case 'clown': {
      ctx.beginPath()
      ctx.arc(noseTip.x, noseTip.y, faceH * 0.075, 0, Math.PI * 2)
      const g = ctx.createRadialGradient(noseTip.x - faceH * 0.025, noseTip.y - faceH * 0.025, 0, noseTip.x, noseTip.y, faceH * 0.075)
      g.addColorStop(0, '#ff6666'); g.addColorStop(1, '#cc0000')
      ctx.fillStyle = g; ctx.fill()
      const lc = lm(landmarks, LM_LEFT_CHEEK, W, H)
      const rc = lm(landmarks, LM_RIGHT_CHEEK, W, H)
      ;[lc, rc].forEach(c => {
        ctx.beginPath(); ctx.arc(c.x, c.y, faceH * 0.09, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,70,70,0.5)'; ctx.fill()
      })
      const colors = ['#f00','#f80','#ff0','#0c0','#00f','#80f']
      const hairY = forehead.y - faceH * 0.05
      const hairW = faceH * 0.55
      colors.forEach((col, i) => {
        const hx = (forehead.x - hairW / 2) + (i + 0.5) * (hairW / colors.length)
        ctx.beginPath(); ctx.arc(hx, hairY, faceH * 0.07, Math.PI, 0)
        ctx.fillStyle = col; ctx.fill()
      })
      break
    }
    case 'robot': {
      ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = faceH * 0.025
      ctx.beginPath()
      ctx.moveTo(forehead.x, forehead.y - faceH * 0.02)
      ctx.lineTo(forehead.x, forehead.y - faceH * 0.22)
      ctx.stroke()
      ctx.beginPath(); ctx.arc(forehead.x, forehead.y - faceH * 0.24, faceH * 0.04, 0, Math.PI * 2)
      ctx.fillStyle = '#f44336'; ctx.fill()
      ;[leftEar, rightEar].forEach(ear => {
        ctx.beginPath(); ctx.arc(ear.x, ear.y, faceH * 0.04, 0, Math.PI * 2)
        ctx.fillStyle = '#0d47a1'; ctx.fill()
        ctx.beginPath(); ctx.arc(ear.x, ear.y, faceH * 0.025, 0, Math.PI * 2)
        ctx.fillStyle = '#bbdefb'; ctx.fill()
      })
      break
    }
    case 'skull': {
      ;[-1, 1].forEach(side => {
        ctx.beginPath()
        ctx.ellipse(noseTip.x + side * faceH * 0.04, noseTip.y, faceH * 0.028, faceH * 0.045, 0, 0, Math.PI * 2)
        ctx.fillStyle = '#111'; ctx.fill()
      })
      ctx.beginPath()
      ctx.ellipse(forehead.x, forehead.y, faceH * 0.22, faceH * 0.12, 0, Math.PI, 0)
      ctx.fillStyle = 'rgba(240,240,240,0.95)'; ctx.fill()
      break
    }
    case 'cowboy': {
      const brimW = faceH * 0.65, crownW = faceH * 0.38, crownH = faceH * 0.28
      const hatY = forehead.y - faceH * 0.04
      ctx.beginPath()
      ctx.ellipse(forehead.x, hatY, brimW / 2, faceH * 0.08, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#5d4037'; ctx.fill()
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(forehead.x - crownW / 2, hatY - crownH, crownW, crownH, faceH * 0.06)
      ctx.fillStyle = '#6d4c41'; ctx.fill()
      ctx.fillStyle = '#3e2723'
      ctx.fillRect(forehead.x - crownW / 2, hatY - crownH * 0.22, crownW, crownH * 0.18)
      break
    }
    default: break
  }

  ctx.restore()
}

function drawCheeks(ctx: CanvasRenderingContext2D, char: Character,
                    landmarks: NormalizedLandmark[], W: number, H: number) {
  if (!char.cheek) return
  const lc = lm(landmarks, LM_LEFT_CHEEK, W, H)
  const rc = lm(landmarks, LM_RIGHT_CHEEK, W, H)
  const faceH = (lm(landmarks, LM_CHIN, W, H).y - lm(landmarks, LM_FOREHEAD, W, H).y)
  ctx.save()
  ;[lc, rc].forEach(c => {
    ctx.beginPath(); ctx.arc(c.x, c.y, faceH * 0.1, 0, Math.PI * 2)
    ctx.fillStyle = char.cheek!; ctx.fill()
  })
  ctx.restore()
}

function drawNameTag(ctx: CanvasRenderingContext2D, char: Character,
                     landmarks: NormalizedLandmark[], W: number, H: number) {
  const chin = lm(landmarks, LM_CHIN, W, H)
  const text = char.label.toUpperCase()
  ctx.font = 'bold 16px sans-serif'
  const tw = ctx.measureText(text).width
  const px = 12, py = 6, r = 11
  const bw = tw + px * 2, bh = 16 + py * 2
  const bx = chin.x - bw / 2, by = chin.y + 10
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, r)
  else { ctx.rect(bx, by, bw, bh) }
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, chin.x, by + bh / 2)
}

// ─── Main hook ────────────────────────────────────────────────────────────────
interface UseCharacterOverlayOptions {
  localStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
}

export function useCharacterOverlay({ localStream }: UseCharacterOverlayOptions) {
  const [activeCharacter, setActiveCharacter]     = useState<Character | null>(null)
  const [activeAccessories, setActiveAccessories] = useState<string[]>([])
  const canvasRef        = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef  = useRef<MediaStream | null>(null)
  const rafRef           = useRef<number | null>(null)
  const activeCharRef    = useRef<Character | null>(null)
  const activeAccRef     = useRef<string[]>([])
  const landmarkerRef    = useRef<FaceLandmarker | null>(null)
  const landmarkerReady  = useRef(false)

  useEffect(() => { activeCharRef.current = activeCharacter }, [activeCharacter])
  useEffect(() => { activeAccRef.current  = activeAccessories }, [activeAccessories])

  // ── Init MediaPipe FaceLandmarker ───────────────────────────────────────────
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
          runningMode: 'VIDEO', numFaces: 1,
          outputFaceBlendshapes: false,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceScore: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (!cancelled) { landmarkerRef.current = fl; landmarkerReady.current = true }
      } catch (e) { console.warn('[FaceLandmarker] init failed', e) }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Canvas render loop ──────────────────────────────────────────────────────
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

    const vid = document.createElement('video')
    vid.srcObject = localStream; vid.autoplay = true; vid.muted = true
    vid.playsInline = true; vid.play().catch(() => {})
    const W = canvas.width, H = canvas.height

    const draw = () => {
      const char  = activeCharRef.current
      const accs  = activeAccRef.current
      const ready = vid.readyState >= 2

      // Mirror video frame
      if (ready) {
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1)
        ctx.drawImage(vid, 0, 0, W, H); ctx.restore()
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      }

      const hasFilter = (char || accs.length > 0)
      if (hasFilter && ready && landmarkerReady.current && landmarkerRef.current) {
        let landmarks: NormalizedLandmark[] | null = null
        try {
          const result = landmarkerRef.current.detectForVideo(vid, performance.now())
          landmarks = result.faceLandmarks[0] ?? null
        } catch (_) {}

        if (landmarks) {
          if (char) {
            // ── Face mask compositing on offscreen canvas ────────────────
            mctx.clearRect(0, 0, W, H)

            drawCheeks(mctx as unknown as CanvasRenderingContext2D, char, landmarks, W, H)

            mctx.fillStyle = char.skin
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, FACE_OVAL, W, H)
            mctx.fill()

            if (char.eyeRing) {
              const expand = (lm(landmarks, LM_CHIN, W, H).y - lm(landmarks, LM_FOREHEAD, W, H).y) * 0.025
              mctx.fillStyle = char.eyeRing
              expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,  W, H, expand); mctx.fill()
              expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE, W, H, expand); mctx.fill()
            }

            // Punch eye + mouth cutouts so real face shows through
            mctx.globalCompositeOperation = 'destination-out'
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,   W, H); mctx.fill()
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE,  W, H); mctx.fill()
            tracePoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LIPS_OUTER, W, H); mctx.fill()
            mctx.globalCompositeOperation = 'source-over'

            ctx.drawImage(maskCanvas, 0, 0)
            drawDecorations(ctx, char, landmarks, W, H)
            drawNameTag(ctx, char, landmarks, W, H)
          }

          // ── Accessories drawn on top of everything ───────────────────
          if (accs.length > 0) {
            drawAccessories(ctx, accs, landmarks, W, H)
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.font = '15px sans-serif'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('Move into frame', W / 2, H * 0.92)
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      vid.srcObject = null
      canvasStreamRef.current = null; canvasRef.current = null
    }
  }, [localStream])

  const getCanvasVideoTrack = useCallback(
    (): MediaStreamTrack | null => canvasStreamRef.current?.getVideoTracks()[0] ?? null, [])
  const getCanvasStream = useCallback(
    (): MediaStream | null => canvasStreamRef.current, [])

  const selectCharacter = useCallback((char: Character | null) => setActiveCharacter(char), [])

  const toggleAccessory = useCallback((id: string) => {
    setActiveAccessories(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }, [])

  const clearAccessories = useCallback(() => setActiveAccessories([]), [])

  return {
    activeCharacter, selectCharacter,
    activeAccessories, toggleAccessory, clearAccessories,
    getCanvasVideoTrack, getCanvasStream,
    CHARACTERS,
  }
}
