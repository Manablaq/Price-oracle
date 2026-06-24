export const CONTRACT_ADDRESS = '0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B' as `0x${string}`

export const BRADBURY_CHAIN = {
  id: 4221,
  name: 'GenLayer Bradbury',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-bradbury.genlayer.com'] } },
  blockExplorers: { default: { name: 'GenExplorer', url: 'https://explorer-bradbury.genlayer.com' } },
} as const

export const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
export const FOREX_PAIRS = [
  { base: 'USD', quote: 'NGN' },
  { base: 'USD', quote: 'GHS' },
  { base: 'USD', quote: 'KES' },
  { base: 'USD', quote: 'EUR' },
  { base: 'USD', quote: 'GBP' },
]

export const CRYPTO_META: Record<string, { name: string; emoji: string; color: string }> = {
  BTCUSDT: { name: 'Bitcoin',  emoji: '₿', color: '#F7931A' },
  ETHUSDT: { name: 'Ethereum', emoji: 'Ξ', color: '#627EEA' },
  SOLUSDT: { name: 'Solana',   emoji: '◎', color: '#9945FF' },
  BNBUSDT: { name: 'BNB',      emoji: 'B', color: '#F3BA2F' },
}

export const FOREX_META: Record<string, { flag: string; name: string }> = {
  NGN: { flag: '🇳🇬', name: 'Nigerian Naira' },
  GHS: { flag: '🇬🇭', name: 'Ghanaian Cedi' },
  KES: { flag: '🇰🇪', name: 'Kenyan Shilling' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  GBP: { flag: '🇬🇧', name: 'British Pound' },
}
