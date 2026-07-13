'use client'

import { formatFixed, marketState } from '@/lib/priceguard-core.mjs'
import { useProtocol } from './ProtocolProvider'
import { StatusBadge } from './StatusBadge'

export function MarketPanel({ detailed = false }: { detailed?: boolean }) {
  const { data, loading, error, refresh } = useProtocol()
  const market = data?.market
  const state = marketState(market)
  return <section className="panel market-panel reveal">
    <div className="eyebrow-row"><span className="eyebrow">LATEST V2 ON-CHAIN SNAPSHOT</span><StatusBadge state={loading ? 'UNVERIFIED' : state} /></div>
    {error && <div className="danger-panel"><p>{error}</p><button className="button secondary" onClick={() => void refresh()}>Retry read</button></div>}
    <div className="market-price-row">
      <div><h2>BTC / USD</h2><p className="muted">Direct venue median · policy BTCUSD-1</p></div>
      <strong>{market ? formatFixed(market.median_price, market.decimals, { prefix: '$', trim: false }) : 'No V2 snapshot'}</strong>
    </div>
    <div className="metric-grid">
      <div><span>Confidence</span><b>{market?.confidence || '—'}</b></div>
      <div><span>Venue spread</span><b>{market ? `${market.spread_bps} bps` : '—'}</b></div>
      <div><span>Valid sources</span><b>{market ? `${market.valid_source_count} / 3` : '—'}</b></div>
      <div><span>Sequence</span><b>{market?.update_sequence || '—'}</b></div>
    </div>
    {detailed && <div className="source-list">
      {(market?.observations || []).map(item => <div key={item.source}><span><i className="source-dot" />{item.source}</span><b>{formatFixed(item.price, market?.decimals || 2, { prefix: '$', trim: false })}</b><small>{item.observed_at ? new Date(Number(item.observed_at) * 1000).toLocaleString() : 'Timestamp unavailable'}</small></div>)}
      {!market && <p className="empty">There is no deployed V2 snapshot. API preview values below are not covenant-evaluation evidence.</p>}
    </div>}
  </section>
}

export function ApiPreview() {
  const { data } = useProtocol()
  return <section className="panel">
    <div className="eyebrow-row"><span className="eyebrow">CURRENT API PREVIEW</span><StatusBadge state="UNVERIFIED" /></div>
    <p className="muted callout-copy">These server-fetched venue values show current endpoint availability. They are not validator consensus, are not stored on-chain, and cannot satisfy a covenant.</p>
    <div className="source-list">
      {(data?.preview.observations || []).map(item => <div key={item.source}><span><i className={`source-dot ${item.ok ? '' : 'failed'}`} />{item.source}</span><b>{item.ok ? `$${item.price}` : 'Unavailable'}</b><small>{item.observed_at ? new Date(item.observed_at).toLocaleString() : item.error || 'No timestamp'}</small></div>)}
    </div>
  </section>
}
