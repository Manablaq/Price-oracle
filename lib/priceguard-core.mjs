export const CONFIDENCE_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 }
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const POLICY_VERSION = 'BTCUSD-1'
export const SUPPORTED_SYMBOL = 'BTC/USD'
export const MARKET_DECIMALS = 2
export const MAX_VALIDITY_SECONDS = 365 * 24 * 60 * 60
export const PAGE_LIMIT = 50
export const MAX_THRESHOLD_SCALED = 100000000000000n

export function formatFixed(value, decimals = 2, options = {}) {
  const raw = String(value ?? '0')
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return '—'
  const padded = raw.padStart(decimals + 1, '0')
  const whole = decimals ? padded.slice(0, -decimals) : padded
  const fraction = decimals ? padded.slice(-decimals) : ''
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const trimmed = options.trim === false ? fraction : fraction.replace(/0+$/, '')
  const result = trimmed ? `${grouped}.${trimmed}` : grouped
  return `${options.prefix ?? ''}${result}${options.suffix ?? ''}`
}

export function marketState(snapshot, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!snapshot || snapshot.found === false) return 'UNVERIFIED'
  if (snapshot.circuit_breaker) return 'CIRCUIT_BREAKER'
  const epoch = Number(snapshot.transaction_epoch || 0)
  if (!Number.isSafeInteger(epoch) || epoch <= 0 || nowSeconds - epoch > 300) return 'STALE'
  return 'VERIFIED'
}

export function stateTone(state) {
  if (['VERIFIED', 'TRIGGERED', 'CLOSED', 'CONFIRMED', 'HIGH', 'MATCHED'].includes(state)) return 'positive'
  if (['CIRCUIT_BREAKER', 'EXECUTION_FAILED', 'CANCELED', 'UNDETERMINED', 'MISMATCHED'].includes(state)) return 'danger'
  if (['STALE', 'PROCESSING', 'CONFIRMATION', 'MEDIUM', 'ACTIVE', 'UNAVAILABLE'].includes(state)) return 'warning'
  return 'neutral'
}

/**
 * Classify a GenLayerJS transaction using the documented finality contract:
 * FINALIZED + FINISHED_WITH_RETURN is execution success. ACCEPTED is not final.
 * resultName is retained for diagnosing no-majority/disagreement, but is not an
 * additional success gate because Bradbury may expose MAJORITY_AGREE.
 */
export function classifyTransaction(tx) {
  const status = String(tx?.statusName ?? tx?.status ?? 'UNKNOWN')
  const result = String(tx?.resultName ?? '')
  const execution = String(tx?.txExecutionResultName ?? '')

  if (status === 'CANCELED') return { phase: 'CANCELED', terminal: true }
  if (status === 'UNDETERMINED' || result === 'NO_MAJORITY' || result === 'MAJORITY_DISAGREE') {
    return { phase: 'UNDETERMINED', terminal: true }
  }
  if (status === 'VALIDATORS_TIMEOUT' || status === 'LEADER_TIMEOUT' || result === 'TIMEOUT') {
    return { phase: 'UNDETERMINED', terminal: true }
  }
  if (status === 'FINALIZED') {
    if (execution === 'FINISHED_WITH_RETURN') return { phase: 'CONFIRMED', terminal: true }
    return { phase: 'EXECUTION_FAILED', terminal: true }
  }
  if (execution === 'FINISHED_WITH_ERROR' || result === 'DISAGREE' || result === 'DETERMINISTIC_VIOLATION') {
    return { phase: 'EXECUTION_FAILED', terminal: true }
  }
  if (status === 'ACCEPTED' || status === 'READY_TO_FINALIZE') return { phase: 'CONFIRMATION', terminal: false }
  if (['UNINITIALIZED', 'PENDING', 'PROPOSING', 'COMMITTING', 'REVEALING', 'APPEAL_REVEALING', 'APPEAL_COMMITTING'].includes(status)) {
    return { phase: 'PROCESSING', terminal: false }
  }
  return { phase: 'UNKNOWN_RETRYABLE', terminal: false }
}

export function activityNamespace(chainId, contract, wallet) {
  return `priceguard:activity:${chainId}:${String(contract).toLowerCase()}:${String(wallet).toLowerCase()}`
}

export function mergeActivity(current, incoming) {
  const merged = new Map()
  for (const item of [...current, ...incoming]) {
    const prior = merged.get(item.hash)
    if (!prior || Number(item.updatedAt) > Number(prior.updatedAt)) merged.set(item.hash, item)
  }
  return [...merged.values()].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
}

export function mergeCovenantPages(creatorPage, counterpartyPage) {
  const map = new Map()
  for (const item of creatorPage.items || []) {
    map.set(item.covenant_id, { item, creator: true, counterparty: false })
  }
  for (const item of counterpartyPage.items || []) {
    const prior = map.get(item.covenant_id)
    map.set(item.covenant_id, { item: prior?.item ?? item, creator: Boolean(prior?.creator), counterparty: true })
  }
  return [...map.values()]
    .map(({ item, creator, counterparty }) => ({
      ...item,
      role: creator && counterparty ? 'CREATOR_AND_COUNTERPARTY' : creator ? 'CREATOR' : 'COUNTERPARTY',
    }))
    .sort((a, b) => String(a.covenant_id).localeCompare(String(b.covenant_id)))
}

export function sourceHasNext(page) {
  return Number(page.offset) + Number(page.items?.length || 0) < Number(page.total || 0)
}

export function nextCovenantCursors(state, creatorPage, counterpartyPage) {
  return {
    creatorOffset: sourceHasNext(creatorPage) ? state.creatorOffset + creatorPage.limit : creatorPage.total,
    counterpartyOffset: sourceHasNext(counterpartyPage) ? state.counterpartyOffset + counterpartyPage.limit : counterpartyPage.total,
  }
}

export function cursorsChanged(previous, next) {
  return previous.creatorOffset !== next.creatorOffset || previous.counterpartyOffset !== next.counterpartyOffset
}

export function attestationHasNext(page) {
  return Number(page.offset) + Number(page.items?.length || 0) < Number(page.retained || 0)
}

export function attestationRoute(attestationIdValue) {
  return `/attestations/${String(attestationIdValue)}`
}

export function actionAllowed(action, covenant, wallet, now = Math.floor(Date.now() / 1000), chainOk = true, deployed = true) {
  if (!chainOk || !deployed || !covenant || !wallet) return false
  const me = String(wallet).toLowerCase()
  const creator = String(covenant.creator).toLowerCase() === me
  const counterparty = String(covenant.counterparty).toLowerCase() === me
  const expiry = Number(covenant.expiry)
  const validFrom = Number(covenant.valid_from)
  if (!Number.isSafeInteger(expiry) || !Number.isSafeInteger(validFrom)) return false
  if (action === 'accept') return covenant.mode === 'BILATERAL' && counterparty && covenant.status === 'PENDING_ACCEPTANCE' && now <= expiry
  if (action === 'cancel') return creator && covenant.status === 'PENDING_ACCEPTANCE' && now <= expiry
  if (action === 'evaluate') return covenant.status === 'ACTIVE' && now >= validFrom && now <= expiry
  if (action === 'expire') return (covenant.status === 'ACTIVE' || covenant.status === 'PENDING_ACCEPTANCE') && now > expiry
  if (action === 'acknowledge') {
    if (covenant.status !== 'TRIGGERED') return false
    if (creator) return !covenant.creator_acknowledged
    return covenant.mode === 'BILATERAL' && counterparty && !covenant.counterparty_acknowledged
  }
  return false
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function covenantId(creator, clientRequestId) {
  return `cov_${(await sha256Hex(`${String(creator).toLowerCase()}:${String(clientRequestId)}`)).slice(0, 48)}`
}

export async function attestationId(covenantIdValue, sequence) {
  return `att_${(await sha256Hex(`${String(covenantIdValue)}:${String(sequence)}`)).slice(0, 48)}`
}

export function scaleThresholdInput(value) {
  const text = String(value)
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) throw new Error('Threshold must be a positive decimal with at most 12 whole digits and two decimal places.')
  const [whole, fraction = ''] = text.split('.')
  const scaled = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0')
  if (scaled <= 0n || scaled > MAX_THRESHOLD_SCALED) throw new Error('Threshold is outside the contract range.')
  return scaled.toString()
}

export function parseCreateTerms(args, wallet, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(args) || args.length !== 14) throw new Error('create_covenant requires exactly 14 arguments.')
  const [clientRequestId, mode, counterparty, symbol, conditionType, thresholdLowInput, thresholdHighInput, validFrom, expiry, minimumConfidence, maximumSpreadBps, memo, externalReferenceHash, revisionOf] = args
  if (typeof clientRequestId !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(clientRequestId)) throw new Error('Client request ID is invalid.')
  if (mode !== 'PERSONAL' && mode !== 'BILATERAL') throw new Error('Mode must be PERSONAL or BILATERAL.')
  if (typeof counterparty !== 'string') throw new Error('Counterparty must be an address.')
  const address = /^0x[0-9a-fA-F]{40}$/
  if (mode === 'PERSONAL' && counterparty !== ZERO_ADDRESS) throw new Error('Personal covenants must use the zero-address counterparty.')
  if (mode === 'BILATERAL' && (!address.test(counterparty) || counterparty.toLowerCase() === ZERO_ADDRESS || counterparty.toLowerCase() === String(wallet).toLowerCase())) throw new Error('Bilateral counterparty must be a different non-zero address.')
  if (symbol !== SUPPORTED_SYMBOL) throw new Error('Only BTC/USD is supported.')
  if (!['ABOVE', 'BELOW', 'AT_OR_ABOVE', 'AT_OR_BELOW', 'IN_RANGE'].includes(String(conditionType))) throw new Error('Condition is unsupported.')
  if (typeof thresholdLowInput !== 'string' || typeof thresholdHighInput !== 'string') throw new Error('Thresholds must be decimal strings.')
  const lowScaled = scaleThresholdInput(thresholdLowInput)
  if (conditionType === 'IN_RANGE') {
    const highScaled = scaleThresholdInput(thresholdHighInput)
    if (BigInt(lowScaled) > BigInt(highScaled)) throw new Error('Lower threshold cannot exceed upper threshold.')
  } else if (thresholdHighInput !== '' && thresholdHighInput !== '0') {
    throw new Error('Upper threshold must be empty or zero for this condition.')
  }
  if (!Number.isSafeInteger(validFrom) || Number(validFrom) < 0) throw new Error('Valid-from timestamp is invalid.')
  if (!Number.isSafeInteger(expiry) || Number(expiry) <= nowSeconds) throw new Error('Expiry must be in the future.')
  if (Number(validFrom) > Number(expiry)) throw new Error('Valid-from cannot be after expiry.')
  if (Number(expiry) - nowSeconds > MAX_VALIDITY_SECONDS) throw new Error('Expiry cannot be more than 365 days away.')
  if (minimumConfidence !== 'HIGH') throw new Error('Minimum confidence must be HIGH.')
  if (!Number.isSafeInteger(maximumSpreadBps) || Number(maximumSpreadBps) < 0 || Number(maximumSpreadBps) > 100) throw new Error('Maximum spread must be an integer from 0 to 100 bps.')
  if (typeof memo !== 'string' || memo.length > 280) throw new Error('Memo cannot exceed 280 characters.')
  if (typeof externalReferenceHash !== 'string' || (externalReferenceHash !== '' && !/^0x[0-9a-f]{64}$/.test(externalReferenceHash))) throw new Error('External reference must be an empty value or a lowercase 32-byte hash.')
  if (typeof revisionOf !== 'string' || (revisionOf !== '' && !/^cov_[0-9a-f]{48}$/.test(revisionOf))) throw new Error('Revision must be an empty value or a canonical covenant ID.')
  return {
    clientRequestId,
    mode,
    counterparty,
    symbol,
    conditionType,
    thresholdLowInput,
    thresholdHighInput,
    validFrom,
    expiry,
    minimumConfidence,
    maximumSpreadBps,
    memo,
    externalReferenceHash,
    revisionOf,
  }
}

export function createCovenantValidation(input, wallet, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    parseCreateTerms([
      input.request,
      input.mode,
      input.mode === 'PERSONAL' ? ZERO_ADDRESS : input.counterparty,
      SUPPORTED_SYMBOL,
      input.condition,
      input.low,
      input.condition === 'IN_RANGE' ? input.high : '',
      input.validFrom,
      input.expiry,
      'HIGH',
      input.spread,
      input.memo || '',
      input.reference || '',
      input.revision || '',
    ], wallet, nowSeconds)
    return true
  } catch {
    return false
  }
}

export function previewState(wallet, request, storedKey, status) {
  const key = `${String(wallet || '').toLowerCase()}:${String(request)}`
  return {
    key,
    usable: Boolean(wallet && status === 'READY' && storedKey === key),
    pending: status === 'PENDING',
    failed: status === 'FAILED',
  }
}
