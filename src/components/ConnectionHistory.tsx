import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Heart, MessageSquare, UserPlus, Star, Filter } from 'lucide-react'
import { User, Connection } from '../types'

interface ConnectionHistoryProps {
  user: User
  onBack: () => void
}

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({ user, onBack }) => {
  const [filter, setFilter] = useState<'all' | 'liked' | 'added'>('all')

  // Mock data - in real app this would come from backend
  const connections: Connection[] = [
    {
      id: '1',
      partnerId: 'user1',
      partnerUsername: 'MusicLover22',
      duration: 245,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      wasAdded: true,
      likesExchanged: 2
    },
    {
      id: '2',
      partnerId: 'user2',
      partnerUsername: 'GameMaster99',
      duration: 89,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      wasAdded: false,
      likesExchanged: 1
    },
    {
      id: '3',
      partnerId: 'user3',
      partnerUsername: 'ArtisticSoul',
      duration: 432,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      wasAdded: true,
      likesExchanged: 3
    },
    {
      id: '4',
      partnerId: 'user4',
      partnerUsername: 'CoffeeAddict',
      duration: 156,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      wasAdded: false,
      likesExchanged: 0
    },
  ]

  const filteredConnections = connections.filter(conn => {
    switch (filter) {
      case 'liked':
        return conn.likesExchanged > 0
      case 'added':
        return conn.wasAdded
      default:
        return true
    }
  })

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    
    return date.toLocaleDateString()
  }

  const totalConnections = connections.length
  const totalTime = connections.reduce((sum, conn) => sum + conn.duration, 0)
  const totalLikes = connections.reduce((sum, conn) => sum + conn.likesExchanged, 0)
  const addedConnections = connections.filter(conn => conn.wasAdded).length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        className="flex items-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          onClick={onBack}
          className="mr-4 p-2 text-white/60 hover:text-white transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <h1 className="text-3xl font-bold text-white">Your Connections</h1>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { icon: MessageSquare, label: 'Total Chats', value: totalConnections, color: 'bg-blue-500' },
          { icon: Clock, label: 'Total Time', value: formatDuration(totalTime), color: 'bg-green-500' },
          { icon: Heart, label: 'Likes Given/Received', value: totalLikes, color: 'bg-red-500' },
          { icon: UserPlus, label: 'Added Friends', value: addedConnections, color: 'bg-purple-500' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-4"
            whileHover={{ scale: 1.05 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-gray-400 text-sm">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter Buttons */}
      <motion.div
        className="flex space-x-4 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {[
          { key: 'all', label: 'All', count: totalConnections },
          { key: 'liked', label: 'Liked', count: connections.filter(c => c.likesExchanged > 0).length },
          { key: 'added', label: 'Added', count: addedConnections },
        ].map(filterOption => (
          <motion.button
            key={filterOption.key}
            onClick={() => setFilter(filterOption.key as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              filter === filterOption.key
                ? 'bg-primary-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Filter className="w-4 h-4" />
            <span>{filterOption.label}</span>
            <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
              {filterOption.count}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Connections List */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {filteredConnections.length === 0 ? (
          <motion.div
            className="text-center py-12 bg-white/5 rounded-xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-white mb-2">No connections yet</h3>
            <p className="text-gray-400">Start chatting to build your connection history!</p>
          </motion.div>
        ) : (
          filteredConnections.map((connection, i) => (
            <motion.div
              key={connection.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/15 transition-all cursor-pointer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02, x: 10 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-bold">
                    {connection.partnerUsername[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      {connection.partnerUsername}
                      {connection.wasAdded && (
                        <span className="ml-2 text-xs bg-green-500 px-2 py-1 rounded-full">Added</span>
                      )}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(connection.duration)}</span>
                      </span>
                      <span>{formatDate(connection.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-4">
                  {connection.likesExchanged > 0 && (
                    <div className="flex items-center space-x-1 text-red-400">
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="text-sm">{connection.likesExchanged}</span>
                    </div>
                  )}
                  
                  {/* Quality indicator */}
                  <div className="flex items-center space-x-1">
                    {[...Array(Math.min(5, Math.ceil(connection.duration / 100)))].map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Achievement Banner */}
      {totalConnections >= 10 && (
        <motion.div
          className="mt-8 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center space-x-4">
            <div className="text-4xl">🏆</div>
            <div>
              <h3 className="text-yellow-400 font-bold text-lg">Social Butterfly!</h3>
              <p className="text-gray-300">You've made {totalConnections} connections! Keep it up!</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default ConnectionHistory