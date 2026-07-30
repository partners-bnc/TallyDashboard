import { redirect } from 'next/navigation'
import { LedgerDetail } from '@/components/ledger-detail'

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ org?: string; company?: string; ledger?: string }> }) {
  const params = await searchParams
  
  const orgId = params.org ?? null
  const companyId = params.company
  const ledgerId = params.ledger

  // If critical parameters are missing, redirect to dashboard onboarding
  if (!companyId || !ledgerId) {
    const search = new URLSearchParams()
    if (orgId) search.set('org', orgId)
    redirect(`/dashboard?${search.toString()}`)
  }

  return (
    <LedgerDetail 
      orgId={orgId} 
      companyId={companyId} 
      ledgerId={ledgerId} 
    />
  )
}
