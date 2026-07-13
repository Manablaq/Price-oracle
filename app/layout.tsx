import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'PriceGuard — Market Covenants', template: '%s · PriceGuard' },
  description: 'Non-custodial GenLayer market covenants and evidence attestations.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>
}
