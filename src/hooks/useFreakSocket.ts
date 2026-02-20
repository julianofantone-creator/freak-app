import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SERVER_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080'

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
}

export function useFreakSocket({
  username,
  localStream,
  remoteVideoRef,
  onConnected,
  onDisconnected,
  onSearching,
}: UseFreakSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const tokenRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [serverOffline, setServerOffline] = useState(false)

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  // Create fresh RTCPeerConnection
  const createPC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
    }

    // Remote stream → video element
    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0]
      }
    }

    // ICE candidates → signal
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('webrtc:ice-candidate', { candidate: e.candidate })
      }
    }

    pcRef.current = pc
    return pc
  }, [localStream, remoteVideoRef])

  // Init socket + auth
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        let res: Response
        try {
          res = await fetch(`${SERVER_URL}/api/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
          })
        } catch {
          console.warn('Freak backend offline — running in demo mode')
          setServerOffline(true)
          return
        }
        const data = await res.json()
        if (!data.success || cancelled) return

        tokenRef.current = data.token

        const socket = io(SERVER_URL, {
          auth: { token: data.token },
          transports: ['websocket', 'polling'],
        })

        socket.on('connect', () => {
          if (!cancelled) setIsReady(true)
        })

        socket.on('disconnect', () => {
          setIsReady(false)
          onDisconnected()
        })

        // Match found — start WebRTC as initiator
        socket.on('match-found', async (data: { partner: Partner; isInitiator: boolean }) => {
          onConnected(data.partner)
          const pc = createPC()

          if (data.isInitiator) {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.emit('webrtc:offer', { offer })
          }
        })

        // Receive offer — answer it
        socket.on('webrtc:offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
          const pc = pcRef.current || createPC()
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('webrtc:answer', { answer })
        })

        // Receive answer
        socket.on('webrtc:answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
          const pc = pcRef.current
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer))
        })

        // Receive ICE candidates
        socket.on('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
          const pc = pcRef.current
          if (pc && candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
          }
        })

        // Partner disconnected
        socket.on('peer-disconnected', () => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
          onDisconnected()
        })

        socketRef.current = socket
      } catch (err) {
        console.error('Socket init failed:', err)
      }
    }

    init()
    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      pcRef.current?.close()
    }
  }, [username])

  const joinQueue = useCallback(() => {
    if (!socketRef.current || !isReady) return
    onSearching()
    socketRef.current.emit('join-queue', { username })
  }, [isReady, username, onSearching])

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('leave-queue')
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }, [remoteVideoRef])

  const skip = useCallback(() => {
    leaveQueue()
    setTimeout(() => joinQueue(), 300)
  }, [leaveQueue, joinQueue])

  const stop = useCallback(() => {
    leaveQueue()
    onDisconnected()
  }, [leaveQueue, onDisconnected])

  return { joinQueue, skip, stop, isReady, serverOffline }
}
