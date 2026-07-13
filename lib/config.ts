const configuredV2 = process.env.NEXT_PUBLIC_PRICEGUARD_V2_ADDRESS || ''
export const PRICEGUARD_V2_ADDRESS = /^0x[0-9a-fA-F]{40}$/.test(configuredV2)
  ? configuredV2 as `0x${string}`
  : null

export const CHAIN_ID = 4221
export const BRADBURY_CHAIN_ID_HEX = '0x107d'
export const BRADBURY_NETWORK = {
  chainId: BRADBURY_CHAIN_ID_HEX,
  chainName: 'GenLayer Bradbury',
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-bradbury.genlayer.com'],
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
} as const
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
