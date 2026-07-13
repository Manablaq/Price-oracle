import test from 'node:test'
import assert from 'node:assert/strict'
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
  assert.match(source, /const connect[\s\S]*manuallyDisconnected\.current = false[\s\S]*eth_requestAccounts/)
  assert.match(source, /const disconnect[\s\S]*localStorage\.setItem\('priceguard:manually-disconnected', 'true'\)/)
})

test('wallet shell renders explicit connect, switch, address, and disconnect controls', async () => {
  const source = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(source, /Wallet unavailable/)
  assert.match(source, /Connect wallet/)
  assert.match(source, /Switch to Bradbury/)
  assert.match(source, /wallet-address/)
  assert.match(source, />Disconnect<\/button>/)
  assert.match(source, /type="button"/)
  assert.doesNotMatch(source, /wrongNetwork \? switchNetwork\(\) : connect\(\)/)
})

test('standard injected-provider announcements drive wallet selection', async () => {
  const manager = await readFile(new URL('../components/TransactionManager.tsx', import.meta.url), 'utf8')
  const shell = await readFile(new URL('../components/AppShell.tsx', import.meta.url), 'utf8')
  assert.match(manager, /eip6963:announceProvider/)
  assert.match(manager, /eip6963:requestProvider/)
  assert.doesNotMatch(manager, /window\.ethereum\.providers/)
  assert.match(shell, /Select injected wallet provider/)
})

test('covenant list and authoring routes keep creation navigation visible', async () => {
  const listPage = await readFile(new URL('../app/covenants/page.tsx', import.meta.url), 'utf8')
  const newPage = await readFile(new URL('../app/covenants/new/page.tsx', import.meta.url), 'utf8')
  const list = await readFile(new URL('../components/CovenantList.tsx', import.meta.url), 'utf8')
  assert.match(listPage, /href="\/covenants\/new"[^>]*>Create covenant/)
  assert.match(list, /href="\/covenants\/new"[^>]*>Create your first covenant/)
  assert.match(newPage, /href="\/covenants"[^>]*>← Back to covenants/)
})

test('wallet controls retain mobile overflow and touch safeguards', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /\.wallet-controls\s*\{[^}]*flex-wrap:\s*wrap/s)
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.wallet-area\s*\{[^}]*min-width:\s*0/s)
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.wallet-controls \.button, \.wallet-picker select\s*\{[^}]*min-height:\s*42px/s)
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
