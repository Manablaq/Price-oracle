import { NextResponse } from 'next/server'
import { CONTRACT_ADDRESS } from '@/lib/config'

export async function GET() {
  try {
    const { createClient } = await import('genlayer-js')
    const { testnetBradbury } = await import('genlayer-js/chains')
    const client = createClient({ chain: testnetBradbury, account: undefined })

    const [allPrices, stats] = await Promise.all([
      (client as any).readContract({ address: CONTRACT_ADDRESS, functionName: 'get_all_prices', args: [], stateStatus: 'accepted' }),
      (client as any).readContract({ address: CONTRACT_ADDRESS, functionName: 'get_stats', args: [], stateStatus: 'accepted' }),
    ])

    const parsePrices = (r: unknown) => {
      if (typeof r === 'string') { try { return JSON.parse(r) } catch {} }
      return r
    }

    return NextResponse.json({ prices: parsePrices(allPrices), stats: parsePrices(stats) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, prices: [], stats: {} }, { status: 500 })
  }
}
