export interface User {
  id: string
  username: string
  interests: string[]
  joinedAt: Date
  connectionsCount: number
  avatar?: string
  bio?: string
  theme?: string
  layoutPreference?: string
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

export interface StreamerSettings {
  theme: string
  layout: 'fullscreen' | 'split' | 'corner'
  chatEnabled: boolean
  soundEnabled: boolean
  autoSkipEnabled: boolean
  skipDelay: number
}