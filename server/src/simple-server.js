/**
 * Freak — Simple WebRTC Signaling Server
 * Guest-first, no DB required. In-memory queue + Socket.io signaling.
 */

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import jwt from 'jsonwebtoken'

const PORT = process.env.PORT || 8080
const JWT_SECRET = process.env.JWT_SECRET || 'freak-dev-secret-change-in-prod-2026'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const app = express()
app.use(cors({ origin: '*', credentials: true }))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── In-memory state ───────────────────────────────────────────────────────
const waitingQueue = [] // [{ socketId, username, socket }]
const activePairs = new Map() // socketId → partnerSocketId

// ─── REST: Guest auth ───────────────────────────────────────────────────────
app.post('/api/guest', (req, res) => {
  const username = (req.body?.username || '').trim().slice(0, 20) || `Freak${Math.floor(Math.random() * 9999)}`
  const guestId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const token = jwt.sign({ id: guestId, username, isGuest: true }, JWT_SECRET, { expiresIn: '24h' })
  res.json({ success: true, token, user: { id: guestId, username } })
})

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', waiting: waitingQueue.length, pairs: activePairs.size }))
app.get('/', (_req, res) => res.json({ app: 'freak-server', version: '2.0.0' }))

// ─── Socket auth middleware ─────────────────────────────────────────────────
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('No token'))
    const decoded = jwt.verify(token, JWT_SECRET)
    socket.user = { id: decoded.id, username: decoded.username }
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

// ─── Matching helpers ───────────────────────────────────────────────────────
function tryMatch(socket) {
  // Remove self from queue if already there
  const idx = waitingQueue.findIndex(w => w.socketId === socket.id)
  if (idx !== -1) waitingQueue.splice(idx, 1)

  // Find a waiting partner (not self)
  const partnerIdx = waitingQueue.findIndex(w => w.socketId !== socket.id)
  if (partnerIdx === -1) {
    // No one waiting — add to queue
    waitingQueue.push({ socketId: socket.id, username: socket.user.username, socket })
    socket.emit('queue-joined', { position: waitingQueue.length })
    console.log(`📋 Queue: ${socket.user.username} waiting (${waitingQueue.length} total)`)
    return
  }

  // Found a match!
  const [partner] = waitingQueue.splice(partnerIdx, 1)
  activePairs.set(socket.id, partner.socketId)
  activePairs.set(partner.socketId, socket.id)

  console.log(`🤝 Matched: ${socket.user.username} ↔ ${partner.username}`)

  // Tell both — initiator creates the WebRTC offer
  socket.emit('match-found', {
    partner: { id: partner.socketId, username: partner.username },
    isInitiator: false,
  })
  partner.socket.emit('match-found', {
    partner: { id: socket.id, username: socket.user.username },
    isInitiator: true,
  })
}

function cleanup(socket) {
  // Remove from queue
  const qi = waitingQueue.findIndex(w => w.socketId === socket.id)
  if (qi !== -1) waitingQueue.splice(qi, 1)

  // Notify partner
  const partnerId = activePairs.get(socket.id)
  if (partnerId) {
    activePairs.delete(socket.id)
    activePairs.delete(partnerId)
    const partnerSocket = io.sockets.sockets.get(partnerId)
    if (partnerSocket) {
      partnerSocket.emit('peer-disconnected', { reason: 'partner left' })
    }
  }
}

// ─── Socket events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const { username } = socket.user
  console.log(`✅ Connected: ${username} (${socket.id})`)

  // User wants to find a match
  socket.on('join-queue', () => {
    console.log(`🔍 ${username} joining queue`)
    tryMatch(socket)
  })

  // User leaves queue / session
  socket.on('leave-queue', () => {
    cleanup(socket)
    socket.emit('queue-left')
  })

  // ── WebRTC Signaling (relay between pairs) ──
  socket.on('webrtc:offer', ({ offer }) => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) io.to(partnerId).emit('webrtc:offer', { offer })
  })

  socket.on('webrtc:answer', ({ answer }) => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) io.to(partnerId).emit('webrtc:answer', { answer })
  })

  socket.on('webrtc:ice-candidate', ({ candidate }) => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) io.to(partnerId).emit('webrtc:ice-candidate', { candidate })
  })

  // Chat message relay
  socket.on('chat-message', ({ text }) => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) {
      io.to(partnerId).emit('chat-message', { text, from: username, timestamp: Date.now() })
    }
  })

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ Disconnected: ${username} (${reason})`)
    cleanup(socket)
  })
})

httpServer.listen(PORT, () => {
  console.log(`🔥 Freak server running on port ${PORT}`)
  console.log(`🌐 CORS: all origins`)
  console.log(`🎥 Mode: WebRTC signaling + in-memory matching`)
})
