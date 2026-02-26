import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, TrendingUp, Copy, Check, Play, Heart, Smartphone } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const SERVER_URL = (import.meta as any).env?.VITE_API_URL || 'https://freak-app-production.up.railway.app'

const CONTENT_HOOKS = [
  { emoji: '💀', hook: '"I tried the new Omegle replacement and it actually worked"', views: '2M+ views format' },
  { emoji: '😭', hook: '"Setting my followers up on a blind date live"', views: 'Date Mode content' },
  { emoji: '🎭', hook: '"I wore the Clown filter the whole time and..."', views: 'Filter reaction content' },
  { emoji: '👀', hook: '"This app is actually dangerous"', views: 'Proven viral hook' },
  { emoji: '🫠', hook: '"POV: matching with strangers wearing face filters"', views: 'POV format' },
  { emoji: '💕', hook: '"I found my type in 5 minutes using this app"', views: 'Romance/connection content' },
]

export default function CreatorLanding() {
  const [name, setName]         = useState('')
  const [handle, setHandle]     = useState('')
  const [platform, setPlatform] = useState('tiktok')
  const [loading, setLoading]   = useState(false)
  const [refLink, setRefLink]   = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  const register = async () => {
    if (!name.trim() || !handle.trim()) { toast.error('Fill in both fields'); return }
    setLoading(true)
    try {
      const streamUrl = platform === 'tiktok'
        ? `https://tiktok.com/@${handle.replace('@','')}`
        : platform === 'instagram'
        ? `https://instagram.com/${handle.replace('@','')}`
        : handle
      const res = await fetch(`${SERVER_URL}/api/streamer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamerName: name.trim(), streamUrl }),
      })
      const data = await res.json()
      if (data.refUrl) {
        setRefLink(data.refUrl)
        toast.success('You\'re in 🔥', { style: { background: '#FF0066', color: '#fff' } })
      }
    } catch { toast.error('Try again') }
    finally { setLoading(false) }
  }

  const copy = async () => {
    if (!refLink) return
    await navigator.clipboard.writeText(refLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    toast.success('Copied!', { style: { background: '#FF0066', color: '#fff' } })
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      <Toaster position="top-center" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <a href="/" className="text-2xl font-black text-[#FF0066] tracking-tighter">freaky</a>
        <div className="flex items-center gap-4">
          <a href="/streamers" className="text-sm text-white/40 hover:text-white/70 transition-colors">Streamers</a>
          <a href="/" className="text-sm text-white/50 hover:text-white transition-colors">← Back to app</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-[#FF0066]/10 border border-[#FF0066]/30 rounded-full px-4 py-2 mb-8"
        >
          <Smartphone className="w-4 h-4 text-[#FF0066]" />
          <span className="text-sm font-semibold text-[#FF0066]">Creator Program — TikTok · Instagram · YouTube</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-6"
        >
          Your followers,{' '}
          <span className="text-[#FF0066]">matched live</span>
          <br />on camera
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="text-white/60 text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Post your creator link. Your followers get matched with strangers on Freaky —
          random video chat with face filters. You film the chaos. It goes viral. Simple.
        </motion.p>

        <motion.a
          href="#join"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.16 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="inline-block bg-[#FF0066] text-white font-black text-lg px-10 py-4 rounded-2xl shadow-[0_0_40px_rgba(255,0,102,0.4)]"
        >
          Get My Creator Link — Free
        </motion.a>
      </section>

      {/* Content hooks */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5">
        <h2 className="text-3xl font-black tracking-tighter text-center mb-3">Ready-to-film content</h2>
        <p className="text-center text-white/50 mb-10">Every single one of these formats kills on TikTok. Just add your creator link in the caption.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {CONTENT_HOOKS.map(({ emoji, hook, views }) => (
            <motion.div
              key={hook}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-5 flex gap-4 items-start"
            >
              <span className="text-2xl flex-shrink-0">{emoji}</span>
              <div>
                <p className="font-semibold text-sm mb-1">"{hook}"</p>
                <p className="text-[#FF0066] text-xs font-medium">{views}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What makes it viral */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5">
        <h2 className="text-3xl font-black tracking-tighter text-center mb-12">Why this content goes viral</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Play, title: 'Unscripted every time', body: 'Every match is a different person. You never know what you\'re getting. That unpredictability is what TikTok rewards.' },
            { icon: Heart, title: 'Face filters = content gold', body: '17 face filters including Melting, Chipmunk, Cyclops, Funhouse. Reactions to filters get shared constantly.' },
            { icon: TrendingUp, title: 'Your followers are the cast', body: 'People share content when they\'re IN it. Your followers will screenshot, share, and tag friends.' },
          ].map(({ icon: Icon, title, body }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-6"
            >
              <Icon className="w-6 h-6 text-[#FF0066] mb-4" />
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What your followers get */}
      <section className="max-w-3xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="bg-[#0d0d0d] border border-[#FF0066]/15 rounded-3xl p-8 text-center">
          <Zap className="w-8 h-8 text-[#FF0066] fill-[#FF0066] mx-auto mb-4" />
          <h2 className="text-2xl font-black tracking-tighter mb-3">Your followers get Freaky+ free</h2>
          <p className="text-white/50 mb-6">Everyone who clicks your link gets 7 days of Freaky+ automatically — priority matching, date mode access, Freaky+ badge. Makes your link actually worth posting.</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {['⚡ Priority queue', '💕 Date Mode', '🎭 All filters'].map(f => (
              <div key={f} className="bg-black rounded-xl py-3 px-2 text-white/70 font-medium">{f}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign up form */}
      <section id="join" className="max-w-xl mx-auto px-6 py-20">
        <div className="bg-[#0d0d0d] border border-[#FF0066]/20 rounded-3xl p-8 shadow-[0_0_80px_rgba(255,0,102,0.10)]">
          <h2 className="text-3xl font-black tracking-tighter mb-2 text-center">Get your creator link</h2>
          <p className="text-white/50 text-sm text-center mb-8">Free. 10 seconds. Your followers thank you.</p>

          {!refLink ? (
            <div className="flex flex-col gap-4">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name / creator name"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#FF0066]/50 transition-colors"
              />
              {/* Platform selector */}
              <div className="grid grid-cols-3 gap-2">
                {['tiktok','instagram','youtube'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all border ${platform === p ? 'bg-[#FF0066]/15 border-[#FF0066]/50 text-[#FF0066]' : 'border-white/10 text-white/40 hover:text-white/60'}`}
                  >
                    {p === 'tiktok' ? '🎵 TikTok' : p === 'instagram' ? '📸 Instagram' : '▶️ YouTube'}
                  </button>
                ))}
              </div>
              <input
                value={handle}
                onChange={e => setHandle(e.target.value)}
                placeholder={platform === 'tiktok' ? '@yourhandle' : platform === 'instagram' ? '@yourhandle' : 'youtube.com/channel'}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#FF0066]/50 transition-colors"
              />
              <motion.button
                onClick={register}
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-[#FF0066] text-white font-black text-lg py-4 rounded-2xl shadow-[0_0_30px_rgba(255,0,102,0.35)] disabled:opacity-60 mt-1"
              >
                {loading ? 'Generating...' : 'Get My Creator Link 🔥'}
              </motion.button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-5">
              <div className="text-4xl text-center">🔥</div>
              <h3 className="text-xl font-black text-center">You're in, {name}!</h3>
              <p className="text-white/50 text-sm text-center">Post this in your bio or caption. Followers who click get 7 days of Freaky+ instantly.</p>
              <div className="bg-black border border-[#FF0066]/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-[#FF0066] text-sm font-mono flex-1 truncate">{refLink}</span>
                <motion.button onClick={copy} whileTap={{ scale: 0.9 }} className="p-2 rounded-lg bg-[#FF0066]/10 hover:bg-[#FF0066]/20 transition-colors flex-shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[#FF0066]" />}
                </motion.button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/8 rounded-xl p-4">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Suggested caption</p>
                <p className="text-sm text-white/80 leading-relaxed">
                  tried this random video chat app and it's actually unhinged 😭 my followers get free Freaky+ if you use my link → {refLink} #freaky #randomvideochat
                </p>
              </div>
              <button onClick={() => { setRefLink(null); setName(''); setHandle('') }}
                className="py-3 border border-white/10 text-white/40 font-bold rounded-xl text-sm hover:text-white/70 transition-colors">
                Register another
              </button>
            </motion.div>
          )}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-white/30 text-sm">
        <span className="text-[#FF0066] font-black">freaky</span> — random video chat for creators and their communities
      </footer>
    </div>
  )
}
