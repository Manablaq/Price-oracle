import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'PriceOracle — GenLayer On-Chain Price Feed', description: 'Crypto and forex prices stored on GenLayer Bradbury after validator format checks.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
