'use client'

import { ApiPreview, MarketPanel } from '@/components/MarketPanel'
import { WriteButton } from '@/components/WriteButton'
import { POLICY } from '@/lib/config'

export default function MarketsPage() {
  return <div className="page-width page-top"><div className="page-title"><span className="eyebrow">VERIFIED MARKETS</span><h1>Source transparency</h1><p className="lead small">On-chain consensus evidence and off-chain preview are intentionally separated. Degraded snapshots never trigger a covenant.</p></div><div className="section-heading"><div><h2>BTC / USD</h2><p className="muted">The sole V2 allowlisted market</p></div><WriteButton action="refresh" functionName="refresh_market" args={['BTC/USD']}>Request verified snapshot</WriteButton></div><div className="two-col"><MarketPanel detailed /><ApiPreview /></div><section className="panel policy-table"><div className="eyebrow-row"><span className="eyebrow">POLICY {POLICY.version}</span><span>Fixed and reviewable</span></div><div className="table-row"><span>Independent venues</span><b>{POLICY.sources.join(' · ')}</b></div><div className="table-row"><span>Refresh minimum</span><b>{POLICY.refreshRequiredSources} of 3</b></div><div className="table-row"><span>Covenant evaluation</span><b>{POLICY.evaluationRequiredSources} of 3 · HIGH confidence</b></div><div className="table-row"><span>Maximum source spread</span><b>{POLICY.maxSpreadBps} bps</b></div><div className="table-row"><span>Validator median tolerance</span><b>{POLICY.validatorToleranceBps} bps</b></div><div className="table-row"><span>Maximum timestamp age</span><b>{POLICY.maxAgeSeconds} seconds</b></div></section></div>
}
