import express from 'express'
import jwt from 'jsonwebtoken'
import config from '../config/config.js'

const router = express.Router()

// POST /api/guest — create a guest session, returns JWT (no DB required)
router.post('/', (req, res) => {
  try {
    const username = (req.body.username || '').trim().slice(0, 20) || `Freak${Math.floor(Math.random() * 9999)}`
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const token = jwt.sign(
      { id: guestId, username, isGuest: true },
      config.JWT_SECRET,
      { expiresIn: '24h', issuer: 'freaky-app', audience: 'freaky-users' }
    )

    res.json({ success: true, token, user: { id: guestId, username, isGuest: true } })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create guest session' })
  }
})

export default router
