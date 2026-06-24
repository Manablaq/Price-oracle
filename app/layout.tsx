import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'PriceOracle — GenLayer On-Chain Price Feed', description: 'Live crypto and forex prices verified by 5 AI validators on GenLayer.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
