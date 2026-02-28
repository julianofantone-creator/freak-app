import express from 'express'

const router = express.Router()

// In-memory fallback (Railway has no persistent disk) + MongoDB when available
const memoryClicks = []

// POST /api/clicks/ping?src=tk — beacon from frontend
router.post('/ping', async (req, res) => {
  try {
    const source = (req.query.src || req.body?.src || 'unknown').slice(0, 32)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown'
    const ua = (req.headers['user-agent'] || '').slice(0, 200)
    const ref = (req.headers['referer'] || '').slice(0, 200)
    const ts  = Date.now()

    const entry = { source, ip, ua, ref, ts }

    // Store in memory (always)
    memoryClicks.push(entry)
    if (memoryClicks.length > 50000) memoryClicks.shift() // cap at 50k

    // Try MongoDB if available
    try {
      const mongoose = await import('mongoose')
      if (mongoose.default.connection.readyState === 1) {
        const Click = mongoose.default.models.Click || mongoose.default.model('Click',
          new mongoose.default.Schema({ source: String, ip: String, ua: String, ref: String, ts: Number },
            { timestamps: false, collection: 'clicks' }))
        await Click.create(entry)
      }
    } catch (_) { /* mongo optional */ }

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false })
  }
})

// GET /api/clicks/stats?hours=8&src=tk — query click counts
router.get('/stats', async (req, res) => {
  try {
    const hours  = Math.min(parseInt(req.query.hours) || 8, 720)
    const src    = req.query.src || null
    const since  = Date.now() - hours * 60 * 60 * 1000

    let results = null

    // Try MongoDB first
    try {
      const mongoose = await import('mongoose')
      if (mongoose.default.connection.readyState === 1) {
        const Click = mongoose.default.models.Click || mongoose.default.model('Click',
          new mongoose.default.Schema({ source: String, ip: String, ua: String, ref: String, ts: Number },
            { timestamps: false, collection: 'clicks' }))
        const query = { ts: { $gte: since } }
        if (src) query.source = src
        const count = await Click.countDocuments(query)
        const breakdown = await Click.aggregate([
          { $match: query },
          { $group: { _id: '$source', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        results = { count, breakdown, from: 'mongodb' }
      }
    } catch (_) { /* mongo optional */ }

    // Fallback: in-memory
    if (!results) {
      const filtered = memoryClicks.filter(c => c.ts >= since && (!src || c.source === src))
      const breakdown = {}
      for (const c of filtered) {
        breakdown[c.source] = (breakdown[c.source] || 0) + 1
      }
      results = {
        count: filtered.length,
        breakdown: Object.entries(breakdown).map(([s, n]) => ({ _id: s, count: n })).sort((a,b) => b.count - a.count),
        from: 'memory'
      }
    }

    res.json({ ok: true, hours, ...results })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
