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
const botSockets = new Map() // botId → fakeSocket (for partner lookups)

// ─── Streamer mode state ───────────────────────────────────────────────────
const streamerCodes = new Map() // code → { streamerName, streamUrl, createdAt, clicks, referrals }
const premiumUsers = new Map()  // userId → { expiresAt, grantedBy, streamerName }

const ADMIN_KEY = process.env.ADMIN_KEY || 'freak-admin-2026'
const FRONTEND_DOMAIN = (process.env.FRONTEND_URL || 'https://freak.cool').replace(/\/$/, '')

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

// ─── Streamer mode endpoints ───────────────────────────────────────────────

// Register as a streamer — returns a unique ref link
app.post('/api/streamer/register', (req, res) => {
  const { streamerName, streamUrl } = req.body || {}
  if (!streamerName?.trim()) return res.status(400).json({ error: 'Streamer name required' })
  if (!streamUrl?.trim()) return res.status(400).json({ error: 'Stream URL required' })

  // Generate short code from name + random suffix
  const slug = streamerName.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
  const code = `${slug}${Math.random().toString(36).slice(2, 6)}`

  streamerCodes.set(code, {
    streamerName: streamerName.trim().slice(0, 30),
    streamUrl: streamUrl.trim().slice(0, 200),
    createdAt: new Date().toISOString(),
    clicks: 0,
    referrals: 0,
  })

  const refUrl = `${FRONTEND_DOMAIN}/?ref=${code}`
  console.log(`🎮 New streamer: ${streamerName} → ${refUrl}`)
  res.json({ success: true, code, refUrl })
})

// Get streamer info by code (called when viewer lands with ?ref=)
app.get('/api/streamer/:code', (req, res) => {
  const streamer = streamerCodes.get(req.params.code)
  if (!streamer) return res.status(404).json({ error: 'Invalid code' })

  // Track click
  streamer.clicks++
  res.json({
    streamerName: streamer.streamerName,
    streamUrl: streamer.streamUrl,
    code: req.params.code,
  })
})

// Redeem referral code → grant 7 days of Freaky+
app.post('/api/streamer/redeem', (req, res) => {
  const { code, userId } = req.body || {}
  if (!code || !userId) return res.status(400).json({ error: 'code + userId required' })

  const streamer = streamerCodes.get(code)
  if (!streamer) return res.status(404).json({ error: 'Invalid code' })

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  premiumUsers.set(userId, {
    expiresAt,
    grantedBy: code,
    streamerName: streamer.streamerName,
  })
  streamer.referrals++

  console.log(`⚡ Freaky+ granted to ${userId} via ${streamer.streamerName} (expires ${expiresAt})`)
  res.json({ success: true, expiresAt, streamerName: streamer.streamerName })
})

// Check premium status for a userId
app.get('/api/premium/:userId', (req, res) => {
  const prem = premiumUsers.get(req.params.userId)
  if (!prem) return res.json({ isPremium: false })

  const expired = new Date(prem.expiresAt) < new Date()
  if (expired) {
    premiumUsers.delete(req.params.userId)
    return res.json({ isPremium: false })
  }
  res.json({ isPremium: true, expiresAt: prem.expiresAt, streamerName: prem.streamerName })
})

// Streamer dashboard — see your stats
app.get('/api/streamer/:code/stats', (req, res) => {
  const streamer = streamerCodes.get(req.params.code)
  if (!streamer) return res.status(404).json({ error: 'Invalid code' })
  res.json({
    streamerName: streamer.streamerName,
    streamUrl: streamer.streamUrl,
    clicks: streamer.clicks,
    referrals: streamer.referrals,
    createdAt: streamer.createdAt,
    refUrl: `${FRONTEND_DOMAIN}/?ref=${req.params.code}`,
  })
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

// ─── Socket lookup (real + bots) ────────────────────────────────────────────
function getAnySocket(id) {
  return io.sockets.sockets.get(id) || botSockets.get(id) || null
}

// ─── Matching helpers ───────────────────────────────────────────────────────
function sharedTags(a, b) {
  if (!a?.length || !b?.length) return []
  return a.filter(t => b.includes(t))
}

function tryMatch(socket, mode = 'random', tags = []) {
  // Remove self from queue if already there
  const idx = waitingQueue.findIndex(w => w.socketId === socket.id)
  if (idx !== -1) waitingQueue.splice(idx, 1)

  // Find all candidates with same mode
  const candidates = waitingQueue.filter(w => w.socketId !== socket.id && w.mode === mode)
  if (candidates.length === 0) {
    // No one waiting — add to queue with tags
    waitingQueue.push({ socketId: socket.id, username: socket.user.username, socket, mode, tags })
    socket.emit('queue-joined', { position: waitingQueue.filter(w => w.mode === mode).length })
    console.log(`📋 Queue [${mode}]: ${socket.user.username} waiting [${tags.join(',')}] (${waitingQueue.length} total)`)
    return
  }

  // Score candidates by shared tags — prefer best match, fall back to first in queue
  let bestCandidate = candidates[0]
  let bestScore = sharedTags(tags, candidates[0].tags || []).length
  for (const c of candidates.slice(1)) {
    const score = sharedTags(tags, c.tags || []).length
    if (score > bestScore) { bestScore = score; bestCandidate = c }
  }

  const partnerIdx = waitingQueue.findIndex(w => w.socketId === bestCandidate.socketId)
  const [partner] = waitingQueue.splice(partnerIdx, 1)
  activePairs.set(socket.id, partner.socketId)
  activePairs.set(partner.socketId, socket.id)

  const common = sharedTags(tags, partner.tags || [])
  console.log(`🤝 Matched [${mode}]: ${socket.user.username} ↔ ${partner.username} | shared: [${common.join(',')}]`)

  // Tell both — include sharedTags so UI can show "you both like: X"
  socket.emit('match-found', {
    partner: { id: partner.socketId, username: partner.username },
    isInitiator: false,
    mode,
    sharedTags: common,
  })
  partner.socket.emit('match-found', {
    partner: { id: socket.id, username: socket.user.username },
    isInitiator: true,
    mode,
    sharedTags: common,
  })
}

function cleanup(socket) {
  // Remove from queue
  const qi = waitingQueue.findIndex(w => w.socketId === socket.id)
  if (qi !== -1) waitingQueue.splice(qi, 1)

  // Notify partner (works for real sockets + bots)
  const partnerId = activePairs.get(socket.id)
  if (partnerId) {
    activePairs.delete(socket.id)
    activePairs.delete(partnerId)
    const partnerSocket = getAnySocket(partnerId)
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

  // User wants to find a match (mode: 'random' | 'date', tags: string[])
  socket.on('join-queue', ({ mode, tags } = {}) => {
    const queueMode = mode === 'date' ? 'date' : 'random'
    const cleanTags = Array.isArray(tags) ? tags.map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5) : []
    console.log(`🔍 ${username} joining queue [${queueMode}] tags: [${cleanTags.join(',')}]`)
    tryMatch(socket, queueMode, cleanTags)
  })

  // Fast "I'm leaving" signal — fires BEFORE socket cleanup so partner disconnects immediately
  // This is the primary fix for the ghost-connection bug (partner sees your face after you left)
  socket.on('partner-leaving', () => {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) {
      const partnerSocket = getAnySocket(partnerId)
      if (partnerSocket) {
        partnerSocket.emit('peer-disconnected', { reason: 'partner left' })
        console.log(`🚪 Fast disconnect: ${username} → notified partner immediately`)
      }
      activePairs.delete(socket.id)
      activePairs.delete(partnerId)
    }
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

// ─── 🤖 Bot Service — Ghost users to fill queue & prevent cold-start wait ────
// Bots sit in queue. When matched with a real user, they wait 8-15s then leave.
// From user perspective: instant match → other person drops after a moment → re-queue.
// Keeps perceived wait time near-zero even when traffic is low.

const BOT_NAMES = ['Alex', 'Jordan', 'Casey', 'Sam', 'Riley', 'Morgan', 'Taylor', 'Quinn', 'Drew', 'Blake', 'Avery', 'Jamie']
const BOT_TARGET = 2 // always try to keep N bots in queue

function createFakeSocket(name) {
  const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  let matchTimer = null

  const fakeSocket = {
    id: botId,
    isBot: true,
    user: { id: botId, username: name },
    emit(event, data) {
      if (event === 'match-found') {
        // Matched with a real user — wait then leave so they re-queue quickly
        const delay = 8000 + Math.random() * 7000 // 8-15s
        console.log(`🤖 Bot ${name} matched — will ghost in ${Math.round(delay/1000)}s`)
        matchTimer = setTimeout(() => {
          const partnerId = activePairs.get(botId)
          if (partnerId) {
            activePairs.delete(botId)
            activePairs.delete(partnerId)
            const partnerSocket = io.sockets.sockets.get(partnerId)
            if (partnerSocket) {
              partnerSocket.emit('peer-disconnected', { reason: 'partner left' })
              console.log(`🤖 Bot ${name} ghosted → partner re-queues`)
            }
          }
          botSockets.delete(botId)
          // Respawn a fresh bot after a short break
          setTimeout(spawnBot, 3000 + Math.random() * 4000)
        }, delay)
      } else if (event === 'queue-joined') {
        console.log(`🤖 Bot ${name} in queue (total bots: ${botSockets.size})`)
      } else if (event === 'peer-disconnected') {
        // Real partner skipped the bot — clean up and respawn
        if (matchTimer) { clearTimeout(matchTimer); matchTimer = null }
        activePairs.delete(botId)
        botSockets.delete(botId)
        console.log(`🤖 Bot ${name} got skipped — respawning`)
        setTimeout(spawnBot, 2000 + Math.random() * 3000)
      }
    }
  }

  return fakeSocket
}

function spawnBot() {
  // Only spawn if we need more bots in queue
  const botsInQueue = waitingQueue.filter(w => w.socket?.isBot).length
  if (botsInQueue >= BOT_TARGET) return

  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 99)
  const fakeSocket = createFakeSocket(name)
  botSockets.set(fakeSocket.id, fakeSocket)
  tryMatch(fakeSocket, 'random', [])
}

function startBotService() {
  console.log(`🤖 Bot service starting — maintaining ${BOT_TARGET} queue ghosts`)
  // Initial spawn
  for (let i = 0; i < BOT_TARGET; i++) {
    setTimeout(spawnBot, i * 1500)
  }
  // Periodic check — top up bots if queue is short
  setInterval(() => {
    const botsInQueue = waitingQueue.filter(w => w.socket?.isBot).length
    const realUsersInQueue = waitingQueue.filter(w => !w.socket?.isBot).length
    // Only add bots when real user traffic is low
    if (botsInQueue < BOT_TARGET && realUsersInQueue < 5) {
      spawnBot()
    }
  }, 15000)
}

httpServer.listen(PORT, () => {
  console.log(`🔥 Freak server running on port ${PORT}`)
  console.log(`🌐 CORS: all origins`)
  console.log(`🎥 Mode: WebRTC signaling + in-memory matching`)
  // Start ghost bots after server is up
  setTimeout(startBotService, 2000)
})
