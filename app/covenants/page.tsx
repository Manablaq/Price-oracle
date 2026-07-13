import { CovenantList } from '@/components/CovenantList'
import Link from 'next/link'
export default function CovenantsPage() { return <div className="page-width page-top"><div className="page-heading-row"><div className="page-title"><span className="eyebrow">NON-CUSTODIAL REGISTRY</span><h1>Market covenants</h1><p className="lead small">Create and monitor independently verified market conditions. PriceGuard never holds or transfers funds.</p></div><Link className="button primary" href="/covenants/new">Create covenant</Link></div><CovenantList /></div> }
