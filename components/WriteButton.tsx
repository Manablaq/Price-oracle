'use client'

import { CHAIN_ID, PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { useState } from 'react'
import { useTransactions } from './TransactionManager'

export function WriteButton({ action, functionName, args, covenantId, children, disabled = false }: {
  action: 'refresh' | 'create' | 'accept' | 'cancel' | 'evaluate' | 'expire' | 'acknowledge'
  functionName: string
  args: Array<string | number | bigint | boolean>
  covenantId?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const { wallet, chainId, providerAvailable, connect, switchNetwork, submit, isPending } = useTransactions()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pending = isPending(action, covenantId)
  const wrongNetwork = Boolean(wallet) && chainId !== CHAIN_ID

  const click = async () => {
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      if (!providerAvailable) throw new Error('Install or enable an injected wallet first.')
      if (!wallet) { await connect(); return }
      if (wrongNetwork) { await switchNetwork(); return }
      await submit({ action, functionName, args, covenantId })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Submission failed')
    } finally {
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
    {error && <small className="form-error" role="alert">{error}</small>}
  </div>
}
