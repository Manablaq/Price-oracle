'use client'

import { EXPLORER_URL } from '@/lib/config'
import { useTransactions } from '@/components/TransactionManager'
import { StatusBadge } from '@/components/StatusBadge'

export default function ActivityPage() {
  const { activities, wallet } = useTransactions()
  return <div className="page-width page-top">
    <div className="page-title"><span className="eyebrow">PERSISTENT TRANSACTION ACTIVITY</span><h1>Consensus is a lifecycle</h1><p className="lead small">A transaction is successful only after GenLayer reports FINALIZED with FINISHED_WITH_RETURN. ACCEPTED remains inside the finality window. Supplementary state reads are displayed separately and never override protocol finality.</p></div>
    <div className="activity-list">
      {activities.map(item => <article className="panel activity-row" key={item.hash}><div>
        <span className="eyebrow">{item.action} · {item.functionName}</span>
        <a href={`${EXPLORER_URL}/transactions/${item.hash}`} target="_blank" rel="noreferrer">{item.hash}</a>
        <small>{new Date(item.updatedAt).toLocaleString()} · {item.error || item.stateCheckMessage || 'Waiting for network status'}</small>
        {item.stateCheck && item.stateCheck !== 'NOT_RUN' && <small>Supplementary state read: {item.stateCheck.replaceAll('_', ' ')}</small>}
      </div><StatusBadge state={item.phase} /></article>)}
      {!wallet && <div className="empty-state panel"><h2>Connect a wallet</h2><p>Activity is isolated by chain, contract, and connected account.</p></div>}
      {wallet && !activities.length && <div className="empty-state panel"><h2>No transaction records</h2><p>Submitted writes will remain here through finalization, execution failure, cancellation, or undetermined consensus.</p></div>}
    </div>
  </div>
}
