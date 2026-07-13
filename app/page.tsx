'use client'

import Link from 'next/link'
import { POLICY } from '@/lib/config'
import { MarketPanel, ApiPreview } from '@/components/MarketPanel'
import { WriteButton } from '@/components/WriteButton'

export default function HomePage() {
  return <>
    <section className="hero page-width">
      <div className="hero-copy reveal"><span className="kicker"><i /> MARKET COVENANTS &amp; RISK ATTESTATIONS</span><h1>Verify conditions.<br /><em>Coordinate with evidence.</em></h1><p className="lead">PriceGuard Covenant independently verifies BTC/USD market evidence and records attestations. It is non-custodial: no funds are held, transferred, or settled.</p><div className="hero-actions"><Link href="/covenants/new" className="button primary">Create a covenant</Link><Link href="/about/verification" className="button secondary">Inspect verification</Link></div></div>
      <div className="hero-visual reveal delay"><div className="radar"><span className="orbit one"><i /></span><span className="orbit two"><i /></span><div className="radar-core"><small>EVALUATION</small><b>3 / 3</b><span>sources required</span></div></div><div className="trust-strip"><span>Leader fetch</span><i>→</i><span>Validator re-fetch</span><i>→</i><span>State transition</span></div></div>
    </section>
    <section className="page-width section-block"><div className="section-heading"><div><span className="eyebrow">MARKET CONTROL PLANE</span><h2>Market evidence, not a decorative feed</h2></div><WriteButton action="refresh" functionName="refresh_market" args={['BTC/USD']}>Refresh market on-chain</WriteButton></div><div className="two-col"><MarketPanel /><ApiPreview /></div></section>
    <section className="section-tint"><div className="page-width section-block"><div className="section-heading"><div><span className="eyebrow">WHY GENLAYER</span><h2>Validators independently observe the outside world</h2></div></div><div className="process-grid">{[
      ['01','Leader observes','Fetches three fixed exchange endpoints and normalizes decimal strings into integer cents.'],
      ['02','Validators re-observe','Each validator fetches the same venues, recomputes median and dispersion, and compares—not merely parses—the leader result.'],
      ['03','Attestation issued','Only a fresh, three-source, high-confidence snapshot can trigger an immutable covenant attestation.'],
    ].map(([n,t,d]) => <article className="panel process" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
    <section className="page-width section-block"><div className="section-heading"><div><span className="eyebrow">EXPLICIT TRUST BOUNDARY</span><h2>Small allowlist. Visible policy.</h2></div></div><div className="policy-grid"><div className="panel"><b>{POLICY.refreshRequiredSources} of 3</b><span>minimum refresh evidence</span></div><div className="panel"><b>{POLICY.maxAgeSeconds}s</b><span>maximum observation age</span></div><div className="panel"><b>{POLICY.maxSpreadBps} bps</b><span>source spread breaker</span></div><div className="panel"><b>{POLICY.validatorToleranceBps} bps</b><span>leader-validator tolerance</span></div></div><p className="limitations">Exchange APIs can fail, correlate, rate-limit, or publish abnormal prints. PriceGuard reduces single-response trust; it does not eliminate venue, validator, network, or smart-contract risk.</p></section>
  </>
}
