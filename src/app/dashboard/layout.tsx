import { Suspense, type ReactNode } from 'react'
import { auth } from '@/lib/auth/server'
import { ComplianceGate } from './compliance-gate'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return children
  return <Suspense fallback={null}><ComplianceGate userId={session.user.id}>{children}</ComplianceGate></Suspense>
}
