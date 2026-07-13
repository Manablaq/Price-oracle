'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { formatFixed } from '@/lib/priceguard-core.mjs'
import { isAttestationId, isAttestationResult, parseContractJson, type Attestation } from '@/lib/types'

export function AttestationDetailView({ id }: { id: string }) {
  const [attestation, setAttestation] = useState<Attestation | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const load = useCallback(async () => {
    if (!PRICEGUARD_V2_ADDRESS) return
    if (!isAttestationId(id)) { setNotFound(true); setLoading(false); return }
    setLoading(true)
    setError('')
    setNotFound(false)
    try {
      const { createClient } = await import('genlayer-js')
      const { testnetBradbury } = await import('genlayer-js/chains')
      const client = createClient({ chain: testnetBradbury })
      const raw = await client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_attestation', args: [id] })
      const result = parseContractJson(raw)
      if (!isAttestationResult(result)) throw new Error('The contract returned malformed attestation data.')
      if (!result.found) { setNotFound(true); setAttestation(null); return }
      setAttestation(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Attestation state is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  if (!PRICEGUARD_V2_ADDRESS) return <div className="panel empty">V2 is undeployed.</div>
  if (loading) return <div className="panel skeleton">Loading attestation…</div>
  if (error) return <div className="panel danger-panel"><p>{error}</p><button className="button secondary" onClick={() => void load()}>Retry</button></div>
  if (notFound || !attestation) return <div className="panel empty"><h1>Attestation not found</h1><p>No V2 certificate exists at <code>{id}</code>.</p></div>

  const canonical = JSON.stringify(attestation, Object.keys(attestation).sort(), 2)
  return <div className="stack">
    <section className="panel">
      <span className="eyebrow">{attestation.outcome}</span>
      <h1>{attestation.attestation_id}</h1>
      <p>Covenant <Link href={`/covenants/${attestation.covenant_id}`}>{attestation.covenant_id}</Link> · sequence {attestation.evaluation_sequence}</p>
      <p>Observed median: {formatFixed(attestation.evaluated_price, attestation.decimals, { prefix: '$', trim: false })} · confidence {attestation.confidence} · spread {attestation.spread_bps} bps</p>
      <p>Sources: {attestation.source_identities.join(', ')}</p>
      <p className="muted">This certificate is market evidence only. It does not represent payment, custody, legal enforcement, or automatic external execution.</p>
      <button className="button secondary" onClick={() => void navigator.clipboard.writeText(canonical).then(() => setCopyStatus('Canonical JSON copied.')).catch(() => setCopyStatus('Copy failed.'))}>Copy canonical JSON</button>
      <span className="muted" role="status" aria-live="polite">{copyStatus}</span>
    </section>
    <pre className="panel code-block">{canonical}</pre>
  </div>
}
