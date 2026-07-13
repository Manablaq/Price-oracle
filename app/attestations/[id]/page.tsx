import { AttestationDetailView } from '@/components/AttestationDetailView'
export default async function AttestationDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <div className="page-width page-top"><AttestationDetailView id={id} /></div> }
