'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CHAIN_ID, PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { cursorsChanged, formatFixed, mergeCovenantPages, nextCovenantCursors } from '@/lib/priceguard-core.mjs'
import { isCovenantPage, parseContractJson, type CovenantPage, type CovenantStatus } from '@/lib/types'
import { useTransactions } from './TransactionManager'

type Cursor = { creatorOffset: number; counterpartyOffset: number }
type Role = 'CREATOR' | 'COUNTERPARTY' | 'CREATOR_AND_COUNTERPARTY'
type Row = CovenantPage['items'][number] & { role: Role }

const emptyPage = (offset: number): CovenantPage => ({ items: [], offset, limit: 50, total: 0 })

export function CovenantList() {
  const { wallet, chainId, connect, switchNetwork } = useTransactions()
  const [cursor, setCursor] = useState<Cursor>({ creatorOffset: 0, counterpartyOffset: 0 })
  const [history, setHistory] = useState<Cursor[]>([])
  const [creatorPage, setCreatorPage] = useState<CovenantPage>(emptyPage(0))
  const [counterpartyPage, setCounterpartyPage] = useState<CovenantPage>(emptyPage(0))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'ALL' | CovenantStatus>('ALL')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCursor({ creatorOffset: 0, counterpartyOffset: 0 })
      setHistory([])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [wallet])

  const load = useCallback(async () => {
    if (!wallet || !PRICEGUARD_V2_ADDRESS) return
    setLoading(true)
    setError('')
    try {
      const { createClient } = await import('genlayer-js')
      const { testnetBradbury } = await import('genlayer-js/chains')
      const client = createClient({ chain: testnetBradbury })
      const [creatorRaw, counterpartyRaw] = await Promise.all([
        client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_covenants_by_creator', args: [wallet, cursor.creatorOffset, 50] }),
        client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_covenants_by_counterparty', args: [wallet, cursor.counterpartyOffset, 50] }),
      ])
      const creator = parseContractJson(creatorRaw)
      const counterparty = parseContractJson(counterpartyRaw)
      if (!isCovenantPage(creator) || !isCovenantPage(counterparty)) throw new Error('The contract returned malformed covenant indexes.')
      setCreatorPage(creator)
      setCounterpartyPage(counterparty)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Covenant indexes are unavailable.')
    } finally {
      setLoading(false)
    }
  }, [cursor, wallet])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const rows = useMemo(() => mergeCovenantPages(creatorPage, counterpartyPage) as Row[], [creatorPage, counterpartyPage])
  const visible = useMemo(() => rows.filter(item => filter === 'ALL' || item.status === filter), [rows, filter])
  const nextCursor = nextCovenantCursors(cursor, creatorPage, counterpartyPage) as Cursor
  const canNext = cursorsChanged(cursor, nextCursor)

  if (!PRICEGUARD_V2_ADDRESS) return <div className="panel empty">V2 is undeployed. Configure a new V2 address to read covenants.</div>
  if (!wallet) return <div className="panel empty"><p>Connect an injected wallet to view your creator and counterparty indexes.</p><button type="button" className="button primary" onClick={() => void connect()}>Connect wallet</button></div>

  return <section className="stack">
    {chainId !== CHAIN_ID && <div className="panel network-warning" role="status"><div><strong>Bradbury network required</strong><p>Switch this wallet to chain {CHAIN_ID} before creating or updating covenants.</p></div><button type="button" className="button secondary" onClick={() => void switchNetwork()}>Switch to Bradbury</button></div>}
    <div className="toolbar">
      <label className="visually-group">Status
        <select value={filter} onChange={event => setFilter(event.target.value as 'ALL' | CovenantStatus)}>
          <option>ALL</option><option>PENDING_ACCEPTANCE</option><option>ACTIVE</option><option>TRIGGERED</option><option>CLOSED</option><option>EXPIRED</option><option>CANCELED</option>
        </select>
      </label>
      <button type="button" className="button secondary" onClick={() => void load()} disabled={loading}>Refresh</button>
    </div>

    {loading && <div className="panel skeleton">Loading covenant indexes…</div>}
    {error && <div className="panel danger-panel"><p>{error}</p><button className="button secondary" onClick={() => void load()}>Retry</button></div>}
    {!loading && !error && visible.length === 0 && <div className="panel empty"><p>No covenants match this page and filter.</p><Link className="button primary" href="/covenants/new">Create your first covenant</Link></div>}

    {!loading && !error && visible.map(item => <Link className="panel list-row" href={`/covenants/${item.covenant_id}`} key={item.covenant_id}>
      <div><strong>{item.covenant_id}</strong><p className="muted">{item.role.replaceAll('_', ' ')} · {item.mode} · {item.condition_type} {formatFixed(item.threshold_low, item.decimals)}</p></div>
      <span className="status-badge">{item.status}</span>
    </Link>)}

    <div className="toolbar">
      <button className="button secondary" disabled={history.length === 0 || loading} onClick={() => {
        const previous = history.at(-1)
        if (!previous) return
        setHistory(current => current.slice(0, -1))
        setCursor(previous)
      }}>Previous</button>
      <span className="muted">Creator {creatorPage.items.length ? creatorPage.offset + 1 : 0}–{creatorPage.offset + creatorPage.items.length} of {creatorPage.total} · Counterparty {counterpartyPage.items.length ? counterpartyPage.offset + 1 : 0}–{counterpartyPage.offset + counterpartyPage.items.length} of {counterpartyPage.total}</span>
      <button className="button secondary" disabled={!canNext || loading} onClick={() => {
        setHistory(current => [...current, cursor])
        setCursor(nextCursor)
      }}>Next</button>
    </div>
  </section>
}
