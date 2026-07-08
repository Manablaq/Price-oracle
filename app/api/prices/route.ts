import { NextResponse } from 'next/server'
import { CONTRACT_ADDRESS } from '@/lib/config'

type ReadContractClient = {
  readContract: (params: {
    address: typeof CONTRACT_ADDRESS
    functionName: 'get_all_prices' | 'get_stats'
    args: []
    stateStatus: 'accepted'
  }) => Promise<unknown>
}

const parseContractJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export async function GET() {
  try {
    const { createClient } = await import('genlayer-js')
    const { testnetBradbury } = await import('genlayer-js/chains')
    const client = createClient({ chain: testnetBradbury, account: undefined }) as ReadContractClient

    const [allPrices, stats] = await Promise.all([
      client.readContract({ address: CONTRACT_ADDRESS, functionName: 'get_all_prices', args: [], stateStatus: 'accepted' }),
      client.readContract({ address: CONTRACT_ADDRESS, functionName: 'get_stats', args: [], stateStatus: 'accepted' }),
    ])

    return NextResponse.json({
      prices: parseContractJson(allPrices),
      stats: parseContractJson(stats),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read accepted contract state'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
