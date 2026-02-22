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

export interface Crush {
  id: string
  username: string
  avatar?: string
  addedAt: Date
  lastMessage?: string
  lastMessageAt?: Date
  unread: number
  online: boolean
}

export type MessageType = 'text' | 'image' | 'gif'

export interface ChatMessage {
  id: string
  type: MessageType
  text?: string
  mediaUrl?: string
  sender: 'me' | 'them'
  timestamp: Date
  status?: 'sent' | 'delivered' | 'read' // only relevant for sender's messages
}

export interface Connection {
  id: string
  partnerId: string
  partnerUsername: string
  duration: number
  timestamp: Date
  wasAdded: boolean
  likesExchanged: number
}

// Legacy Message type (used by old components)
export interface Message {
  id: string
  text: string
  sender: 'me' | 'partner'
  timestamp: Date
}
