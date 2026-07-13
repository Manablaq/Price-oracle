import { stateTone } from '@/lib/priceguard-core.mjs'

export function StatusBadge({ state }: { state: string }) {
  return <span className={`status ${stateTone(state)}`}>{state.replaceAll('_', ' ')}</span>
}
