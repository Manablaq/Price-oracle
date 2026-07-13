'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { actionAllowed, attestationRoute, formatFixed } from '@/lib/priceguard-core.mjs'
import {
  isAttestationPage,
  isCovenantId,
  isCovenantResult,
  parseContractJson,
  type AttestationPage,
  type Covenant,
} from '@/lib/types'
import { useTransactions } from './TransactionManager'
import { WriteButton } from './WriteButton'

const formatEpoch = (value: string) => value === '0' ? 'Not set' : new Date(Number(value) * 1000).toLocaleString()

export function CovenantDetailView({ id }: { id: string }) {
  const { wallet } = useTransactions()
  const [covenant, setCovenant] = useState<Covenant | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [history, setHistory] = useState<AttestationPage>({ items: [], offset: 0, limit: 32, total: 0, retained: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  const load = useCallback(async () => {
    if (!PRICEGUARD_V2_ADDRESS) return
    if (!isCovenantId(id)) { setNotFound(true); setLoading(false); return }
    setLoading(true)
    setError('')
    setNotFound(false)
    try {
      const { createClient } = await import('genlayer-js')
      const { testnetBradbury } = await import('genlayer-js/chains')
      const client = createClient({ chain: testnetBradbury })
      const covenantRaw = await client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_covenant', args: [id] })
      const result = parseContractJson(covenantRaw)
      if (!isCovenantResult(result)) throw new Error('The contract returned malformed covenant data.')
      if (!result.found) { setNotFound(true); setCovenant(null); return }
      setCovenant(result)
      const historyRaw = await client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_covenant_evaluations', args: [id, 0, 32] })
      const parsedHistory = parseContractJson(historyRaw)
      if (!isAttestationPage(parsedHistory)) throw new Error('The contract returned malformed evaluation history.')
      setHistory(parsedHistory)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Covenant state is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const permitted = useMemo(() => {
    if (!covenant) return [] as Array<'accept' | 'cancel' | 'evaluate' | 'expire' | 'acknowledge'>
    return (['accept', 'cancel', 'evaluate', 'expire', 'acknowledge'] as const).filter(action => actionAllowed(action, covenant, wallet, now, true, true))
  }, [covenant, now, wallet])

  if (!PRICEGUARD_V2_ADDRESS) return <div className="panel empty">V2 is undeployed.</div>
  if (loading) return <div className="panel skeleton">Loading covenant…</div>
  if (error) return <div className="panel danger-panel"><p>{error}</p><button className="button secondary" onClick={() => void load()}>Retry</button></div>
  if (notFound || !covenant) return <div className="panel empty"><h1>Covenant not found</h1><p>No V2 covenant exists at <code>{id}</code>.</p></div>

  return <div className="stack">
    <section className="panel">
      <span className="eyebrow">{covenant.status}</span>
      <h1>{covenant.covenant_id}</h1>
      <p>{covenant.mode} · {covenant.condition_type} · {formatFixed(covenant.threshold_low, covenant.decimals)}{covenant.condition_type === 'IN_RANGE' ? `–${formatFixed(covenant.threshold_high, covenant.decimals)}` : ''}</p>
      <div className="table-row"><span>Creator</span><b className="mono-wrap">{covenant.creator}</b></div>
      <div className="table-row"><span>Counterparty</span><b className="mono-wrap">{covenant.mode === 'PERSONAL' ? 'Not applicable' : covenant.counterparty}</b></div>
      <div className="table-row"><span>Valid from</span><b>{formatEpoch(covenant.valid_from)}</b></div>
      <div className="table-row"><span>Expiry</span><b>{formatEpoch(covenant.expiry)}</b></div>
      <div className="table-row"><span>Maximum spread</span><b>{covenant.maximum_spread_bps} bps</b></div>
      {covenant.memo && <p>{covenant.memo}</p>}
    </section>

    <section className="panel">
      <div className="eyebrow-row"><h2>Actions</h2><span>Contract state and time window apply</span></div>
      <div className="toolbar">
        {permitted.includes('accept') && <WriteButton action="accept" functionName="accept_covenant" args={[id]} covenantId={id}>Accept covenant</WriteButton>}
        {permitted.includes('cancel') && <WriteButton action="cancel" functionName="cancel_unaccepted_covenant" args={[id]} covenantId={id}>Cancel unaccepted</WriteButton>}
        {permitted.includes('evaluate') && <WriteButton action="evaluate" functionName="evaluate_covenant" args={[id]} covenantId={id}>Evaluate condition</WriteButton>}
        {permitted.includes('expire') && <WriteButton action="expire" functionName="expire_covenant" args={[id]} covenantId={id}>Mark expired</WriteButton>}
        {permitted.includes('acknowledge') && <WriteButton action="acknowledge" functionName="acknowledge_outcome" args={[id]} covenantId={id}>Acknowledge outcome</WriteButton>}
        {permitted.length === 0 && <p className="muted">No action is available to this wallet at the current state and time.</p>}
      </div>
    </section>

    <section className="panel">
      <div className="eyebrow-row"><h2>Evaluation history</h2><span>{history.total} total · {history.retained} retained</span></div>
      {history.items.length === 0 && <p className="muted">No evaluations have been recorded.</p>}
      {history.items.map(attestation => <Link className="list-row" href={attestationRoute(attestation.attestation_id)} key={attestation.attestation_id}>
        <span>{attestation.outcome} · {formatFixed(attestation.evaluated_price, attestation.decimals, { prefix: '$', trim: false })}</span>
        <span className="mono-wrap">{attestation.attestation_id}</span>
      </Link>)}
    </section>
  </div>
}
