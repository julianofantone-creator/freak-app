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
app.use(cors({ origin: true, credentials: false }))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, credentials: false, methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── In-memory state ───────────────────────────────────────────────────────
const waitingQueue = [] // [{ socketId, username, socket }]
const activePairs = new Map() // socketId → partnerSocketId
const userSockets = new Map() // username → socket (for direct messaging)
const pendingCrushMessages = new Map() // username → [{ id, from, type, text, mediaUrl, timestamp }]
const reports = [] // [{ id, category, description, meta, timestamp }]

const ADMIN_KEY = process.env.ADMIN_KEY || 'freak-admin-2026'

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

// Live stats endpoint
app.get('/api/stats', (_req, res) => {
  res.json({
    online: io.sockets.sockets.size,
    inCalls: Math.floor(activePairs.size / 2),
    searching: waitingQueue.length,
  })
})

// Broadcast live stats to all connected clients every 10s
function broadcastStats() {
  io.emit('stats', {
    online: io.sockets.sockets.size,
    inCalls: Math.floor(activePairs.size / 2),
    searching: waitingQueue.length,
  })
}
setInterval(broadcastStats, 10000)

// ─── REST: Issue reporting ──────────────────────────────────────────────────
app.post('/api/report', (req, res) => {
  const { category, description, meta } = req.body || {}
  if (!description || !description.trim()) return res.status(400).json({ error: 'Description required' })
  const report = {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category: category || 'other',
    description: description.trim().slice(0, 1000),
    meta: meta || {},
    timestamp: new Date().toISOString(),
    status: 'open',
  }
  reports.push(report)
  console.log(`🚨 Report #${reports.length}: [${report.category}] ${report.description.slice(0, 60)}`)
  res.json({ success: true, id: report.id })
})

app.get('/api/reports', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' })
  const status = req.query.status // optional filter: open, resolved
  const filtered = status ? reports.filter(r => r.status === status) : reports
  res.json({ total: filtered.length, reports: filtered.slice().reverse() }) // newest first
})

app.patch('/api/reports/:id', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' })
  const report = reports.find(r => r.id === req.params.id)
  if (!report) return res.status(404).json({ error: 'Not found' })
  if (req.body.status) report.status = req.body.status
  if (req.body.note) report.note = req.body.note
  res.json({ success: true, report })
})

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

  // Track username → socket for direct messaging
  userSockets.set(username, socket)

  // Send current stats immediately on connect + broadcast updated count to everyone
  socket.emit('stats', {
    online: io.sockets.sockets.size,
    inCalls: Math.floor(activePairs.size / 2),
    searching: waitingQueue.length,
  })
  broadcastStats()

  // Deliver any queued crush messages
  const pending = pendingCrushMessages.get(username) || []
  if (pending.length > 0) {
    console.log(`📬 Delivering ${pending.length} queued messages to ${username}`)
    pending.forEach(msg => socket.emit('crush-message', msg))
    pendingCrushMessages.delete(username)
  }

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

  // Chat message relay — forward full payload (text, image, gif)
  socket.on('chat-message', (payload) => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) {
      io.to(partnerId).emit('chat-message', { ...payload, from: username, timestamp: Date.now() })
    }
  })

  // Crush request relay — tell partner you crushed them
  socket.on('crush-request', ({ username: fromUsername }) => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) {
      io.to(partnerId).emit('crush-request', { from: fromUsername || username })
    }
  })

  // ── DIRECT CRUSH MESSAGE (routed by username, queued if offline) ──
  socket.on('crush-message', (payload) => {
    const { toUsername, type, text, mediaUrl, id: clientId } = payload
    if (!toUsername || !type) return

    const msgId = clientId || `m_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
    const msg = { id: msgId, from: username, type, text, mediaUrl, timestamp: Date.now() }

    const recipientSocket = userSockets.get(toUsername)
    if (recipientSocket?.connected) {
      recipientSocket.emit('crush-message', msg)
      socket.emit('crush-message-ack', { id: msgId, status: 'delivered' })
      console.log(`💬 Direct message: ${username} → ${toUsername} (delivered)`)
    } else {
      // Queue for when they come online
      const queue = pendingCrushMessages.get(toUsername) || []
      queue.push(msg)
      if (queue.length > 200) queue.shift() // cap at 200
      pendingCrushMessages.set(toUsername, queue)
      socket.emit('crush-message-ack', { id: msgId, status: 'queued' })
      console.log(`📬 Direct message: ${username} → ${toUsername} (queued, offline)`)
    }
  })

  // ── READ RECEIPT ──────────────────────────────────────────────────
  socket.on('message-read', ({ toUsername }) => {
    const recipientSocket = userSockets.get(toUsername)
    if (recipientSocket?.connected) {
      recipientSocket.emit('message-read', { fromUsername: username })
    }
  })

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ Disconnected: ${username} (${reason})`)
    userSockets.delete(username)
    cleanup(socket)
    broadcastStats()
  })
})

httpServer.listen(PORT, () => {
  console.log(`🔥 Freak server running on port ${PORT}`)
  console.log(`🌐 CORS: all origins`)
  console.log(`🎥 Mode: WebRTC signaling + in-memory matching`)
})
