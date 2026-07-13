import { NextResponse } from 'next/server'
import { PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import { isMarketResult, isProtocolStats, parseContractJson, type ApiObservation, type SourceIdentity } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function previewSource(source: SourceIdentity, url: string, parser: (data: unknown) => { price: string; observed_at: string }): Promise<ApiObservation> {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const parsed = parser(await response.json())
    return { source, ok: true, ...parsed }
  } catch (error) {
    return { source, ok: false, price: '', observed_at: '', error: error instanceof Error ? error.message : 'Unavailable' }
  }
}

export async function GET() {
  const observations = await Promise.all([
    previewSource('coinbase', 'https://api.exchange.coinbase.com/products/BTC-USD/ticker', data => {
      const value = data as { price?: unknown; time?: unknown }
      if (typeof value.price !== 'string' || typeof value.time !== 'string') throw new Error('Unexpected Coinbase response')
      return { price: value.price, observed_at: value.time }
    }),
    previewSource('bitstamp', 'https://www.bitstamp.net/api/v2/ticker/btcusd/', data => {
      const value = data as { last?: unknown; timestamp?: unknown }
      if (typeof value.last !== 'string' || typeof value.timestamp !== 'string' || !/^\d+$/.test(value.timestamp)) throw new Error('Unexpected Bitstamp response')
      return { price: value.last, observed_at: new Date(Number(value.timestamp) * 1000).toISOString() }
    }),
    previewSource('gemini', 'https://api.gemini.com/v1/trades/btcusd?limit_trades=1', data => {
      if (!Array.isArray(data) || !data[0] || typeof data[0].price !== 'string' || typeof data[0].timestampms !== 'number') throw new Error('Unexpected Gemini response')
      return { price: data[0].price, observed_at: new Date(data[0].timestampms).toISOString() }
    }),
  ])

  let market = null
  let stats = null
  let error: string | undefined
  if (PRICEGUARD_V2_ADDRESS) {
    try {
      const { createClient } = await import('genlayer-js')
      const { testnetBradbury } = await import('genlayer-js/chains')
      const client = createClient({ chain: testnetBradbury })
      const [marketRaw, statsRaw] = await Promise.all([
        client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_market', args: ['BTC/USD'] }),
        client.readContract({ address: PRICEGUARD_V2_ADDRESS, functionName: 'get_protocol_stats', args: [] }),
      ])
      const marketResult = parseContractJson(marketRaw)
      const statsResult = parseContractJson(statsRaw)
      if (!isMarketResult(marketResult)) throw new Error('Malformed V2 market response')
      if (!isProtocolStats(statsResult)) throw new Error('Malformed V2 protocol statistics')
      if (marketResult.found) {
        const { found, ...snapshot } = marketResult
        void found
        market = snapshot
      } else {
        market = null
      }
      stats = statsResult
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'V2 state unavailable'
    }
  }

  return NextResponse.json({
    deploymentStatus: PRICEGUARD_V2_ADDRESS ? 'CONFIGURED' : 'UNDEPLOYED',
    contractAddress: PRICEGUARD_V2_ADDRESS,
    market,
    stats,
    preview: { symbol: 'BTC/USD', fetchedAt: new Date().toISOString(), observations, label: 'CURRENT_API_PREVIEW' },
    error,
  })
}
