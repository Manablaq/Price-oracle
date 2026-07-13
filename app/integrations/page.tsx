import { PRICEGUARD_V2_ADDRESS } from '@/lib/config'

export default function IntegrationsPage() {
  return <div className="page-width page-top prose-page">
    <div className="page-title"><span className="eyebrow">INTEGRATIONS</span><h1>Consume PriceGuard evidence</h1><p className="lead small">External agents, treasuries, marketplaces, and business systems can read canonical contract state and decide their own actions. PriceGuard itself remains non-custodial.</p></div>
    <section className="panel"><h2>Read an attestation</h2><pre className="code-block">{`const raw = await client.readContract({
  address: '${PRICEGUARD_V2_ADDRESS ?? '0x<V2_ADDRESS>'}',
  functionName: 'get_attestation',
  args: ['att_<48 lowercase hex>'],
})
const result = JSON.parse(String(raw))
if (result.found && result.outcome === 'SATISFIED') {
  // Apply your own policy. Do not treat this as a payment receipt.
}`}</pre></section>
    <section className="panel"><h2>Canonical evidence fields</h2><p>Verify the attestation ID, covenant ID, evaluation sequence, outcome, symbol, condition, thresholds, evaluated price, source identities, confidence, spread, policy version, timestamp, and evaluator. Reject unknown schema versions or extra/missing fields.</p></section>
    <section className="panel"><h2>Index retention</h2><p>Exact attestation records grow monotonically and remain addressable by ID. The global discovery index retains the newest 256 IDs, while each covenant’s history index retains its newest 32 evaluation IDs. Store IDs you rely on rather than assuming they will remain discoverable through retained indexes.</p></section>
    <section className="panel danger-panel"><h2>Integration boundary</h2><p>An attestation is evidence, not legal advice, a custody guarantee, a transfer, or an automatic external action. Your integration must define authorization, replay protection, error handling, policy-version acceptance, and consequences independently.</p></section>
  </div>
}
