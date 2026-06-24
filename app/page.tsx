'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { CONTRACT_ADDRESS, CRYPTO_META, FOREX_META } from '@/lib/config'

const Mochi = dynamic(() => import('@/components/Mochi').then(m => ({ default: m.Mochi })), { ssr: false })

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  return `${Math.floor(d / 3600)}h ago`
}

function formatPrice(p: any) {
  const n = parseFloat(p.price || p.rate || '0')
  if (!n) return '—'
  if (n > 1000) return `$${n.toLocaleString('en', { maximumFractionDigits: 2 })}`
  if (n > 1)    return `${n.toFixed(4)}`
  return `${n.toFixed(6)}`
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  useEffect(() => {
    const s = localStorage.getItem('po-theme') as 'dark'|'light' | null
    if (s) { setTheme(s); document.documentElement.setAttribute('data-theme', s) }
  }, [])
  function toggle() {
    const n = theme === 'dark' ? 'light' : 'dark'
    setTheme(n); document.documentElement.setAttribute('data-theme', n); localStorage.setItem('po-theme', n)
  }
  return (
    <button onClick={toggle} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 15 }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.12 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

// ── Price Card ────────────────────────────────────────────────────────────────
function PriceCard({ item, index }: { item: any; index: number }) {
  const isCrypto = item.type === 'crypto'
  const meta = isCrypto ? CRYPTO_META[item.symbol] : null
  const quoteMeta = !isCrypto ? FOREX_META[item.quote] : null
  const color = meta?.color || 'var(--blue)'

  return (
    <div className={`card reveal reveal-d${(index % 4) + 1}`} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Color accent top bar */}
      <div style={{ height: 3, background: isCrypto ? `linear-gradient(90deg, ${color}, ${color}88)` : 'var(--grad)' }} />

      <div className="card-inner">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {isCrypto ? (
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color, flexShrink: 0 }}>
              {meta?.emoji}
            </div>
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {quoteMeta?.flag}
            </div>
          )}
          <div>
            <p className="font-display" style={{ fontSize: 14, fontWeight: 700, marginBottom: 1 }}>
              {isCrypto ? meta?.name : `USD / ${item.quote}`}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {isCrypto ? item.symbol : quoteMeta?.name}
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge" style={{ color: isCrypto ? '#F7931A' : 'var(--blue)', background: isCrypto ? 'rgba(247,147,26,0.1)' : 'rgba(30,83,229,0.1)', fontSize: 9 }}>
              {isCrypto ? 'CRYPTO' : 'FOREX'}
            </span>
          </div>
        </div>

        {/* Price */}
        <div style={{ marginBottom: 14 }}>
          <p className="font-display" style={{ fontSize: 'clamp(18px,3vw,26px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            {isCrypto ? `$${parseFloat(item.price).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : parseFloat(item.rate).toLocaleString('en', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
          </p>
          {!isCrypto && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>1 USD = {parseFloat(item.rate).toFixed(4)} {item.quote}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Live</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(item.updated_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker({ prices }: { prices: any[] }) {
  if (!prices.length) return null
  const items = [...prices, ...prices] // duplicate for seamless loop

  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {items.map((p, i) => {
          const isCrypto = p.type === 'crypto'
          const val = isCrypto ? parseFloat(p.price) : parseFloat(p.rate)
          const meta = isCrypto ? CRYPTO_META[p.symbol] : null
          const quoteMeta = !isCrypto ? FOREX_META[p.quote] : null

          return (
            <div key={i} className="ticker-item">
              <span style={{ fontSize: 14 }}>{isCrypto ? meta?.emoji : quoteMeta?.flag}</span>
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {isCrypto ? p.symbol.replace('USDT','') : `${p.base}/${p.quote}`}
              </span>
              <span className="font-mono" style={{ fontSize: 12, color: isCrypto ? 'var(--green)' : 'var(--blue2)' }}>
                {isCrypto
                  ? `$${val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : val.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OraclePage() {
  const [prices, setPrices] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  useReveal()

  const fetchPrices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/prices', { cache: 'no-store' })
      const data = await res.json()
      if (Array.isArray(data.prices)) setPrices(data.prices)
      if (data.stats) setStats(data.stats)
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(() => fetchPrices(true), 30000)
    return () => clearInterval(t)
  }, [fetchPrices])

  const cryptoPrices = prices.filter(p => p.type === 'crypto')
  const forexPrices  = prices.filter(p => p.type === 'forex')

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* TOPNAV */}
      <nav className="topnav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>◉</div>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 700 }}>PriceOracle</span>
          <span className="badge" style={{ color: 'var(--green)', background: 'rgba(0,200,83,0.1)', marginLeft: 4 }}>
            <span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {refreshing && <div className="spinner" />}
          <a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', display: 'none' }} className="desktop-only">
            {CONTRACT_ADDRESS.slice(0, 10)}...
          </a>
          <ThemeToggle />
          <button className="btn-outline" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => fetchPrices(true)}>
            ↻ Refresh
          </button>
        </div>
      </nav>

      {/* TICKER */}
      <Ticker prices={prices} />

      {/* HERO */}
      <div className="section" style={{ paddingBottom: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '4px 12px', background: 'rgba(30,83,229,0.1)', border: '1px solid rgba(30,83,229,0.25)', borderRadius: 999 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 11, color: 'var(--blue2)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>GENLAYER BRADBURY TESTNET</span>
            </div>
            <h1 className="font-display reveal" style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 16 }}>
              On-Chain Price Feed<br />
              <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Verified by AI.</span>
            </h1>
            <p className="reveal reveal-d1" style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--muted)', maxWidth: 480, marginBottom: 28 }}>
              Live crypto and forex prices fetched from public APIs and verified by 5 independent GenLayer validators before being written on-chain.
            </p>

            {/* Stats row */}
            <div className="reveal reveal-d2" style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              {[
                { val: stats.total_symbols || String(prices.length), label: 'Pairs tracked' },
                { val: stats.total_updates || '—', label: 'Total updates' },
                { val: '5', label: 'AI validators' },
                { val: lastRefresh ? timeAgo(lastRefresh.toISOString()) : '—', label: 'Last refresh' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <p className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{val}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.05em' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mochi */}
          <div className="reveal" style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(30,83,229,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            <Mochi size={200} />
          </div>
        </div>
      </div>

      {/* ── CRYPTO PRICES ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--blue2)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>BINANCE · REAL-TIME</p>
            <h2 className="font-display reveal" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Crypto Prices</h2>
          </div>
          <span className="badge" style={{ color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }}>
            Auto-refresh · 30s
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
        ) : (
          <div className="price-grid">
            {cryptoPrices.map((p, i) => <PriceCard key={p.symbol} item={p} index={i} />)}
          </div>
        )}
      </div>

      {/* ── FOREX RATES ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--blue2)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>FRANKFURTER · EXCHANGERATE-API</p>
          <h2 className="font-display reveal" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Forex Rates</h2>
        </div>
        <div className="price-grid">
          {forexPrices.map((p, i) => <PriceCard key={p.symbol} item={p} index={i} />)}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '60px 0' }}>
        <div className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <h2 className="font-display reveal" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 32, textAlign: 'center' }}>How It Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { n: '01', t: 'Fetch', d: 'Contract fetches price from Binance or forex APIs inside a nondet block', c: 'var(--blue)' },
              { n: '02', t: 'Verify', d: '5 independent GenLayer validators each check the output format and value', c: 'var(--purple)' },
              { n: '03', t: 'Store', d: 'Price is written on-chain with timestamp — any dApp can read it instantly', c: 'var(--green)' },
            ].map(({ n, t, d, c }, i) => (
              <div key={n} className={`panel reveal reveal-d${i+1}`} style={{ borderTop: `3px solid ${c}`, paddingTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, letterSpacing: '0.08em' }}>{n}</p>
                <p className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t}</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTRACT INFO ── */}
      <div className="section">
        <div className="panel reveal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 6 }}>CONTRACT ADDRESS · BRADBURY TESTNET</p>
            <p className="font-mono" style={{ fontSize: 14, color: 'var(--blue2)', wordBreak: 'break-all' }}>{CONTRACT_ADDRESS}</p>
          </div>
          <a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '10px 20px', fontSize: 14, textDecoration: 'none' }}>
            View on Explorer ↗
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>◉</div>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 700 }}>PriceOracle</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>by Manablaq</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Built on GenLayer Bradbury Testnet · Prices auto-refresh every 30s</p>
        </div>
      </footer>

    </div>
  )
}
