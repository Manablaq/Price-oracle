'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { attestationHasNext, attestationRoute, formatFixed } from '@/lib/priceguard-core.mjs'
import { isAttestationPage, parseContractJson, type AttestationPage } from '@/lib/types'

export function AttestationList() {
  const [page, setPage] = useState<AttestationPage>({ items: [], offset: 0, limit: 50, total: 0, retained: 0 })
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!PRICEGUARD_V2_ADDRESS) return
    setLoading(true)
    setError('')
    try {
      const { createClient } = await import('genlayer-js')
      const { testnetBradbury } = await import('genlayer-js/chains')
      const client = createClient({ chain: testnetBradbury })
      const raw = await client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_attestations', args: [offset, 50] })
      const parsed = parseContractJson(raw)
      if (!isAttestationPage(parsed)) throw new Error('The contract returned a malformed attestation page.')
      setPage(parsed)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Attestations are unavailable.')
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  if (!PRICEGUARD_V2_ADDRESS) return <div className="panel empty">V2 is undeployed; attestations are unavailable.</div>

  return <section className="stack">
    <div className="eyebrow-row panel"><span>{page.total} exact records created</span><span>{page.retained} discoverable in the global retained index</span></div>
    {loading && <div className="panel skeleton">Loading attestations…</div>}
    {error && <div className="panel danger-panel"><p>{error}</p><button className="button secondary" onClick={() => void load()}>Retry</button></div>}
    {!loading && !error && page.items.length === 0 && <div className="panel empty">No attestations are retained at this offset.</div>}
    {!loading && !error && page.items.map(attestation => <Link className="panel list-row" href={attestationRoute(attestation.attestation_id)} key={attestation.attestation_id}>
      <div><strong>{attestation.attestation_id}</strong><p className="muted">{attestation.covenant_id} · {attestation.outcome} · {formatFixed(attestation.evaluated_price, attestation.decimals, { prefix: '$', trim: false })}</p></div>
      <span>{attestation.confidence}</span>
    </Link>)}
    <div className="toolbar">
      <button className="button secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
      <span className="muted">Showing {page.items.length ? page.offset + 1 : 0}–{page.offset + page.items.length} of {page.retained} retained</span>
      <button className="button secondary" disabled={!attestationHasNext(page) || loading} onClick={() => setOffset(offset + 50)}>Next</button>
    </div>
  </section>
}
