'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CHAIN_ID, PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { stateTone } from '@/lib/priceguard-core.mjs'
import { useTransactions } from './TransactionManager'

const nav = [['/', 'Overview'], ['/markets', 'Markets'], ['/covenants', 'Covenants'], ['/attestations', 'Attestations'], ['/activity', 'Activity'], ['/integrations', 'Integrations'], ['/about/verification', 'Verification']]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { wallet, chainId, providerAvailable, connect, switchNetwork, connecting, activities } = useTransactions()
  const [progress, setProgress] = useState(0)
  const pending = activities.filter(item => !item.terminal).length
  const wrongNetwork = Boolean(wallet) && chainId !== CHAIN_ID

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? window.scrollY / height : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return <>
    <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} />
    <header className="topbar">
      <Link href="/" className="brand" aria-label="PriceGuard home"><span className="brand-mark">PG</span><span>PriceGuard</span></Link>
      <nav className="nav-links" aria-label="Primary navigation">
        {nav.map(([href, label]) => <Link key={href} href={href} className={pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'active' : ''}>{label}</Link>)}
      </nav>
      <div className="wallet-area">
        {pending > 0 && <Link href="/activity" className={`status ${stateTone('PROCESSING')}`}>{pending} pending</Link>}
        <button className="button secondary compact" onClick={() => void (wrongNetwork ? switchNetwork() : connect())} disabled={connecting || !providerAvailable}>
          {!providerAvailable ? 'Wallet unavailable' : wrongNetwork ? 'Switch to Bradbury' : wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
      </div>
    </header>
    {!PRICEGUARD_V2_ADDRESS && <div className="undeployed-banner"><span>V2 UNDEPLOYED</span> Contract writes are disabled until a new PriceGuard address is configured. The rejected V1 address is never used for V2 actions.</div>}
    {wrongNetwork && <div className="undeployed-banner"><span>WRONG NETWORK</span> Switch the injected wallet to Bradbury chain {CHAIN_ID} before writing.</div>}
    <main>{children}</main>
    <footer><div><span className="brand-mark small">PG</span> PriceGuard Covenant</div><p>Non-custodial market evidence on GenLayer Bradbury. {PRICEGUARD_V2_ADDRESS ? 'V2 configured.' : 'V2 is undeployed.'}</p></footer>
  </>
}
