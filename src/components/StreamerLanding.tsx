import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Link, Users, TrendingUp, Heart, Monitor, Copy, Check } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const SERVER_URL = (import.meta as any).env?.VITE_API_URL || 'https://freak-app-production.up.railway.app'

export default function StreamerLanding() {
  const [name, setName] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [refLink, setRefLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const register = async () => {
    if (!name.trim() || !streamUrl.trim()) {
      toast.error('Fill in both fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${SERVER_URL}/api/streamer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamerName: name.trim(), streamUrl: streamUrl.trim() }),
      })
      const data = await res.json()
      if (data.refUrl) {
        setRefLink(data.refUrl)
        toast.success('You\'re in! 🔥', { style: { background: '#FF0066', color: '#fff' } })
      }
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!refLink) return
    await navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied!', { style: { background: '#FF0066', color: '#fff' } })
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      <Toaster position="top-center" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <a href="/" className="text-2xl font-black text-[#FF0066] tracking-tighter">freaky</a>
        <a href="/" className="text-sm text-white/50 hover:text-white transition-colors">← Back to app</a>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-[#FF0066]/10 border border-[#FF0066]/30 rounded-full px-4 py-2 mb-8"
        >
          <Zap className="w-4 h-4 text-[#FF0066] fill-[#FF0066]" />
          <span className="text-sm font-semibold text-[#FF0066]">Streamer Program — Free to join</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[0.95]"
        >
          Host live{' '}
          <span className="text-[#FF0066]">eDating shows</span>
          <br />on Freaky
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-white/60 text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Your viewers get matched live, on camera, in front of your stream.
          You get the content. They get the experience. Everyone goes viral.
        </motion.p>

        <motion.a
          href="#join"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="inline-block bg-[#FF0066] text-white font-black text-lg px-10 py-4 rounded-2xl shadow-[0_0_40px_rgba(255,0,102,0.4)]"
        >
          Get My Ref Link — Free
        </motion.a>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5">
        <h2 className="text-3xl font-black tracking-tighter text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Link, n: '01', title: 'Get your ref link', body: 'Register below and get a unique link tied to your channel in 10 seconds.' },
            { icon: Users, n: '02', title: 'Drop it in your stream', body: 'Post it in chat. Viewers who click get 7 days of Freaky+ free — instantly.' },
            { icon: Monitor, n: '03', title: 'Watch the chaos', body: 'Your stream overlay shows your viewers getting matched live. Pure content gold.' },
          ].map(({ icon: Icon, n, title, body }) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-6"
            >
              <div className="text-[#FF0066]/40 font-black text-4xl mb-4">{n}</div>
              <Icon className="w-6 h-6 text-[#FF0066] mb-3" />
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What your viewers get */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5">
        <h2 className="text-3xl font-black tracking-tighter text-center mb-4">What your viewers get</h2>
        <p className="text-center text-white/50 mb-12">Everyone who uses your link gets Freaky+ free for 7 days</p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Zap, title: 'Freaky+ Badge', body: 'Priority queue — matched faster than everyone else' },
            { icon: Heart, title: 'Stream Overlay', body: 'See your streamer\'s live feed inside the app while they chat' },
            { icon: TrendingUp, title: 'Date Mode Access', body: 'Speed dating queue — 3 min rounds, mutual swipe to match' },
            { icon: Users, title: 'Priority Matching', body: 'Freaky+ users get paired with other Freaky+ users first' },
          ].map(({ icon: Icon, title, body }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex gap-4 bg-[#0d0d0d] border border-white/8 rounded-2xl p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF0066]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[#FF0066]" />
              </div>
              <div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-white/50 text-sm">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why streamers love it */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5">
        <h2 className="text-3xl font-black tracking-tighter text-center mb-12">Why streamers love it</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { emoji: '📈', title: 'Endless content', body: 'Every match is unscripted, unfiltered, and unpredictable. Your chat will explode.' },
            { emoji: '🎯', title: 'Your community dates live', body: 'Imagine your chat reacting to two people falling for each other on camera. That\'s every session.' },
            { emoji: '🔗', title: 'Built-in clip moments', body: 'Awkward moments, sparks, instant chemistry — all clippable, all shareable.' },
            { emoji: '🚀', title: 'Grow together', body: 'The more you post the link, the more your community builds inside Freaky. It compounds.' },
          ].map(({ emoji, title, body }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-6"
            >
              <div className="text-3xl mb-3">{emoji}</div>
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Registration form */}
      <section id="join" className="max-w-xl mx-auto px-6 py-20">
        <div className="bg-[#0d0d0d] border border-[#FF0066]/20 rounded-3xl p-8 shadow-[0_0_80px_rgba(255,0,102,0.12)]">
          <h2 className="text-3xl font-black tracking-tighter mb-2 text-center">Get your ref link</h2>
          <p className="text-white/50 text-sm text-center mb-8">Takes 10 seconds. Free forever.</p>

          {!refLink ? (
            <div className="flex flex-col gap-4">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your streamer name"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#FF0066]/50 transition-colors"
              />
              <input
                value={streamUrl}
                onChange={e => setStreamUrl(e.target.value)}
                placeholder="Your stream URL (Twitch, YouTube, Kick...)"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#FF0066]/50 transition-colors"
              />
              <motion.button
                onClick={register}
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-[#FF0066] text-white font-black text-lg py-4 rounded-2xl shadow-[0_0_30px_rgba(255,0,102,0.35)] disabled:opacity-60 mt-2"
              >
                {loading ? 'Generating...' : 'Get My Ref Link 🔥'}
              </motion.button>
              <p className="text-white/30 text-xs text-center">No account needed. Instant.</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-5">
              <div className="text-center text-4xl">🔥</div>
              <h3 className="text-xl font-black text-center">You're in, {name}!</h3>
              <p className="text-white/50 text-sm text-center">Post this link in your chat. Viewers who click get 7 days of Freaky+ instantly.</p>
              <div className="bg-black border border-[#FF0066]/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-[#FF0066] text-sm font-mono flex-1 truncate">{refLink}</span>
                <motion.button onClick={copy} whileTap={{ scale: 0.9 }} className="flex-shrink-0 p-2 rounded-lg bg-[#FF0066]/10 hover:bg-[#FF0066]/20 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[#FF0066]" />}
                </motion.button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={refLink}
                  className="text-center py-3 bg-[#FF0066] text-white font-bold rounded-xl text-sm"
                >
                  Open Freaky ↗
                </a>
                <button
                  onClick={() => { setRefLink(null); setName(''); setStreamUrl('') }}
                  className="py-3 border border-white/10 text-white/50 font-bold rounded-xl text-sm hover:text-white transition-colors"
                >
                  Register another
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-white/30 text-sm">
        <span className="text-[#FF0066] font-black">freaky</span> — random video chat, built for creators
      </footer>
    </div>
  )
}
