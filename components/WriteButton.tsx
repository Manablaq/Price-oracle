'use client'

import { CHAIN_ID, PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import {
  isSubmissionStageError,
  normalizeUnknownError,
  SUBMISSION_STAGE_LABELS,
  submissionErrorTitle,
  type NormalizedUnknownError,
  type SubmissionStage,
} from '@/lib/submission-errors'
import { useRef, useState } from 'react'
import { useTransactions } from './TransactionManager'

type SubmissionErrorView = NormalizedUnknownError & { stage: SubmissionStage; title: string }

export function WriteButton({ action, functionName, args, covenantId, children, disabled = false }: {
  action: 'refresh' | 'create' | 'accept' | 'cancel' | 'evaluate' | 'expire' | 'acknowledge'
  functionName: string
  args: Array<string | number | bigint | boolean>
  covenantId?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const { wallet, chainId, providerAvailable, connect, switchNetwork, submit, isPending } = useTransactions()
  const [error, setError] = useState<SubmissionErrorView | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submissionLock = useRef(false)
  const pending = isPending(action, covenantId)
  const wrongNetwork = Boolean(wallet) && chainId !== CHAIN_ID

  const click = async () => {
    if (submissionLock.current) return
    submissionLock.current = true
    setError(null)
    setSubmitting(true)
    try {
      if (!providerAvailable) throw new Error('Install or enable an injected wallet first.')
      if (!wallet) { await connect(); return }
      if (wrongNetwork) { await switchNetwork(); return }
      await submit({ action, functionName, args, covenantId })
    } catch (caught) {
      if (isSubmissionStageError(caught)) {
        console.error('[PriceGuard submission]', {
          stage: caught.stage,
          message: caught.safe.message,
          ...(caught.safe.code ? { code: caught.safe.code } : {}),
          ...(caught.safe.technicalDetails ? { technicalDetails: caught.safe.technicalDetails } : {}),
        })
        setError({ ...caught.safe, stage: caught.stage, title: submissionErrorTitle(caught.stage) })
      } else {
        const safe = normalizeUnknownError(caught)
        setError({ ...safe, stage: 'PREPARATION', title: 'Submission preparation failed' })
      }
    } finally {
      submissionLock.current = false
      setSubmitting(false)
    }
  }

  const label = submitting
    ? 'Preparing transaction…'
    : pending
      ? 'Transaction pending…'
    : !wallet
      ? 'Connect wallet'
      : wrongNetwork
        ? 'Switch to Bradbury'
        : children

  return <div className="write-control">
    <button
      type="button"
      className="button primary"
      disabled={disabled || submitting || pending || !PRICEGUARD_V2_ADDRESS || !providerAvailable}
      onClick={() => void click()}
    >{label}</button>
    {wrongNetwork && <small className="form-error">Writes require Bradbury chain {CHAIN_ID}.</small>}
    {error && <div className="submission-error" role="alert">
      <strong>{error.title}</strong>
      <span>Stage: <code>{error.stage}</code> — {SUBMISSION_STAGE_LABELS[error.stage]}</span>
      <p>{error.message}</p>
      {error.code && <span>Provider/RPC error code: <code>{error.code}</code></span>}
      <p>No transaction hash was returned, so nothing was added to Activity.</p>
      {error.technicalDetails && <details>
        <summary>Technical details</summary>
        <p>{error.technicalDetails}</p>
      </details>}
    </div>}
  </div>
}
