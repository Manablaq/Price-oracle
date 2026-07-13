'use client'

import { AppShell } from './AppShell'
import { ProtocolProvider } from './ProtocolProvider'
import { TransactionManager } from './TransactionManager'

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProtocolProvider><TransactionManager><AppShell>{children}</AppShell></TransactionManager></ProtocolProvider>
}
