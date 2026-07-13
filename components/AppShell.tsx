'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAIN_ID, PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { stateTone } from '@/lib/priceguard-core.mjs'
import { useTransactions, type InjectedProviderInfo } from './TransactionManager'

const nav = [['/', 'Overview'], ['/markets', 'Markets'], ['/covenants', 'Covenants'], ['/attestations', 'Attestations'], ['/activity', 'Activity'], ['/integrations', 'Integrations'], ['/about/verification', 'Verification']]

function WalletIcon({ provider }: { provider?: InjectedProviderInfo }) {
  return <span className="wallet-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none"><path d="M4.5 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12"/><path d="M17 12h3.5v4H17a2 2 0 1 1 0-4Z"/></svg>
    {provider?.icon && <Image key={provider.icon} src={provider.icon} width={36} height={36} unoptimized alt="" onError={event => { event.currentTarget.hidden = true }} />}
  </span>
}

function ChevronIcon() {
  return <svg className="chevron-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>
}

function CopyIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5v-2a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2"/></svg>
}

function NetworkIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v4m0 6v4M4 6.5l3.5 2M12.5 11 16 13.5M16 6.5l-3.5 2M7.5 11 4 13.5"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="2.5" r="1.5"/><circle cx="3" cy="6" r="1.5"/><circle cx="17" cy="6" r="1.5"/><circle cx="3" cy="14" r="1.5"/><circle cx="17" cy="14" r="1.5"/><circle cx="10" cy="17.5" r="1.5"/></svg>
}

function DisconnectIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 4H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1H8m4-3 3-3-3-3m3 3H7"/></svg>
}

function normalizeWalletError(error: unknown, action: 'connect' | 'switch') {
  const code = typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : null
  const message = error instanceof Error ? error.message : ''
  if (code === 4001 || /reject|declin|denied/i.test(message)) return action === 'connect'
    ? 'Connection request was declined in your wallet.'
    : 'Network switch was declined in your wallet.'
  if (code === -32002 || /already pending|already open/i.test(message)) return 'A wallet request is already open. Complete it in your wallet and try again.'
  if (/no longer available/i.test(message)) return message
  if (/did not return an account/i.test(message)) return 'The wallet connected without returning an account. Unlock it and try again.'
  return action === 'connect'
    ? 'PriceGuard could not connect to that wallet. Check the wallet extension and try again.'
    : 'PriceGuard could not switch this wallet to GenLayer Bradbury. Try again from your wallet.'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { wallet, chainId, injectedProviders, selectedProviderId, connect, disconnect, selectProvider, switchNetwork, connecting, activities } = useTransactions()
  const [progress, setProgress] = useState(0)
  const [connectOpen, setConnectOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [connectingProviderId, setConnectingProviderId] = useState('')
  const [connectError, setConnectError] = useState('')
  const [accountError, setAccountError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const connectTriggerRef = useRef<HTMLButtonElement>(null)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const modalReturnFocusRef = useRef<HTMLElement | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const pending = activities.filter(item => !item.terminal).length
  const wrongNetwork = Boolean(wallet) && chainId !== CHAIN_ID
  const selectedProvider = injectedProviders.find(provider => provider.id === selectedProviderId)
  const shortAddress = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : ''
  const networkName = chainId === CHAIN_ID ? `GenLayer Bradbury · ${CHAIN_ID}` : chainId === null ? 'Network unavailable' : `Chain ${chainId}`

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? window.scrollY / height : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    const closeTimer = window.setTimeout(() => setAccountOpen(false), 0)
    return () => window.clearTimeout(closeTimer)
  }, [wallet])

  useEffect(() => {
    const closeTimer = window.setTimeout(() => {
      setAccountOpen(false)
      setConnectOpen(false)
    }, 0)
    return () => window.clearTimeout(closeTimer)
  }, [pathname])

  useEffect(() => {
    if (!connectOpen) return
    modalReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') ?? [])]
    const focusTimer = window.setTimeout(() => (focusable()[0] ?? dialogRef.current)?.focus(), 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setConnectOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (modalReturnFocusRef.current?.isConnected) modalReturnFocusRef.current.focus()
    }
  }, [connectOpen])

  const closeAccountMenu = useCallback((returnFocus = false) => {
    setAccountOpen(false)
    if (returnFocus) window.setTimeout(() => accountTriggerRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!accountOpen) return
    const focusTimer = window.setTimeout(() => accountMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 0)
    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node) && !accountTriggerRef.current?.contains(event.target as Node)) closeAccountMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeAccountMenu(true) }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen, closeAccountMenu])

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
  }, [])

  const openConnectDialog = () => {
    setConnectError('')
    setConnectOpen(true)
  }

  const connectProvider = async (providerId: string) => {
    if (connecting) return
    setConnectError('')
    setConnectingProviderId(providerId)
    try {
      selectProvider(providerId)
      await connect(providerId)
      setConnectOpen(false)
      window.setTimeout(() => accountTriggerRef.current?.focus(), 0)
    } catch (error) {
      setConnectError(normalizeWalletError(error, 'connect'))
    } finally {
      setConnectingProviderId('')
    }
  }

  const copyAddress = async () => {
    setAccountError('')
    setCopyStatus('')
    if (!navigator.clipboard?.writeText) {
      setAccountError('Copy is unavailable in this browser. Select the address above to copy it manually.')
      return
    }
    try {
      await navigator.clipboard.writeText(wallet)
      setCopyStatus('Copied')
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopyStatus(''), 1800)
    } catch {
      setAccountError('The address could not be copied. Select it above to copy it manually.')
    }
  }

  const switchToBradbury = async () => {
    setAccountError('')
    try {
      await switchNetwork()
    } catch (error) {
      setAccountError(normalizeWalletError(error, 'switch'))
    }
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
    if (!items.length) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
    items[index].focus()
  }

  return <>
    <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} />
    <header className="topbar">
      <Link href="/" className="brand" aria-label="PriceGuard home" onNavigate={() => setAccountOpen(false)}><span className="brand-mark">PG</span><span>PriceGuard</span></Link>
      <nav className="nav-links" aria-label="Primary navigation">
        {nav.map(([href, label]) => <Link key={href} href={href} onNavigate={() => setAccountOpen(false)} className={pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'active' : ''}>{label}</Link>)}
      </nav>
      <div className="wallet-area">
        {pending > 0 && <Link href="/activity" className={`status ${stateTone('PROCESSING')}`}>{pending} pending</Link>}
        {!wallet ? <button ref={connectTriggerRef} type="button" className="wallet-connect-trigger" onClick={openConnectDialog} aria-haspopup="dialog">
          <WalletIcon />
          <span>Connect wallet</span>
        </button> : <div className="account-control-wrap">
          <button
            ref={accountTriggerRef}
            type="button"
            className={`account-trigger${wrongNetwork ? ' wrong-network' : ''}`}
            onClick={() => { setAccountError(''); setAccountOpen(open => !open) }}
            aria-label={`${wrongNetwork ? 'Wrong network. ' : 'Connected wallet '}${wallet} using ${selectedProvider?.name ?? 'Injected wallet'}`}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-controls="wallet-account-menu"
          >
            <WalletIcon provider={selectedProvider} />
            <span className={`connection-dot ${wrongNetwork ? 'warning' : 'connected'}`} />
            <span className="account-trigger-label">{wrongNetwork ? 'Wrong network' : shortAddress}</span>
            <ChevronIcon />
          </button>
          {accountOpen && <div id="wallet-account-menu" ref={accountMenuRef} className="account-menu" role="menu" aria-label="Wallet account" onKeyDown={onMenuKeyDown}>
            <div className="account-menu-heading" role="none">
              <WalletIcon provider={selectedProvider} />
              <div><span>Connected with</span><strong>{selectedProvider?.name ?? 'Injected wallet'}</strong></div>
              <span className={`network-pill ${wrongNetwork ? 'warning' : 'connected'}`}>{wrongNetwork ? 'Action needed' : 'Connected'}</span>
            </div>
            <div className="account-identity" role="none">
              <span>Account</span>
              <code title={wallet}>{wallet}</code>
            </div>
            <div className="account-network" role="none">
              <span className={`connection-dot ${wrongNetwork ? 'warning' : 'connected'}`} />
              <div><span>Current network</span><strong>{networkName}</strong></div>
              <small>{wrongNetwork ? 'Bradbury required' : 'Bradbury ready'}</small>
            </div>
            <div className="account-actions" role="none">
              <button type="button" role="menuitem" onClick={() => void copyAddress()}><CopyIcon /><span>Copy address</span><small aria-live="polite">{copyStatus}</small></button>
              {wrongNetwork && <button type="button" role="menuitem" onClick={() => void switchToBradbury()} disabled={connecting}><NetworkIcon /><span>{connecting ? 'Switching network…' : 'Switch to Bradbury'}</span></button>}
              <button type="button" role="menuitem" className="disconnect-action" onClick={() => { closeAccountMenu(); disconnect() }}><DisconnectIcon /><span>Disconnect from PriceGuard</span></button>
            </div>
            {accountError && <p className="wallet-inline-error" role="alert">{accountError}</p>}
            <p className="disconnect-note" role="none">Disconnecting PriceGuard does not revoke this site&apos;s permission inside your wallet extension.</p>
          </div>}
        </div>}
      </div>
    </header>

    {connectOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConnectOpen(false) }}>
      <div ref={dialogRef} className="wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-wallet-title" aria-describedby="connect-wallet-description" tabIndex={-1}>
        <div className="dialog-brand"><span className="brand-mark small">PG</span><span>PriceGuard</span></div>
        <button type="button" className="dialog-close" onClick={() => setConnectOpen(false)} aria-label="Close connect wallet dialog"><CloseIcon /></button>
        <div className="dialog-heading">
          <span className="eyebrow">GENLAYER BRADBURY</span>
          <h2 id="connect-wallet-title">Connect wallet</h2>
          <p id="connect-wallet-description">Connect an injected wallet to use PriceGuard on GenLayer Bradbury.</p>
        </div>
        <div className="provider-list" aria-label="Detected wallet providers">
          {injectedProviders.map(provider => <button key={provider.id} type="button" className="provider-option" onClick={() => void connectProvider(provider.id)} disabled={connecting}>
            <WalletIcon provider={provider} />
            <span className="provider-copy"><strong>{provider.name}</strong>{provider.rdns && <small>{provider.rdns}</small>}</span>
            <span className="detected-status"><i />{connectingProviderId === provider.id ? 'Connecting…' : 'Detected'}</span>
            <ChevronIcon />
          </button>)}
          {!injectedProviders.length && <div className="provider-empty" role="status"><WalletIcon /><strong>No injected wallet detected</strong><p>Install or enable a browser wallet, then reopen this dialog.</p></div>}
        </div>
        {connectError && <p className="wallet-inline-error dialog-error" role="alert">{connectError}</p>}
        <p className="dialog-footnote">PriceGuard will request access only after you choose a detected wallet.</p>
      </div>
    </div>}

    {!PRICEGUARD_V2_ADDRESS && <div className="undeployed-banner"><span>V2 UNDEPLOYED</span> Contract writes are disabled until a new PriceGuard address is configured. The rejected V1 address is never used for V2 actions.</div>}
    {wrongNetwork && <div className="undeployed-banner"><span>WRONG NETWORK</span> Switch the injected wallet to Bradbury chain {CHAIN_ID} before writing.</div>}
    <main>{children}</main>
    <footer><div><span className="brand-mark small">PG</span> PriceGuard Covenant</div><p>Non-custodial market evidence on GenLayer Bradbury. {PRICEGUARD_V2_ADDRESS ? 'V2 configured.' : 'V2 is undeployed.'}</p></footer>
  </>
}
