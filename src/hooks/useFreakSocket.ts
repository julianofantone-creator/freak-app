import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SERVER_URL = (import.meta as any).env?.VITE_API_URL || 'https://freak-app-production.up.railway.app'

interface Partner {
  id: string
  username: string
}

interface UseFreakSocketOptions {
  username: string
  localStream: MediaStream | null
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  onConnected: (partner: Partner, mode: 'random' | 'date', sharedTags: string[]) => void
  onDisconnected: () => void
  onSearching: () => void
  onCrushRequest: (fromUsername: string) => void
  onChatMessage?: (payload: { type: string; text?: string; mediaUrl?: string }, from: string) => void
  onCrushMessage?: (payload: { id: string; type: string; text?: string; mediaUrl?: string; timestamp: number }, from: string) => void
  onMessageRead?: (fromUsername: string) => void
  onMessageAck?: (id: string, status: 'delivered' | 'queued') => void
}

// Metered.ca dedicated TURN — freak.metered.live (500MB free tier, renews MAR-2026)
// All 4 relay endpoints cover: UDP 80, TCP 80, UDP 443, TLS 443 — handles strict firewalls + mobile carriers
const TURN_USER = 'dd307a5fafaabea3119577b2'
const TURN_CRED = '3QZQE59LiCiMKHlg'

const ICE_SERVERS = [
  // STUN — multiple sources for redundancy
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN — dedicated Metered.ca relay (replaces unreliable openrelay public servers)
  { urls: 'turn:global.relay.metered.ca:80',               username: TURN_USER, credential: TURN_CRED },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: TURN_USER, credential: TURN_CRED },
  { urls: 'turn:global.relay.metered.ca:443',              username: TURN_USER, credential: TURN_CRED },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: TURN_USER, credential: TURN_CRED },
]

// Boost video bitrate in SDP — targets 2.5 Mbps video, 128k audio
// This makes video quality significantly better than Omegle/OmeTV/Monkey
function boostBitrate(sdp: string): string {
  const VIDEO_BITRATE_KBPS = 2500
  const AUDIO_BITRATE_KBPS = 128
  return sdp
    .split('\r\n')
    .map((line, i, arr) => {
      // Insert bandwidth line after each m= line
      if (line.startsWith('m=video')) {
        // Find c= line index or insert after m=
        return line
      }
      if (line.startsWith('m=audio')) return line
      // After c= line following m=video, insert b=AS
      if (line.startsWith('c=')) {
        const prev = arr.slice(0, i).reverse().find(l => l.startsWith('m='))
        if (prev?.startsWith('m=video')) return `${line}\r\nb=AS:${VIDEO_BITRATE_KBPS}\r\nb=TIAS:${VIDEO_BITRATE_KBPS * 1000}`
        if (prev?.startsWith('m=audio')) return `${line}\r\nb=AS:${AUDIO_BITRATE_KBPS}`
      }
      return line
    })
    .join('\r\n')
}

export function useFreakSocket({
  username,
  localStream,
  remoteVideoRef,
  onConnected,
  onDisconnected,
  onSearching,
  onCrushRequest,
  onChatMessage,
  onCrushMessage,
  onMessageRead,
  onMessageAck,
}: UseFreakSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)  // stored at hook level so closePC can stop tracks
  const iceDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)  // timer for ICE disconnect → full close
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])  // queue ICE until remoteDescription set
  const isInitiatorRef = useRef(false)  // track who created the original offer (for ICE restart)
  const [isReady, setIsReady] = useState(false)
  const [serverOffline, setServerOffline] = useState(false)
  const [liveStats, setLiveStats] = useState<{ online: number; inCalls: number; searching: number } | null>(null)
  const [sharedTags, setSharedTags] = useState<string[]>([])
  const pendingJoin = useRef(false)
  const pendingMode = useRef<'random' | 'date'>('random')
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep a ref to localStream so socket handlers always have the latest value
  const localStreamRef = useRef<MediaStream | null>(null)
  useEffect(() => { localStreamRef.current = localStream }, [localStream])

  // Keep callbacks in refs to avoid stale closures
  const onConnectedRef = useRef(onConnected)
  const onDisconnectedRef = useRef(onDisconnected)
  const onSearchingRef = useRef(onSearching)
  const onCrushRequestRef = useRef(onCrushRequest)
  useEffect(() => { onConnectedRef.current = onConnected }, [onConnected])
  useEffect(() => { onDisconnectedRef.current = onDisconnected }, [onDisconnected])
  useEffect(() => { onSearchingRef.current = onSearching }, [onSearching])
  useEffect(() => { onCrushRequestRef.current = onCrushRequest }, [onCrushRequest])

  const onChatMessageRef = useRef(onChatMessage)
  useEffect(() => { onChatMessageRef.current = onChatMessage }, [onChatMessage])

  const onCrushMessageRef = useRef(onCrushMessage)
  useEffect(() => { onCrushMessageRef.current = onCrushMessage }, [onCrushMessage])

  const onMessageReadRef = useRef(onMessageRead)
  useEffect(() => { onMessageReadRef.current = onMessageRead }, [onMessageRead])

  const onMessageAckRef = useRef(onMessageAck)
  useEffect(() => { onMessageAckRef.current = onMessageAck }, [onMessageAck])

  const closePC = useCallback(() => {
    // Clear any pending ICE disconnect timer
    if (iceDisconnectTimerRef.current) {
      clearTimeout(iceDisconnectTimerRef.current)
      iceDisconnectTimerRef.current = null
    }
    pendingCandidates.current = []

    // ── Kill the peer connection ──────────────────────────────────────────
    if (pcRef.current) {
      pcRef.current.ontrack = null
      pcRef.current.onicecandidate = null
      pcRef.current.oniceconnectionstatechange = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }

    // ── Stop ALL remote stream tracks — this is the key fix ──────────────
    // Without this, the tracks keep flowing even after srcObject = null
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(t => t.stop())
      remoteStreamRef.current = null
    }

    // ── Fully clear the remote video element ─────────────────────────────
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
      remoteVideoRef.current.pause()
      remoteVideoRef.current.load()  // resets the element — clears last frame
    }
  }, [remoteVideoRef])

  const createPC = useCallback(() => {
    closePC()
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local tracks using ref (always latest)
    const stream = localStreamRef.current
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })
    }

    // When remote stream arrives — store at hook level so closePC can stop tracks
    remoteStreamRef.current = new MediaStream()
    let remoteStreamAttached = false
    pc.ontrack = (e) => {
      remoteStreamRef.current!.addTrack(e.track)
      if (remoteVideoRef.current) {
        if (!remoteStreamAttached) {
          remoteStreamAttached = true
          remoteVideoRef.current.srcObject = remoteStreamRef.current
          remoteVideoRef.current.play().catch((err) => {
            console.warn('[WebRTC] remote video autoplay blocked:', err)
          })
        }
      }
    }

    // Send ICE candidates to partner via signaling
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit('webrtc:ice-candidate', { candidate: e.candidate })
      }
    }

    // ── Connection state (high-level) — catches failed/closed definitively ──
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('[WebRTC] Connection state:', state)
      if (state === 'failed' || state === 'closed') {
        // Hard failure — shut everything down immediately
        closePC()
        onDisconnectedRef.current()
        socketRef.current?.emit('partner-leaving')  // tell server to notify partner
      }
    }

    // ── ICE state — granular network-level changes ───────────────────────
    pc.oniceconnectionstatechange = async () => {
      const state = pc.iceConnectionState
      console.log('[WebRTC] ICE state:', state)

      if (state === 'disconnected') {
        // Start a 5s timer — if not recovered, treat as a full failure
        // This covers the case where one side leaves but ICE never reaches 'failed'
        if (iceDisconnectTimerRef.current) clearTimeout(iceDisconnectTimerRef.current)
        iceDisconnectTimerRef.current = setTimeout(() => {
          console.log('[WebRTC] ICE disconnected for 5s — closing connection')
          closePC()
          onDisconnectedRef.current()
          socketRef.current?.emit('partner-leaving')
        }, 5000)
      }

      if (state === 'connected' || state === 'completed') {
        // Recovered — clear the disconnect timer
        if (iceDisconnectTimerRef.current) {
          clearTimeout(iceDisconnectTimerRef.current)
          iceDisconnectTimerRef.current = null
        }
      }

      if (state === 'failed') {
        if (iceDisconnectTimerRef.current) {
          clearTimeout(iceDisconnectTimerRef.current)
          iceDisconnectTimerRef.current = null
        }
        if (isInitiatorRef.current) {
          // Initiator attempts ICE restart before giving up
          try {
            const offer = await pc.createOffer({ iceRestart: true })
            await pc.setLocalDescription(offer)
            if (socketRef.current?.connected) {
              socketRef.current.emit('webrtc:offer', { offer })
              console.log('[WebRTC] ICE restart offer sent')
            }
          } catch (e) {
            console.error('[ICE] restart offer failed — closing:', e)
            closePC()
            onDisconnectedRef.current()
          }
        }
        // Answerer waits for restart offer from initiator
      }
    }

    pcRef.current = pc
    return pc
  }, [closePC, remoteVideoRef])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)

      // Get guest auth token
      let token: string
      try {
        const res = await fetch(`${SERVER_URL}/api/guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        })
        const data = await res.json()
        if (!data.success || cancelled) return
        token = data.token
        setServerOffline(false)
      } catch {
        if (cancelled) return
        console.warn('Server offline — retrying in 5s')
        setServerOffline(true)
        retryTimer.current = setTimeout(() => { if (!cancelled) init() }, 5000)
        return
      }

      // Connect socket
      const socket = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      })
      socketRef.current = socket

      socket.on('connect', () => {
        if (cancelled) return
        setIsReady(true)
        setServerOffline(false)
        if (pendingJoin.current) {
          pendingJoin.current = false
          onSearchingRef.current()
          socket.emit('join-queue', { username, mode: pendingMode.current, tags: pendingTagsRef.current })
        }
      })

      socket.on('disconnect', () => {
        setIsReady(false)
        onDisconnectedRef.current()
      })

      socket.on('reconnect', () => {
        setIsReady(true)
      })

      // ── MATCH FOUND ──────────────────────────────────────────────
      socket.on('match-found', async (data: { partner: Partner; isInitiator: boolean; mode?: string; sharedTags?: string[] }) => {
        const matchMode = (data.mode === 'date' ? 'date' : 'random') as 'random' | 'date'
        const common = Array.isArray(data.sharedTags) ? data.sharedTags : []
        setSharedTags(common)
        isInitiatorRef.current = data.isInitiator  // remember role for ICE restart
        onConnectedRef.current(data.partner, matchMode, common)

        const pc = createPC()

        if (data.isInitiator) {
          // Small delay to ensure both sides are ready
          await new Promise(r => setTimeout(r, 300))
          try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            const boostedOffer = { ...offer, sdp: boostBitrate(offer.sdp || '') }
            await pc.setLocalDescription(boostedOffer)
            socket.emit('webrtc:offer', { offer: boostedOffer })
          } catch (e) {
            console.error('Offer failed:', e)
          }
        }
      })

      // ── RECEIVE OFFER ─────────────────────────────────────────────
      socket.on('webrtc:offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current || createPC()
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          // Flush any ICE candidates that arrived before remote description was set
          while (pendingCandidates.current.length > 0) {
            const c = pendingCandidates.current.shift()!
            try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
          }
          const answer = await pc.createAnswer()
          const boostedAnswer = { ...answer, sdp: boostBitrate(answer.sdp || '') }
          await pc.setLocalDescription(boostedAnswer)
          socket.emit('webrtc:answer', { answer: boostedAnswer })
        } catch (e) {
          console.error('Answer failed:', e)
        }
      })

      // ── RECEIVE ANSWER ────────────────────────────────────────────
      socket.on('webrtc:answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
            // Flush any ICE candidates that arrived before remote description was set
            while (pendingCandidates.current.length > 0) {
              const c = pendingCandidates.current.shift()!
              try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
            }
          } catch (e) { console.error('Set remote answer failed:', e) }
        }
      })

      // ── ICE CANDIDATES ────────────────────────────────────────────
      socket.on('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        const pc = pcRef.current
        if (pc && candidate) {
          if (!pc.remoteDescription) {
            // Remote description not set yet — queue for later
            pendingCandidates.current.push(candidate)
            return
          }
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
          catch (e) { console.warn('ICE add failed:', e) }
        }
      })

      // ── PEER LEFT ─────────────────────────────────────────────────
      socket.on('peer-disconnected', () => {
        closePC()
        onDisconnectedRef.current()
      })

      // ── CRUSH REQUEST ─────────────────────────────────────────────
      socket.on('crush-request', ({ from }: { from: string }) => {
        onCrushRequestRef.current(from)
      })

      // ── LIVE STATS ────────────────────────────────────────────────
      socket.on('stats', (data: { online: number; inCalls: number; searching: number }) => {
        setLiveStats(data)
      })

      // ── LIVE CHAT MESSAGE (in-call relay) ────────────────────────
      socket.on('chat-message', ({ from, type, text, mediaUrl }: { from: string; type?: string; text?: string; mediaUrl?: string }) => {
        onChatMessageRef.current?.({ type: type || 'text', text, mediaUrl }, from)
        // Dispatch for Mascot wingman
        if (text) window.dispatchEvent(new CustomEvent('freak:chat', { detail: { from, text, ts: Date.now() } }))
      })

      // ── DIRECT CRUSH MESSAGE (routed by username) ─────────────────
      socket.on('crush-message', ({ id, from, type, text, mediaUrl, timestamp }: {
        id: string; from: string; type: string; text?: string; mediaUrl?: string; timestamp: number
      }) => {
        onCrushMessageRef.current?.({ id, type, text, mediaUrl, timestamp }, from)
      })

      // ── MESSAGE DELIVERY ACK ──────────────────────────────────────
      socket.on('crush-message-ack', ({ id, status }: { id: string; status: 'delivered' | 'queued' }) => {
        onMessageAckRef.current?.(id, status)
      })

      // ── READ RECEIPT ──────────────────────────────────────────────
      socket.on('message-read', ({ fromUsername }: { fromUsername: string }) => {
        onMessageReadRef.current?.(fromUsername)
      })
    }

    init()

    return () => {
      cancelled = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (iceDisconnectTimerRef.current) clearTimeout(iceDisconnectTimerRef.current)
      // Notify partner before socket closes — they get instant cleanup
      socketRef.current?.emit('partner-leaving')
      closePC()
      socketRef.current?.disconnect()
    }
  }, [username])

  const pendingTagsRef = useRef<string[]>([])

  const joinQueue = useCallback((mode: 'random' | 'date' = 'random', tags: string[] = []) => {
    onSearchingRef.current()
    setSharedTags([])
    pendingMode.current = mode
    pendingTagsRef.current = tags
    if (!socketRef.current?.connected || !isReady) {
      pendingJoin.current = true
      return
    }
    pendingJoin.current = false
    socketRef.current.emit('join-queue', { username, mode, tags })
  }, [isReady, username])

  const leaveQueue = useCallback(() => {
    // Emit partner-leaving FIRST — server immediately notifies partner before any cleanup
    // This is the fastest path: partner gets disconnected within one round-trip
    socketRef.current?.emit('partner-leaving')
    socketRef.current?.emit('leave-queue')
    closePC()
  }, [closePC])

  const skip = useCallback(() => {
    leaveQueue()
    // Immediately show searching state — no 300ms delay for better UX
    onSearchingRef.current()
    if (socketRef.current?.connected) {
      // Small server-side delay before re-joining so cleanup propagates to old partner
      setTimeout(() => {
        socketRef.current?.emit('join-queue', { username, mode: pendingMode.current, tags: pendingTagsRef.current })
      }, 200)
    } else {
      pendingJoin.current = true
    }
  }, [leaveQueue, username])

  const stop = useCallback(() => {
    pendingJoin.current = false
    leaveQueue()
    onDisconnectedRef.current()
  }, [leaveQueue])

  const sendCrushRequest = useCallback(() => {
    socketRef.current?.emit('crush-request', { username })
  }, [username])

  const acceptCrushRequest = useCallback(() => {
    socketRef.current?.emit('crush-request', { username }) // notify them back
  }, [username])

  // Direct message to a crush by their username (works even if not in same call)
  const sendDirectCrushMessage = useCallback((toUsername: string, payload: { id: string; type: string; text?: string; mediaUrl?: string }) => {
    socketRef.current?.emit('crush-message', { toUsername, ...payload })
  }, [])

  // Tell the other person you've read their messages
  const sendReadReceipt = useCallback((toUsername: string) => {
    socketRef.current?.emit('message-read', { toUsername })
  }, [])

  // Replace the video track being sent to the peer (for character overlays)
  const replaceVideoTrack = useCallback((newTrack: MediaStreamTrack | null) => {
    const pc = pcRef.current
    if (!pc) return
    const sender = pc.getSenders().find(s => s.track?.kind === 'video')
    if (!sender) return
    if (newTrack) {
      sender.replaceTrack(newTrack).catch(e => console.warn('replaceTrack failed:', e))
    } else {
      // Restore original camera track
      const camTrack = localStreamRef.current?.getVideoTracks()[0]
      if (camTrack) sender.replaceTrack(camTrack).catch(e => console.warn('replaceTrack restore failed:', e))
    }
  }, [])

  const sendCallChat = useCallback((text: string) => {
    socketRef.current?.emit('chat-message', { type: 'text', text })
  }, [])

  return { joinQueue, skip, stop, isReady, serverOffline, liveStats, sharedTags, sendCrushRequest, acceptCrushRequest, sendDirectCrushMessage, sendReadReceipt, replaceVideoTrack, sendCallChat }
}
