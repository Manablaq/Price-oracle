export const SUBMISSION_STAGES = [
  'PREPARATION',
  'CLIENT_INITIALIZATION',
  'NETWORK_VERIFICATION',
  'WALLET_SUBMISSION',
  'HASH_VALIDATION',
] as const

export type SubmissionStage = typeof SUBMISSION_STAGES[number]

export const SUBMISSION_STAGE_LABELS: Record<SubmissionStage, string> = {
  PREPARATION: 'Preparation',
  CLIENT_INITIALIZATION: 'Client initialization',
  NETWORK_VERIFICATION: 'Network verification',
  WALLET_SUBMISSION: 'Wallet submission',
  HASH_VALIDATION: 'Transaction hash validation',
}

export type NormalizedUnknownError = {
  message: string
  code?: string
  technicalDetails?: string
}

const FALLBACK_MESSAGE = 'The submission could not be completed. No additional error information was provided.'
const MAX_DEPTH = 5
const MAX_MESSAGE_LENGTH = 480
const MAX_TECHNICAL_LENGTH = 720
const MESSAGE_FIELDS = ['message', 'shortMessage', 'details', 'reason'] as const

function safeProperty(value: object, key: string): unknown {
  try {
    return Reflect.get(value, key)
  } catch {
    return undefined
  }
}

function redactSensitiveText(value: string) {
  const withoutStack = value
    .split(/\r?\n/)
    .filter(line => !/^\s*at\s+/i.test(line))
    .join(' ')
  return withoutStack
    .replace(/(["']?(?:private[_ -]?key|secret|seed[_ -]?phrase|mnemonic|signature|raw(?:[_ -]?signed)?[_ -]?transaction|transaction[_ -]?payload|request[_ -]?payload)["']?(?:\s*[:=]\s*|\s+(?:is|was)\s+))(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[redacted]')
    .replace(/\b(?:bearer\s+)[a-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/0x[0-9a-f]{128,}/gi, '[redacted hex payload]')
    .replace(/\s+/g, ' ')
    .trim()
}

function boundedText(value: unknown, limit: number) {
  if (typeof value !== 'string') return ''
  const safe = redactSensitiveText(value)
  if (!safe) return ''
  return safe.length <= limit ? safe : `${safe.slice(0, limit - 1).trimEnd()}…`
}

function safeCode(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') return ''
  const code = boundedText(String(value), 80)
  return /^[\w.:-]+$/.test(code) ? code : ''
}

/**
 * Extracts only known-safe wallet/RPC error fields. It never serializes the
 * thrown value, and both traversal depth and rendered text are bounded.
 */
export function normalizeUnknownError(error: unknown): NormalizedUnknownError {
  const seen = new WeakSet<object>()
  const messages: string[] = []
  let code = ''

  const addMessage = (value: unknown) => {
    const message = boundedText(value, MAX_MESSAGE_LENGTH)
    if (message && !messages.includes(message)) messages.push(message)
  }

  const visit = (value: unknown, depth: number) => {
    if (depth > MAX_DEPTH) return
    if (typeof value === 'string') {
      addMessage(value)
      return
    }
    if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return
    const object = value as object
    if (seen.has(object)) return
    seen.add(object)

    for (const field of MESSAGE_FIELDS) addMessage(safeProperty(object, field))
    if (!code) code = safeCode(safeProperty(object, 'code'))

    const data = safeProperty(object, 'data')
    if (typeof data === 'object' && data !== null) addMessage(safeProperty(data, 'message'))

    const nestedError = safeProperty(object, 'error')
    if (typeof nestedError === 'string') addMessage(nestedError)
    else visit(nestedError, depth + 1)
    visit(safeProperty(object, 'cause'), depth + 1)
  }

  visit(error, 0)
  const message = messages[0] ?? FALLBACK_MESSAGE
  const secondary = messages.slice(1).join(' · ')
  return {
    message,
    ...(code ? { code } : {}),
    ...(secondary ? { technicalDetails: boundedText(secondary, MAX_TECHNICAL_LENGTH) } : {}),
  }
}

export class SubmissionStageError extends Error {
  readonly stage: SubmissionStage
  readonly safe: NormalizedUnknownError
  override readonly cause: unknown

  constructor(stage: SubmissionStage, cause: unknown) {
    const safe = normalizeUnknownError(cause)
    super(safe.message)
    this.name = 'SubmissionStageError'
    this.stage = stage
    this.safe = safe
    this.cause = cause
  }
}

export function isSubmissionStageError(error: unknown): error is SubmissionStageError {
  return error instanceof SubmissionStageError
    || (typeof error === 'object'
      && error !== null
      && safeProperty(error, 'name') === 'SubmissionStageError'
      && SUBMISSION_STAGES.includes(safeProperty(error, 'stage') as SubmissionStage))
}

export function submissionErrorTitle(stage: SubmissionStage) {
  if (stage === 'WALLET_SUBMISSION') return 'Wallet submission failed'
  if (stage === 'HASH_VALIDATION') return 'Transaction hash validation failed'
  return `${SUBMISSION_STAGE_LABELS[stage]} failed`
}

export function isValidTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}
