export const COVENANT_MODES = ['PERSONAL', 'BILATERAL'] as const
export const CONDITION_TYPES = ['ABOVE', 'BELOW', 'AT_OR_ABOVE', 'AT_OR_BELOW', 'IN_RANGE'] as const
export const COVENANT_STATUSES = ['PENDING_ACCEPTANCE', 'ACTIVE', 'TRIGGERED', 'EXPIRED', 'CANCELED', 'CLOSED'] as const
export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export const ATTESTATION_OUTCOMES = ['SATISFIED', 'NOT_SATISFIED'] as const
export const SOURCE_IDENTITIES = ['coinbase', 'bitstamp', 'gemini'] as const
export const MARKET_OBSERVATION_ORDER = ['bitstamp', 'coinbase', 'gemini'] as const

export type CovenantMode = typeof COVENANT_MODES[number]
export type ConditionType = typeof CONDITION_TYPES[number]
export type CovenantStatus = typeof COVENANT_STATUSES[number]
export type Confidence = typeof CONFIDENCE_LEVELS[number]
export type AttestationOutcome = typeof ATTESTATION_OUTCOMES[number]
export type SourceIdentity = typeof SOURCE_IDENTITIES[number]

export type Observation = {
  source: SourceIdentity
  price: string
  observed_at: string
}

export type MarketSnapshot = {
  symbol: 'BTC/USD'
  asset_class: 'CRYPTO_SPOT'
  decimals: 2
  policy_version: 'BTCUSD-1'
  observations: Observation[]
  valid_source_count: number
  rejected_source_count: number
  median_price: string
  minimum_observation: string
  maximum_observation: string
  spread_bps: number
  confidence: Confidence
  circuit_breaker: boolean
  transaction_epoch: string
  update_sequence: string
  updater: string
}

export type MarketResult =
  | { found: false; symbol: 'BTC/USD' }
  | ({ found: true } & MarketSnapshot)

export type Covenant = {
  covenant_id: string
  client_request_id: string
  mode: CovenantMode
  creator: string
  counterparty: string
  symbol: 'BTC/USD'
  condition_type: ConditionType
  threshold_low: string
  threshold_high: string
  decimals: 2
  valid_from: string
  expiry: string
  minimum_confidence: 'HIGH'
  maximum_spread_bps: number
  status: CovenantStatus
  accepted_at: string
  last_evaluated_at: string
  evaluation_count: string
  trigger_snapshot_sequence: string
  trigger_attestation_id: string
  triggered_at: string
  creator_acknowledged: boolean
  counterparty_acknowledged: boolean
  closed_at: string
  memo: string
  external_reference_hash: string
  revision_of: string
  policy_version: 'BTCUSD-1'
}

export type CovenantResult =
  | { found: false; covenant_id: string }
  | ({ found: true } & Covenant)

export type Attestation = {
  schema_version: 'priceguard-attestation-1'
  attestation_id: string
  covenant_id: string
  evaluation_sequence: number
  outcome: AttestationOutcome
  symbol: 'BTC/USD'
  condition_type: ConditionType
  threshold_low: string
  threshold_high: string
  evaluated_price: string
  decimals: 2
  snapshot_sequence: string
  valid_source_count: number
  source_identities: SourceIdentity[]
  minimum_observation: string
  maximum_observation: string
  spread_bps: number
  confidence: Confidence
  circuit_breaker: boolean
  policy_version: 'BTCUSD-1'
  evaluated_at: string
  evaluator: string
}

export type AttestationResult =
  | { found: false; attestation_id: string }
  | ({ found: true } & Attestation)

export type CovenantPage = { items: Covenant[]; offset: number; limit: number; total: number }
export type AttestationPage = { items: Attestation[]; offset: number; limit: number; total: number; retained: number }
export type MarketHistoryPage = { items: MarketSnapshot[]; offset: number; limit: number; total: number }

export type ProtocolStats = {
  protocol_version: 'priceguard-covenant-1'
  policy_version: 'BTCUSD-1'
  market_update_count: string
  covenant_count: string
  personal_count: string
  bilateral_count: string
  pending_count: string
  active_count: string
  triggered_count: string
  expired_count: string
  canceled_count: string
  closed_count: string
  attestation_count: string
  custody: false
}

export type CreateTerms = {
  clientRequestId: string
  mode: CovenantMode
  counterparty: string
  symbol: 'BTC/USD'
  conditionType: ConditionType
  thresholdLowInput: string
  thresholdHighInput: string
  validFrom: number
  expiry: number
  minimumConfidence: 'HIGH'
  maximumSpreadBps: number
  memo: string
  externalReferenceHash: string
  revisionOf: string
}

export type ApiObservation = {
  source: SourceIdentity
  price: string
  observed_at: string
  ok: boolean
  error?: string
}

export type ProtocolResponse = {
  deploymentStatus: 'UNDEPLOYED' | 'CONFIGURED'
  contractAddress: string | null
  market: MarketSnapshot | null
  stats: ProtocolStats | null
  preview: {
    symbol: 'BTC/USD'
    fetchedAt: string
    observations: ApiObservation[]
    label: 'CURRENT_API_PREVIEW'
  }
  error?: string
}

export type ActivityPhase =
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'CONFIRMATION'
  | 'CONFIRMED'
  | 'EXECUTION_FAILED'
  | 'CANCELED'
  | 'UNDETERMINED'
  | 'UNKNOWN_RETRYABLE'

export type ActivityStateCheck = 'NOT_RUN' | 'MATCHED' | 'MISMATCHED' | 'UNAVAILABLE'

export type Activity = {
  hash: `0x${string}`
  chainId: number
  contract: string
  wallet: string
  action: string
  functionName: string
  phase: ActivityPhase
  submittedAt: number
  updatedAt: number
  terminal: boolean
  covenantId?: string
  expectedCovenantId?: string
  submittedCreateTerms?: CreateTerms
  stateCheck?: ActivityStateCheck
  stateCheckMessage?: string
  error?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

const isEnum = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === 'string' && values.includes(value as T[number])

export const isCanonicalDigits = (value: unknown, allowZero = true): value is string =>
  typeof value === 'string' && /^\d+$/.test(value) && String(BigInt(value)) === value && (allowZero || value !== '0')

export const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)

export const isCovenantId = (value: unknown): value is string =>
  typeof value === 'string' && /^cov_[0-9a-f]{48}$/.test(value)

export const isAttestationId = (value: unknown): value is string =>
  typeof value === 'string' && /^att_[0-9a-f]{48}$/.test(value)

const isReferenceHash = (value: unknown): value is string =>
  value === '' || (typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value))

const isRevisionId = (value: unknown): value is string => value === '' || isCovenantId(value)

const OBSERVATION_KEYS = ['source', 'price', 'observed_at'] as const
export function isObservation(value: unknown): value is Observation {
  if (!isRecord(value) || !hasExactKeys(value, OBSERVATION_KEYS)) return false
  return isEnum(value.source, SOURCE_IDENTITIES) && isCanonicalDigits(value.price, false) && isCanonicalDigits(value.observed_at, false)
}

const MARKET_KEYS = [
  'symbol', 'asset_class', 'decimals', 'policy_version', 'observations',
  'valid_source_count', 'rejected_source_count', 'median_price',
  'minimum_observation', 'maximum_observation', 'spread_bps', 'confidence',
  'circuit_breaker', 'transaction_epoch', 'update_sequence', 'updater',
] as const

export function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (!isRecord(value) || !hasExactKeys(value, MARKET_KEYS)) return false
  if (value.symbol !== 'BTC/USD' || value.asset_class !== 'CRYPTO_SPOT' || value.decimals !== 2 || value.policy_version !== 'BTCUSD-1') return false
  if (!Array.isArray(value.observations) || !value.observations.every(isObservation)) return false
  const sources = value.observations.map(item => item.source)
  if (new Set(sources).size !== sources.length) return false
  if (!sources.every((source, index) => source === MARKET_OBSERVATION_ORDER.filter(item => sources.includes(item))[index])) return false
  return Number.isInteger(value.valid_source_count) && Number(value.valid_source_count) >= 2 && Number(value.valid_source_count) <= 3
    && Number.isInteger(value.rejected_source_count) && Number(value.rejected_source_count) >= 0 && Number(value.rejected_source_count) <= 3
    && Number(value.valid_source_count) + Number(value.rejected_source_count) === 3
    && value.observations.length === value.valid_source_count
    && isCanonicalDigits(value.median_price, false)
    && isCanonicalDigits(value.minimum_observation, false)
    && isCanonicalDigits(value.maximum_observation, false)
    && Number.isInteger(value.spread_bps) && Number(value.spread_bps) >= 0 && Number(value.spread_bps) <= 100
    && value.confidence === (Number(value.valid_source_count) === 3 && Number(value.spread_bps) <= 25 ? 'HIGH' : Number(value.spread_bps) <= 75 ? 'MEDIUM' : 'LOW')
    && value.circuit_breaker === false
    && isCanonicalDigits(value.transaction_epoch, false)
    && isCanonicalDigits(value.update_sequence, false)
    && isAddress(value.updater)
}

export function isMarketNotFound(value: unknown): value is Extract<MarketResult, { found: false }> {
  return isRecord(value) && hasExactKeys(value, ['found', 'symbol']) && value.found === false && value.symbol === 'BTC/USD'
}

export function isMarketFound(value: unknown): value is Extract<MarketResult, { found: true }> {
  if (!isRecord(value) || value.found !== true) return false
  const snapshot = { ...value }
  delete snapshot.found
  return hasExactKeys(value, ['found', ...MARKET_KEYS]) && isMarketSnapshot(snapshot)
}

export function isMarketResult(value: unknown): value is MarketResult {
  return isMarketNotFound(value) || isMarketFound(value)
}

const COVENANT_KEYS = [
  'covenant_id', 'client_request_id', 'mode', 'creator', 'counterparty', 'symbol',
  'condition_type', 'threshold_low', 'threshold_high', 'decimals', 'valid_from',
  'expiry', 'minimum_confidence', 'maximum_spread_bps', 'status', 'accepted_at',
  'last_evaluated_at', 'evaluation_count', 'trigger_snapshot_sequence',
  'trigger_attestation_id', 'triggered_at', 'creator_acknowledged',
  'counterparty_acknowledged', 'closed_at', 'memo', 'external_reference_hash',
  'revision_of', 'policy_version',
] as const

export function isCovenant(value: unknown): value is Covenant {
  if (!isRecord(value) || !hasExactKeys(value, COVENANT_KEYS)) return false
  if (!isCovenantId(value.covenant_id) || typeof value.client_request_id !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(value.client_request_id)) return false
  if (!isEnum(value.mode, COVENANT_MODES) || !isAddress(value.creator) || !isAddress(value.counterparty)) return false
  if (value.symbol !== 'BTC/USD' || !isEnum(value.condition_type, CONDITION_TYPES)) return false
  if (!isCanonicalDigits(value.threshold_low, false) || !isCanonicalDigits(value.threshold_high)) return false
  if (value.decimals !== 2 || !isCanonicalDigits(value.valid_from) || !isCanonicalDigits(value.expiry, false)) return false
  if (value.minimum_confidence !== 'HIGH' || !Number.isInteger(value.maximum_spread_bps) || Number(value.maximum_spread_bps) < 0 || Number(value.maximum_spread_bps) > 100) return false
  if (!isEnum(value.status, COVENANT_STATUSES)) return false
  for (const key of ['accepted_at', 'last_evaluated_at', 'evaluation_count', 'trigger_snapshot_sequence', 'triggered_at', 'closed_at'] as const) {
    if (!isCanonicalDigits(value[key])) return false
  }
  if (value.trigger_attestation_id !== '' && !isAttestationId(value.trigger_attestation_id)) return false
  if (typeof value.creator_acknowledged !== 'boolean' || typeof value.counterparty_acknowledged !== 'boolean') return false
  if (typeof value.memo !== 'string' || value.memo.length > 280 || !isReferenceHash(value.external_reference_hash) || !isRevisionId(value.revision_of)) return false
  if (value.policy_version !== 'BTCUSD-1') return false
  if (value.mode === 'PERSONAL' && value.counterparty.toLowerCase() !== '0x0000000000000000000000000000000000000000') return false
  if (value.mode === 'BILATERAL' && (value.counterparty.toLowerCase() === '0x0000000000000000000000000000000000000000' || value.counterparty.toLowerCase() === value.creator.toLowerCase())) return false
  if (BigInt(value.valid_from) > BigInt(value.expiry)) return false
  return true
}

export function isCovenantNotFound(value: unknown): value is Extract<CovenantResult, { found: false }> {
  return isRecord(value) && hasExactKeys(value, ['found', 'covenant_id']) && value.found === false && isCovenantId(value.covenant_id)
}

export function isCovenantFound(value: unknown): value is Extract<CovenantResult, { found: true }> {
  if (!isRecord(value) || value.found !== true || !hasExactKeys(value, ['found', ...COVENANT_KEYS])) return false
  const covenant = { ...value }
  delete covenant.found
  return isCovenant(covenant)
}

export function isCovenantResult(value: unknown): value is CovenantResult {
  return isCovenantNotFound(value) || isCovenantFound(value)
}

const ATTESTATION_KEYS = [
  'schema_version', 'attestation_id', 'covenant_id', 'evaluation_sequence',
  'outcome', 'symbol', 'condition_type', 'threshold_low', 'threshold_high',
  'evaluated_price', 'decimals', 'snapshot_sequence', 'valid_source_count',
  'source_identities', 'minimum_observation', 'maximum_observation', 'spread_bps',
  'confidence', 'circuit_breaker', 'policy_version', 'evaluated_at', 'evaluator',
] as const

export function isAttestation(value: unknown): value is Attestation {
  if (!isRecord(value) || !hasExactKeys(value, ATTESTATION_KEYS)) return false
  return value.schema_version === 'priceguard-attestation-1'
    && isAttestationId(value.attestation_id)
    && isCovenantId(value.covenant_id)
    && Number.isSafeInteger(value.evaluation_sequence) && Number(value.evaluation_sequence) > 0
    && isEnum(value.outcome, ATTESTATION_OUTCOMES)
    && value.symbol === 'BTC/USD'
    && isEnum(value.condition_type, CONDITION_TYPES)
    && isCanonicalDigits(value.threshold_low, false)
    && isCanonicalDigits(value.threshold_high)
    && isCanonicalDigits(value.evaluated_price, false)
    && value.decimals === 2
    && isCanonicalDigits(value.snapshot_sequence, false)
    && value.valid_source_count === 3
    && Array.isArray(value.source_identities)
    && value.source_identities.length === 3
    && value.source_identities.every((source, index) => source === SOURCE_IDENTITIES[index])
    && isCanonicalDigits(value.minimum_observation, false)
    && isCanonicalDigits(value.maximum_observation, false)
    && Number.isInteger(value.spread_bps) && Number(value.spread_bps) >= 0 && Number(value.spread_bps) <= 100
    && value.confidence === 'HIGH'
    && value.circuit_breaker === false
    && value.policy_version === 'BTCUSD-1'
    && isCanonicalDigits(value.evaluated_at, false)
    && isAddress(value.evaluator)
}

export function isAttestationNotFound(value: unknown): value is Extract<AttestationResult, { found: false }> {
  return isRecord(value) && hasExactKeys(value, ['found', 'attestation_id']) && value.found === false && isAttestationId(value.attestation_id)
}

export function isAttestationFound(value: unknown): value is Extract<AttestationResult, { found: true }> {
  if (!isRecord(value) || value.found !== true || !hasExactKeys(value, ['found', ...ATTESTATION_KEYS])) return false
  const attestation = { ...value }
  delete attestation.found
  return isAttestation(attestation)
}

export function isAttestationResult(value: unknown): value is AttestationResult {
  return isAttestationNotFound(value) || isAttestationFound(value)
}

export function isCovenantPage(value: unknown): value is CovenantPage {
  return isRecord(value) && hasExactKeys(value, ['items', 'offset', 'limit', 'total'])
    && Array.isArray(value.items) && value.items.every(isCovenant)
    && Number.isSafeInteger(value.offset) && Number(value.offset) >= 0
    && Number.isSafeInteger(value.limit) && Number(value.limit) >= 0 && Number(value.limit) <= 50
    && Number.isSafeInteger(value.total) && Number(value.total) >= 0
}

export function isAttestationPage(value: unknown): value is AttestationPage {
  return isRecord(value) && hasExactKeys(value, ['items', 'offset', 'limit', 'total', 'retained'])
    && Array.isArray(value.items) && value.items.every(isAttestation)
    && Number.isSafeInteger(value.offset) && Number(value.offset) >= 0
    && Number.isSafeInteger(value.limit) && Number(value.limit) >= 0 && Number(value.limit) <= 50
    && Number.isSafeInteger(value.total) && Number(value.total) >= 0
    && Number.isSafeInteger(value.retained) && Number(value.retained) >= 0 && Number(value.retained) <= Number(value.total)
}

export function isProtocolStats(value: unknown): value is ProtocolStats {
  const keys = [
    'protocol_version', 'policy_version', 'market_update_count', 'covenant_count',
    'personal_count', 'bilateral_count', 'pending_count', 'active_count',
    'triggered_count', 'expired_count', 'canceled_count', 'closed_count',
    'attestation_count', 'custody',
  ] as const
  if (!isRecord(value) || !hasExactKeys(value, keys)) return false
  if (value.protocol_version !== 'priceguard-covenant-1' || value.policy_version !== 'BTCUSD-1' || value.custody !== false) return false
  return ['market_update_count', 'covenant_count', 'personal_count', 'bilateral_count', 'pending_count', 'active_count', 'triggered_count', 'expired_count', 'canceled_count', 'closed_count', 'attestation_count']
    .every(key => isCanonicalDigits(value[key]))
}

export function isProtocolResponse(value: unknown): value is ProtocolResponse {
  if (!isRecord(value)) return false
  const required = ['deploymentStatus', 'contractAddress', 'market', 'stats', 'preview']
  const allowed = [...required, 'error']
  if (!required.every(key => Object.hasOwn(value, key)) || !Object.keys(value).every(key => allowed.includes(key))) return false
  if (value.deploymentStatus !== 'UNDEPLOYED' && value.deploymentStatus !== 'CONFIGURED') return false
  if (value.contractAddress !== null && !isAddress(value.contractAddress)) return false
  if ((value.deploymentStatus === 'UNDEPLOYED') !== (value.contractAddress === null)) return false
  if (value.market !== null && !isMarketSnapshot(value.market)) return false
  if (value.stats !== null && !isProtocolStats(value.stats)) return false
  if (!isRecord(value.preview) || !hasExactKeys(value.preview, ['symbol', 'fetchedAt', 'observations', 'label'])) return false
  if (value.preview.symbol !== 'BTC/USD' || value.preview.label !== 'CURRENT_API_PREVIEW' || typeof value.preview.fetchedAt !== 'string' || Number.isNaN(Date.parse(value.preview.fetchedAt))) return false
  if (!Array.isArray(value.preview.observations) || value.preview.observations.length !== 3) return false
  if (!value.preview.observations.every((item, index) => {
    if (!isRecord(item) || item.source !== SOURCE_IDENTITIES[index] || typeof item.ok !== 'boolean') return false
    const keys = item.ok ? ['source', 'price', 'observed_at', 'ok'] : ['source', 'price', 'observed_at', 'ok', 'error']
    if (!hasExactKeys(item, keys)) return false
    if (item.ok) return typeof item.price === 'string' && /^\d+(?:\.\d+)?$/.test(item.price) && typeof item.observed_at === 'string' && !Number.isNaN(Date.parse(item.observed_at))
    return item.price === '' && item.observed_at === '' && typeof item.error === 'string' && item.error.length > 0
  })) return false
  return value.error === undefined || typeof value.error === 'string'
}

const ACTIVITY_ACTIONS = ['refresh', 'create', 'accept', 'cancel', 'evaluate', 'expire', 'acknowledge'] as const
const ACTIVITY_FUNCTIONS: Record<typeof ACTIVITY_ACTIONS[number], string> = {
  refresh: 'refresh_market',
  create: 'create_covenant',
  accept: 'accept_covenant',
  cancel: 'cancel_unaccepted_covenant',
  evaluate: 'evaluate_covenant',
  expire: 'expire_covenant',
  acknowledge: 'acknowledge_outcome',
}
const CREATE_TERM_KEYS = ['clientRequestId', 'mode', 'counterparty', 'symbol', 'conditionType', 'thresholdLowInput', 'thresholdHighInput', 'validFrom', 'expiry', 'minimumConfidence', 'maximumSpreadBps', 'memo', 'externalReferenceHash', 'revisionOf'] as const

function isPersistedCreateTerms(value: unknown): value is CreateTerms {
  if (!isRecord(value) || !hasExactKeys(value, CREATE_TERM_KEYS)) return false
  if (typeof value.clientRequestId !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(value.clientRequestId)) return false
  if (!isEnum(value.mode, COVENANT_MODES) || !isAddress(value.counterparty) || value.symbol !== 'BTC/USD' || !isEnum(value.conditionType, CONDITION_TYPES)) return false
  if (typeof value.thresholdLowInput !== 'string' || typeof value.thresholdHighInput !== 'string') return false
  if (!Number.isSafeInteger(value.validFrom) || Number(value.validFrom) < 0 || !Number.isSafeInteger(value.expiry) || Number(value.expiry) <= 0) return false
  if (value.minimumConfidence !== 'HIGH' || !Number.isSafeInteger(value.maximumSpreadBps) || Number(value.maximumSpreadBps) < 0 || Number(value.maximumSpreadBps) > 100) return false
  return typeof value.memo === 'string' && value.memo.length <= 280 && isReferenceHash(value.externalReferenceHash) && isRevisionId(value.revisionOf)
}

export function isActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false
  const required = ['hash', 'chainId', 'contract', 'wallet', 'action', 'functionName', 'phase', 'submittedAt', 'updatedAt', 'terminal']
  const optional = ['covenantId', 'expectedCovenantId', 'submittedCreateTerms', 'stateCheck', 'stateCheckMessage', 'error']
  if (!required.every(key => Object.hasOwn(value, key)) || !Object.keys(value).every(key => required.includes(key) || optional.includes(key))) return false
  const phases: ActivityPhase[] = ['SUBMITTED', 'PROCESSING', 'CONFIRMATION', 'CONFIRMED', 'EXECUTION_FAILED', 'CANCELED', 'UNDETERMINED', 'UNKNOWN_RETRYABLE']
  if (typeof value.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value.hash)) return false
  if (!Number.isSafeInteger(value.chainId) || Number(value.chainId) <= 0 || !isAddress(value.contract) || !isAddress(value.wallet)) return false
  if (!isEnum(value.action, ACTIVITY_ACTIONS) || value.functionName !== ACTIVITY_FUNCTIONS[value.action]) return false
  if (typeof value.phase !== 'string' || !phases.includes(value.phase as ActivityPhase)) return false
  if (!Number.isSafeInteger(value.submittedAt) || Number(value.submittedAt) < 0 || !Number.isSafeInteger(value.updatedAt) || Number(value.updatedAt) < Number(value.submittedAt) || typeof value.terminal !== 'boolean') return false
  if (value.covenantId !== undefined && !isCovenantId(value.covenantId)) return false
  if (value.expectedCovenantId !== undefined && !isCovenantId(value.expectedCovenantId)) return false
  if (value.submittedCreateTerms !== undefined && !isPersistedCreateTerms(value.submittedCreateTerms)) return false
  if (value.stateCheck !== undefined && !['NOT_RUN', 'MATCHED', 'MISMATCHED', 'UNAVAILABLE'].includes(String(value.stateCheck))) return false
  if (value.stateCheckMessage !== undefined && typeof value.stateCheckMessage !== 'string') return false
  if (value.error !== undefined && typeof value.error !== 'string') return false
  return true
}

export const parseContractJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) as unknown } catch { return null }
}
