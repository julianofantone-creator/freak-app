import config from '../config/config.js'
import ChatSession from '../models/ChatSession.js'

class WebRTCService {
  constructor(io) {
    this.io = io
    this.activeSessions = new Map() // sessionId -> session data
    this.userSessions = new Map() // userId -> sessionId
    
    this.setupSocketHandlers()
  }

  // Setup Socket.IO handlers for WebRTC signaling
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      // WebRTC Offer
      socket.on('webrtc:offer', async (data) => {
        try {
          await this.handleOffer(socket, data)
        } catch (error) {
          console.error('WebRTC offer error:', error)
          socket.emit('webrtc:error', { message: 'Failed to process offer' })
        }
      })

      // WebRTC Answer
      socket.on('webrtc:answer', async (data) => {
        try {
          await this.handleAnswer(socket, data)
        } catch (error) {
          console.error('WebRTC answer error:', error)
          socket.emit('webrtc:error', { message: 'Failed to process answer' })
        }
      })

      // ICE Candidates
      socket.on('webrtc:ice-candidate', async (data) => {
        try {
          await this.handleIceCandidate(socket, data)
        } catch (error) {
          console.error('ICE candidate error:', error)
          socket.emit('webrtc:error', { message: 'Failed to process ICE candidate' })
        }
      })

      // Connection state updates
      socket.on('webrtc:connection-state', async (data) => {
        try {
          await this.handleConnectionState(socket, data)
        } catch (error) {
          console.error('Connection state error:', error)
        }
      })

      // Data channel messages
      socket.on('webrtc:data-channel', async (data) => {
        try {
          await this.handleDataChannel(socket, data)
        } catch (error) {
          console.error('Data channel error:', error)
        }
      })

      // Media constraints changed
      socket.on('webrtc:media-constraints', async (data) => {
        try {
          await this.handleMediaConstraints(socket, data)
        } catch (error) {
          console.error('Media constraints error:', error)
        }
      })

      // Screen sharing
      socket.on('webrtc:screen-share', async (data) => {
        try {
          await this.handleScreenShare(socket, data)
        } catch (error) {
          console.error('Screen share error:', error)
        }
      })

      // Session cleanup on disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  // Get ICE servers configuration including TURN servers
  getIceServers() {
    const iceServers = [
      // Public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]

    // Add TURN server if configured
    if (config.TURN_SERVER.URL) {
      iceServers.push({
        urls: config.TURN_SERVER.URL,
        username: config.TURN_SERVER.USERNAME,
        credential: config.TURN_SERVER.CREDENTIAL
      })
    }

    return iceServers
  }

  // Handle WebRTC offer
  async handleOffer(socket, data) {
    const { sessionId, offer, mediaConstraints } = data
    const userId = socket.user._id.toString()

    // Validate session
    const session = await ChatSession.findById(sessionId)
    if (!session || !this.isUserInSession(session, userId)) {
      throw new Error('Invalid session')
    }

    // Find the other participant
    const otherParticipant = session.participants.find(
      p => p.user.toString() !== userId
    )
    
    if (!otherParticipant) {
      throw new Error('No other participant found')
    }

    // Find other participant's socket
    const otherSocket = this.findSocketByUserId(otherParticipant.user.toString())
    if (!otherSocket) {
      throw new Error('Other participant not connected')
    }

    // Store session info
    this.activeSessions.set(sessionId, {
      sessionId,
      participants: [userId, otherParticipant.user.toString()],
      initiator: userId,
      startedAt: Date.now(),
      iceConnectionState: 'new',
      connectionState: 'new',
      mediaConstraints
    })

    this.userSessions.set(userId, sessionId)
    this.userSessions.set(otherParticipant.user.toString(), sessionId)

    // Send offer to other participant with ICE servers
    otherSocket.emit('webrtc:offer', {
      sessionId,
      offer,
      from: userId,
      fromUsername: socket.user.username,
      iceServers: this.getIceServers(),
      mediaConstraints
    })

    // Update session status
    await ChatSession.findByIdAndUpdate(sessionId, {
      status: 'active',
      startedAt: new Date()
    })

    console.log(`📞 WebRTC offer sent from ${socket.user.username} in session ${sessionId}`)
  }

  // Handle WebRTC answer
  async handleAnswer(socket, data) {
    const { sessionId, answer } = data
    const userId = socket.user._id.toString()

    // Get session data
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) {
      throw new Error('Session not found')
    }

    // Find initiator socket
    const initiatorSocket = this.findSocketByUserId(sessionData.initiator)
    if (!initiatorSocket) {
      throw new Error('Initiator not connected')
    }

    // Send answer to initiator
    initiatorSocket.emit('webrtc:answer', {
      sessionId,
      answer,
      from: userId,
      fromUsername: socket.user.username
    })

    console.log(`📞 WebRTC answer sent from ${socket.user.username} in session ${sessionId}`)
  }

  // Handle ICE candidates
  async handleIceCandidate(socket, data) {
    const { sessionId, candidate } = data
    const userId = socket.user._id.toString()

    // Get session data
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) {
      throw new Error('Session not found')
    }

    // Find other participant
    const otherUserId = sessionData.participants.find(id => id !== userId)
    if (!otherUserId) {
      throw new Error('Other participant not found')
    }

    // Find other participant's socket
    const otherSocket = this.findSocketByUserId(otherUserId)
    if (!otherSocket) {
      throw new Error('Other participant not connected')
    }

    // Forward ICE candidate
    otherSocket.emit('webrtc:ice-candidate', {
      sessionId,
      candidate,
      from: userId
    })

    console.log(`🧊 ICE candidate forwarded from ${socket.user.username} in session ${sessionId}`)
  }

  // Handle connection state changes
  async handleConnectionState(socket, data) {
    const { sessionId, iceConnectionState, connectionState, stats } = data
    const userId = socket.user._id.toString()

    // Update session data
    const sessionData = this.activeSessions.get(sessionId)
    if (sessionData) {
      sessionData.iceConnectionState = iceConnectionState
      sessionData.connectionState = connectionState
      
      if (stats) {
        sessionData.lastStats = {
          ...stats,
          timestamp: Date.now(),
          userId
        }
      }
    }

    // Update database with WebRTC stats
    if (stats) {
      await ChatSession.findByIdAndUpdate(sessionId, {
        'webRtcStats.iceConnectionState': iceConnectionState,
        'webRtcStats.connectionState': connectionState,
        'webRtcStats.avgBitrate': stats.avgBitrate,
        'webRtcStats.packetsLost': stats.packetsLost,
        'webRtcStats.jitter': stats.jitter
      })
    }

    // Notify other participant of connection state
    const sessionData2 = this.activeSessions.get(sessionId)
    if (sessionData2) {
      const otherUserId = sessionData2.participants.find(id => id !== userId)
      const otherSocket = this.findSocketByUserId(otherUserId)
      
      if (otherSocket) {
        otherSocket.emit('webrtc:peer-connection-state', {
          sessionId,
          peerConnectionState: connectionState,
          iceConnectionState,
          from: userId
        })
      }
    }

    // Handle connection failures
    if (iceConnectionState === 'failed' || connectionState === 'failed') {
      console.warn(`⚠️ WebRTC connection failed in session ${sessionId}`)
      await this.handleConnectionFailure(sessionId, userId)
    }

    console.log(`🔗 Connection state updated in session ${sessionId}: ${connectionState}`)
  }

  // Handle data channel messages
  async handleDataChannel(socket, data) {
    const { sessionId, message, type = 'text' } = data
    const userId = socket.user._id.toString()

    // Get session data
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) {
      throw new Error('Session not found')
    }

    // Find other participant
    const otherUserId = sessionData.participants.find(id => id !== userId)
    const otherSocket = this.findSocketByUserId(otherUserId)
    
    if (otherSocket) {
      otherSocket.emit('webrtc:data-channel', {
        sessionId,
        message,
        type,
        from: userId,
        timestamp: Date.now()
      })
    }

    // Log data channel usage
    await ChatSession.findByIdAndUpdate(sessionId, {
      $push: {
        'featuresUsed': {
          feature: 'chat',
          timestamp: new Date()
        }
      },
      $inc: { messageCount: 1 }
    })

    console.log(`💬 Data channel message in session ${sessionId}`)
  }

  // Handle media constraints changes
  async handleMediaConstraints(socket, data) {
    const { sessionId, constraints, type } = data // type: 'video', 'audio', 'screen'
    const userId = socket.user._id.toString()

    // Get session data
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) {
      throw new Error('Session not found')
    }

    // Update session constraints
    sessionData.mediaConstraints = {
      ...sessionData.mediaConstraints,
      [type]: constraints
    }

    // Notify other participant
    const otherUserId = sessionData.participants.find(id => id !== userId)
    const otherSocket = this.findSocketByUserId(otherUserId)
    
    if (otherSocket) {
      otherSocket.emit('webrtc:peer-media-change', {
        sessionId,
        constraints,
        type,
        from: userId,
        fromUsername: socket.user.username
      })
    }

    // Log feature usage
    await ChatSession.findByIdAndUpdate(sessionId, {
      $push: {
        'featuresUsed': {
          feature: type,
          timestamp: new Date()
        }
      }
    })

    console.log(`🎥 Media constraints changed in session ${sessionId}: ${type}`)
  }

  // Handle screen sharing
  async handleScreenShare(socket, data) {
    const { sessionId, sharing, offer } = data
    const userId = socket.user._id.toString()

    // Get session data
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) {
      throw new Error('Session not found')
    }

    // Find other participant
    const otherUserId = sessionData.participants.find(id => id !== userId)
    const otherSocket = this.findSocketByUserId(otherUserId)
    
    if (!otherSocket) {
      throw new Error('Other participant not connected')
    }

    if (sharing) {
      // Start screen sharing
      otherSocket.emit('webrtc:screen-share-offer', {
        sessionId,
        offer,
        from: userId,
        fromUsername: socket.user.username
      })

      // Log screen sharing
      await ChatSession.findByIdAndUpdate(sessionId, {
        $push: {
          'featuresUsed': {
            feature: 'screen_share',
            timestamp: new Date()
          }
        }
      })

      console.log(`🖥️ Screen sharing started in session ${sessionId}`)
    } else {
      // Stop screen sharing
      otherSocket.emit('webrtc:screen-share-stop', {
        sessionId,
        from: userId
      })

      console.log(`🖥️ Screen sharing stopped in session ${sessionId}`)
    }
  }

  // Handle connection failures
  async handleConnectionFailure(sessionId, userId) {
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) return

    // Notify other participant
    const otherUserId = sessionData.participants.find(id => id !== userId)
    const otherSocket = this.findSocketByUserId(otherUserId)
    
    if (otherSocket) {
      otherSocket.emit('webrtc:connection-failed', {
        sessionId,
        message: 'Peer connection failed'
      })
    }

    // Update session status
    await ChatSession.findByIdAndUpdate(sessionId, {
      status: 'ended',
      endedAt: new Date()
    })

    // Clean up session
    this.cleanupSession(sessionId)
  }

  // Handle socket disconnect
  handleDisconnect(socket) {
    const userId = socket.user._id.toString()
    const sessionId = this.userSessions.get(userId)
    
    if (sessionId) {
      const sessionData = this.activeSessions.get(sessionId)
      if (sessionData) {
        // Notify other participant
        const otherUserId = sessionData.participants.find(id => id !== userId)
        const otherSocket = this.findSocketByUserId(otherUserId)
        
        if (otherSocket) {
          otherSocket.emit('webrtc:peer-disconnected', {
            sessionId,
            userId,
            username: socket.user.username
          })
        }

        // End session after a delay to allow for reconnection
        setTimeout(async () => {
          const stillActive = this.activeSessions.get(sessionId)
          if (stillActive) {
            await this.endSession(sessionId)
          }
        }, 30000) // 30 second grace period
      }
    }

    console.log(`👋 User ${socket.user.username} disconnected from WebRTC`)
  }

  // Find socket by user ID
  findSocketByUserId(userId) {
    for (const [socketId, socket] of this.io.sockets.sockets) {
      if (socket.user && socket.user._id.toString() === userId) {
        return socket
      }
    }
    return null
  }

  // Check if user is in session
  isUserInSession(session, userId) {
    return session.participants.some(p => p.user.toString() === userId)
  }

  // End a WebRTC session
  async endSession(sessionId) {
    const sessionData = this.activeSessions.get(sessionId)
    if (!sessionData) return

    // Calculate session duration
    const duration = Math.floor((Date.now() - sessionData.startedAt) / 1000)

    // Update database
    await ChatSession.findByIdAndUpdate(sessionId, {
      status: 'ended',
      endedAt: new Date(),
      duration
    })

    // Notify participants
    for (const userId of sessionData.participants) {
      const socket = this.findSocketByUserId(userId)
      if (socket) {
        socket.emit('webrtc:session-ended', {
          sessionId,
          duration,
          reason: 'session_ended'
        })
      }
    }

    // Clean up
    this.cleanupSession(sessionId)

    console.log(`🏁 WebRTC session ${sessionId} ended (duration: ${duration}s)`)
  }

  // Clean up session data
  cleanupSession(sessionId) {
    const sessionData = this.activeSessions.get(sessionId)
    if (sessionData) {
      // Remove user session mappings
      for (const userId of sessionData.participants) {
        this.userSessions.delete(userId)
      }
      
      // Remove session data
      this.activeSessions.delete(sessionId)
    }
  }

  // Get active session statistics
  getSessionStats() {
    const activeSessions = Array.from(this.activeSessions.values())
    
    return {
      totalActiveSessions: activeSessions.length,
      connectionStates: this.getConnectionStateStats(activeSessions),
      averageSessionDuration: this.getAverageSessionDuration(activeSessions),
      featuresInUse: this.getFeaturesInUse(activeSessions)
    }
  }

  // Get connection state statistics
  getConnectionStateStats(sessions) {
    const stats = {}
    for (const session of sessions) {
      const state = session.connectionState || 'unknown'
      stats[state] = (stats[state] || 0) + 1
    }
    return stats
  }

  // Get average session duration for active sessions
  getAverageSessionDuration(sessions) {
    if (sessions.length === 0) return 0
    
    const now = Date.now()
    const totalDuration = sessions.reduce((sum, session) => 
      sum + (now - session.startedAt), 0)
    
    return Math.floor(totalDuration / sessions.length / 1000) // seconds
  }

  // Get features currently in use
  getFeaturesInUse(sessions) {
    const features = new Set()
    
    for (const session of sessions) {
      if (session.mediaConstraints) {
        Object.keys(session.mediaConstraints).forEach(feature => {
          if (session.mediaConstraints[feature]) {
            features.add(feature)
          }
        })
      }
    }
    
    return Array.from(features)
  }
}

export default WebRTCService