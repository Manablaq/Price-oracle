import { CovenantDetailView } from '@/components/CovenantDetailView'
export default async function CovenantDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <div className="page-width page-top"><CovenantDetailView id={id} /></div> }
