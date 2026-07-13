export const LEGACY_V1_ADDRESS = '0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B' as const
export const LEGACY_V1_UPDATE_TX = '0x0e87e2e6cccfae6467ad8f17574f3b1d10088a309b9c7d1eea5cdca99c51951e' as const

const configuredV2 = process.env.NEXT_PUBLIC_PRICEGUARD_V2_ADDRESS || ''
export const PRICEGUARD_V2_ADDRESS = /^0x[0-9a-fA-F]{40}$/.test(configuredV2)
  ? configuredV2 as `0x${string}`
  : null

export const CHAIN_ID = 4221
export const EXPLORER_URL = 'https://explorer-bradbury.genlayer.com'
export const POLICY = {
  symbol: 'BTC/USD',
  decimals: 2,
  sources: ['Coinbase Exchange', 'Bitstamp', 'Gemini'],
  refreshRequiredSources: 2,
  evaluationRequiredSources: 3,
  maxSpreadBps: 100,
  validatorToleranceBps: 50,
  maxAgeSeconds: 120,
  version: 'BTCUSD-1',
} as const
