export interface User {
  id: string
  username: string
  interests: string[]
  joinedAt: Date
  connectionsCount: number
  avatar?: string
  bio?: string
}

export type ConnectionState = 'idle' | 'searching' | 'connected' | 'disconnected'

export interface Connection {
  id: string
  partnerId: string
  partnerUsername: string
  duration: number // seconds
  timestamp: Date
  wasAdded: boolean
  likesExchanged: number
}

export interface Message {
  id: string
  text: string
  sender: 'me' | 'partner'
  timestamp: Date
}