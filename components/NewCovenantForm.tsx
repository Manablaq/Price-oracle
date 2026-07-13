'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAIN_ID } from '@/lib/config'
import { covenantId, parseCreateTerms, ZERO_ADDRESS } from '@/lib/priceguard-core.mjs'
import type { ConditionType, CovenantMode } from '@/lib/types'
import { useTransactions } from './TransactionManager'
import { WriteButton } from './WriteButton'

const toEpoch = (value: string) => {
  if (!value) return 0
  const milliseconds = new Date(value).getTime()
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : Number.NaN
}

export function NewCovenantForm() {
  const { wallet, chainId, switchNetwork } = useTransactions()
  const [request, setRequest] = useState('request_1')
  const [mode, setMode] = useState<CovenantMode>('PERSONAL')
  const [counterparty, setCounterparty] = useState('')
  const [condition, setCondition] = useState<ConditionType>('BELOW')
  const [low, setLow] = useState('70000')
  const [high, setHigh] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [expiry, setExpiry] = useState('')
  const [spread, setSpread] = useState('50')
  const [memo, setMemo] = useState('')
  const [reference, setReference] = useState('')
  const [revision, setRevision] = useState('')
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [preview, setPreview] = useState<{ key: string; id: string; status: 'IDLE' | 'PENDING' | 'READY' | 'FAILED' }>({ key: '', id: '', status: 'IDLE' })
  const generation = useRef(0)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  const previewKey = `${wallet.toLowerCase()}:${request}`
  useEffect(() => {
    const currentGeneration = ++generation.current
    const timer = window.setTimeout(() => {
      setPreview({ key: previewKey, id: '', status: wallet && /^[A-Za-z0-9_-]{1,48}$/.test(request) ? 'PENDING' : 'IDLE' })
      if (!wallet || !/^[A-Za-z0-9_-]{1,48}$/.test(request)) return
      void covenantId(wallet, request).then(id => {
        if (generation.current === currentGeneration) setPreview({ key: previewKey, id, status: 'READY' })
      }).catch(() => {
        if (generation.current === currentGeneration) setPreview({ key: previewKey, id: '', status: 'FAILED' })
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [wallet, request, previewKey])

  const validFromEpoch = toEpoch(validFrom)
  const expiryEpoch = toEpoch(expiry)
  const spreadNumber = spread === '' ? Number.NaN : Number(spread)
  const args = useMemo(() => [
    request,
    mode,
    mode === 'PERSONAL' ? ZERO_ADDRESS : counterparty,
    'BTC/USD',
    condition,
    low,
    condition === 'IN_RANGE' ? high : '',
    validFromEpoch,
    expiryEpoch,
    'HIGH',
    spreadNumber,
    memo,
    reference,
    revision,
  ] as Array<string | number>, [request, mode, counterparty, condition, low, high, validFromEpoch, expiryEpoch, spreadNumber, memo, reference, revision])

  let validationError = ''
  try {
    if (!/^\d+$/.test(spread)) throw new Error('Maximum spread must be a whole number of basis points.')
    if (!wallet) throw new Error('Connect an injected wallet to publish.')
    parseCreateTerms(args, wallet, now)
    if (preview.status !== 'READY' || preview.key !== previewKey || !preview.id) throw new Error('Wait for the current deterministic covenant ID.')
  } catch (error) {
    validationError = error instanceof Error ? error.message : 'The form is invalid.'
  }

  return <div className="form-stack">
    {wallet && chainId !== CHAIN_ID && <div className="panel network-warning" role="status"><div><strong>Bradbury network required</strong><p>Switch this wallet to chain {CHAIN_ID} before publishing a covenant.</p></div><button type="button" className="button secondary" onClick={() => void switchNetwork()}>Switch to Bradbury</button></div>}
    <div className="panel form-grid">
    <label>Client request ID<input value={request} maxLength={48} onChange={event => setRequest(event.target.value)} /></label>
    <p className="muted">Covenant ID: <code>{preview.status === 'READY' && preview.key === previewKey ? preview.id : preview.status === 'FAILED' ? 'unavailable' : 'computing…'}</code></p>

    <label>Mode<select value={mode} onChange={event => setMode(event.target.value as CovenantMode)}><option>PERSONAL</option><option>BILATERAL</option></select></label>
    {mode === 'BILATERAL' && <label>Counterparty<input value={counterparty} placeholder="0x…" onChange={event => setCounterparty(event.target.value)} /></label>}

    <label>Condition<select value={condition} onChange={event => setCondition(event.target.value as ConditionType)}>{['ABOVE', 'BELOW', 'AT_OR_ABOVE', 'AT_OR_BELOW', 'IN_RANGE'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Lower threshold<input inputMode="decimal" value={low} onChange={event => setLow(event.target.value)} /></label>
    {condition === 'IN_RANGE' && <label>Upper threshold<input inputMode="decimal" value={high} onChange={event => setHigh(event.target.value)} /></label>}

    <label>Valid from (optional)<input type="datetime-local" value={validFrom} onChange={event => setValidFrom(event.target.value)} /></label>
    <label>Expiry<input type="datetime-local" value={expiry} onChange={event => setExpiry(event.target.value)} /></label>
    <label>Maximum spread (bps)<input inputMode="numeric" value={spread} onChange={event => setSpread(event.target.value)} /></label>
    <label>Minimum confidence<input value="HIGH" readOnly /></label>
    <label>Memo<textarea value={memo} maxLength={280} onChange={event => setMemo(event.target.value)} /></label>
    <label>External reference hash<input value={reference} placeholder="0x… (optional)" onChange={event => setReference(event.target.value)} /></label>
    <label>Revision covenant ID<input value={revision} placeholder="cov_… (optional)" onChange={event => setRevision(event.target.value)} /></label>

    <p className="muted">Non-custodial protocol: no GEN amount, claim, refund, or transfer is part of this covenant.</p>
    {validationError && <p className="form-error" role="status">{validationError}</p>}
    <WriteButton action="create" functionName="create_covenant" args={args} disabled={Boolean(validationError)}>Publish covenant</WriteButton>
    </div>
  </div>
}
