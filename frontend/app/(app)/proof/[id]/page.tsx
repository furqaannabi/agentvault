import { ProofExplorer } from '@/components/proof/ProofExplorer'

export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProofExplorer proofId={id} />
}
