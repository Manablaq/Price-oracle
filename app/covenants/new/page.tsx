import { NewCovenantForm } from '@/components/NewCovenantForm'
import Link from 'next/link'
export default function NewCovenantPage() { return <div className="page-width page-top"><Link className="back-link" href="/covenants">← Back to covenants</Link><div className="page-title"><span className="eyebrow">COVENANT AUTHORING</span><h1>Create a covenant</h1><p className="lead small">Define a market condition and publish a verifiable risk attestation. No GEN amount or payment is requested.</p></div><NewCovenantForm /></div> }
