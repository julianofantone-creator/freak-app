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
  onConnected: (partner: Partner) => void
  onDisconnected: () => void
  onSearching: () => void
  onCrushRequest: (fromUsername: string) => void
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
]

export function useFreakSocket({
  username,
  localStream,
  remoteVideoRef,
  onConnected,
  onDisconnected,
  onSearching,
  onCrushRequest,
}: UseFreakSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [serverOffline, setServerOffline] = useState(false)
  const pendingJoin = useRef(false)
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

  const closePC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null
      pcRef.current.onicecandidate = null
      pcRef.current.close()
      pcRef.current = null
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
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

    // When remote stream arrives — attach to video element
    const remoteStream = new MediaStream()
    pc.ontrack = (e) => {
      remoteStream.addTrack(e.track)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
    }

    // Send ICE candidates to partner via signaling
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit('webrtc:ice-candidate', { candidate: e.candidate })
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed') {
        console.warn('ICE failed — restarting ICE')
        pc.restartIce()
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
        console.log('✅ Socket connected:', socket.id)
        setIsReady(true)
        setServerOffline(false)
        if (pendingJoin.current) {
          pendingJoin.current = false
          onSearchingRef.current()
          socket.emit('join-queue', { username })
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
      socket.on('match-found', async (data: { partner: Partner; isInitiator: boolean }) => {
        console.log('🤝 Matched with:', data.partner.username, '| initiator:', data.isInitiator)
        onConnectedRef.current(data.partner)

        const pc = createPC()

        if (data.isInitiator) {
          // Small delay to ensure both sides are ready
          await new Promise(r => setTimeout(r, 300))
          try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            await pc.setLocalDescription(offer)
            socket.emit('webrtc:offer', { offer })
            console.log('📡 Offer sent')
          } catch (e) {
            console.error('Offer failed:', e)
          }
        }
      })

      // ── RECEIVE OFFER ─────────────────────────────────────────────
      socket.on('webrtc:offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        console.log('📡 Offer received')
        const pc = pcRef.current || createPC()
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('webrtc:answer', { answer })
          console.log('📡 Answer sent')
        } catch (e) {
          console.error('Answer failed:', e)
        }
      })

      // ── RECEIVE ANSWER ────────────────────────────────────────────
      socket.on('webrtc:answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        console.log('📡 Answer received')
        const pc = pcRef.current
        if (pc) {
          try { await pc.setRemoteDescription(new RTCSessionDescription(answer)) }
          catch (e) { console.error('Set remote answer failed:', e) }
        }
      })

      // ── ICE CANDIDATES ────────────────────────────────────────────
      socket.on('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        const pc = pcRef.current
        if (pc && candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
          catch (e) { console.warn('ICE add failed:', e) }
        }
      })

      // ── PEER LEFT ─────────────────────────────────────────────────
      socket.on('peer-disconnected', () => {
        console.log('👋 Partner disconnected')
        closePC()
        onDisconnectedRef.current()
      })

      // ── CRUSH REQUEST ─────────────────────────────────────────────
      socket.on('crush-request', ({ from }: { from: string }) => {
        onCrushRequestRef.current(from)
      })
    }

    init()

    return () => {
      cancelled = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      closePC()
      socketRef.current?.disconnect()
    }
  }, [username])

  const joinQueue = useCallback(() => {
    onSearchingRef.current()
    if (!socketRef.current?.connected || !isReady) {
      pendingJoin.current = true
      return
    }
    pendingJoin.current = false
    socketRef.current.emit('join-queue', { username })
  }, [isReady, username])

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('leave-queue')
    closePC()
  }, [closePC])

  const skip = useCallback(() => {
    leaveQueue()
    setTimeout(() => {
      onSearchingRef.current()
      if (socketRef.current?.connected) {
        socketRef.current.emit('join-queue', { username })
      } else {
        pendingJoin.current = true
      }
    }, 300)
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

  return { joinQueue, skip, stop, isReady, serverOffline, sendCrushRequest, acceptCrushRequest }
}
