import {
  isCovenantResult,
  isMarketResult,
  parseContractJson,
  type Activity,
} from './types.ts'

export type PostStateReadClient = {
  readContract: (args: {
    address: `0x${string}`
    functionName: string
    args: Array<string | number>
  }) => Promise<unknown>
}

const readJson = async (client: PostStateReadClient, address: `0x${string}`, functionName: string, args: Array<string | number>) =>
  parseContractJson(await client.readContract({ address, functionName, args }))

export async function checkPostState(client: PostStateReadClient, address: `0x${string}`, activity: Activity) {
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
