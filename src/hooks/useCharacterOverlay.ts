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
  { id: 'dragon',    emoji: '🐉', label: 'Dragon',     skin: 'rgba(100,50,150,0.95)',   eyeRing: '#ff9800' },
  { id: 'fire',      emoji: '🔥', label: 'Fire',       skin: 'rgba(255,100,0,0.92)',    eyeRing: '#ffcc00' },
  { id: 'anime',     emoji: '✨', label: 'Anime',      skin: 'rgba(255,225,200,0.97)',  eyeRing: '#ff88bb', cheek: 'rgba(255,160,180,0.55)' },
  { id: 'neon-skull',emoji: '💜', label: 'Neon Skull', skin: 'rgba(235,225,255,0.97)', eyeRing: '#cc00ff' },
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

// ─── Distortion Filters ────────────────────────────────────────────────────
export interface DistortionFilter {
  id: string; emoji: string; label: string
}
export const DISTORTION_FILTERS: DistortionFilter[] = [
  { id: 'baby-face',    emoji: '👶', label: 'Baby Face'   },
  { id: 'fat-face',     emoji: '🐷', label: 'Fat Face'    },
  { id: 'slim-face',    emoji: '💃', label: 'Slim Face'   },
  { id: 'big-eyes',     emoji: '👀', label: 'Big Eyes'    },
  { id: 'tiny-face',    emoji: '🤏', label: 'Tiny Face'   },
  { id: 'alien-eyes',   emoji: '👽', label: 'Alien Eyes'  },
  { id: 'big-nose',     emoji: '🤡', label: 'Big Nose'    },
  // 🔥 New unhinged filters
  { id: 'big-forehead', emoji: '🧠', label: 'Big Brain'   },
  { id: 'chipmunk',     emoji: '🐹', label: 'Chipmunk'    },
  { id: 'blowfish',     emoji: '🐡', label: 'Blowfish'    },
  { id: 'noodle',       emoji: '🍜', label: 'Noodle'      },
  { id: 'potato',       emoji: '🥔', label: 'Potato'      },
  { id: 'big-mouth',    emoji: '😬', label: 'Big Mouth'   },
  { id: 'tiny-mouth',   emoji: '🫦', label: 'Tiny Mouth'  },
  { id: 'cyclops',      emoji: '👁️', label: 'Cyclops'    },
  { id: 'funhouse',     emoji: '🌊', label: 'Funhouse'    },
  { id: 'melting',      emoji: '🫠', label: 'Melting'     },
]

// ── Eye center helpers (cached per call) ─────────────────────────────────────
function eyeCenter(landmarks: NormalizedLandmark[], indices: number[], W: number, H: number) {
  let sx = 0, sy = 0
  for (const i of indices) { const p = lm(landmarks, i, W, H); sx += p.x; sy += p.y }
  return { x: sx / indices.length, y: sy / indices.length }
}

// ── Pixel-level face distortion (Liquify-style warp) ─────────────────────────
function applyFaceDistortion(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  filterId: string,
  landmarks: NormalizedLandmark[]
) {
  const foreheadP  = lm(landmarks, LM_FOREHEAD,    W, H)
  const chinP      = lm(landmarks, LM_CHIN,         W, H)
  const leftEarP   = lm(landmarks, LM_LEFT_EAR,    W, H)
  const rightEarP  = lm(landmarks, LM_RIGHT_EAR,   W, H)
  const noseTipP   = lm(landmarks, LM_NOSE_TIP,    W, H)
  const faceH      = chinP.y - foreheadP.y
  const faceW      = Math.abs(rightEarP.x - leftEarP.x)
  const faceCX     = (leftEarP.x + rightEarP.x) / 2
  const faceCY     = (foreheadP.y + chinP.y) / 2
  const leftEyeC   = eyeCenter(landmarks, LEFT_EYE,  W, H)
  const rightEyeC  = eyeCenter(landmarks, RIGHT_EYE, W, H)
  const R          = Math.max(faceW, faceH)

  interface WarpOp {
    cx: number; cy: number; radius: number; strength: number
    kind: 'expand' | 'shrink' | 'h-expand' | 'h-shrink' | 'v-expand' | 'v-shrink'
  }
  const ops: WarpOp[] = []

  switch (filterId) {
    case 'baby-face':
      ops.push({ cx: leftEyeC.x,  cy: leftEyeC.y,  radius: faceH*0.24, strength: 0.70, kind: 'expand' })
      ops.push({ cx: rightEyeC.x, cy: rightEyeC.y, radius: faceH*0.24, strength: 0.70, kind: 'expand' })
      ops.push({ cx: noseTipP.x,  cy: noseTipP.y,  radius: faceH*0.20, strength: 0.50, kind: 'shrink' })
      ops.push({ cx: leftEarP.x  + faceW*0.22, cy: faceCY + faceH*0.08, radius: faceH*0.28, strength: 0.28, kind: 'expand' })
      ops.push({ cx: rightEarP.x - faceW*0.22, cy: faceCY + faceH*0.08, radius: faceH*0.28, strength: 0.28, kind: 'expand' })
      break
    case 'fat-face':
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.70, strength: 0.50, kind: 'h-expand' })
      break
    case 'slim-face':
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.70, strength: 0.42, kind: 'h-shrink' })
      break
    case 'big-eyes':
      ops.push({ cx: leftEyeC.x,  cy: leftEyeC.y,  radius: faceH*0.32, strength: 0.90, kind: 'expand' })
      ops.push({ cx: rightEyeC.x, cy: rightEyeC.y, radius: faceH*0.32, strength: 0.90, kind: 'expand' })
      break
    case 'tiny-face':
      ops.push({ cx: faceCX, cy: faceCY - faceH*0.05, radius: R * 0.60, strength: 0.48, kind: 'shrink' })
      break
    case 'alien-eyes':
      ops.push({ cx: leftEyeC.x,  cy: leftEyeC.y,  radius: faceH*0.22, strength: 0.55, kind: 'expand' })
      ops.push({ cx: rightEyeC.x, cy: rightEyeC.y, radius: faceH*0.22, strength: 0.55, kind: 'expand' })
      // Expand forehead up (elongate skull)
      ops.push({ cx: faceCX, cy: foreheadP.y - faceH*0.10, radius: faceH*0.40, strength: 0.30, kind: 'expand' })
      // Shrink lower face (narrow jaw)
      ops.push({ cx: faceCX, cy: chinP.y, radius: faceH*0.35, strength: 0.35, kind: 'h-shrink' })
      break
    case 'big-nose':
      ops.push({ cx: noseTipP.x, cy: noseTipP.y + faceH*0.02, radius: faceH*0.24, strength: 0.70, kind: 'expand' })
      break
    case 'big-forehead':
      // Balloon the forehead up like someone got hit by a frying pan
      ops.push({ cx: faceCX, cy: foreheadP.y - faceH*0.05, radius: faceH*0.55, strength: 0.65, kind: 'v-expand' })
      // Slight h-shrink on lower face to exaggerate the big brain look
      ops.push({ cx: faceCX, cy: chinP.y + faceH*0.08, radius: faceH*0.40, strength: 0.30, kind: 'h-shrink' })
      break
    case 'chipmunk':
      // Massive cheek puffs on both sides
      ops.push({ cx: leftEarP.x  + faceW*0.08, cy: faceCY + faceH*0.05, radius: faceH*0.38, strength: 0.72, kind: 'expand' })
      ops.push({ cx: rightEarP.x - faceW*0.08, cy: faceCY + faceH*0.05, radius: faceH*0.38, strength: 0.72, kind: 'expand' })
      // Tiny nose to contrast
      ops.push({ cx: noseTipP.x, cy: noseTipP.y, radius: faceH*0.14, strength: 0.35, kind: 'shrink' })
      break
    case 'blowfish':
      // Entire face inflates like a balloon — bigger and more uniform than fat-face
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.85, strength: 0.68, kind: 'expand' })
      break
    case 'noodle':
      // Tall + thin — face stretches vertically and squishes horizontally
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.75, strength: 0.60, kind: 'v-expand' })
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.75, strength: 0.52, kind: 'h-shrink' })
      break
    case 'potato':
      // Wide + flat — face squishes like a potato
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.80, strength: 0.62, kind: 'h-expand' })
      ops.push({ cx: faceCX, cy: faceCY, radius: R * 0.80, strength: 0.48, kind: 'v-shrink' })
      break
    case 'big-mouth':
      // Jaw and mouth inflate like a bass or a Muppet
      ops.push({ cx: noseTipP.x, cy: chinP.y - faceH*0.10, radius: faceH*0.50, strength: 0.70, kind: 'expand' })
      ops.push({ cx: faceCX, cy: chinP.y + faceH*0.05, radius: faceH*0.38, strength: 0.40, kind: 'h-expand' })
      break
    case 'tiny-mouth':
      // Mouth shrinks to an adorable little dot
      ops.push({ cx: noseTipP.x, cy: chinP.y - faceH*0.18, radius: faceH*0.28, strength: 0.72, kind: 'shrink' })
      break
    case 'cyclops':
      // Both eyes get pulled toward the nose bridge (merge into one giant eye)
      ops.push({ cx: noseTipP.x, cy: faceCY - faceH*0.12, radius: faceH*0.55, strength: 0.48, kind: 'h-shrink' })
      // Also expand the nose/eye area so the merged eye looks big
      ops.push({ cx: noseTipP.x, cy: faceCY - faceH*0.10, radius: faceH*0.22, strength: 0.40, kind: 'expand' })
      break
    // funhouse + melting are handled below with per-pixel special logic
  }

  const isSpecialFilter = filterId === 'funhouse' || filterId === 'melting'
  if (ops.length === 0 && !isSpecialFilter) return

  const imgData = ctx.getImageData(0, 0, W, H)
  const src = imgData.data
  const dst = new Uint8ClampedArray(src.length)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let dispX = 0, dispY = 0

      for (const op of ops) {
        const dx = x - op.cx
        const dy = y - op.cy
        const r2 = dx*dx + dy*dy
        const rr = op.radius * op.radius
        if (r2 >= rr || r2 < 0.01) continue
        const r = Math.sqrt(r2)
        const falloff = 1 - r / op.radius
        const t = falloff * falloff * op.strength
        switch (op.kind) {
          case 'expand':   dispX -= dx * t; dispY -= dy * t; break   // source closer → region appears bigger
          case 'shrink':   dispX += dx * t; dispY += dy * t; break   // source farther → region appears smaller
          case 'h-expand': dispX -= dx * t;                   break   // horizontal only expand (fat)
          case 'h-shrink': dispX += dx * t;                   break   // horizontal only shrink (slim)
          case 'v-expand':                  dispY -= dy * t;  break   // vertical only expand (noodle)
          case 'v-shrink':                  dispY += dy * t;  break   // vertical only shrink (potato)
        }
      }

      // ── Special per-pixel effects ─────────────────────────────────────────
      if (filterId === 'funhouse') {
        // Sin-wave funhouse mirror — wobbles across face in X and Y
        const relX = (x - faceCX) / (faceW * 0.7)
        const relY = (y - faceCY) / (faceH * 0.7)
        const inFace = relX*relX + relY*relY < 1.8
        if (inFace) {
          const wave = Math.sin(y / (faceH * 0.12)) * faceW * 0.10
          const wave2 = Math.sin(x / (faceW * 0.12)) * faceH * 0.07
          const strength = Math.max(0, 1 - Math.sqrt(relX*relX + relY*relY) / 1.35)
          dispX += wave * strength
          dispY += wave2 * strength
        }
      }

      if (filterId === 'melting') {
        // Face drips downward like hot wax — displacement grows with y position in face
        const relY = (y - foreheadP.y) / faceH
        const relX = (x - faceCX) / (faceW * 0.6)
        const inFace = Math.abs(relX) < 1.2 && relY > 0.1 && relY < 1.6
        if (inFace) {
          const drip = Math.pow(Math.max(0, relY - 0.15), 1.5) * faceH * 0.35
          // Add horizontal wobble to the drip for extra chaos
          const wobble = Math.sin(x / (faceW * 0.18) + relY * 3) * faceW * 0.06 * relY
          const strength = Math.max(0, 1 - Math.abs(relX) / 1.1)
          dispY -= drip * strength   // source above → pixels stretch down (melting)
          dispX += wobble * strength
        }
      }

      const srcX = Math.max(0, Math.min(W - 2, x + dispX))
      const srcY = Math.max(0, Math.min(H - 2, y + dispY))
      // Bilinear interpolation
      const fx = srcX | 0, fy = srcY | 0
      const wx = srcX - fx, wy = srcY - fy
      const i00 = (fy * W + fx) * 4
      const i10 = (fy * W + Math.min(fx + 1, W - 1)) * 4
      const i01 = (Math.min(fy + 1, H - 1) * W + fx) * 4
      const i11 = (Math.min(fy + 1, H - 1) * W + Math.min(fx + 1, W - 1)) * 4
      const di  = (y * W + x) * 4
      const w00 = (1-wx)*(1-wy), w10 = wx*(1-wy), w01 = (1-wx)*wy, w11 = wx*wy
      dst[di]   = src[i00]*w00 + src[i10]*w10 + src[i01]*w01 + src[i11]*w11
      dst[di+1] = src[i00+1]*w00 + src[i10+1]*w10 + src[i01+1]*w01 + src[i11+1]*w11
      dst[di+2] = src[i00+2]*w00 + src[i10+2]*w10 + src[i01+2]*w01 + src[i11+2]*w11
      dst[di+3] = src[i00+3]*w00 + src[i10+3]*w10 + src[i01+3]*w01 + src[i11+3]*w11
    }
  }

  ctx.putImageData(new ImageData(dst, W, H), 0, 0)
}

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
  // Natural coords (no horizontal flip) — video is drawn unmirrored;
  // display canvas uses CSS scaleX(-1) for self-view mirror effect
  return { x: p.x * W, y: p.y * H }
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
    // No neck/shoulder — face only
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

// ─── Expression system ────────────────────────────────────────────────────────
interface FaceExpressions {
  browRaise:  number  // 0=neutral … 1=fully shocked/raised
  mouthOpen:  number  // 0=closed … 1=wide open
  smileRatio: number  // -1=frown … 0=neutral … 1=big smile
  eyeOpenL:   number  // 0=closed … 1=wide open
  eyeOpenR:   number
}

function computeExpressions(
  landmarks: NormalizedLandmark[], W: number, H: number, faceH: number
): FaceExpressions {
  const BROW_R_IDX = [70, 63, 105, 66, 107]
  const BROW_L_IDX = [336, 296, 334, 293, 300]
  const RE_IDX     = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]
  const LE_IDX     = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]

  // Brow raise: gap between brow midpoint and eye top, normalized
  const browRMid = BROW_R_IDX.reduce((s,i)=>s+lm(landmarks,i,W,H).y,0) / BROW_R_IDX.length
  const browLMid = BROW_L_IDX.reduce((s,i)=>s+lm(landmarks,i,W,H).y,0) / BROW_L_IDX.length
  const eyeRTop  = Math.min(...RE_IDX.map(i=>lm(landmarks,i,W,H).y))
  const eyeLTop  = Math.min(...LE_IDX.map(i=>lm(landmarks,i,W,H).y))
  const gapR = (eyeRTop - browRMid) / faceH
  const gapL = (eyeLTop - browLMid) / faceH
  // neutral gap ≈ 0.08, shocked ≈ 0.20
  const browRaise = Math.max(0, Math.min(1, ((gapR + gapL) / 2 - 0.07) / 0.14))

  // Mouth open
  const iTop = lm(landmarks, 13, W, H)
  const iBot = lm(landmarks, 14, W, H)
  const mouthOpen = Math.min(1, Math.abs(iBot.y - iTop.y) / (faceH * 0.14))

  // Smile: lip corner horizontal spread (wider = more smile)
  const lCorner = lm(landmarks, 61,  W, H)
  const rCorner = lm(landmarks, 291, W, H)
  const lipSpread = Math.abs(rCorner.x - lCorner.x) / faceH
  // neutral ≈ 0.35, smile ≈ 0.52, frown ≈ 0.25
  const smileRatio = Math.max(-1, Math.min(1, (lipSpread - 0.35) / 0.18))

  // Eye openness (EAR)
  const rEAR = computeEyeEAR(landmarks, 159, 145, 33,  133, W, H)
  const lEAR = computeEyeEAR(landmarks, 386, 374, 362, 263, W, H)
  const eyeOpenR = Math.min(1, rEAR / 0.24)
  const eyeOpenL = Math.min(1, lEAR / 0.24)

  return { browRaise, mouthOpen, smileRatio, eyeOpenL, eyeOpenR }
}

// ─── Expression visuals ───────────────────────────────────────────────────────
function drawMouthExpression(
  ctx: CanvasRenderingContext2D, char: Character,
  landmarks: NormalizedLandmark[], W: number, H: number, faceH: number,
  expr: FaceExpressions
) {
  if (expr.mouthOpen < 0.18 && expr.smileRatio < 0.25) return
  const iTop = lm(landmarks, 13, W, H)
  const iBot = lm(landmarks, 14, W, H)
  const lCorner = lm(landmarks, 61, W, H)
  const rCorner = lm(landmarks, 291, W, H)
  const mc = { x: (lCorner.x + rCorner.x) / 2, y: (iTop.y + iBot.y) / 2 }
  const mW = Math.abs(rCorner.x - lCorner.x) * (1 + expr.smileRatio * 0.5 + expr.mouthOpen * 0.4)
  const mH = Math.abs(iBot.y - iTop.y) * (1 + expr.mouthOpen * 1.2) + faceH * 0.015

  ctx.save()
  switch (char.id) {
    case 'skull': {
      // Jaw-drop: dark hollow mouth + jagged teeth top
      if (expr.mouthOpen > 0.25) {
        ctx.fillStyle = 'rgba(0,0,0,0.88)'
        ctx.beginPath(); ctx.ellipse(mc.x, mc.y + mH*0.1, mW*0.62, mH*0.72, 0, 0, Math.PI*2); ctx.fill()
        // Top teeth row
        ctx.fillStyle = 'rgba(240,240,230,0.95)'
        const teeth = 5, tw = mW * 0.9 / teeth
        for (let i = 0; i < teeth; i++) {
          const tx = mc.x - mW*0.45 + tw*(i+0.5)
          ctx.fillRect(tx - tw*0.35, mc.y - mH*0.08, tw*0.7, mH * 0.4 * expr.mouthOpen)
        }
      }
      break
    }
    case 'clown': {
      // Exaggerated red lips that grow with the smile
      ctx.strokeStyle = '#cc0000'; ctx.lineWidth = faceH * 0.022; ctx.lineCap = 'round'
      const smileArc = expr.smileRatio * faceH * 0.06
      ctx.beginPath()
      ctx.moveTo(lCorner.x - faceH*0.05, lCorner.y)
      ctx.quadraticCurveTo(mc.x, mc.y + smileArc + mH*0.4, rCorner.x + faceH*0.05, rCorner.y)
      ctx.stroke()
      if (expr.mouthOpen > 0.3) {
        ctx.fillStyle = 'rgba(20,0,0,0.75)'
        ctx.beginPath(); ctx.ellipse(mc.x, mc.y + mH*0.15, mW*0.5, mH*0.55, 0, 0, Math.PI*2); ctx.fill()
      }
      break
    }
    case 'devil': {
      // Fangs appear when smiling + mouth opens
      if (expr.mouthOpen > 0.2 || expr.smileRatio > 0.3) {
        ctx.strokeStyle = '#880000'; ctx.lineWidth = faceH * 0.016
        const cornerLift = expr.smileRatio * faceH * 0.04
        ctx.beginPath()
        ctx.moveTo(lCorner.x - faceH*0.03, lCorner.y - cornerLift)
        ctx.quadraticCurveTo(mc.x, mc.y + faceH*0.02, rCorner.x + faceH*0.03, rCorner.y - cornerLift)
        ctx.stroke()
        if (expr.mouthOpen > 0.25) {
          // Two fangs
          ctx.fillStyle = 'rgba(245,240,240,0.92)'
          ;[-1,1].forEach(side => {
            ctx.beginPath()
            ctx.moveTo(mc.x + side*mW*0.18, mc.y - mH*0.05)
            ctx.lineTo(mc.x + side*mW*0.30, mc.y - mH*0.05)
            ctx.lineTo(mc.x + side*mW*0.24, mc.y + mH*0.55 * expr.mouthOpen)
            ctx.closePath(); ctx.fill()
          })
        }
      }
      break
    }
    case 'pickle': {
      // Wavy cartoon smile around mouth
      ctx.strokeStyle = '#2d5a1b'; ctx.lineWidth = faceH * 0.018; ctx.lineCap = 'round'
      const lift = expr.smileRatio * faceH * 0.05 + expr.mouthOpen * faceH * 0.04
      ctx.beginPath()
      ctx.moveTo(lCorner.x - faceH*0.04, lCorner.y - lift*0.3)
      ctx.bezierCurveTo(
        mc.x - mW*0.2, mc.y + lift + mH*0.3,
        mc.x + mW*0.2, mc.y + lift + mH*0.3,
        rCorner.x + faceH*0.04, rCorner.y - lift*0.3
      )
      ctx.stroke()
      break
    }
    case 'peanut': {
      // Warm brown smile line
      if (expr.smileRatio > 0.1 || expr.mouthOpen > 0.15) {
        ctx.strokeStyle = '#7a5c20'; ctx.lineWidth = faceH * 0.022; ctx.lineCap = 'round'
        const lift = expr.smileRatio * faceH * 0.05
        ctx.beginPath()
        ctx.moveTo(lCorner.x - faceH*0.03, lCorner.y - lift*0.4)
        ctx.quadraticCurveTo(mc.x, mc.y + lift + mH*0.4 * expr.mouthOpen, rCorner.x + faceH*0.03, rCorner.y - lift*0.4)
        ctx.stroke()
      }
      break
    }
    case 'robot': {
      // Rectangular speaker mouth
      if (expr.mouthOpen > 0.15 || expr.smileRatio > 0.2) {
        ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = faceH * 0.012
        const boxH = Math.max(faceH*0.04, mH * (0.5 + expr.mouthOpen * 0.8))
        ctx.strokeRect(mc.x - mW*0.48, mc.y - boxH*0.4, mW*0.96, boxH)
        // Frequency bars inside
        ctx.fillStyle = `rgba(0,229,255,${0.5 + expr.mouthOpen * 0.4})`
        const bars = 5
        for (let b = 0; b < bars; b++) {
          const bh = boxH * (0.3 + Math.sin(b * 1.8) * 0.35) * (0.4 + expr.mouthOpen * 0.8)
          ctx.fillRect(mc.x - mW*0.42 + b*(mW*0.84/bars), mc.y + boxH*0.3 - bh, mW*0.84/bars*0.72, bh)
        }
      }
      break
    }
    case 'ghost': {
      // Wavy ghost mouth
      ctx.strokeStyle = `rgba(220,100,255,${0.7 + expr.mouthOpen * 0.3})`
      ctx.lineWidth = faceH * 0.018; ctx.lineCap = 'round'
      const waves = 4; const ww = mW / waves
      ctx.beginPath(); ctx.moveTo(lCorner.x - faceH*0.02, mc.y)
      for (let w = 0; w < waves; w++) {
        const wx = lCorner.x - faceH*0.02 + ww * w
        ctx.quadraticCurveTo(wx + ww*0.25, mc.y + (w%2===0 ? 1:-1)*faceH*0.03*(1+expr.mouthOpen), wx + ww*0.5, mc.y)
        ctx.quadraticCurveTo(wx + ww*0.75, mc.y + (w%2===0 ? -1:1)*faceH*0.03*(1+expr.mouthOpen), wx + ww, mc.y)
      }
      ctx.stroke()
      break
    }
    default: {
      // Generic: colored outline that grows with expressions
      if (expr.smileRatio > 0.2 || expr.mouthOpen > 0.2) {
        ctx.strokeStyle = (char.eyeRing ?? char.skin).replace(/[\d.]+\)$/, '0.80)')
        ctx.lineWidth = faceH * 0.020; ctx.lineCap = 'round'
        const lift = expr.smileRatio * faceH * 0.04
        ctx.beginPath()
        ctx.moveTo(lCorner.x - faceH*0.025, lCorner.y - lift*0.4)
        ctx.quadraticCurveTo(mc.x, mc.y + lift + mH * 0.35 * (1 + expr.mouthOpen), rCorner.x + faceH*0.025, rCorner.y - lift*0.4)
        ctx.stroke()
      }
      break
    }
  }
  ctx.restore()
}

function drawSurpriseEffect(
  ctx: CanvasRenderingContext2D, char: Character,
  landmarks: NormalizedLandmark[], W: number, H: number, faceH: number,
  expr: FaceExpressions, t: number
) {
  if (expr.browRaise < 0.45) return
  const intensity = (expr.browRaise - 0.45) / 0.55  // 0→1 only when shocked
  const forehead = lm(landmarks, LM_FOREHEAD, W, H)
  const leftEar  = lm(landmarks, LM_LEFT_EAR, W, H)
  const rightEar = lm(landmarks, LM_RIGHT_EAR, W, H)
  const faceCX = (leftEar.x + rightEar.x) / 2

  ctx.save()

  // Radiating shock lines above eyebrows
  const lineCount = 8
  const innerR = faceH * 0.28
  const outerR = faceH * (0.38 + intensity * 0.28)
  const centerY = forehead.y - faceH * 0.08
  ctx.strokeStyle = (char.eyeRing ?? char.skin).replace(/[\d.]+\)$/, `${0.55 * intensity})`)
  ctx.lineWidth = Math.max(1.5, faceH * 0.012)
  ctx.lineCap = 'round'
  for (let i = 0; i < lineCount; i++) {
    const angle = (Math.PI * 1.5) + (i - lineCount/2) * (Math.PI * 0.9 / lineCount)
    const wobble = Math.sin(t * 0.015 + i) * faceH * 0.012 * intensity
    ctx.beginPath()
    ctx.moveTo(faceCX + Math.cos(angle) * (innerR + wobble), centerY + Math.sin(angle) * innerR)
    ctx.lineTo(faceCX + Math.cos(angle) * (outerR + wobble), centerY + Math.sin(angle) * (outerR * 0.85))
    ctx.stroke()
  }

  // "!!" text above head when fully shocked
  if (intensity > 0.7) {
    const textScale = intensity * 0.9
    ctx.font = `bold ${faceH * 0.22 * textScale}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = (char.eyeRing ?? '#ffffff').replace(/[\d.]+\)$/, `${0.9 * intensity})`)
    // Slight shake effect
    const shakeX = Math.sin(t * 0.025) * faceH * 0.018 * intensity
    ctx.fillText('!!', faceCX + shakeX, forehead.y - faceH * 0.42 * textScale)
  }

  ctx.restore()
}

// ─── Particle system ──────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number
  born: number; duration: number
  r: number; h: number; s: number; l: number
  type: 'fire'|'smoke'|'sparkle'|'heart'|'energy'|'petal'
}

function spawnParticles(
  pool: Particle[], cx: number, cy: number, count: number,
  type: Particle['type'], now: number, spread: number, baseAngle: number,
  speed: number, h: number, s: number, l: number, r: number, duration: number
) {
  for (let i = 0; i < count; i++) {
    const ang = baseAngle + (Math.random() - 0.5) * spread
    const spd = speed * (0.55 + Math.random() * 0.9)
    pool.push({
      x: cx + (Math.random() - 0.5) * r * 2,
      y: cy + (Math.random() - 0.5) * r,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      born: now, duration: duration * (0.55 + Math.random() * 0.9),
      r: r * (0.45 + Math.random() * 1.1),
      h: h + (Math.random() - 0.5) * 18, s, l,
      type,
    })
  }
}

function updateAndDrawParticles(pool: Particle[], ctx: CanvasRenderingContext2D, now: number) {
  for (let i = pool.length - 1; i >= 0; i--) {
    if (now - pool[i].born >= pool[i].duration) { pool.splice(i, 1); continue }
  }
  for (const p of pool) {
    const frac  = Math.min(1, (now - p.born) / p.duration)
    const alpha = (1 - frac * frac)
    p.x += p.vx; p.y += p.vy
    ctx.save()
    switch (p.type) {
      case 'fire': {
        p.vy *= 0.968; p.vx *= 0.985
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + frac * 0.7), 0, Math.PI*2)
        ctx.fillStyle = `hsla(${p.h + frac*28},${p.s}%,${p.l + frac*22}%,${alpha * 0.88})`
        ctx.fill(); break
      }
      case 'smoke': {
        p.vy *= 0.982; p.vx += (Math.random()-0.5)*0.25
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + frac * 2.8), 0, Math.PI*2)
        ctx.fillStyle = `hsla(${p.h},${p.s}%,${p.l}%,${alpha * 0.28})`
        ctx.fill(); break
      }
      case 'sparkle': {
        ctx.translate(p.x, p.y); ctx.rotate(frac * Math.PI * 3)
        ctx.fillStyle = `hsla(${p.h},${p.s}%,${p.l}%,${alpha})`
        const sz = p.r * (1.1 - frac * 0.4)
        ctx.beginPath()
        for (let k = 0; k < 4; k++) {
          const a1 = k * Math.PI/2, a2 = a1 + Math.PI/4
          ctx.lineTo(Math.cos(a1)*sz, Math.sin(a1)*sz)
          ctx.lineTo(Math.cos(a2)*sz*0.32, Math.sin(a2)*sz*0.32)
        }
        ctx.closePath(); ctx.fill(); break
      }
      case 'heart': {
        p.vy *= 0.988
        ctx.font = `${p.r * 2.2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.globalAlpha = alpha
        ctx.fillStyle = `hsl(${p.h},${p.s}%,${p.l}%)`
        ctx.fillText('♥', p.x, p.y); break
      }
      case 'energy': {
        p.vy *= 0.960; p.vx *= 0.960
        ctx.shadowBlur = p.r * 3.5; ctx.shadowColor = `hsl(${p.h},100%,72%)`
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - frac * 0.25), 0, Math.PI*2)
        ctx.fillStyle = `hsla(${p.h},${p.s}%,${p.l}%,${alpha * 0.85})`
        ctx.fill(); ctx.shadowBlur = 0; break
      }
      case 'petal': {
        p.vy *= 0.980; p.vx += Math.sin(now * 0.003 + p.born * 0.001) * 0.14
        ctx.translate(p.x, p.y); ctx.rotate(frac * Math.PI * 1.8)
        ctx.fillStyle = `hsla(${p.h},${p.s}%,${p.l}%,${alpha * 0.82})`
        ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.3, p.r * 0.55, 0, 0, Math.PI*2)
        ctx.fill(); break
      }
    }
    ctx.restore()
  }
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
  landmarks: NormalizedLandmark[], W: number, H: number, faceH: number,
  expr?: FaceExpressions
) {
  const browColor = char.eyeRing ?? char.skin
  // Amplify vertical lift: up to 10% of faceH extra when fully shocked
  const lift = expr ? expr.browRaise * faceH * 0.10 : 0
  // Extra thickness when shocked (eyebrows get "heavier" under shock)
  const thickness = faceH * (0.030 + (expr?.browRaise ?? 0) * 0.018)

  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ;[BROW_RIGHT, BROW_LEFT].forEach(indices => {
    const pts = indices.map(i => { const p = lm(landmarks, i, W, H); return { x: p.x, y: p.y - lift } })
    // Main brow stroke
    ctx.beginPath()
    pts.forEach((p, n) => n === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = browColor; ctx.lineWidth = thickness; ctx.stroke()
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
  /** Canvas elements to blit every frame into (preview + in-call self-view) */
  displayCanvasRefs?: React.RefObject<HTMLCanvasElement>[]
  /** Remote video element — used for Face Merge */
  remoteVideoRef?: React.RefObject<HTMLVideoElement>
}

export function useCharacterOverlay({ localStream, displayCanvasRefs, remoteVideoRef }: UseCharacterOverlayOptions) {
  const [activeCharacter,    setActiveCharacter]    = useState<Character | null>(null)
  const [activeAccessories,  setActiveAccessories]  = useState<string[]>([])
  const [activeBackground,   setActiveBackground]   = useState<string>('none')
  const [filterReady,        setFilterReady]        = useState(false)
  const [filterError,        setFilterError]        = useState<string | null>(null)
  const [isMerging,          setIsMerging]          = useState(false)
  const [activeDistortion,   setActiveDistortionState] = useState<string | null>(null)

  const canvasRef              = useRef<HTMLCanvasElement | null>(null)
  const canvasStreamRef        = useRef<MediaStream | null>(null)
  const rafRef                 = useRef<number | null>(null)
  const activeCharRef          = useRef<Character | null>(null)
  const activeAccRef           = useRef<string[]>([])
  const activeBgRef            = useRef<string>('none')
  const landmarkerRef          = useRef<FaceLandmarker | null>(null)
  const landmarkerReady        = useRef(false)
  const segmenterRef           = useRef<ImageSegmenter | null>(null)
  const segmenterReady         = useRef(false)
  // ── Face Merge ──────────────────────────────────────────────────────────────
  const isMergingRef           = useRef(false)
  const mergeRatioRef          = useRef(0)          // 0 = normal, 0.5 = fully merged
  const remoteLandmarkerRef    = useRef<FaceLandmarker | null>(null)
  const remoteLandmarkerReady  = useRef(false)
  const remoteLmRef            = useRef<NormalizedLandmark[] | null>(null)
  const remoteLastTRef         = useRef(0)
  const mergeInitRef           = useRef(false)
  const activeDistortionRef    = useRef<string | null>(null)

  useEffect(() => { activeCharRef.current      = activeCharacter    }, [activeCharacter])
  useEffect(() => { activeAccRef.current       = activeAccessories  }, [activeAccessories])
  useEffect(() => { activeBgRef.current        = activeBackground   }, [activeBackground])
  useEffect(() => { activeDistortionRef.current = activeDistortion  }, [activeDistortion])

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
        // Load FaceLandmarker — GPU first, CPU fallback
        try {
          const fl = await tryCreateFaceLandmarker(vision, 'GPU')
          if (!cancelled) { landmarkerRef.current = fl; landmarkerReady.current = true }
        } catch {
          try {
            const fl = await tryCreateFaceLandmarker(vision, 'CPU')
            if (!cancelled) { landmarkerRef.current = fl; landmarkerReady.current = true }
          } catch (e) {
            console.error('[FaceFilter] FaceLandmarker failed:', e)
          }
        }

        // Load Segmenter — GPU first, CPU fallback
        try {
          const seg = await tryCreateSegmenter(vision, 'GPU')
          if (!cancelled) { segmenterRef.current = seg; segmenterReady.current = true }
        } catch {
          try {
            const seg = await tryCreateSegmenter(vision, 'CPU')
            if (!cancelled) { segmenterRef.current = seg; segmenterReady.current = true }
          } catch (e) {
            console.error('[FaceFilter] Segmenter failed:', e)
          }
        }

        if (!cancelled) {
          const anyReady = landmarkerReady.current || segmenterReady.current
          setFilterReady(anyReady)
          if (!landmarkerReady.current) setFilterError('Face tracking unavailable — characters will use emoji fallback')
        }
      } catch (e) {
        console.error('[FaceFilter] Init failed:', e)
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
    canvas.width = 640; canvas.height = 360
    canvasRef.current = canvas
    canvasStreamRef.current = canvas.captureStream(30)
    const ctx = canvas.getContext('2d')!
    const particlePool: Particle[] = []  // lives for duration of this stream session

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = 640; maskCanvas.height = 360
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
    segCanvas.width = 640; segCanvas.height = 360
    const sctx = segCanvas.getContext('2d')!

    // ── Perf: FPS cap + detection throttle ───────────────────────────────────
    let lastDrawTime = 0
    let lastLandmarkTime = 0
    let cachedLandmarks: NormalizedLandmark[] | null = null
    let lastSegmentTime = 0
    let cachedSegMask: Float32Array | null = null

    const vid = document.createElement('video')
    vid.srcObject = localStream; vid.autoplay = true; vid.muted = true
    vid.playsInline = true; vid.play().catch(() => {})
    const W = canvas.width, H = canvas.height

    const draw = () => {
      const t = performance.now()
      // ── FPS cap: 30fps max — frees CPU for WebRTC encoder ────────────────
      if (t - lastDrawTime < 33) { rafRef.current = requestAnimationFrame(draw); return }
      lastDrawTime = t

      const char  = activeCharRef.current
      const accs  = activeAccRef.current
      const bg    = activeBgRef.current
      const ready = vid.readyState >= 2

      if (!ready) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
        rafRef.current = requestAnimationFrame(draw); return
      }

      // ── Background layer ──────────────────────────────────────────────
      // Video drawn in NATURAL orientation (no canvas flip).
      // CSS scaleX(-1) on the display canvas gives the self-view mirror effect.
      // WebRTC stream stays natural so the remote peer sees correct orientation.
      if (bg === 'none') {
        ctx.drawImage(vid, 0, 0, W, H)

      } else if (bg === 'blur') {
        // Blurred background, then sharp person on top
        ctx.save(); ctx.filter = 'blur(18px)'; ctx.drawImage(vid, 0, 0, W, H); ctx.restore()
        // Overlay sharp person using segmentation mask
        if (segmenterReady.current && segmenterRef.current) {
          try {
            // Throttle segmentation to ~10fps — mask changes slowly
            if (t - lastSegmentTime > 100) {
              const result = segmenterRef.current.segmentForVideo(vid, t)
              cachedSegMask = result.confidenceMasks![0].getAsFloat32Array()
              lastSegmentTime = t
            }
            if (cachedSegMask) {
              sctx.drawImage(vid, 0, 0, W, H)
              const fd = sctx.getImageData(0,0,W,H)
              for (let i = 0; i < cachedSegMask.length; i++) { fd.data[i*4+3] = Math.round(cachedSegMask[i]*255) }
              sctx.putImageData(fd, 0, 0)
              ctx.drawImage(segCanvas, 0, 0)
            }
          } catch (_) { /* skip frame */ }
        }

      } else {
        // Preset background + person cutout via segmentation
        renderBackground(ctx, bg, W, H, t)
        if (segmenterReady.current && segmenterRef.current) {
          try {
            // Throttle segmentation to ~10fps — reuse cached mask between frames
            if (t - lastSegmentTime > 100) {
              const result = segmenterRef.current.segmentForVideo(vid, t)
              cachedSegMask = result.confidenceMasks![0].getAsFloat32Array()
              lastSegmentTime = t
            }
            if (cachedSegMask) {
              sctx.drawImage(vid, 0, 0, W, H)
              const fd = sctx.getImageData(0,0,W,H)
              for (let i = 0; i < cachedSegMask.length; i++) { fd.data[i*4+3] = Math.round(cachedSegMask[i]*255) }
              sctx.putImageData(fd, 0, 0)
              ctx.drawImage(segCanvas, 0, 0)
            }
          } catch (_) { /* skip frame */ }
        } else {
          // Fallback: natural video over background
          ctx.drawImage(vid, 0, 0, W, H)
        }
      }

      // ── Character + accessories on top of video/bg ────────────────────
      // Landmarks detection is OPTIONAL — if FaceLandmarker failed to load we
      // still show the fallback tint + emoji so the user knows the filter is ON.
      // ── Scene color grading — character tints the whole frame ────────────
      if (char) {
        const sceneTints: Record<string,string> = {
          devil:       'rgba(55,0,0,0.09)',
          'neon-skull':'rgba(35,0,55,0.10)',
          ghost:       'rgba(18,0,35,0.10)',
          skull:       'rgba(12,12,12,0.08)',
          robot:       'rgba(0,18,28,0.10)',
          alien:       'rgba(0,28,0,0.09)',
          dragon:      'rgba(30,0,45,0.10)',
          fire:        'rgba(45,8,0,0.09)',
          anime:       'rgba(255,220,230,0.05)',
        }
        const st = sceneTints[char.id]
        if (st) { ctx.fillStyle = st; ctx.fillRect(0, 0, W, H) }
      }

      // ── Face Merge: animate ratio + detect remote landmarks ─────────────
      const mergeTarget = isMergingRef.current ? 0.5 : 0
      if (mergeRatioRef.current < mergeTarget)
        mergeRatioRef.current = Math.min(mergeTarget, mergeRatioRef.current + 0.010)
      else if (mergeRatioRef.current > mergeTarget)
        mergeRatioRef.current = Math.max(mergeTarget, mergeRatioRef.current - 0.015)

      const hasFilter     = !!char || accs.length > 0
      const hasDistortion = !!activeDistortionRef.current

      // ── Shared landmark detection (distortion + character both use this) ──
      let landmarks: NormalizedLandmark[] | null = null
      if ((hasFilter || hasDistortion) && landmarkerReady.current && landmarkerRef.current) {
        try {
          // Throttle MediaPipe to ~15fps — cache landmarks between frames
          if (t - lastLandmarkTime > 66) {
            const result = landmarkerRef.current.detectForVideo(vid, t)
            cachedLandmarks = result.faceLandmarks[0] ?? null
            lastLandmarkTime = t
          }
          landmarks = cachedLandmarks
        } catch (_) {}
      }

      // ── Distortion filters (pixel-level warp on the drawn video frame) ────
      if (hasDistortion && landmarks) {
        applyFaceDistortion(ctx, W, H, activeDistortionRef.current!, landmarks)
      }

      if (hasFilter) {
        // ── Remote landmark detection for merge (max ~15fps) ───────────
        const mr = mergeRatioRef.current
        const remVid = remoteVideoRef?.current
        if (mr > 0 && remoteLandmarkerReady.current && remoteLandmarkerRef.current && remVid && remVid.readyState >= 2) {
          if (t - remoteLastTRef.current > 66) {
            try {
              const rRes = remoteLandmarkerRef.current.detectForVideo(remVid, Date.now())
              remoteLmRef.current = rRes.faceLandmarks[0] ?? null
              remoteLastTRef.current = t
            } catch (_) {}
          }
        }

        // ── Blend local + remote landmarks ────────────────────────────
        if (mr > 0.01 && remoteLmRef.current && landmarks) {
          landmarks = landmarks.map((p, i) => {
            const r = remoteLmRef.current![i] ?? p
            return { x: p.x*(1-mr) + r.x*mr, y: p.y*(1-mr) + r.y*mr, z: (p.z??0)*(1-mr) + (r.z??0)*mr, visibility: p.visibility }
          })
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

          // ── Merge glow: pulsing purple/pink aura ──────────────────
          if (mr > 0.05) {
            const pulse = 0.6 + 0.4 * Math.sin(t * 0.006)
            ctx.save()
            ctx.shadowBlur = 28; ctx.shadowColor = `rgba(220,0,255,${0.8 * pulse})`
            tracePoly(ctx, landmarks, FACE_OVAL, W, H)
            ctx.strokeStyle = `rgba(200,0,255,${0.55 * mr * pulse})`
            ctx.lineWidth = faceH * 0.06 * mr; ctx.stroke()
            // Second ring — hot pink
            ctx.shadowColor = `rgba(255,0,150,${0.6 * pulse})`
            tracePoly(ctx, landmarks, FACE_OVAL, W, H)
            ctx.strokeStyle = `rgba(255,0,150,${0.35 * mr * pulse})`
            ctx.lineWidth = faceH * 0.10 * mr; ctx.stroke()
            ctx.restore()
          }
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

            // Punch eye + mouth cutouts — larger for anime, standard for others
            const eyeExpand  = char.id === 'anime' ? faceH * 0.072 : faceH * 0.038
            const mouthExpand = char.id === 'anime' ? faceH * 0.032 : faceH * 0.028
            mctx.globalCompositeOperation = 'destination-out'
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LEFT_EYE,   W, H, eyeExpand); mctx.fill()
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, RIGHT_EYE,  W, H, eyeExpand); mctx.fill()
            expandPoly(mctx as unknown as CanvasRenderingContext2D, landmarks, LIPS_OUTER, W, H, mouthExpand); mctx.fill()

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
            // ── HYPER-REALISTIC EYE SOCKET SYSTEM ─────────────────────────
            const eyeR    = char.id === 'anime' ? faceH * 0.095 : faceH * 0.065
            const holeR   = char.id === 'anime' ? faceH * 0.072 : faceH * 0.042
            ctx.save()
            ;[leftEyeCenter, rightEyeCenter].forEach((eye, eyeIdx) => {
              const isLeft = eyeIdx === 0

              // ── 1. SOCKET DEPTH GRADIENT ──────────────────────────────────
              // Transparent at center (real eye shows through) → dark shadow at rim
              // Creates the illusion the eye is inside a deep socket
              const depthGrad = ctx.createRadialGradient(
                eye.x, eye.y, holeR * 0.7,   // inner: transparent (eye hole zone)
                eye.x, eye.y, eyeR * 1.55    // outer: dark shadow at socket rim
              )
              switch (char.id) {
                case 'skull':
                  depthGrad.addColorStop(0,    'transparent')
                  depthGrad.addColorStop(0.30, 'rgba(5,3,2,0.0)')
                  depthGrad.addColorStop(0.65, 'rgba(8,5,3,0.55)')
                  depthGrad.addColorStop(1.0,  'rgba(2,1,0,0.92)')
                  break
                case 'devil':
                  depthGrad.addColorStop(0,    'rgba(255,40,0,0.0)')
                  depthGrad.addColorStop(0.35, 'rgba(255,40,0,0.12)')
                  depthGrad.addColorStop(0.68, 'rgba(200,0,0,0.52)')
                  depthGrad.addColorStop(1.0,  'rgba(120,0,0,0.85)')
                  break
                case 'ghost':
                  depthGrad.addColorStop(0,    'rgba(200,80,255,0.08)')
                  depthGrad.addColorStop(0.4,  'rgba(160,0,255,0.22)')
                  depthGrad.addColorStop(0.75, 'rgba(100,0,180,0.48)')
                  depthGrad.addColorStop(1.0,  'rgba(60,0,120,0.70)')
                  break
                case 'robot':
                  depthGrad.addColorStop(0,    'rgba(0,229,255,0.10)')
                  depthGrad.addColorStop(0.45, 'rgba(0,100,200,0.30)')
                  depthGrad.addColorStop(0.78, 'rgba(0,20,60,0.65)')
                  depthGrad.addColorStop(1.0,  'rgba(0,10,30,0.88)')
                  break
                case 'peanut':
                  depthGrad.addColorStop(0,    'transparent')
                  depthGrad.addColorStop(0.40, 'rgba(80,45,5,0.08)')
                  depthGrad.addColorStop(0.70, 'rgba(60,30,0,0.38)')
                  depthGrad.addColorStop(1.0,  'rgba(40,18,0,0.68)')
                  break
                case 'pickle':
                  depthGrad.addColorStop(0,    'transparent')
                  depthGrad.addColorStop(0.38, 'rgba(20,60,10,0.08)')
                  depthGrad.addColorStop(0.70, 'rgba(15,50,8,0.42)')
                  depthGrad.addColorStop(1.0,  'rgba(10,35,5,0.72)')
                  break
                default:
                  depthGrad.addColorStop(0,    'transparent')
                  depthGrad.addColorStop(0.40, 'rgba(0,0,0,0.05)')
                  depthGrad.addColorStop(0.72, 'rgba(0,0,0,0.32)')
                  depthGrad.addColorStop(1.0,  'rgba(0,0,0,0.60)')
              }
              ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR * 1.55, 0, Math.PI*2)
              ctx.fillStyle = depthGrad; ctx.fill()

              // ── 2. CHARACTER SOCKET RIM — the precise frame around the hole ─
              switch (char.id) {
                case 'anime': {
                  // MASSIVE anime eyes — the whole style is defined by huge shiny eyes
                  const aEyeR = eyeR * 1.65
                  // White sclera
                  ctx.fillStyle = 'rgba(255,252,255,0.94)'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, aEyeR, 0, Math.PI*2); ctx.fill()
                  // Pink rim
                  ctx.strokeStyle = '#ff88bb'; ctx.lineWidth = faceH*0.018; ctx.stroke()
                  // Iris gradient (real eye shows in center)
                  const aiG = ctx.createRadialGradient(eye.x, eye.y, holeR*0.75, eye.x, eye.y, aEyeR*0.88)
                  aiG.addColorStop(0, 'transparent'); aiG.addColorStop(0.5, 'rgba(255,100,160,0.30)'); aiG.addColorStop(1, 'rgba(200,60,130,0.55)')
                  ctx.fillStyle = aiG; ctx.beginPath(); ctx.arc(eye.x, eye.y, aEyeR*0.88, 0, Math.PI*2); ctx.fill()
                  // Top eyelid — thick dark
                  ctx.strokeStyle = '#1a0010'; ctx.lineWidth = faceH*0.028; ctx.lineCap = 'round'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, aEyeR, Math.PI*1.1, Math.PI*1.9); ctx.stroke()
                  // Lower lash line
                  ctx.strokeStyle = '#3d0020'; ctx.lineWidth = faceH*0.010
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, aEyeR, Math.PI*0.05, Math.PI*0.95); ctx.stroke()
                  // Large white sparkle reflection (top-left)
                  ctx.fillStyle = 'rgba(255,255,255,0.95)'
                  ctx.beginPath(); ctx.ellipse(eye.x - aEyeR*0.38, eye.y - aEyeR*0.38, aEyeR*0.28, aEyeR*0.18, -0.4, 0, Math.PI*2); ctx.fill()
                  // Small secondary sparkle
                  ctx.beginPath(); ctx.arc(eye.x + aEyeR*0.28, eye.y - aEyeR*0.5, aEyeR*0.12, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'neon-skull': {
                  // Neon purple death sockets
                  const nsFlicker = 0.80 + 0.20 * Math.sin(t * 0.009 + eyeIdx * 2.1)
                  ctx.strokeStyle = `rgba(200,0,255,${0.88 * nsFlicker})`; ctx.lineWidth = faceH*0.016
                  ctx.shadowBlur = 16; ctx.shadowColor = `rgba(200,0,255,${0.7 * nsFlicker})`
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y + eyeR*0.05, eyeR*1.10, eyeR*0.95, 0, 0, Math.PI*2); ctx.stroke()
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y + eyeR*0.05, eyeR*1.32, eyeR*1.14, 0, 0, Math.PI*2); ctx.stroke()
                  ctx.shadowBlur = 0
                  const nvg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR)
                  nvg.addColorStop(0, `rgba(80,0,120,${0.55*nsFlicker})`); nvg.addColorStop(1, 'transparent')
                  ctx.fillStyle = nvg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'skull': {
                  // Bone orbital socket — slightly ovoid, rough inner edge
                  ctx.strokeStyle = 'rgba(200,192,178,0.85)'; ctx.lineWidth = faceH*0.016
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y + eyeR*0.05, eyeR*1.10, eyeR*0.95, 0, 0, Math.PI*2); ctx.stroke()
                  // Second inner ridge
                  ctx.strokeStyle = 'rgba(160,148,132,0.50)'; ctx.lineWidth = faceH*0.008
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y + eyeR*0.05, eyeR*1.30, eyeR*1.12, 0, 0, Math.PI*2); ctx.stroke()
                  // Dark void fill in socket
                  const vg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR)
                  vg.addColorStop(0, 'rgba(0,0,0,0.72)'); vg.addColorStop(0.55, 'rgba(0,0,0,0.28)'); vg.addColorStop(1, 'transparent')
                  ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'robot': {
                  // Metallic square LED frame with corner bolts
                  const hw = eyeR * 1.22, hh = eyeR * 0.88
                  // Dark panel
                  ctx.fillStyle = 'rgba(0,8,20,0.82)'
                  ctx.fillRect(eye.x - hw, eye.y - hh, hw*2, hh*2)
                  // Cyan border
                  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = faceH*0.016
                  ctx.strokeRect(eye.x - hw, eye.y - hh, hw*2, hh*2)
                  // Corner bolts
                  ;[[eye.x-hw, eye.y-hh],[eye.x+hw, eye.y-hh],[eye.x-hw, eye.y+hh],[eye.x+hw, eye.y+hh]].forEach(([bx,by]) => {
                    ctx.beginPath(); ctx.arc(bx as number, by as number, faceH*0.015, 0, Math.PI*2)
                    ctx.fillStyle = '#00b8d4'; ctx.fill()
                  })
                  // Animated scan line bouncing up/down
                  const scanY = eye.y - hh + (Math.sin(t * 0.005 + eyeIdx * 1.4) * 0.5 + 0.5) * hh * 2
                  ctx.strokeStyle = 'rgba(0,229,255,0.80)'; ctx.lineWidth = faceH*0.007
                  ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,229,255,0.7)'
                  ctx.beginPath(); ctx.moveTo(eye.x - hw*0.88, scanY); ctx.lineTo(eye.x + hw*0.88, scanY); ctx.stroke()
                  ctx.shadowBlur = 0
                  break
                }
                case 'devil': {
                  // Fire socket — ANIMATED ember flicker using t
                  const flick  = 0.72 + 0.28 * Math.sin(t * 0.011 + eyeIdx * 1.85)
                  const flick2 = 0.68 + 0.32 * Math.sin(t * 0.017 + eyeIdx * 1.2)
                  const fg = ctx.createRadialGradient(eye.x, eye.y - eyeR*0.2, 0, eye.x, eye.y, eyeR*1.28)
                  fg.addColorStop(0, `rgba(255,145,0,${0.50*flick})`); fg.addColorStop(0.45, `rgba(255,40,0,${0.35*flick})`); fg.addColorStop(1, 'transparent')
                  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.28, 0, Math.PI*2); ctx.fill()
                  ctx.shadowBlur = 12*flick; ctx.shadowColor = `rgba(255,60,0,${0.65*flick})`
                  ctx.strokeStyle = `rgba(255,45,0,${0.80*flick})`; ctx.lineWidth = faceH*0.018
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.0, 0, Math.PI*2); ctx.stroke()
                  ctx.shadowBlur = 0
                  const flameH = eyeR * (0.33 + 0.20 * flick2)
                  ctx.fillStyle = `rgba(255,${Math.floor(185+flick*55)},0,${0.62*flick})`
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y - eyeR*0.78, eyeR*0.19, flameH, 0, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'ghost': {
                  // Glowing portal rings — animated pulse
                  const gPulse = 0.75 + 0.25 * Math.sin(t * 0.007 + eyeIdx * Math.PI)
                  ;[1.45, 1.10].forEach((r, i) => {
                    const alpha = (i === 0 ? 0.32 : 0.62) * gPulse
                    ctx.strokeStyle = `rgba(210,80,255,${alpha})`; ctx.lineWidth = faceH*(i===0 ? 0.008 : 0.016)
                    ctx.shadowBlur = i === 1 ? 8*gPulse : 0; ctx.shadowColor = `rgba(200,80,255,${0.6*gPulse})`
                    ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*r, 0, Math.PI*2); ctx.stroke()
                    ctx.shadowBlur = 0
                  })
                  const gg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eyeR*0.8)
                  gg.addColorStop(0, `rgba(200,100,255,${0.20*gPulse})`); gg.addColorStop(1, 'transparent')
                  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*0.8, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'clown': {
                  // Diamond painted eye: white oval + red diamond top + blue bottom
                  ctx.strokeStyle = '#fff'; ctx.lineWidth = faceH*0.022
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.3, eyeR*1.0, 0, 0, Math.PI*2); ctx.stroke()
                  // Red star-point above eye
                  ctx.fillStyle = 'rgba(220,0,0,0.90)'
                  ctx.beginPath(); ctx.moveTo(eye.x, eye.y - eyeR*1.5); ctx.lineTo(eye.x - eyeR*0.42, eye.y - eyeR*0.6); ctx.lineTo(eye.x + eyeR*0.42, eye.y - eyeR*0.6); ctx.closePath(); ctx.fill()
                  // Blue teardrop below
                  ctx.fillStyle = 'rgba(0,120,255,0.80)'
                  ctx.beginPath(); ctx.moveTo(eye.x, eye.y + eyeR*1.6); ctx.lineTo(eye.x - eyeR*0.35, eye.y + eyeR*0.75); ctx.lineTo(eye.x + eyeR*0.35, eye.y + eyeR*0.75); ctx.closePath(); ctx.fill()
                  break
                }
                case 'cat': {
                  // Almond cat-eye with extended outer flick
                  ctx.strokeStyle = '#3d2200'; ctx.lineWidth = faceH*0.022; ctx.lineCap = 'round'
                  const flip = isLeft ? -1 : 1
                  ctx.beginPath()
                  ctx.moveTo(eye.x - eyeR*1.5, eye.y + eyeR*0.1)
                  ctx.quadraticCurveTo(eye.x, eye.y - eyeR*1.1, eye.x + eyeR*1.5, eye.y + eyeR*0.1)
                  ctx.quadraticCurveTo(eye.x, eye.y + eyeR*0.9, eye.x - eyeR*1.5, eye.y + eyeR*0.1)
                  ctx.stroke()
                  // Cat-eye flick — extends outward
                  ctx.beginPath()
                  ctx.moveTo(eye.x + flip*eyeR*1.5, eye.y + eyeR*0.1)
                  ctx.lineTo(eye.x + flip*eyeR*2.2, eye.y - eyeR*0.7)
                  ctx.stroke()
                  break
                }
                case 'frog': {
                  // Frog has PROTRUDING dome eyes ABOVE the real eyes (not cutting through)
                  // Draw dome eye above, then a small connector arc back to real eye area
                  const domeY = eye.y - eyeR*1.4
                  ctx.beginPath(); ctx.arc(eye.x, domeY, eyeR*1.4, 0, Math.PI*2)
                  ctx.fillStyle = 'rgba(76,175,80,0.92)'; ctx.fill()
                  ctx.strokeStyle = '#2d6e30'; ctx.lineWidth = faceH*0.012; ctx.stroke()
                  ctx.beginPath(); ctx.arc(eye.x, domeY, eyeR*0.85, 0, Math.PI*2)
                  ctx.fillStyle = '#fff'; ctx.fill()
                  ctx.beginPath(); ctx.arc(eye.x + eyeR*0.12, domeY + eyeR*0.1, eyeR*0.42, 0, Math.PI*2)
                  ctx.fillStyle = '#0d2b10'; ctx.fill()
                  // Shine
                  ctx.beginPath(); ctx.arc(eye.x - eyeR*0.22, domeY - eyeR*0.28, eyeR*0.18, 0, Math.PI*2)
                  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill()
                  // Don't use socket gradient for frog (dome covers eye area)
                  break
                }
                case 'alien': {
                  // Massive deep-black almond socket — no iris visible
                  ctx.fillStyle = 'rgba(0,0,0,0.94)'
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.85, eyeR*1.1, 0.18, 0, Math.PI*2); ctx.fill()
                  // Thin iridescent rim
                  ctx.strokeStyle = 'rgba(80,220,100,0.65)'; ctx.lineWidth = faceH*0.010
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.85, eyeR*1.1, 0.18, 0, Math.PI*2); ctx.stroke()
                  // Green reflection arc
                  ctx.strokeStyle = 'rgba(120,255,80,0.40)'; ctx.lineWidth = faceH*0.008
                  ctx.beginPath(); ctx.ellipse(eye.x - eyeR*0.35, eye.y - eyeR*0.38, eyeR*0.9, eyeR*0.28, 0.25, 0, Math.PI); ctx.stroke()
                  break
                }
                case 'pickle': {
                  // White sclera ring — thick cartoon outline with green iris hint
                  ctx.fillStyle = 'rgba(255,255,255,0.88)'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.4, 0, Math.PI*2); ctx.fill()
                  ctx.strokeStyle = '#1e4a12'; ctx.lineWidth = faceH*0.020; ctx.stroke()
                  // Green iris (partial — real eye shows through center)
                  const irisGrad = ctx.createRadialGradient(eye.x, eye.y, holeR*0.85, eye.x, eye.y, eyeR*1.05)
                  irisGrad.addColorStop(0, 'transparent')
                  irisGrad.addColorStop(0.5, 'rgba(45,122,27,0.50)')
                  irisGrad.addColorStop(1,   'rgba(30,88,16,0.70)')
                  ctx.fillStyle = irisGrad; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.05, 0, Math.PI*2); ctx.fill()
                  // Pupil ring hint
                  ctx.strokeStyle = 'rgba(10,30,5,0.60)'; ctx.lineWidth = faceH*0.010
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, holeR*1.05, 0, Math.PI*2); ctx.stroke()
                  break
                }
                case 'peanut': {
                  // Warm tan socket with crease lines — the "eye whites" area
                  ctx.fillStyle = 'rgba(235,210,155,0.72)'
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.25, eyeR*0.95, 0, 0, Math.PI*2); ctx.fill()
                  // Outer brown rim
                  ctx.strokeStyle = '#7a5020'; ctx.lineWidth = faceH*0.022
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.25, eyeR*0.95, 0, 0, Math.PI*2); ctx.stroke()
                  // Heavy upper eyelid crease (TheBurntPeanut look)
                  ctx.strokeStyle = '#4a2e08'; ctx.lineWidth = faceH*0.026; ctx.lineCap = 'round'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.25, Math.PI*1.12, Math.PI*1.88); ctx.stroke()
                  // Iris tint ring
                  const irisP = ctx.createRadialGradient(eye.x, eye.y, holeR*0.8, eye.x, eye.y, eyeR*0.95)
                  irisP.addColorStop(0, 'transparent'); irisP.addColorStop(0.6, 'rgba(140,90,20,0.28)'); irisP.addColorStop(1, 'rgba(100,60,10,0.45)')
                  ctx.fillStyle = irisP; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*0.95, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'bear': {
                  // Dark circles with white inner eye highlight
                  ctx.fillStyle = 'rgba(40,22,10,0.72)'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR*1.3, 0, Math.PI*2); ctx.fill()
                  ctx.strokeStyle = '#1a0e05'; ctx.lineWidth = faceH*0.020; ctx.stroke()
                  ctx.fillStyle = 'rgba(255,248,240,0.25)'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y - eyeR*0.2, eyeR*0.75, 0, Math.PI*2); ctx.fill()
                  break
                }
                case 'panda': {
                  // Large black eye patch + inner white sclera
                  ctx.fillStyle = 'rgba(22,18,18,0.85)'
                  ctx.beginPath(); ctx.ellipse(eye.x, eye.y, eyeR*1.6, eyeR*1.35, isLeft ? 0.2 : -0.2, 0, Math.PI*2); ctx.fill()
                  ctx.fillStyle = 'rgba(255,250,245,0.22)'
                  ctx.beginPath(); ctx.arc(eye.x, eye.y - eyeR*0.15, eyeR*0.72, 0, Math.PI*2); ctx.fill()
                  break
                }
                default: {
                  // Generic: socket ring
                  ctx.strokeStyle = char.eyeRing ?? char.skin
                  ctx.lineWidth = faceH * 0.024
                  ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR * 1.28, 0, Math.PI*2); ctx.stroke()
                  break
                }
              }

              // ── 3. EYELASH ARC — top of eye cutout, all characters ────────
              // Thin radiating lash strokes along the upper eye arc
              if (!['frog','alien','robot'].includes(char.id)) {
                const lashColor = char.eyeRing ? char.eyeRing.replace(/[\d.]+\)$/, '0.72)') : 'rgba(20,10,0,0.72)'
                ctx.strokeStyle = lashColor; ctx.lineWidth = faceH * 0.008; ctx.lineCap = 'round'
                const lashCount = 9, lashInR = eyeR * 1.05, lashOutR = eyeR * 1.48
                for (let l = 0; l < lashCount; l++) {
                  // Fan across the top arc (from ~200° to ~340° — upper semi)
                  const ang = Math.PI * (1.22 + (l / (lashCount-1)) * 0.56)
                  ctx.beginPath()
                  ctx.moveTo(eye.x + Math.cos(ang)*lashInR, eye.y + Math.sin(ang)*lashInR)
                  ctx.lineTo(eye.x + Math.cos(ang)*lashOutR, eye.y + Math.sin(ang)*lashOutR)
                  ctx.stroke()
                }
              }

              // ── 4. LIP/IRIS INNER RIM — thin precise line at hole edge ─────
              // Makes the eye cutout look FINISHED — not a raw hole
              if (!['alien','frog','skull'].includes(char.id)) {
                const rimColor = char.eyeRing ? char.eyeRing.replace(/[\d.]+\)$/, '0.55)') : 'rgba(0,0,0,0.45)'
                ctx.strokeStyle = rimColor; ctx.lineWidth = faceH * 0.009
                ctx.beginPath(); ctx.arc(eye.x, eye.y, holeR * 1.08, 0, Math.PI*2); ctx.stroke()
              }
            })
            ctx.restore()

            // ── LIP RIM: character-coloured border around mouth cutout ──────
            // Frames the real mouth — makes it look like the character's lips
            ctx.save();
            {
              const lipColor: Record<string, string> = {
                skull:  'rgba(220,210,192,0.70)', clown:  'rgba(200,0,0,0.80)',
                devil:  'rgba(160,0,0,0.75)',     ghost:  'rgba(190,60,255,0.65)',
                robot:  'rgba(0,200,255,0.65)',   alien:  'rgba(40,180,40,0.70)',
                pickle: 'rgba(30,90,15,0.72)',    peanut: 'rgba(110,75,20,0.72)',
                bear:   'rgba(50,25,10,0.65)',    cat:    'rgba(80,40,10,0.70)',
                devil2: 'rgba(150,0,0,0.80)',
              }
              const lc = lipColor[char.id] ?? (char.eyeRing?.replace(/[\d.]+\)$/, '0.65)') ?? 'rgba(0,0,0,0.55)')
              ctx.strokeStyle = lc; ctx.lineWidth = faceH * 0.014; ctx.lineCap = 'round'
              tracePoly(ctx, landmarks, LIPS_OUTER, W, H); ctx.stroke()
              // Outer lip shadow
              ctx.strokeStyle = lc.replace(/[\d.]+\)$/, '0.28)'); ctx.lineWidth = faceH * 0.022
              tracePoly(ctx, landmarks, LIPS_OUTER, W, H); ctx.stroke()
            }
            ctx.restore()

            // ── Expressions: compute once, drive everything ───────────────
            const expr = computeExpressions(landmarks, W, H, faceH)

            // ── Eyebrows — amplified by browRaise ─────────────────────────
            drawEyebrows(ctx, char, landmarks, W, H, faceH, expr)

            // ── Shock lines + "!!" above head ─────────────────────────────
            drawSurpriseEffect(ctx, char, landmarks, W, H, faceH, expr, t)

            // ── Eyelids (blink tracking) ──────────────────────────────────
            drawEyelids(ctx, char, landmarks, W, H, faceH, leftEyeCenter, rightEyeCenter)

            // ── Mouth: inner glow + character expression overlay ──────────
            if (expr.mouthOpen > 0.15) {
              const iTop2 = lm(landmarks, 13, W, H)
              const iBot2 = lm(landmarks, 14, W, H)
              const mc2   = { x: (iTop2.x + iBot2.x) / 2, y: (iTop2.y + iBot2.y) / 2 }
              const mg    = ctx.createRadialGradient(mc2.x, mc2.y, 0, mc2.x, mc2.y, faceH * 0.11)
              mg.addColorStop(0, `rgba(255,220,150,${0.38 * expr.mouthOpen})`)
              mg.addColorStop(1, 'transparent')
              ctx.save()
              tracePoly(ctx, landmarks, LIPS_OUTER, W, H)
              ctx.fillStyle = mg; ctx.fill()
              ctx.restore()
            }
            drawMouthExpression(ctx, char, landmarks, W, H, faceH, expr)

            drawDecorations(ctx, char, landmarks, W, H)
            drawNameTag(ctx, char, landmarks, W, H)

            // ── PARTICLE EMISSION ─────────────────────────────────────────
            const mTop   = lm(landmarks, 13, W, H)
            const mBot   = lm(landmarks, 14, W, H)
            const mCX    = (mTop.x + mBot.x) / 2
            const mCY    = (mTop.y + mBot.y) / 2
            const lCorn  = lm(landmarks, 61,  W, H)
            const rCorn  = lm(landmarks, 291, W, H)
            const fhead  = lm(landmarks, LM_FOREHEAD, W, H)

            // Fire / energy from mouth when talking
            if (expr.mouthOpen > 0.32 && Math.random() < 0.55) {
              const mc = Math.ceil(expr.mouthOpen * 3)
              switch (char.id) {
                case 'devil': case 'fire':
                  spawnParticles(particlePool, mCX, mCY, mc, 'fire', t, Math.PI*0.55, -Math.PI/2, 4.0, 18, 95, 52, faceH*0.030, 650)
                  if (Math.random()<0.3) spawnParticles(particlePool, mCX, mCY+faceH*0.02, mc, 'smoke', t, Math.PI*0.4, -Math.PI/2, 1.8, 0, 0, 55, faceH*0.042, 850)
                  break
                case 'dragon':
                  spawnParticles(particlePool, mCX, mCY, mc, 'fire', t, Math.PI*0.65, -Math.PI/2, 4.8, 28, 100, 55, faceH*0.032, 700)
                  break
                case 'ghost':
                  spawnParticles(particlePool, mCX, mCY, mc, 'energy', t, Math.PI*0.7, -Math.PI/2, 3.0, 285, 90, 72, faceH*0.025, 580)
                  break
                case 'robot':
                  spawnParticles(particlePool, mCX, mCY, mc, 'energy', t, Math.PI*0.45, -Math.PI/2, 3.5, 192, 100, 62, faceH*0.020, 480)
                  break
                case 'skull': case 'neon-skull':
                  if (Math.random()<0.45) spawnParticles(particlePool, mCX, mCY, mc, 'smoke', t, Math.PI*0.55, -Math.PI/2, 2.0, 270, 0, 60, faceH*0.038, 750)
                  break
                case 'anime':
                  if (expr.smileRatio > 0.25) spawnParticles(particlePool, mCX, mCY-faceH*0.06, mc, 'sparkle', t, Math.PI*0.7, -Math.PI/2, 2.8, 340, 95, 78, faceH*0.022, 750)
                  break
              }
            }

            // Smile corner hearts
            if (expr.smileRatio > 0.52 && Math.random() < 0.22) {
              const heartIds = ['peanut','anime','cat','fox','bear','cowboy']
              if (heartIds.includes(char.id)) {
                ;[lCorn, rCorn].forEach(c => spawnParticles(particlePool, c.x, c.y, 1, 'heart', t, Math.PI*0.35, -Math.PI/2, 1.6, 345, 90, 72, faceH*0.028, 1000))
              }
            }

            // Anime always drifts petals
            if (char.id === 'anime' && Math.random() < 0.08) {
              spawnParticles(particlePool, faceCX + (Math.random()-0.5)*faceW*1.5, foreheadP.y - faceH*0.2, 1, 'petal', t, Math.PI*0.4, Math.PI/8, 1.5, 340, 90, 82, faceH*0.025, 1800)
            }

            // Shock burst
            if (expr.browRaise > 0.62 && Math.random() < 0.32) {
              const sc = Math.ceil(expr.browRaise * 4)
              switch (char.id) {
                case 'devil': case 'dragon':
                  spawnParticles(particlePool, fhead.x, fhead.y - faceH*0.18, sc, 'fire', t, Math.PI*1.4, -Math.PI/2, 3.2, 20, 98, 58, faceH*0.024, 520)
                  break
                case 'ghost': case 'neon-skull':
                  spawnParticles(particlePool, fhead.x, fhead.y - faceH*0.18, sc, 'energy', t, Math.PI*1.5, -Math.PI/2, 3.8, 285, 90, 78, faceH*0.020, 480)
                  break
                case 'anime':
                  spawnParticles(particlePool, fhead.x + faceW*0.6, fhead.y + faceH*0.1, 1, 'sparkle', t, 0.3, Math.PI/6, 0.8, 200, 25, 80, faceH*0.030, 1200)
                  break
                default:
                  spawnParticles(particlePool, fhead.x, fhead.y - faceH*0.18, sc, 'sparkle', t, Math.PI*1.4, -Math.PI/2, 3.5, 55, 100, 82, faceH*0.022, 520)
              }
            }

            ctx.restore()  // remove perspective transform

            // Draw particles OUTSIDE perspective transform (screen space)
            updateAndDrawParticles(particlePool, ctx, t)
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

      // Blit to all display canvases (preview pane + in-call self-view)
      if (displayCanvasRefs) {
        for (const ref of displayCanvasRefs) {
          const dc = ref.current
          if (dc) {
            const dctx = dc.getContext('2d')
            if (dctx) dctx.drawImage(canvas, 0, 0, dc.width, dc.height)
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      vid.srcObject = null; canvasStreamRef.current = null; canvasRef.current = null
    }
  }, [localStream, displayCanvasRefs])

  const getCanvasVideoTrack = useCallback((): MediaStreamTrack | null => canvasStreamRef.current?.getVideoTracks()[0] ?? null, [])
  const selectCharacter     = useCallback((char: Character | null) => setActiveCharacter(char), [])
  const toggleAccessory     = useCallback((id: string) =>
    setActiveAccessories(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]), [])
  const clearAccessories    = useCallback(() => setActiveAccessories([]), [])
  const selectBackground    = useCallback((id: string) => setActiveBackground(id), [])
  const setDistortionFilter = useCallback((id: string | null) => setActiveDistortionState(id), [])

  // ── Face Merge callbacks ─────────────────────────────────────────────────────
  const startMerge = useCallback(async () => {
    isMergingRef.current = true
    setIsMerging(true)
    // Lazy-init a separate FaceLandmarker for the remote video stream
    if (!mergeInitRef.current) {
      mergeInitRef.current = true
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO', numFaces: 1,
          outputFaceBlendshapes: false,
          minFaceDetectionConfidence: 0.3, minFacePresenceScore: 0.3, minTrackingConfidence: 0.3,
        })
        remoteLandmarkerRef.current = fl
        remoteLandmarkerReady.current = true
      } catch {
        // CPU fallback
        try {
          const vision2 = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          )
          const fl2 = await FaceLandmarker.createFromOptions(vision2, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO', numFaces: 1,
            outputFaceBlendshapes: false,
            minFaceDetectionConfidence: 0.3, minFacePresenceScore: 0.3, minTrackingConfidence: 0.3,
          })
          remoteLandmarkerRef.current = fl2
          remoteLandmarkerReady.current = true
        } catch { /* merge will just use local face only */ }
      }
    }
  }, [])

  const stopMerge = useCallback(() => {
    isMergingRef.current = false
    setIsMerging(false)
  }, [])

  return {
    activeCharacter, selectCharacter,
    activeAccessories, toggleAccessory, clearAccessories,
    activeBackground, selectBackground,
    getCanvasVideoTrack,
    filterReady, filterError,
    canvasRef,
    CHARACTERS,
    // Face Merge
    isMerging, startMerge, stopMerge,
    // Distortion filters
    activeDistortion, setDistortionFilter,
  }
}
