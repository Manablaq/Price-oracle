'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CHAIN_ID, PRICEGUARD_V2_ADDRESS } from '@/lib/config'
import {
  actionAllowed,
  activityNamespace,
  classifyTransaction,
  covenantId,
  mergeActivity,
  parseCreateTerms,
} from '@/lib/priceguard-core.mjs'
import {
  isActivity,
  isCovenantResult,
  isMarketResult,
  parseContractJson,
  type Activity,
  type CreateTerms,
} from '@/lib/types'

type WriteArg = string | number | bigint | boolean

type SubmitSpec = {
  action: 'refresh' | 'create' | 'accept' | 'cancel' | 'evaluate' | 'expire' | 'acknowledge'
  functionName: string
  args: WriteArg[]
  covenantId?: string
}

type ContextValue = {
  wallet: string
  chainId: number | null
  providerAvailable: boolean
  injectedProviders: InjectedProviderInfo[]
  selectedProviderId: string
  connecting: boolean
  activities: Activity[]
  connect: (providerId?: string) => Promise<void>
  disconnect: () => void
  selectProvider: (id: string) => void
  switchNetwork: () => Promise<void>
  submit: (spec: SubmitSpec) => Promise<string>
  isPending: (action: string, covenantId?: string) => boolean
}

export type InjectedProviderInfo = {
  id: string
  name: string
  icon?: string
  rdns?: string
}

type InjectedProviderOption = InjectedProviderInfo & {
  provider: EthereumProvider
}

type ReadClient = {
  readContract: (args: {
    address: `0x${string}`
    functionName: string
    args: Array<string | number>
  }) => Promise<unknown>
  getTransaction: (args: { hash: `0x${string}` }) => Promise<unknown>
}

type WriteClient = ReadClient & {
  connect: (network: string) => Promise<unknown>
  writeContract: (args: {
    address: `0x${string}`
    functionName: string
    args: WriteArg[]
    value: bigint
  }) => Promise<`0x${string}`>
}

const Context = createContext<ContextValue>({
  wallet: '',
  chainId: null,
  providerAvailable: false,
  injectedProviders: [],
  selectedProviderId: '',
  connecting: false,
  activities: [],
  connect: async () => undefined,
  disconnect: () => undefined,
  selectProvider: () => undefined,
  switchNetwork: async () => undefined,
  submit: async () => '',
  isPending: () => false,
})

const FUNCTION_BY_ACTION: Record<SubmitSpec['action'], string> = {
  refresh: 'refresh_market',
  create: 'create_covenant',
  accept: 'accept_covenant',
  cancel: 'cancel_unaccepted_covenant',
  evaluate: 'evaluate_covenant',
  expire: 'expire_covenant',
  acknowledge: 'acknowledge_outcome',
}

const normalizeChainId = (value: unknown) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return null
  const parsed = Number.parseInt(value, 16)
  return Number.isSafeInteger(parsed) ? parsed : null
}

const safeProviderIcon = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 100_000) return undefined
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value) ? value : undefined
}

const readJson = async (client: ReadClient, address: `0x${string}`, functionName: string, args: Array<string | number>) =>
  parseContractJson(await client.readContract({ address, functionName, args }))

async function createReadClient(): Promise<ReadClient> {
  const { createClient } = await import('genlayer-js')
  const { testnetBradbury } = await import('genlayer-js/chains')
  return createClient({ chain: testnetBradbury }) as unknown as ReadClient
}

async function createWriteClient(provider: EthereumProvider, wallet: string): Promise<WriteClient> {
  const { createClient } = await import('genlayer-js')
  const { testnetBradbury } = await import('genlayer-js/chains')
  return createClient({
    chain: testnetBradbury,
    account: wallet as `0x${string}`,
    provider,
  }) as unknown as WriteClient
}

async function prepareSubmission(client: ReadClient, address: `0x${string}`, spec: SubmitSpec, wallet: string) {
  if (FUNCTION_BY_ACTION[spec.action] !== spec.functionName) throw new Error('Write action does not match the contract method.')
  const now = Math.floor(Date.now() / 1000)
  let expectedCovenantId = spec.covenantId
  let submittedCreateTerms: CreateTerms | undefined

  if (spec.action === 'refresh') {
    if (spec.args.length !== 1 || spec.args[0] !== 'BTC/USD') throw new Error('refresh_market only accepts BTC/USD.')
    const market = await readJson(client, address, 'get_market', ['BTC/USD'])
    if (!isMarketResult(market)) throw new Error('The contract returned malformed market state. The transaction was not sent.')
  } else if (spec.action === 'create') {
    submittedCreateTerms = parseCreateTerms(spec.args, wallet, now) as CreateTerms
    expectedCovenantId = await covenantId(wallet, submittedCreateTerms.clientRequestId)
    const existing = await readJson(client, address, 'get_covenant', [expectedCovenantId])
    if (!isCovenantResult(existing)) throw new Error('The contract returned malformed covenant state. The transaction was not sent.')
    if (existing.found) throw new Error('A covenant with this creator and request ID already exists.')
    if (submittedCreateTerms.revisionOf) {
      const revision = await readJson(client, address, 'get_covenant', [submittedCreateTerms.revisionOf])
      if (!isCovenantResult(revision) || !revision.found) throw new Error('The revision covenant does not exist.')
      if (revision.creator.toLowerCase() !== wallet.toLowerCase()) throw new Error('A revision must reference one of your own covenants.')
      if (revision.covenant_id === expectedCovenantId) throw new Error('A covenant cannot revise itself.')
    }
  } else {
    if (!spec.covenantId || spec.args.length !== 1 || spec.args[0] !== spec.covenantId) throw new Error('This action requires one exact covenant ID.')
    const result = await readJson(client, address, 'get_covenant', [spec.covenantId])
    if (!isCovenantResult(result) || !result.found) throw new Error('The covenant is missing or malformed. The transaction was not sent.')
    if (!actionAllowed(spec.action, result, wallet, now, true, true)) throw new Error('This action is not currently authorized by the covenant state or time window.')
  }

  return { expectedCovenantId, submittedCreateTerms }
}

async function checkPostState(client: ReadClient, address: `0x${string}`, activity: Activity) {
  try {
    if (activity.action === 'refresh') {
      const result = await readJson(client, address, 'get_market', ['BTC/USD'])
      if (!isMarketResult(result) || !result.found) return { stateCheck: 'MISMATCHED' as const, stateCheckMessage: 'Execution finalized, but a valid market snapshot could not be read.' }
      return { stateCheck: 'MATCHED' as const, stateCheckMessage: `Market snapshot sequence ${result.update_sequence} is readable.` }
    }

    const id = activity.expectedCovenantId ?? activity.covenantId
    if (!id) return { stateCheck: 'UNAVAILABLE' as const, stateCheckMessage: 'No covenant ID was stored for the supplementary state read.' }
    const result = await readJson(client, address, 'get_covenant', [id])
    if (!isCovenantResult(result) || !result.found) return { stateCheck: 'MISMATCHED' as const, stateCheckMessage: 'Execution finalized, but the covenant is not currently readable.' }

    if (activity.action === 'create') {
      const terms = activity.submittedCreateTerms
      const matched = Boolean(terms)
        && result.client_request_id === terms?.clientRequestId
        && result.creator.toLowerCase() === activity.wallet.toLowerCase()
      return matched
        ? { stateCheck: 'MATCHED' as const, stateCheckMessage: `Created covenant ${id} is readable.` }
        : { stateCheck: 'MISMATCHED' as const, stateCheckMessage: 'The readable covenant does not match the submitted creator/request pair.' }
    }
    if (activity.action === 'accept') return { stateCheck: result.accepted_at !== '0' ? 'MATCHED' as const : 'MISMATCHED' as const, stateCheckMessage: `Current status: ${result.status}.` }
    if (activity.action === 'cancel') return { stateCheck: result.status === 'CANCELED' ? 'MATCHED' as const : 'MISMATCHED' as const, stateCheckMessage: `Current status: ${result.status}.` }
    if (activity.action === 'expire') return { stateCheck: result.status === 'EXPIRED' ? 'MATCHED' as const : 'MISMATCHED' as const, stateCheckMessage: `Current status: ${result.status}.` }
    if (activity.action === 'evaluate') return { stateCheck: Number(result.evaluation_count) > 0 ? 'MATCHED' as const : 'MISMATCHED' as const, stateCheckMessage: `Current evaluation count: ${result.evaluation_count}.` }
    if (activity.action === 'acknowledge') {
      const me = activity.wallet.toLowerCase()
      const acknowledged = result.creator.toLowerCase() === me ? result.creator_acknowledged : result.counterparty.toLowerCase() === me && result.counterparty_acknowledged
      return { stateCheck: acknowledged ? 'MATCHED' as const : 'MISMATCHED' as const, stateCheckMessage: `Current status: ${result.status}.` }
    }
    return { stateCheck: 'UNAVAILABLE' as const, stateCheckMessage: 'No supplementary state check is defined.' }
  } catch (error) {
    return { stateCheck: 'UNAVAILABLE' as const, stateCheckMessage: error instanceof Error ? error.message : 'Post-finalization state read failed.' }
  }
}

export function TransactionManager({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [injectedProviderOptions, setInjectedProviderOptions] = useState<InjectedProviderOption[]>([])
  const [selectedProvider, setSelectedProvider] = useState<EthereumProvider | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const pollers = useRef(new Set<string>())
  const manuallyDisconnected = useRef(false)
  const sessionGeneration = useRef(0)
  const providerOptionsRef = useRef<InjectedProviderOption[]>([])
  const connectionRequestInFlight = useRef(false)

  const providerAvailable = Boolean(selectedProvider)

  useEffect(() => {
    manuallyDisconnected.current = localStorage.getItem('priceguard:manually-disconnected') === 'true'
    const legacyProvider = window.ethereum
    const announced = new Map<string, InjectedProviderOption>()
    let receivedEipProvider = false
    if (legacyProvider) announced.set('legacy-injected', { id: 'legacy-injected', name: 'Injected wallet', provider: legacyProvider })

    const publishProviders = () => {
      const options = [...announced.values()]
      providerOptionsRef.current = options
      setInjectedProviderOptions(options)
      setSelectedProviderId(current => current && options.some(option => option.id === current) ? current : options[0]?.id ?? '')
      setSelectedProvider(current => current && options.some(option => option.provider === current) ? current : options[0]?.provider ?? null)
    }
    publishProviders()

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<{ info?: { uuid?: unknown; name?: unknown; icon?: unknown; rdns?: unknown }; provider?: EthereumProvider }>).detail
      const info = detail?.info
      const uuid = typeof info?.uuid === 'string' ? info.uuid.trim() : ''
      const name = typeof info?.name === 'string' ? info.name.trim() : ''
      if (!uuid || !name || name.length > 80 || typeof detail.provider?.request !== 'function') return
      if (!receivedEipProvider) {
        announced.delete('legacy-injected')
        receivedEipProvider = true
      }
      for (const [id, option] of announced) {
        if (option.provider === detail.provider && id !== uuid) announced.delete(id)
      }
      announced.set(uuid, {
        id: uuid,
        name,
        icon: safeProviderIcon(info?.icon),
        rdns: typeof info?.rdns === 'string' && info.rdns.length <= 255 ? info.rdns : undefined,
        provider: detail.provider,
      })
      publishProviders()
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce)
  }, [])

  useEffect(() => {
    const ethereum = selectedProvider
    if (!ethereum) return

    sessionGeneration.current += 1
    setWallet('')
    setChainId(null)
    setActivities([])
    let mounted = true
    if (!manuallyDisconnected.current) {
      void Promise.all([
        ethereum.request({ method: 'eth_accounts' }),
        ethereum.request({ method: 'eth_chainId' }),
      ]).then(([accountsRaw, chainRaw]) => {
        if (!mounted || manuallyDisconnected.current) return
        const accounts = Array.isArray(accountsRaw) ? accountsRaw.filter((item): item is string => typeof item === 'string') : []
        setWallet(accounts[0] ?? '')
        setChainId(normalizeChainId(chainRaw))
      }).catch(() => undefined)
    } else {
      setWallet('')
      setChainId(null)
    }

    const onAccounts = (...args: unknown[]) => {
      if (manuallyDisconnected.current) return
      const accounts = Array.isArray(args[0]) ? args[0].filter((item): item is string => typeof item === 'string') : []
      sessionGeneration.current += 1
      setActivities([])
      setWallet(accounts[0] ?? '')
    }
    const onChain = (...args: unknown[]) => {
      if (!manuallyDisconnected.current) setChainId(normalizeChainId(args[0]))
    }
    ethereum.on?.('accountsChanged', onAccounts)
    ethereum.on?.('chainChanged', onChain)
    return () => {
      mounted = false
      ethereum.removeListener?.('accountsChanged', onAccounts)
      ethereum.removeListener?.('chainChanged', onChain)
    }
  }, [selectedProvider])

  const storageKey = useMemo(() => wallet && PRICEGUARD_V2_ADDRESS
    ? activityNamespace(CHAIN_ID, PRICEGUARD_V2_ADDRESS, wallet)
    : '', [wallet])

  const storeActivities = useCallback((updater: (current: Activity[]) => Activity[]) => {
    setActivities(current => {
      const next = updater(current)
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Activity remains available for this tab. */ }
      }
      return next
    })
  }, [storageKey])

  const connect = useCallback(async (providerId?: string) => {
    if (connectionRequestInFlight.current) throw new Error('A wallet connection request is already open.')
    const options = providerOptionsRef.current
    const option = providerId
      ? options.find(item => item.id === providerId)
      : options.find(item => item.id === selectedProviderId)
    if (!option) throw new Error(providerId ? 'That wallet is no longer available. Choose another detected wallet.' : 'No injected wallet was detected.')
    setSelectedProviderId(option.id)
    setSelectedProvider(option.provider)
    connectionRequestInFlight.current = true
    setConnecting(true)
    try {
      const accountsRaw = await option.provider.request({ method: 'eth_requestAccounts' })
      const accounts = Array.isArray(accountsRaw) ? accountsRaw.filter((item): item is string => typeof item === 'string') : []
      if (!accounts[0]) throw new Error('Wallet did not return an account.')
      const nextChainId = normalizeChainId(await option.provider.request({ method: 'eth_chainId' }))
      manuallyDisconnected.current = false
      localStorage.removeItem('priceguard:manually-disconnected')
      sessionGeneration.current += 1
      setActivities([])
      setWallet(accounts[0])
      setChainId(nextChainId)
    } finally {
      connectionRequestInFlight.current = false
      setConnecting(false)
    }
  }, [selectedProviderId])

  const disconnect = useCallback(() => {
    manuallyDisconnected.current = true
    localStorage.setItem('priceguard:manually-disconnected', 'true')
    sessionGeneration.current += 1
    setWallet('')
    setChainId(null)
    setActivities([])
  }, [])

  const selectProvider = useCallback((id: string) => {
    const option = providerOptionsRef.current.find(item => item.id === id)
    if (option) {
      setSelectedProviderId(option.id)
      setSelectedProvider(option.provider)
    }
  }, [])

  const switchNetwork = useCallback(async () => {
    if (!selectedProvider) throw new Error('No injected wallet was detected.')
    if (!wallet) await connect()
    const currentWallet = wallet || String((await selectedProvider.request({ method: 'eth_accounts' }) as string[])[0] ?? '')
    if (!currentWallet) throw new Error('Connect an injected wallet first.')
    const client = await createWriteClient(selectedProvider, currentWallet)
    await client.connect('testnetBradbury')
    setChainId(normalizeChainId(await selectedProvider.request({ method: 'eth_chainId' })))
  }, [connect, selectedProvider, wallet])

  useEffect(() => {
    if (!storageKey) { setActivities([]); return }
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
      setActivities(Array.isArray(parsed) ? parsed.filter(isActivity) : [])
    } catch { setActivities([]) }
  }, [storageKey])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return
      try {
        const parsed: unknown = JSON.parse(event.newValue)
        const incoming = Array.isArray(parsed) ? parsed.filter(isActivity) : []
        setActivities(current => mergeActivity(current, incoming) as Activity[])
      } catch { /* Ignore corrupt cross-tab data. */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const poll = useCallback(async (activity: Activity) => {
    if (pollers.current.has(activity.hash) || !PRICEGUARD_V2_ADDRESS) return
    const generation = sessionGeneration.current
    pollers.current.add(activity.hash)
    try {
      const client = await createReadClient()
      const tx = await client.getTransaction({ hash: activity.hash })
      const classification = classifyTransaction(tx) as Pick<Activity, 'phase' | 'terminal'>
      let stateCheckUpdate: Partial<Activity> = {}
      if (classification.phase === 'CONFIRMED') stateCheckUpdate = await checkPostState(client, PRICEGUARD_V2_ADDRESS, activity)
      if (generation !== sessionGeneration.current) return
      storeActivities(current => mergeActivity(current, [{
        ...activity,
        ...classification,
        ...stateCheckUpdate,
        error: undefined,
        updatedAt: Date.now(),
      }]) as Activity[])
    } catch (error) {
      if (generation !== sessionGeneration.current) return
      storeActivities(current => mergeActivity(current, [{
        ...activity,
        phase: 'UNKNOWN_RETRYABLE',
        terminal: false,
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Transaction polling is temporarily unavailable.',
      }]) as Activity[])
    } finally {
      pollers.current.delete(activity.hash)
    }
  }, [storeActivities])

  useEffect(() => {
    const unfinished = activities.filter(item => !item.terminal)
    if (!unfinished.length) return
    const tick = () => unfinished.forEach(item => void poll(item))
    const initial = window.setTimeout(tick, 250)
    const interval = window.setInterval(tick, 6_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [activities, poll])

  const isPending = useCallback((action: string, covenantId?: string) => activities.some(item =>
    !item.terminal && item.action === action && (covenantId === undefined || item.covenantId === covenantId)
  ), [activities])

  const submit = useCallback(async (spec: SubmitSpec) => {
    if (!PRICEGUARD_V2_ADDRESS) throw new Error('PriceGuard V2 is not deployed or configured.')
    if (!wallet || !selectedProvider) throw new Error('Connect an injected wallet first.')
    if (chainId !== CHAIN_ID) throw new Error('Switch to Bradbury (chain 4221) before writing.')
    if (isPending(spec.action, spec.covenantId)) throw new Error('This action already has an unfinished transaction. It will not be resubmitted.')

    const readClient = await createReadClient()
    const prepared = await prepareSubmission(readClient, PRICEGUARD_V2_ADDRESS, spec, wallet)
    const writeClient = await createWriteClient(selectedProvider, wallet)
    await writeClient.connect('testnetBradbury')
    const currentChain = normalizeChainId(await selectedProvider.request({ method: 'eth_chainId' }))
    if (currentChain !== CHAIN_ID) throw new Error('Wallet did not switch to Bradbury chain 4221.')

    const hash = await writeClient.writeContract({
      address: PRICEGUARD_V2_ADDRESS,
      functionName: spec.functionName,
      args: spec.args,
      value: 0n,
    })
    const activity: Activity = {
      hash,
      chainId: CHAIN_ID,
      contract: PRICEGUARD_V2_ADDRESS,
      wallet,
      action: spec.action,
      functionName: spec.functionName,
      phase: 'SUBMITTED',
      submittedAt: Date.now(),
      updatedAt: Date.now(),
      terminal: false,
      covenantId: spec.covenantId,
      expectedCovenantId: prepared.expectedCovenantId,
      submittedCreateTerms: prepared.submittedCreateTerms,
      stateCheck: 'NOT_RUN',
    }
    storeActivities(current => mergeActivity(current, [activity]) as Activity[])
    return hash
  }, [chainId, isPending, selectedProvider, storeActivities, wallet])

  const injectedProviders = useMemo(() => injectedProviderOptions.map(({ id, name, icon, rdns }) => ({ id, name, icon, rdns })), [injectedProviderOptions])

  return <Context.Provider value={{ wallet, chainId, providerAvailable, injectedProviders, selectedProviderId, connecting, activities, connect, disconnect, selectProvider, switchNetwork, submit, isPending }}>{children}</Context.Provider>
}

export const useTransactions = () => useContext(Context)
