import { Suspense, type ReactNode } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ComplianceGate } from './compliance-gate'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return children
  return <Suspense fallback={null}><ComplianceGate userId={user.id}>{children}</ComplianceGate></Suspense>
}
