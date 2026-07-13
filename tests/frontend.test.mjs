import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import {
  actionAllowed,
  activityNamespace,
  attestationHasNext,
  attestationId,
  attestationRoute,
  classifyTransaction,
  covenantId,
  createCovenantValidation,
  cursorsChanged,
  formatFixed,
  marketState,
  mergeActivity,
  mergeCovenantPages,
  nextCovenantCursors,
  parseCreateTerms,
  previewState,
  scaleThresholdInput,
  sourceHasNext,
  stateTone,
  ZERO_ADDRESS,
} from '../lib/priceguard-core.mjs'
import {
  isActivity,
  isAttestation,
  isAttestationPage,
  isAttestationResult,
  isCovenant,
  isCovenantPage,
  isCovenantResult,
  isMarketResult,
  isProtocolStats,
  parseContractJson,
} from '../lib/types.ts'
import {
  isValidTransactionHash,
  normalizeUnknownError,
  SUBMISSION_STAGE_LABELS,
  SUBMISSION_STAGES,
  SubmissionStageError,
  submissionErrorTitle,
} from '../lib/submission-errors.ts'

const addressA = '0x1111111111111111111111111111111111111111'
const addressB = '0x2222222222222222222222222222222222222222'
const covenantIdA = `cov_${'a'.repeat(48)}`
const attestationIdA = `att_${'b'.repeat(48)}`

const market = () => ({
  found: true,
  symbol: 'BTC/USD',
  asset_class: 'CRYPTO_SPOT',
  decimals: 2,
  policy_version: 'BTCUSD-1',
  observations: [
    { source: 'bitstamp', price: '7000100', observed_at: '1783944000' },
    { source: 'coinbase', price: '7000000', observed_at: '1783944000' },
    { source: 'gemini', price: '6999900', observed_at: '1783944000' },
  ],
  valid_source_count: 3,
  rejected_source_count: 0,
  median_price: '7000000',
  minimum_observation: '6999900',
  maximum_observation: '7000100',
  spread_bps: 2,
  confidence: 'HIGH',
  circuit_breaker: false,
  transaction_epoch: '1783944000',
  update_sequence: '1',
  updater: addressA,
})

const covenant = (overrides = {}) => ({
  covenant_id: covenantIdA,
  client_request_id: 'request_1',
  mode: 'PERSONAL',
  creator: addressA,
  counterparty: ZERO_ADDRESS,
  symbol: 'BTC/USD',
  condition_type: 'BELOW',
  threshold_low: '7000000',
  threshold_high: '0',
  decimals: 2,
  valid_from: '0',
  expiry: '1783947600',
  minimum_confidence: 'HIGH',
  maximum_spread_bps: 50,
  status: 'ACTIVE',
  accepted_at: '0',
  last_evaluated_at: '0',
  evaluation_count: '0',
  trigger_snapshot_sequence: '0',
  trigger_attestation_id: '',
  triggered_at: '0',
  creator_acknowledged: false,
  counterparty_acknowledged: false,
  closed_at: '0',
  memo: '',
  external_reference_hash: '',
  revision_of: '',
  policy_version: 'BTCUSD-1',
  ...overrides,
})

const attestation = (overrides = {}) => ({
  schema_version: 'priceguard-attestation-1',
  attestation_id: attestationIdA,
  covenant_id: covenantIdA,
  evaluation_sequence: 1,
  outcome: 'NOT_SATISFIED',
  symbol: 'BTC/USD',
  condition_type: 'BELOW',
  threshold_low: '7000000',
  threshold_high: '0',
  evaluated_price: '7100000',
  decimals: 2,
  snapshot_sequence: '2',
  valid_source_count: 3,
  source_identities: ['coinbase', 'bitstamp', 'gemini'],
  minimum_observation: '7099900',
  maximum_observation: '7100100',
  spread_bps: 2,
  confidence: 'HIGH',
  circuit_breaker: false,
  policy_version: 'BTCUSD-1',
  evaluated_at: '1783944100',
  evaluator: addressB,
  ...overrides,
})

const personalArgs = (overrides = {}) => {
  const values = {
    request: 'request_1', mode: 'PERSONAL', counterparty: ZERO_ADDRESS,
    symbol: 'BTC/USD', condition: 'BELOW', low: '70000', high: '',
    validFrom: 0, expiry: 2000, confidence: 'HIGH', spread: 50,
    memo: '', reference: '', revision: '', ...overrides,
  }
  return [values.request, values.mode, values.counterparty, values.symbol, values.condition,
    values.low, values.high, values.validFrom, values.expiry, values.confidence,
    values.spread, values.memo, values.reference, values.revision]
}

test('unknown errors preserve safe messages from supported throw shapes', () => {
  assert.equal(normalizeUnknownError(new Error('Native failure')).message, 'Native failure')
  assert.equal(normalizeUnknownError('String failure').message, 'String failure')
  assert.equal(normalizeUnknownError({ message: 'Object failure' }).message, 'Object failure')
  assert.deepEqual(normalizeUnknownError({ shortMessage: 'Wallet rejected', code: 4001 }), {
    message: 'Wallet rejected',
    code: '4001',
  })
  assert.equal(normalizeUnknownError({ error: { message: 'Nested RPC failure' } }).message, 'Nested RPC failure')
  assert.equal(normalizeUnknownError({ cause: { cause: new Error('Root cause') } }).message, 'Root cause')
})

test('unknown error normalization is circular-safe, bounded, and redacts secrets', () => {
  const circular = { message: 'Circular failure' }
  circular.cause = circular
  assert.equal(normalizeUnknownError(circular).message, 'Circular failure')

  const huge = normalizeUnknownError({ message: 'x'.repeat(20_000) }).message
  assert.ok(huge.length <= 480)
  assert.match(huge, /…$/)

  const secret = '0x' + 'a'.repeat(130)
  const normalized = normalizeUnknownError({
    message: `Request failed; privateKey=${secret}; signature=${secret}; rawTransaction=${secret}`,
    privateKey: secret,
    signature: secret,
    request: { params: [secret] },
  })
  const displayed = JSON.stringify(normalized)
  assert.doesNotMatch(displayed, new RegExp(secret, 'i'))
  assert.doesNotMatch(displayed, /"request"|"privateKey"|"signature"/)
  assert.match(displayed, /\[redacted\]/)
})

test('submission stages have stable labels and typed stage errors', () => {
  assert.deepEqual(SUBMISSION_STAGES, [
    'PREPARATION',
    'CLIENT_INITIALIZATION',
    'NETWORK_VERIFICATION',
    'WALLET_SUBMISSION',
    'HASH_VALIDATION',
  ])
  assert.equal(SUBMISSION_STAGE_LABELS.WALLET_SUBMISSION, 'Wallet submission')
  assert.equal(submissionErrorTitle('WALLET_SUBMISSION'), 'Wallet submission failed')
  const cause = { shortMessage: 'User rejected', code: 4001 }
  const error = new SubmissionStageError('WALLET_SUBMISSION', cause)
  assert.equal(error.stage, 'WALLET_SUBMISSION')
  assert.equal(error.safe.code, '4001')
  assert.equal(error.cause, cause)
})

test('Activity persistence occurs only after a valid returned transaction hash', async () => {
  assert.equal(isValidTransactionHash(`0x${'a'.repeat(64)}`), true)
  for (const invalid of [undefined, null, '', '0x1234', `0x${'g'.repeat(64)}`, { hash: `0x${'a'.repeat(64)}` }]) {
    assert.equal(isValidTransactionHash(invalid), false)
  }

  const source = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  const validation = source.indexOf("runSubmissionStage('HASH_VALIDATION'")
  const activity = source.indexOf('const activity: Activity', validation)
  const persistence = source.indexOf('storeActivities(', activity)
  assert.ok(validation >= 0 && activity > validation && persistence > activity)
  assert.match(source.slice(validation, activity), /isValidTransactionHash\(returnedHash\)/)
})

test('submission uses the selected provider without a Snap-dependent client connect', async () => {
  const source = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  const submitStart = source.indexOf('const submit = useCallback')
  const submitEnd = source.indexOf('const injectedProviders', submitStart)
  const submit = source.slice(submitStart, submitEnd)

  assert.ok(submitStart >= 0 && submitEnd > submitStart)
  assert.doesNotMatch(submit, /client\.connect\(['"]testnetBradbury['"]\)/)
  assert.match(source, /createClient\(\{[\s\S]*chain: testnetBradbury,[\s\S]*account: wallet as `0x\$\{string\}`,[\s\S]*provider,[\s\S]*\}\)/)
  assert.match(submit, /createWriteClient\(submissionContext\.provider, submissionContext\.wallet\)/)
})

test('submit re-verifies Bradbury and the active account immediately before writing', async () => {
  const source = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  const submitStart = source.indexOf('const submit = useCallback')
  const submitEnd = source.indexOf('const injectedProviders', submitStart)
  const submit = source.slice(submitStart, submitEnd)
  const verification = submit.indexOf("runSubmissionStage('NETWORK_VERIFICATION'")
  const chainCheck = submit.indexOf("method: 'eth_chainId'", verification)
  const accountCheck = submit.indexOf("method: 'eth_accounts'", chainCheck)
  const accountMatch = submit.indexOf('activeAccount.toLowerCase() !== submissionContext.wallet.toLowerCase()', accountCheck)
  const write = submit.indexOf('writeClient.writeContract', accountMatch)

  assert.ok(verification >= 0 && chainCheck > verification && accountCheck > chainCheck && accountMatch > accountCheck && write > accountMatch)
  assert.match(submit.slice(chainCheck, write), /currentChain !== CHAIN_ID/)
  assert.match(submit.slice(accountCheck, write), /Reconnect the PriceGuard wallet before submitting/)
})

test('explicit Bradbury switching uses injected-provider RPC and adds only on code 4902', async () => {
  const [manager, config] = await Promise.all([
    readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/config.ts', import.meta.url), 'utf8'),
  ])
  const switchStart = manager.indexOf('const switchNetwork = useCallback')
  const switchEnd = manager.indexOf('\n  useEffect(', switchStart)
  const switchNetwork = manager.slice(switchStart, switchEnd)

  assert.ok(switchStart >= 0 && switchEnd > switchStart)
  assert.doesNotMatch(switchNetwork, /createWriteClient|client\.connect/)
  assert.match(switchNetwork, /method: 'wallet_switchEthereumChain'[\s\S]*chainId: BRADBURY_CHAIN_ID_HEX/)
  assert.match(switchNetwork, /normalizeUnknownError\(error\)\.code !== '4902'\) throw error[\s\S]*method: 'wallet_addEthereumChain'/)
  assert.equal((switchNetwork.match(/method: 'wallet_addEthereumChain'/g) ?? []).length, 1)
  assert.equal((switchNetwork.match(/method: 'wallet_switchEthereumChain'/g) ?? []).length, 2)

  assert.match(config, /BRADBURY_CHAIN_ID_HEX = '0x107d'/)
  assert.match(config, /chainName: 'GenLayer Bradbury'/)
  assert.match(config, /name: 'GEN',[\s\S]*symbol: 'GEN',[\s\S]*decimals: 18/)
  assert.match(config, /rpcUrls: \['https:\/\/rpc-bradbury\.genlayer\.com'\]/)
  assert.match(config, /blockExplorerUrls: \['https:\/\/explorer-bradbury\.genlayer\.com'\]/)
})

test('project application code contains no MetaMask Snap RPC methods', () => {
  const root = new URL('..', import.meta.url)
  const paths = execFileSync('rg', ['--files', 'components', 'lib', 'app'], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(path => /\.(?:ts|tsx|js|jsx|mjs)$/.test(path))
  const combined = paths.map(path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n')
  for (const method of ['wallet_getSnaps', 'wallet_requestSnaps', 'wallet_invokeSnap', 'wallet_snap']) {
    assert.doesNotMatch(combined, new RegExp(method))
  }
})

test('failed covenant submission preserves controlled form values and restores retry controls', async () => {
  const [form, button] = await Promise.all([
    readFile(new URL('../components/NewCovenantForm.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/WriteButton.tsx', import.meta.url), 'utf8'),
  ])
  for (const value of ['request', 'mode', 'counterparty', 'condition', 'low', 'high', 'validFrom', 'expiry', 'spread', 'memo', 'reference', 'revision']) {
    assert.match(form, new RegExp(`value=\\{${value}\\}`), value)
  }
  assert.doesNotMatch(form, /await submit[\s\S]{0,500}set(?:Request|Mode|Counterparty|Condition|Low|High|ValidFrom|Expiry|Spread|Memo|Reference|Revision)/)
  assert.match(button, /const submissionLock = useRef\(false\)/)
  assert.match(button, /if \(submissionLock\.current\) return/)
  assert.match(button, /finally \{[\s\S]*submissionLock\.current = false[\s\S]*setSubmitting\(false\)/)
  assert.match(button, /disabled=\{disabled \|\| submitting \|\| pending/)
  assert.doesNotMatch(button, /autoSubmit|resubmit|setTimeout\([^)]*click/)
})

test('submission error UI is safe, staged, accessible, and explicit about Activity', async () => {
  const [source, normalizationSource] = await Promise.all([
    readFile(new URL('../components/WriteButton.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/submission-errors.ts', import.meta.url), 'utf8'),
  ])
  const logStart = source.indexOf("console.error('[PriceGuard submission]'")
  const logEnd = source.indexOf('\n        })', logStart)
  const logCall = source.slice(logStart, logEnd)
  assert.ok(logStart >= 0 && logEnd > logStart)
  assert.match(logCall, /stage: caught\.stage/)
  assert.match(logCall, /message: caught\.safe\.message/)
  assert.match(logCall, /caught\.safe\.code/)
  assert.match(logCall, /caught\.safe\.technicalDetails/)
  assert.doesNotMatch(logCall, /caught\.cause|\berror\s*:/)
  assert.doesNotMatch(`${source}\n${normalizationSource}`, /JSON\.stringify\((?:caught|error|cause|caught\.cause)/)
  assert.match(source, /Stage: <code>\{error\.stage\}<\/code>/)
  assert.match(source, /Provider\/RPC error code:/)
  assert.match(source, /No transaction hash was returned, so nothing was added to Activity\./)
  assert.match(source, /<details>[\s\S]*<summary>Technical details<\/summary>/)
  assert.match(source, /role="alert"/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test('PriceGuard contract has no working-tree diff', () => {
  assert.doesNotThrow(() => execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'contracts/priceguard.py'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'pipe',
  }))
})

test('formatFixed renders integer fixed-point values without floating point', () => {
  assert.equal(formatFixed('6283155', 2, { prefix: '$', trim: false }), '$62,831.55')
  assert.equal(formatFixed('10000', 2), '100')
  assert.equal(formatFixed('bad', 2), '—')
})

test('marketState distinguishes missing, stale, breaker, and verified snapshots', () => {
  assert.equal(marketState(null), 'UNVERIFIED')
  assert.equal(marketState({ found: true, circuit_breaker: true }), 'CIRCUIT_BREAKER')
  assert.equal(marketState({ found: true, circuit_breaker: false, transaction_epoch: '100' }, 500), 'STALE')
  assert.equal(marketState({ found: true, circuit_breaker: false, transaction_epoch: '450' }, 500), 'VERIFIED')
  assert.equal(stateTone('CONFIRMED'), 'positive')
  assert.equal(stateTone('EXECUTION_FAILED'), 'danger')
})

test('transaction classification follows GenLayer finality and execution result', () => {
  assert.deepEqual(classifyTransaction({ statusName: 'ACCEPTED', resultName: 'AGREE', txExecutionResultName: 'FINISHED_WITH_RETURN' }), { phase: 'CONFIRMATION', terminal: false })
  assert.deepEqual(classifyTransaction({ statusName: 'FINALIZED', resultName: 'AGREE', txExecutionResultName: 'FINISHED_WITH_RETURN' }), { phase: 'CONFIRMED', terminal: true })
  assert.deepEqual(classifyTransaction({ statusName: 'FINALIZED', resultName: 'MAJORITY_AGREE', txExecutionResultName: 'FINISHED_WITH_RETURN' }), { phase: 'CONFIRMED', terminal: true })
  assert.deepEqual(classifyTransaction({ statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN' }), { phase: 'CONFIRMED', terminal: true })
  assert.equal(classifyTransaction({ statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_ERROR' }).phase, 'EXECUTION_FAILED')
  assert.equal(classifyTransaction({ statusName: 'UNDETERMINED' }).phase, 'UNDETERMINED')
  assert.equal(classifyTransaction({ statusName: 'VALIDATORS_TIMEOUT' }).terminal, true)
  assert.equal(classifyTransaction({ statusName: 'FINALIZED', resultName: 'NO_MAJORITY', txExecutionResultName: 'FINISHED_WITH_RETURN' }).phase, 'UNDETERMINED')
})

test('activity namespace and merge isolate accounts and keep the newest record', () => {
  assert.notEqual(activityNamespace(4221, addressA, addressA), activityNamespace(4221, addressA, addressB))
  const merged = mergeActivity([{ hash: '0x1', updatedAt: 1, phase: 'PROCESSING' }], [{ hash: '0x1', updatedAt: 2, phase: 'CONFIRMED' }])
  assert.equal(merged[0].phase, 'CONFIRMED')
})

test('canonical threshold scaling matches the contract', () => {
  assert.equal(scaleThresholdInput('1'), '100')
  assert.equal(scaleThresholdInput('1.2'), '120')
  assert.equal(scaleThresholdInput('1.25'), '125')
  assert.equal(scaleThresholdInput('001'), '100')
  assert.equal(scaleThresholdInput('0001.20'), '120')
  assert.equal(scaleThresholdInput('70000'), '7000000')
})

test('threshold scaling rejects invalid and out-of-range representations', () => {
  for (const value of ['0', '1.234', '1e2', '-1', '+1', '', '1234567890123']) {
    assert.throws(() => scaleThresholdInput(value), undefined, value)
  }
  assert.throws(() => scaleThresholdInput('1000000000000'))
})

test('parseCreateTerms accepts exact PERSONAL and BILATERAL ABI inputs', () => {
  const personal = parseCreateTerms(personalArgs(), addressA, 1000)
  assert.equal(personal.mode, 'PERSONAL')
  const bilateral = parseCreateTerms(personalArgs({ mode: 'BILATERAL', counterparty: addressB }), addressA, 1000)
  assert.equal(bilateral.counterparty, addressB)
})

test('parseCreateTerms enforces ABI length, mode, counterparty, and symbol', () => {
  assert.throws(() => parseCreateTerms(['short'], addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ mode: 'OTHER' }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ counterparty: addressB }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ mode: 'BILATERAL', counterparty: ZERO_ADDRESS }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ mode: 'BILATERAL', counterparty: addressA }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ symbol: 'ETH/USD' }), addressA, 1000))
})

test('parseCreateTerms enforces conditions and range thresholds', () => {
  assert.throws(() => parseCreateTerms(personalArgs({ condition: 'UNKNOWN' }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ condition: 'IN_RANGE', high: '' }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ condition: 'IN_RANGE', low: '2', high: '1' }), addressA, 1000))
  assert.doesNotThrow(() => parseCreateTerms(personalArgs({ condition: 'IN_RANGE', low: '1', high: '1' }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ condition: 'BELOW', high: '2' }), addressA, 1000))
})

test('parseCreateTerms enforces timestamps, spread, memo, reference, and revision', () => {
  assert.throws(() => parseCreateTerms(personalArgs({ expiry: 1000 }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ validFrom: 3000, expiry: 2000 }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ expiry: 1000 + 31536001 }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ spread: 1.5 }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ spread: 101 }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ memo: 'x'.repeat(281) }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ reference: `0x${'A'.repeat(64)}` }), addressA, 1000))
  assert.throws(() => parseCreateTerms(personalArgs({ revision: 'cov_bad' }), addressA, 1000))
})

test('createCovenantValidation delegates to production parsing rules', () => {
  const input = { request: 'r_1', mode: 'PERSONAL', counterparty: '', condition: 'BELOW', low: '1.25', high: '', validFrom: 0, expiry: 2000, spread: 50, memo: '', reference: '', revision: '' }
  assert.equal(createCovenantValidation(input, addressA, 1000), true)
  assert.equal(createCovenantValidation({ ...input, low: '1.234' }, addressA, 1000), false)
})

test('ID vectors shared with the contract remain exact', async () => {
  const vectors = JSON.parse(await readFile(new URL('./fixtures/id_vectors.json', import.meta.url), 'utf8'))
  for (const vector of vectors) {
    assert.equal(await covenantId(vector.creator, vector.request), vector.covenant_id)
    for (const [sequence, expected] of Object.entries(vector.attestations)) {
      assert.equal(await attestationId(vector.covenant_id, Number(sequence)), expected)
    }
  }
})

test('preview state only allows the current wallet/request hash', () => {
  assert.equal(previewState(addressA, 'r', `${addressA}:r`, 'READY').usable, true)
  assert.equal(previewState(addressA, 'r', `${addressA}:old`, 'READY').usable, false)
  assert.equal(previewState(addressA, 'r', `${addressA}:r`, 'PENDING').usable, false)
  assert.equal(previewState('', 'r', ':r', 'READY').usable, false)
})

test('covenant page merge preserves roles and deterministic ordering', () => {
  const first = covenant({ covenant_id: `cov_${'a'.repeat(48)}` })
  const second = covenant({ covenant_id: `cov_${'b'.repeat(48)}`, mode: 'BILATERAL', counterparty: addressB })
  const merged = mergeCovenantPages({ items: [second, first] }, { items: [first] })
  assert.deepEqual(merged.map(item => item.covenant_id), [first.covenant_id, second.covenant_id])
  assert.equal(merged[0].role, 'CREATOR_AND_COUNTERPARTY')
  assert.equal(merged[1].role, 'CREATOR')
})

test('independent covenant cursors do not repeat exhausted source pages', () => {
  const state = { creatorOffset: 0, counterpartyOffset: 0 }
  const creatorPage = { items: [1, 2], offset: 0, limit: 50, total: 2 }
  const counterpartyPage = { items: Array.from({ length: 50 }), offset: 0, limit: 50, total: 100 }
  const next = nextCovenantCursors(state, creatorPage, counterpartyPage)
  assert.deepEqual(next, { creatorOffset: 2, counterpartyOffset: 50 })
  assert.equal(cursorsChanged(state, next), true)
  assert.equal(sourceHasNext(creatorPage), false)
  assert.equal(sourceHasNext(counterpartyPage), true)
})

test('attestation pagination uses retained count rather than total-ever count', () => {
  assert.equal(attestationHasNext({ offset: 0, items: Array.from({ length: 50 }), retained: 51, total: 1000 }), true)
  assert.equal(attestationHasNext({ offset: 50, items: [1], retained: 51, total: 1000 }), false)
})

test('action authorization mirrors contract roles and time windows', () => {
  const pending = covenant({ mode: 'BILATERAL', counterparty: addressB, status: 'PENDING_ACCEPTANCE', expiry: '2000' })
  assert.equal(actionAllowed('accept', pending, addressB, 1500), true)
  assert.equal(actionAllowed('accept', pending, addressA, 1500), false)
  assert.equal(actionAllowed('accept', pending, addressB, 2001), false)
  assert.equal(actionAllowed('cancel', pending, addressA, 1500), true)
  assert.equal(actionAllowed('expire', pending, addressA, 2001), true)
  const active = covenant({ status: 'ACTIVE', valid_from: '1200', expiry: '2000' })
  assert.equal(actionAllowed('evaluate', active, addressB, 1199), false)
  assert.equal(actionAllowed('evaluate', active, addressB, 1500), true)
  assert.equal(actionAllowed('evaluate', active, addressB, 2001), false)
  const triggered = covenant({ status: 'TRIGGERED' })
  assert.equal(actionAllowed('acknowledge', triggered, addressA, 1500), true)
  assert.equal(actionAllowed('acknowledge', { ...triggered, creator_acknowledged: true }, addressA, 1500), false)
  assert.equal(actionAllowed('accept', pending, addressB, 1500, false, true), false)
})

test('contract JSON parsing fails closed', () => {
  assert.deepEqual(parseContractJson('{"found":false,"symbol":"BTC/USD"}'), { found: false, symbol: 'BTC/USD' })
  assert.equal(parseContractJson('{bad'), null)
})

test('market result guards accept exact schemas and reject extra or missing fields', () => {
  assert.equal(isMarketResult({ found: false, symbol: 'BTC/USD' }), true)
  assert.equal(isMarketResult(market()), true)
  assert.equal(isMarketResult({ ...market(), transaction_datetime: 'not-in-contract' }), false)
  const missing = market(); delete missing.policy_version
  assert.equal(isMarketResult(missing), false)
  assert.equal(isMarketResult({ ...market(), valid_source_count: '3' }), false)
  assert.equal(isMarketResult({ ...market(), observations: [market().observations[1], market().observations[0], market().observations[2]] }), false)
  const medium = market()
  medium.observations = medium.observations.slice(0, 2)
  medium.valid_source_count = 2
  medium.rejected_source_count = 1
  medium.confidence = 'MEDIUM'
  assert.equal(isMarketResult(medium), true)
  assert.equal(isMarketResult({ ...medium, confidence: 'HIGH' }), false)
})

test('covenant guards distinguish exact found and not-found results', () => {
  assert.equal(isCovenant(covenant()), true)
  assert.equal(isCovenantResult({ found: false, covenant_id: covenantIdA }), true)
  assert.equal(isCovenantResult({ found: true, ...covenant() }), true)
  assert.equal(isCovenantResult({ found: false, covenant_id: covenantIdA, status: 'ACTIVE' }), false)
  assert.equal(isCovenant({ ...covenant(), status: 'UNKNOWN' }), false)
  assert.equal(isCovenant({ ...covenant(), unexpected: true }), false)
})

test('attestation guards enforce exact certificate schema', () => {
  assert.equal(isAttestation(attestation()), true)
  assert.equal(isAttestationResult({ found: false, attestation_id: attestationIdA }), true)
  assert.equal(isAttestationResult({ found: true, ...attestation() }), true)
  assert.equal(isAttestation({ ...attestation(), outcome: 'UNKNOWN' }), false)
  assert.equal(isAttestation({ ...attestation(), source_identities: ['gemini', 'bitstamp', 'coinbase'] }), false)
  assert.equal(isAttestation({ ...attestation(), extra: true }), false)
})

test('page guards enforce offsets, limits, totals, and retained counts', () => {
  assert.equal(isCovenantPage({ items: [covenant()], offset: 0, limit: 50, total: 1 }), true)
  assert.equal(isCovenantPage({ items: [covenant()], offset: -1, limit: 50, total: 1 }), false)
  assert.equal(isAttestationPage({ items: [attestation()], offset: 0, limit: 50, total: 10, retained: 1 }), true)
  assert.equal(isAttestationPage({ items: [], offset: 0, limit: 50, total: 1, retained: 2 }), false)
})

test('protocol stats guard exactly matches get_protocol_stats', () => {
  const stats = {
    protocol_version: 'priceguard-covenant-1', policy_version: 'BTCUSD-1',
    market_update_count: '0', covenant_count: '0', personal_count: '0', bilateral_count: '0',
    pending_count: '0', active_count: '0', triggered_count: '0', expired_count: '0',
    canceled_count: '0', closed_count: '0', attestation_count: '0', custody: false,
  }
  assert.equal(isProtocolStats(stats), true)
  assert.equal(isProtocolStats({ ...stats, custody: true }), false)
  assert.equal(isProtocolStats({ ...stats, update_sequence: '0' }), false)
})

test('activity guard rejects corrupt persisted records', () => {
  const record = {
    hash: `0x${'a'.repeat(64)}`, chainId: 4221, contract: addressA, wallet: addressB,
    action: 'refresh', functionName: 'refresh_market', phase: 'PROCESSING',
    submittedAt: 1, updatedAt: 2, terminal: false,
  }
  assert.equal(isActivity(record), true)
  assert.equal(isActivity({ ...record, phase: 'MADE_UP' }), false)
  assert.equal(isActivity({ ...record, wallet: 'bad' }), false)
})

test('attestation route includes the exact certificate ID', () => {
  assert.equal(attestationRoute(attestationIdA), `/attestations/${attestationIdA}`)
})

test('responsive and reduced-motion safeguards remain present', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /\.code-block\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s)
  assert.match(css, /\.form-grid code\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/s)
})

test('transaction context exposes a real app-session disconnect', async () => {
  const source = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  assert.match(source, /disconnect:\s*\(\)\s*=>\s*void/)
  assert.match(source, /const disconnect = useCallback\(\(\) => \{[\s\S]*setWallet\(''\)[\s\S]*setActivities\(\[\]\)/)
  assert.match(source, /value=\{\{[\s\S]*connect, disconnect, selectProvider/)
  assert.doesNotMatch(source, /wallet_revokePermissions|wallet_requestPermissions/)
  assert.doesNotMatch(source, /(?:removeItem|clear)\(storageKey\)/)
})

test('manual disconnect blocks automatic account hydration until connect', async () => {
  const source = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  assert.match(source, /localStorage\.getItem\('priceguard:manually-disconnected'\) === 'true'/)
  assert.match(source, /if \(!manuallyDisconnected\.current\) \{[\s\S]*method: 'eth_accounts'/)
  assert.match(source, /const onAccounts[\s\S]*if \(manuallyDisconnected\.current\) return/)
  assert.match(source, /const connect[\s\S]*eth_requestAccounts[\s\S]*manuallyDisconnected\.current = false[\s\S]*removeItem\('priceguard:manually-disconnected'\)/)
  assert.match(source, /const disconnect[\s\S]*localStorage\.setItem\('priceguard:manually-disconnected', 'true'\)/)
})

test('wallet shell uses one disconnected trigger and one connected account trigger', async () => {
  const source = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(source, /className="wallet-connect-trigger"[\s\S]{0,180}<span>Connect wallet<\/span>/)
  assert.match(source, /className=\{`account-trigger/)
  assert.match(source, /aria-label=\{`\$\{wrongNetwork[\s\S]*\$\{wallet\}[\s\S]*\$\{selectedProvider\?\.name/)
  assert.match(source, /aria-expanded=\{accountOpen\}/)
  assert.match(source, /aria-haspopup="menu"/)
  assert.doesNotMatch(source, /<select|wallet-picker|wallet-controls|wallet-address/)
  assert.doesNotMatch(source, />Wallet<\/span>/)
})

test('disconnect is an account-menu action rather than a permanent header peer', async () => {
  const source = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(source, /id="wallet-account-menu"[\s\S]*role="menu"/)
  assert.match(source, /className="disconnect-action"[\s\S]*Disconnect from PriceGuard/)
  assert.match(source, /closeAccountMenu\(\); disconnect\(\)/)
  assert.match(source, /does not revoke this site&apos;s permission inside your wallet extension/)
})

test('standard EIP-6963 announcements and fallback drive stable provider metadata', async () => {
  const manager = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  const shell = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(manager, /eip6963:announceProvider/)
  assert.match(manager, /eip6963:requestProvider/)
  assert.match(manager, /const legacyProvider = window\.ethereum/)
  assert.match(manager, /uuid\?: unknown; name\?: unknown; icon\?: unknown; rdns\?: unknown/)
  assert.match(manager, /announced = new Map/)
  assert.match(manager, /safeProviderIcon/)
  assert.match(manager, /data:image/)
  assert.match(manager, /base64/)
  assert.doesNotMatch(manager, /window\.ethereum\.providers/)
  assert.match(shell, /injectedProviders\.map\(provider => <button/)
  assert.match(shell, /provider-option/)
  assert.match(shell, /Detected/)
})

test('provider selection and connection resolve the same deterministic provider', async () => {
  const manager = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  const shell = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(manager, /connect: \(providerId\?: string\) => Promise<void>/)
  assert.match(manager, /const option = providerId[\s\S]*options\.find\(item => item\.id === providerId\)/)
  assert.match(manager, /option\.provider\.request\(\{ method: 'eth_requestAccounts' \}\)/)
  assert.match(shell, /selectProvider\(providerId\)[\s\S]*await connect\(providerId\)/)
  assert.doesNotMatch(shell, /selectProvider\(providerId\)[\s\S]{0,80}await connect\(\)/)
})

test('connect dialog lists providers and exposes accessible close behavior', async () => {
  const source = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(source, /role="dialog" aria-modal="true"/)
  assert.match(source, /aria-labelledby="connect-wallet-title" aria-describedby="connect-wallet-description"/)
  assert.match(source, /id="connect-wallet-title">Connect wallet/)
  assert.match(source, /No injected wallet detected/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /event\.target === event\.currentTarget/)
  assert.match(source, /modalReturnFocusRef\.current/)
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/)
})

test('account menu includes identity, network, copy, switch, and disconnect actions', async () => {
  const source = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(source, /Connected with/)
  assert.match(source, /<code title=\{wallet\}>\{wallet\}<\/code>/)
  assert.match(source, /Current network/)
  assert.match(source, /Copy address/)
  assert.match(source, /wrongNetwork && <button[\s\S]*Switch to Bradbury/)
  assert.match(source, /Disconnect from PriceGuard/)
  assert.match(source, /navigator\.clipboard\?\.writeText/)
  assert.match(source, /Copied/)
  assert.match(source, /document\.addEventListener\('pointerdown'/)
  assert.match(source, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/)
})

test('wallet errors are normalized and unsupported wallet APIs stay absent', async () => {
  const sources = await Promise.all([
    '../components/AppShell.tsx',
    '../components/TransactionManager.tsx',
    '../package.json',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  const combined = sources.join('\n')
  assert.match(combined, /Connection request was declined in your wallet/)
  assert.match(combined, /Network switch was declined in your wallet/)
  assert.match(combined, /This wallet does not support automatic network switching/)
  assert.match(combined, /\(code \$\{code\}\)/)
  assert.match(combined, /wallet is no longer available/)
  assert.doesNotMatch(combined, /WalletConnect|wallet_revokePermissions|wallet_requestPermissions|dangerouslySetInnerHTML/)
})

test('covenant list and authoring routes keep creation navigation visible', async () => {
  const listPage = await readFile(new URL('../app/covenants/page.tsx', import.meta.url), 'utf8')
  const newPage = await readFile(new URL('../app/covenants/new/page.tsx', import.meta.url), 'utf8')
  const list = await readFile(new URL('../components/CovenantList.tsx', import.meta.url), 'utf8')
  assert.match(listPage, /href="\/covenants\/new"[^>]*>Create covenant/)
  assert.match(list, /href="\/covenants\/new"[^>]*>Create your first covenant/)
  assert.match(newPage, /href="\/covenants"[^>]*>← Back to covenants/)
})

test('wallet surfaces retain mobile containment and touch safeguards', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.wallet-area\s*\{[^}]*min-width:\s*0/s)
  assert.match(css, /\.wallet-connect-trigger, \.account-trigger\s*\{[^}]*min-height:\s*42px/s)
  assert.match(css, /\.account-actions button\s*\{[^}]*min-height:\s*42px/s)
  assert.match(css, /\.dialog-close\s*\{[^}]*width:\s*42px;[^}]*height:\s*42px/s)
  assert.match(css, /\.account-menu\s*\{[^}]*width:\s*min\(360px, calc\(100vw - 28px\)\)/s)
  assert.match(css, /\.wallet-dialog\s*\{[^}]*width:\s*min\(100%, 480px\)[^}]*max-height:\s*calc\(100dvh - 40px\)/s)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*\.01ms/s)
})

test('active public deployment docs and verification page contain no undeployed V2 claim', async () => {
  const publicSources = await Promise.all([
    '../README.md',
    '../docs/BRADBURY_DEPLOYMENT.md',
    '../docs/SECURITY.md',
    '../docs/REVIEW_FIX.md',
    '../app/about/verification/page.tsx',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  const combined = publicSources.join('\n')
  assert.doesNotMatch(combined, /V2 (?:is|remains) (?:not deployed|undeployed)/i)
  assert.match(combined, /0x7B939483E69ada6d2ca37acd3684182Ed141F35F/)
  assert.match(combined, /full covenant[\s\S]{0,120}(?:remains unverified|has not yet been verified)/i)
})
